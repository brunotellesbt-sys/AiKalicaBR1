import {
  Army,
  Character,
  Choice,
  ChronicleEntry,
  GameState,
  Gender,
  HouseState,
  Location,
  Mission,
  RenownTier,
  Tournament,
  TournamentReason,
  TournamentSize,
} from '../models';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { genFirstName, maybeEpithet } from './names';
import {
  pushSystem, pushNarration, pushNpc, pushChronicle, setGameOver, setVictory,
} from './narration';
import {
  renownFromMartial, titleForHouse, deathChanceByAge, econTierGold,
  armyPower, computeArmyPower, armyMassCount, foodNeedMin,
  prestigeToTournamentSize, categoriesForSize, applyArmyLoss,
} from './rules';
import {
  CANON_DIVERGENCE_THRESHOLD, canonTouchScore, canonIsDiverged,
  markCanonTouched, tickCanonDivergenceDecay, markCanonDeathBypassed,
  canonTouchIfCanonical, canonCharId, ensureCanonDefaults,
} from './canon-divergence';
import {
  addClaim, registerMarriageClaims, registerBirthClaims, claimsOnSeat,
  ensureOccupations, occupySeat, releaseSeat, tickOccupations,
} from './claims';
import {
  openSuccessionCrisis, pretenderLabel, tickSuccessionCrises, activeSuccessionCrises,
  computeSuccessor, handleDeathImmediate, handlePlayerDeath, survivedOwnCanonDeath,
} from './succession';
import {
  tickEconomyAll, tickRumors, tickIronBank, pickMany,
} from './economy';
import {
  isFertileFemale, isAdultMale, beginPregnancy, tickArrangedMarriages,
  tickConceptions, tickPregnancies, spawnChild, tickPersonalProgression,
  tickAgesAndDeaths,
} from './lifecycle';
import {
  availableCasusBelli, casusBelliLabel, declareWar, endWar,
  tickWars, warsOf, warBetween, activeWars, sideOf,
} from './warfare';
import { SCHEDULED_EVENTS } from '../data/timeline';
import {
  CANON_EVENTS,
  CANON_PEOPLE,
  CANON_EVENT_ONLY_PEOPLE,
  CANON_LEADER_MANDATES,
  CANON_WARS,
  absTurn,
  CanonEventDef,
  CanonLeaderMandate,
  CanonPersonDef,
  CanonRequires,
  CanonWarDef,
} from '../data/canon';
import { SuccessionCrisis, CrisisPretender, PretenderBasis, SeatClaim, Occupation } from '../models';

// Reexporta o que a UI e os testes já consumiam por este módulo.
export { renownFromMartial, titleForHouse } from './rules';
export { CANON_DIVERGENCE_THRESHOLD } from './canon-divergence';
export { handlePlayerDeath, activeSuccessionCrises, pretenderLabel } from './succession';
export { activeWars, warsOf, casusBelliLabel } from './warfare';

export interface NewGameParams {
  playerHouseId: string;
  gender: Gender;
}

const RENOWN_ORDER: RenownTier[] = ['comum', 'forte', 'reconhecido', 'imponente', 'renomado'];

// --- Endgame (Gelo & Fogo) ---
// Por padrão, usamos a convenção popular de datas: eventos do fim da série em 304–305 DC.
// (Brecha na Muralha ~ 304; queda/incêndio de Porto Real ~ 305.)
const ENDGAME_WALL_YEAR = 304;
const ENDGAME_WALL_TURN = 20;
const ENDGAME_DANY_YEAR = 305;
const ENDGAME_DANY_TURN = 2;
const ENDGAME_BURN_YEAR = 305;
const ENDGAME_BURN_TURN = 12;

// -----------------------
// Canon (história real)
// -----------------------


const CANON_INDEX: Record<string, CanonPersonDef> = (() => {
  const all = [...CANON_PEOPLE, ...CANON_EVENT_ONLY_PEOPLE];
  const idx: Record<string, CanonPersonDef> = {};
  for (const p of all) idx[p.canonId] = p;
  return idx;
})();

/**
 * Normalização do dataset.
 *
 * Boa parte dos marcos de morte/nascimento foi escrita como `kind: 'chronicle'`
 * com `personCanonId`. Nesse formato o motor publicava o texto ("Morre X") sem
 * consultar se a morte realmente aconteceu — então um personagem salvo pelo
 * jogador aparecia morto na crônica e vivo no mapa. Aqui promovemos esses
 * eventos para o tipo correto, de modo que exista um único caminho de execução.
 */
function normalizeCanonEvent(e: CanonEventDef): CanonEventDef {
  if (e.kind === 'chronicle' && e.personCanonId) {
    if (e.tags?.includes('death')) return { ...e, kind: 'death' };
    if (e.tags?.includes('birth')) return { ...e, kind: 'birth' };
  }
  return e;
}

export const CANON_EVENTS_ALL: CanonEventDef[] = CANON_EVENTS.map(normalizeCanonEvent);

// Usado para evitar duplicar entradas quando já existe um evento canônico explícito
// de nascimento/morte para a mesma pessoa no mesmo turno.
const CANON_MANUAL_BIRTH_KEYS = new Set<string>();
const CANON_MANUAL_DEATH_KEYS = new Set<string>();
for (const e of CANON_EVENTS_ALL) {
  if (!e.personCanonId) continue;
  const key = `${e.personCanonId}:${absTurn(e.year, e.turn)}`;
  if (e.kind === 'birth') CANON_MANUAL_BIRTH_KEYS.add(key);
  if (e.kind === 'death') CANON_MANUAL_DEATH_KEYS.add(key);
}

// Divergência canônica por interferência do jogador.
// Ideia: pequenas interações registram "toque" mas só ações fortes (ex.: casamento)
// desativam forçamentos (morte/mandatos) automaticamente.

const ANCHOR_HOUSE_IDS = new Set<string>([
  'targaryen_throne',
  'stark',
  'lannister',
  'baratheon',
  'tyrell',
  'arryn',
  'tully',
  'martell',
  'greyjoy',
]);

/**
 * "Âncora" precisa ser raro para o modo significar alguma coisa.
 *
 * A regra anterior classificava 91% das pessoas como âncora (bastava pertencer
 * a uma Grande Casa), então strict e anchors produziam praticamente o mesmo
 * mundo. Agora âncora é apenas quem senta em um trono/assento regional.
 */
function isAnchorPerson(def: CanonPersonDef): boolean {
  if (def.title && /^(Rei|Rainha)\b/i.test(def.title)) return true;
  if (def.currentHouseId === 'targaryen_dany') return true;
  if (def.title && /Lorde de|Senhor de|Príncipe de Dorne/i.test(def.title) && ANCHOR_HOUSE_IDS.has(def.currentHouseId)) {
    return true;
  }
  return false;
}

export function isAnchorCanonEvent(e: CanonEventDef): boolean {
  const tags = e.tags ?? [];
  if (tags.includes('anchor')) return true;

  // Marcos estruturais: guerras, trocas de trono e o fim da era.
  const major = ['war', 'rebellion', 'throne', 'endgame'];
  if (tags.some(t => major.includes(t))) return true;

  // Sucessões só contam quando envolvem uma âncora de fato.
  if (e.kind === 'succession' || e.kind === 'dynasty_shift') {
    const def = e.newLeaderCanonId ? CANON_INDEX[e.newLeaderCanonId] : undefined;
    return !!def && isAnchorPerson(def);
  }

  if (e.personCanonId) {
    const def = CANON_INDEX[e.personCanonId];
    if (def && isAnchorPerson(def)) return true;
  }
  return false;
}


function houseAliveCount(state: GameState, houseId: string, excludeId?: string): number {
  return Object.values(state.characters).filter(
    c => c.alive && c.currentHouseId === houseId && c.id !== excludeId
  ).length;
}

function canApplyCanonBirthNow(state: GameState, rng: Rng, def: CanonPersonDef): boolean {
  // Se não há pais registrados, permitimos.
  if (!def.fatherCanonId && !def.motherCanonId) return true;

  if (!def.fatherCanonId || !def.motherCanonId) return false;

  const father = ensureCanonPerson(state, rng, def.fatherCanonId, state.date.year, state.date.turn);
  const mother = ensureCanonPerson(state, rng, def.motherCanonId, state.date.year, state.date.turn);
  if (!father || !mother) return false;
  if (!father.alive || !mother.alive) return false;

  // Se algum dos pais está casado com outra pessoa (ex.: o jogador), o nascimento canônico não é forçado.
  if (father.maritalStatus === 'married' && father.spouseId !== mother.id) return false;
  if (mother.maritalStatus === 'married' && mother.spouseId !== father.id) return false;

  return true;
}

function queuePendingBirth(state: GameState, canonId: string, desiredAbsTurn: number): void {
  ensureCanonDefaults(state);
  const key = `birth:${canonId}`;
  const pending = state.canon!.pendingBirths!;
  if (pending[key]) return;
  // janela de 5 anos (~100 turnos)
  pending[key] = {
    desiredAbsTurn,
    expireAbsTurn: desiredAbsTurn + 100,
  };
}

function tryApplyOrQueueCanonBirth(state: GameState, rng: Rng, def: CanonPersonDef, desiredAbsTurn: number): void {
  const nowAbs = state.date.absoluteTurn;
  if (state.characters[canonCharId(def.canonId)]) return;

  if (canApplyCanonBirthNow(state, rng, def)) {
    // Se chegou depois do desejado, consideramos "nascimento tardio" e ajustamos idade para 0.
    const c = ensureCanonPerson(state, rng, def.canonId, state.date.year, state.date.turn);
    if (c) {
      if (nowAbs > desiredAbsTurn) {
        c.ageYears = 0;
        pushNarration(state, `👶 ${c.name} nasce mais tarde do que o registro canônico (divergência).`);
        pushChronicle(state, {
          absTurn: nowAbs,
          title: `Nascimento tardio: ${c.name}`,
          body: `${c.name} nasce fora do turno canônico, devido a mudanças no mundo.`,
          tags: ['canon', 'birth', 'divergence'],
        });
      }
    }
  } else {
    // Não foi possível: agenda para tentar depois.
    queuePendingBirth(state, def.canonId, desiredAbsTurn);
  }
}

function processPendingCanonBirths(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  const pending = state.canon!.pendingBirths!;
  const nowAbs = state.date.absoluteTurn;

  for (const [key, item] of Object.entries(pending)) {
    if (!item) continue;
    if (item.lastAttemptAbsTurn === nowAbs) continue;
    item.lastAttemptAbsTurn = nowAbs;

    const canonId = key.replace(/^birth:/, '');
    const def = CANON_INDEX[canonId];
    if (!def) {
      delete pending[key];
      continue;
    }

    // Expirou: nascimento perdido.
    if (nowAbs > item.expireAbsTurn) {
      delete pending[key];
      pushChronicle(state, {
        absTurn: nowAbs,
        title: `Nascimento perdido: ${def.name}`,
        body: `O nascimento registrado não ocorreu dentro da janela possível após as mudanças do mundo.`,
        tags: ['canon', 'birth', 'divergence'],
      });
      continue;
    }

    // Só tenta depois do turno desejado.
    if (nowAbs < item.desiredAbsTurn) continue;

    if (canApplyCanonBirthNow(state, rng, def)) {
      const c = ensureCanonPerson(state, rng, def.canonId, state.date.year, state.date.turn);
      if (c) {
        // nascimento tardio: zera idade
        c.ageYears = 0;
        pushNarration(state, `👶 ${c.name} finalmente nasce (tardio).`);
        delete pending[key];
      }
    }
  }
}


function resolveCanonAbsTurn(
  state: GameState,
  rng: Rng,
  key: string,
  yearMin: number,
  yearMax: number,
  turn: number
): number {
  ensureCanonDefaults(state);
  const existing = state.canon!.resolvedAbsTurns?.[key];
  if (typeof existing === 'number') return existing;

  // Em modo "strict", preferimos um ponto fixo (meio do intervalo) para manter
  // previsibilidade. Em "anchors", sorteamos dentro do intervalo para variar.
  const y = (() => {
    if (yearMin === yearMax) return yearMin;
    if (state.canon!.mode === 'strict') return yearMin + Math.floor((yearMax - yearMin) / 2);
    return rng.int(yearMin, yearMax);
  })();
  const abs = absTurn(y, turn);
  state.canon!.resolvedAbsTurns![key] = abs;
  return abs;
}

function canonBirthAbsTurn(state: GameState, rng: Rng, def: CanonPersonDef): number | null {
  const turn = def.birthTurn ?? 10;
  if (typeof def.birthYear === 'number') return absTurn(def.birthYear, turn);
  if (typeof def.birthYearMin === 'number' && typeof def.birthYearMax === 'number') {
    return resolveCanonAbsTurn(state, rng, `birth:${def.canonId}`, def.birthYearMin, def.birthYearMax, turn);
  }
  return null;
}

function canonDeathAbsTurn(state: GameState, rng: Rng, def: CanonPersonDef): number | null {
  const turn = def.deathTurn ?? 10;
  if (typeof def.deathYear === 'number') return absTurn(def.deathYear, turn);
  if (typeof def.deathYearMin === 'number' && typeof def.deathYearMax === 'number') {
    return resolveCanonAbsTurn(state, rng, `death:${def.canonId}`, def.deathYearMin, def.deathYearMax, turn);
  }
  return null;
}

function ensureCanonPerson(state: GameState, rng: Rng, canonId: string, year: number, turn: number): Character | null {
  const def = CANON_INDEX[canonId];
  if (!def) return null;
  const id = canonCharId(canonId);
  const existing = state.characters[id];
  if (existing) return existing;

  const birthHouseId = def.birthHouseId ?? def.currentHouseId;

  // Respeita nascimento (inclusive quando for um intervalo). Se ainda não nasceu, não cria.
  const nowAbs = absTurn(year, turn);
  const birthAbs = canonBirthAbsTurn(state, rng, def);
  if (typeof birthAbs === 'number' && nowAbs < birthAbs) return null;

  // Nascimentos canônicos devem respeitar mudanças reais do mundo.
  // Se o nascimento não for possível (pai/mãe mortos ou casados com outra pessoa), não criamos.
  if (def.fatherCanonId && def.motherCanonId) {
    if (!canApplyCanonBirthNow(state, rng, def)) return null;
  }

  // idade aproximada (anos inteiros) — suficiente para regras de fertilidade/maioridade
  const ageYears = (() => {
    if (typeof birthAbs !== 'number') return 18;
    const raw = (nowAbs - birthAbs) / 20;
    return Math.max(0, Math.floor(raw));
  })();

  const martial = clamp(rng.int(35, 70) + (def.title?.includes('Rei') ? 8 : 0), 0, 100);
  const charm = clamp(rng.int(30, 70) + (def.title?.includes('Rei') ? 6 : 0), 0, 100);
  const beauty = clamp(rng.int(25, 70), 0, 100);
  const wellLiked = clamp(rng.int(30, 75), 0, 100);
  const personalPrestige = clamp(rng.int(35, 75) + (def.title?.includes('Rei') ? 18 : 0), 0, 100);

  const c: Character = {
    id,
    name: def.name,
    gender: def.gender,
    ageYears,
    alive: true,
    birthHouseId,
    currentHouseId: def.currentHouseId,
    maritalStatus: 'single',
    keepsBirthName: def.birthHouseId ? true : false,
    locationId: def.locationId ?? 'kings_landing',
    martial,
    charm,
    beauty,
    wellLiked,
    personalPrestige,
    renownTier: renownFromMartial(martial),
    fertility: rng.chance(0.03) ? 'sterile' : 'fertile',
    knownToPlayer: false,
    relationshipToPlayer: 0,
    personalGold: rng.int(40, 120),
    kissedIds: [],
    title: def.title,

    isCanonical: true,
    canonId: def.canonId,
    canonBirthYear: def.birthYear,
    canonDeathYear: def.deathYear,
    canonDeathAbsTurn: canonDeathAbsTurn(state, rng, def) ?? undefined,
  };

  // vínculos (se existir)
  if (def.fatherCanonId) c.fatherId = canonCharId(def.fatherCanonId);
  if (def.motherCanonId) c.motherId = canonCharId(def.motherCanonId);

  state.characters[c.id] = c;

  // casamento (se o cônjuge já existir)
  if (def.spouseCanonId) {
    const sp = ensureCanonPerson(state, rng, def.spouseCanonId, year, turn);
    if (sp && sp.alive) {
      // Não sobrescreve casamento já estabelecido (ex.: jogador casou antes)
      if (c.spouseId && c.spouseId !== sp.id) return c;
      if (sp.spouseId && sp.spouseId !== c.id) return c;

      // Se um dos dois já divergiu por interferência do jogador, não forçamos o casamento canônico.
      if ((c.canonId && canonIsDiverged(state, c.canonId)) || (sp.canonId && canonIsDiverged(state, sp.canonId))) {
        return c;
      }

      c.spouseId = sp.id;
      sp.spouseId = c.id;
      c.maritalStatus = 'married';
      sp.maritalStatus = 'married';
    }
  }

  return c;
}

function killCanonCharacter(state: GameState, rng: Rng, canonId: string, reason: string, silent: boolean = false): boolean {
  const c = ensureCanonPerson(state, rng, canonId, state.date.year, state.date.turn);
  if (!c || !c.alive) return false;

  // Se o jogador alterou a rota desse personagem, o motor não força a morte canônica.
  if (c.canonId && canonIsDiverged(state, c.canonId)) {
    markCanonDeathBypassed(state, c.canonId);
    if (!silent) {
      pushNarration(state, `⚠️ Destino divergente: ${c.name} não morre no turno canônico (${reason}).`);
    }
    return false;
  }

  c.alive = false;
  if (c.maritalStatus === 'married') c.maritalStatus = 'widowed';

  // viúvo(a) volta ao sobrenome de nascimento conforme regra
  if (c.spouseId) {
    const spouse = state.characters[c.spouseId];
    if (spouse && spouse.alive) {
      spouse.maritalStatus = 'widowed';
      if (spouse.gender === 'F' && spouse.birthHouseId !== spouse.currentHouseId) {
        spouse.currentHouseId = spouse.birthHouseId;
        spouse.keepsBirthName = true;
      }
    }
  }

  if (!silent) pushNarration(state, `⚰️ ${c.name} morre (${reason}).`);

  // Se era líder de casa, resolve sucessão (aqui a canon vai normalmente ditar o sucessor)
  for (const h of Object.values(state.houses)) {
    if (h.leaderId === c.id) {
      const succ = computeSuccessor(state, rng, h.id);
      if (succ) {
        h.leaderId = succ.id;
        succ.title = titleForHouse(h.id, succ.gender);
        pushNarration(state, `👑 ${succ.name} torna-se líder de ${h.name}.`);
      }
    }
  }

  return true;
}


/** Avalia as pré-condições de um evento contra o estado real do mundo. */
function canonRequiresSatisfied(state: GameState, req?: CanonRequires): { ok: boolean; why?: string } {
  if (!req) return { ok: true };

  for (const id of req.aliveCanonIds ?? []) {
    const c = state.characters[canonCharId(id)];
    if (!c || !c.alive) {
      return { ok: false, why: `${CANON_INDEX[id]?.name ?? id} não está vivo para isso` };
    }
  }

  for (const id of req.deadCanonIds ?? []) {
    const c = state.characters[canonCharId(id)];
    // Quem nunca existiu no mundo não bloqueia nada.
    if (c && c.alive) return { ok: false, why: `${c.name} continua vivo` };
  }

  const lo = req.leaderOf;
  if (lo) {
    const h = state.houses[lo.houseId];
    const c = state.characters[canonCharId(lo.canonId)];
    if (!h || !c || !c.alive || h.leaderId !== c.id) {
      const who = CANON_INDEX[lo.canonId]?.name ?? lo.canonId;
      return { ok: false, why: `${who} não lidera ${h?.name ?? lo.houseId}` };
    }
  }

  return { ok: true };
}

/** Publica a variante alternativa quando o cânone não pôde acontecer. */
function publishCanonDivergence(state: GameState, e: CanonEventDef, why?: string): void {
  const title = e.altTitle ?? `${e.title} (não aconteceu)`;
  const body = e.altBody
    ?? `O registro previa: “${e.body}” — mas o mundo mudou${why ? ` (${why})` : ''}.`;

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title,
    body,
    tags: Array.from(new Set([...(e.tags ?? []), 'divergence'])),
  });
  pushNarration(state, `📜 ${title}: ${body}`);
}

/**
 * Se o assento visado pelo evento ainda está ocupado por alguém que deveria
 * ter morrido, abre a disputa e devolve `true` (o evento não se aplica).
 */
/**
 * Um assento que o cânone não tem direito de reatribuir em silêncio.
 *
 * Vale para quem sobreviveu à própria morte registrada e, principalmente,
 * para o próprio jogador: a rajada de sincronização de 298 instalava os
 * senhores canônicos de oito Casas de uma vez e podia tirar do jogador, sem
 * uma linha de aviso, um assento conquistado ao longo de 148 anos de campanha.
 * A presença dele ali já É uma divergência — então vira disputa, não decreto.
 */
function seatIsContested(state: GameState, incumbent: Character | undefined): boolean {
  if (!incumbent || !incumbent.alive) return false;
  if (incumbent.id === state.playerId) return true;
  return survivedOwnCanonDeath(state, incumbent);
}

function maybeOpenCrisisForSuccession(state: GameState, rng: Rng, e: CanonEventDef): boolean {
  if (e.kind !== 'succession' && e.kind !== 'dynasty_shift') return false;
  if (!e.newLeaderCanonId) return false;

  const houseId = e.houseId ?? Object.values(state.houses).find(x => x.isIronThrone)?.id;
  const house = houseId ? state.houses[houseId] : undefined;
  if (!house) return false;

  const incumbent = state.characters[house.leaderId];
  if (!seatIsContested(state, incumbent)) return false;

  const claimant = ensureCanonPerson(state, rng, e.newLeaderCanonId, e.year, e.turn);
  if (!claimant || !claimant.alive || claimant.id === incumbent.id) return false;

  // Disputa já decidida em favor do titular: o evento apenas registra que
  // a coroação prevista não aconteceu.
  const crisis = state.canon!.successionCrises?.[house.id];
  if (crisis && crisis.pretenders.some(p => p.characterId === incumbent.id)) return false;

  openSuccessionCrisis(state, house, incumbent, claimant, e);
  return true;
}

/**
 * Uma notícia chega ao jogador?
 *
 * Marcos do reino todo mundo ouve. Histórias de casas menores — uma rixa por
 * um moinho, um herdeiro que some, uma casa que enriquece rápido demais — só
 * chegam a quem está por perto ou tem laço com os envolvidos. Sem isso, o
 * chat vira um mural de fatos de famílias que o jogador nunca encontrou.
 */
function canonNewsReachesPlayer(state: GameState, e: CanonEventDef): boolean {
  const tags = e.tags ?? [];
  if (!tags.includes('local')) return true;

  const playerHouse = state.houses[state.playerHouseId];
  const player = state.characters[state.playerId];
  if (!playerHouse || !player) return true;

  const playerRegion = state.locations[player.locationId]?.regionId;

  if (e.regionId && (e.regionId === playerRegion || e.regionId === playerHouse.regionId)) return true;

  if (e.houseId) {
    if (e.houseId === playerHouse.id) return true;
    const other = state.houses[e.houseId];
    if (other) {
      if (other.regionId === playerRegion || other.regionId === playerHouse.regionId) return true;
      if (other.suzerainId === playerHouse.id || playerHouse.suzerainId === other.id) return true;
      if ((playerHouse.relations[other.id] ?? 50) >= 62) return true;
    }
  }

  return false;
}

function applyCanonEvent(state: GameState, rng: Rng, e: CanonEventDef): void {
  ensureCanonDefaults(state);
  if (state.canon!.appliedEventIds[e.id]) return;
  if (!state.canon!.enabled) return;

  // marca como aplicado antes (evita loops se algo der erro e reentrar)
  state.canon!.appliedEventIds[e.id] = true;

  // Caso especial, avaliado antes das pré-condições genéricas: quando o
  // titular sobreviveu à própria morte registrada, a coroação prevista não
  // "deixa de acontecer" — ela vira uma disputa aberta pelo assento.
  if (maybeOpenCrisisForSuccession(state, rng, e)) return;

  // Pré-condições: a história só se impõe se o mundo ainda a comporta.
  // É daqui que sai a cascata — impedir uma morte cancela a coroação seguinte,
  // que por sua vez cancela a guerra que aquele rei declararia.
  const req = canonRequiresSatisfied(state, e.requires);
  if (!req.ok) {
    publishCanonDivergence(state, e, req.why);
    return;
  }

  switch (e.kind) {
    case 'chronicle': {
      state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
      if (canonNewsReachesPlayer(state, e)) {
        pushNarration(state, `📜 ${e.title}: ${e.body}`);
      }
      break;
    }
    case 'birth': {
      if (!e.personCanonId) break;
      const desired = absTurn(e.year, e.turn);
      const def = CANON_INDEX[e.personCanonId];
      if (def) {
        tryApplyOrQueueCanonBirth(state, rng, def, desired);
      } else {
        ensureCanonPerson(state, rng, e.personCanonId, e.year, e.turn);
      }
      const created = state.characters[canonCharId(e.personCanonId)];
      if (created && created.ageYears === 0) {
        created.locationId = CANON_INDEX[e.personCanonId]?.locationId ?? created.locationId;
        state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
        pushNarration(state, `👶 ${e.title}: ${created.name}.`);
      } else {
        state.chronicle.unshift({
          turn: state.date.absoluteTurn,
          title: `${e.title} (adiado)`,
          body: `As condições para este nascimento não existem agora. O destino tenta se ajustar.`,
          tags: Array.from(new Set([...(e.tags ?? []), 'divergence'])),
        });
      }
      break;
    }
    case 'death': {
      if (!e.personCanonId) break;
      const killed = killCanonCharacter(state, rng, e.personCanonId, e.body);
      if (killed) {
        state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
      } else {
        state.chronicle.unshift({
          turn: state.date.absoluteTurn,
          title: `${e.title} (destino divergente)`,
          body: `O registro indica que ${e.body}, mas mudanças no mundo impedem esse desfecho agora.`,
          tags: Array.from(new Set([...(e.tags ?? []), 'divergence'])),
        });
      }
      break;
    }
    case 'succession': {
      if (!e.houseId || !e.newLeaderCanonId) break;
      const h = state.houses[e.houseId];
      if (!h) break;

      const leader = ensureCanonPerson(state, rng, e.newLeaderCanonId, e.year, e.turn);
      if (!leader) break;

      // ensureCanonPerson devolve o personagem mesmo morto: sem esta checagem
      // o evento coroava um cadáver e a Casa ficava com um líder sem vida.
      if (!leader.alive) {
        publishCanonDivergence(state, e, `${leader.name} já está morto`);
        break;
      }

      // Se o jogador interferiu o suficiente com este personagem, não forçamos a sucessão.
      if (leader.canonId && canonIsDiverged(state, leader.canonId)) {
        state.chronicle.unshift({
          turn: state.date.absoluteTurn,
          title: `${e.title} (em aberto)`,
          body: `A sucessão canônica não é imposta porque o destino deste personagem divergiu por interferência do jogador.`,
          tags: Array.from(new Set([...(e.tags ?? []), 'divergence'])),
        });
        pushNarration(state, `👑 Sucessão em aberto: ${e.title}.`);
        break;
      }

      // Titular que sobreviveu à própria morte canônica não é deposto em
      // silêncio: instala-se uma crise sucessória com dois pretendentes.
      const incumbent = state.characters[h.leaderId];
      if (incumbent && incumbent.id !== leader.id && seatIsContested(state, incumbent)) {
        openSuccessionCrisis(state, h, incumbent, leader, e);
        break;
      }

      h.leaderId = leader.id;
      leader.title = titleForHouse(h.id, leader.gender);
      state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
      pushNarration(state, `👑 ${e.title}: ${leader.name}.`);
      break;
    }
    case 'dynasty_shift': {
      // Estes eventos descrevem a troca de dinastia no Trono de Ferro e, no
      // dataset, trazem apenas `dynasty`. O guard antigo exigia houseId E
      // newLeaderCanonId, então nenhum deles jamais executava.
      const houseId = e.houseId ?? Object.values(state.houses).find(x => x.isIronThrone)?.id;
      const h = houseId ? state.houses[houseId] : undefined;
      if (!h) break;

      if (e.newLeaderCanonId) {
        const leader = ensureCanonPerson(state, rng, e.newLeaderCanonId, e.year, e.turn);
        if (leader && leader.alive) {
          if (leader.canonId && canonIsDiverged(state, leader.canonId)) {
            state.chronicle.unshift({
              turn: state.date.absoluteTurn,
              title: `${e.title} (em aberto)`,
              body: `A mudança dinástica canônica não é imposta porque o destino do líder divergiu por interferência do jogador.`,
              tags: Array.from(new Set([...(e.tags ?? []), 'divergence'])),
            });
            pushNarration(state, `👑 Mudança dinástica em aberto: ${e.title}.`);
            break;
          }
          const incumbent = state.characters[h.leaderId];
          if (incumbent && incumbent.id !== leader.id && seatIsContested(state, incumbent)) {
            openSuccessionCrisis(state, h, incumbent, leader, e);
            break;
          }
          h.leaderId = leader.id;
          leader.title = titleForHouse(h.id, leader.gender);
        }
      }

      if (e.dynasty?.ironThroneHouseName) {
        h.name = e.dynasty.ironThroneHouseName;
      }
      state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
      pushNarration(state, `👑 ${e.title}: ${e.body}`);
      break;
    }
    case 'tournament': {
      if (!e.tournament) break;
      // cria um torneio fixo simples
      const tid = `canon_tourney_${e.year}_${e.turn}_${e.tournament.locationId}`;
      if (!state.tournaments.some(t => t.id === tid)) {
        const size: TournamentSize = 'importante';
        const reason: TournamentReason = 'outro';
        const t: Tournament = {
          id: tid,
          hostHouseId: e.tournament.hostHouseId ?? 'targaryen_throne',
          locationId: e.tournament.locationId,
          size,
          reason,
          announcedTurn: state.date.absoluteTurn,
          status: 'anunciado',
          categories: categoriesForSize(size),
        };
        state.tournaments.unshift(t);
      }
      state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
      pushNarration(state, `🏇 ${e.title}: ${e.body}`);
      break;
    }
  }
}


// -----------------------
// Crises sucessórias
// -----------------------
// Quando o jogador salva alguém da própria morte canônica, o sucessor histórico
// não assume mais em silêncio: os dois passam a disputar o assento, e as demais
// casas tomam partido. É aqui que "mudar a história" vira jogabilidade.

// Apoio a guerra em escala: antes havia um único pacote caro que rendia
// +1 num placar cujo prêmio final era ±2 de prestígio — ninguém usava duas vezes.
export type WarAidSize = 'small' | 'medium' | 'large';

const WAR_AID_COST: Record<WarAidSize, { goods: number; levies: number; points: number }> = {
  small: { goods: 25, levies: 40, points: 1 },
  medium: { goods: 60, levies: 110, points: 3 },
  large: { goods: 130, levies: 240, points: 7 },
};

const WAR_AID_TIERS: Array<[WarAidSize, string]> = [
  ['small', 'destacamento'],
  ['medium', 'hoste'],
  ['large', 'convocação geral'],
];

 // 3 anos


// -----------------------
// Reivindicações (claims)
// -----------------------


// -----------------------
// Ocupação de assentos
// -----------------------


/** O jogador escolhe um lado — o gesto político mais forte do jogo. */
/** O jogador escolhe um lado — o gesto político mais forte do jogo. */
export function applyCrisisAction(state: GameState, rng: Rng, cmd: string): void {
  ensureCanonDefaults(state);
  const sep = cmd.indexOf(':');
  const houseId = sep >= 0 ? cmd.slice(0, sep) : cmd;
  const targetId = sep >= 0 ? cmd.slice(sep + 1) : '';
  const crisis = state.canon!.successionCrises?.[houseId];

  if (!crisis || crisis.resolvedAbsTurn) {
    pushNarration(state, 'Não há crise sucessória em aberto nesta Casa.');
    return promptMainMenu(state, rng);
  }
  if (crisis.playerBackedId) {
    pushNarration(state, 'Você já escolheu um lado nesta disputa. Trocar de lado agora custaria sua palavra.');
    return promptMainMenu(state, rng);
  }

  const pick = crisis.pretenders.find(p => p.characterId === targetId);
  if (!pick) {
    pushNarration(state, 'Esse pretendente não está na disputa.');
    return promptMainMenu(state, rng);
  }

  const playerHouse = state.houses[state.playerHouseId];
  const cost = 60;
  if ((playerHouse.resources.goods ?? 0) < cost) {
    pushNarration(state, `Apoiar um pretendente exige ${cost} recursos para sustentar a causa.`);
    return promptMainMenu(state, rng);
  }
  playerHouse.resources.goods = (playerHouse.resources.goods ?? 0) - cost;

  crisis.playerBackedId = pick.characterId;
  pick.support = clamp(pick.support + 12, 0, 100);

  const backed = state.characters[pick.characterId];
  if (backed?.canonId) markCanonTouched(state, backed.canonId, 'crisis_support', 6);

  const target = state.houses[crisis.houseId];
  if (target) {
    target.relations[playerHouse.id] = clamp((target.relations[playerHouse.id] ?? 50) + 8, 0, 100);
  }

  // Tomar partido cria inimigos: cada rival preterido não esquece.
  for (const other of crisis.pretenders) {
    if (other.characterId === pick.characterId) continue;
    const rivalHouse = state.houses[other.houseId];
    if (rivalHouse && rivalHouse.id !== playerHouse.id) {
      rivalHouse.relations[playerHouse.id] = clamp((rivalHouse.relations[playerHouse.id] ?? 50) - 10, 0, 100);
    }
  }

  pushNarration(state, `🤝 Você declara apoio a ${backed?.name ?? 'um pretendente'} na disputa por ${target?.name ?? houseId}. Custo: ${cost} recursos.`);
  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Apoio declarado — ${target?.name ?? houseId}`,
    body: `${playerHouse.name} declara apoio a ${backed?.name ?? 'um pretendente'}.`,
    tags: ['canon', 'divergence', 'sucessao', 'politica'],
  });

  return promptMainMenu(state, rng);
}

function applyCanonAutoPeopleForTurn(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  if (!state.canon!.enabled) return;

  const abs = state.date.absoluteTurn;
  const anchorsMode = state.canon!.mode === 'anchors';

  for (const def of Object.values(CANON_INDEX)) {
    if (anchorsMode && !isAnchorPerson(def)) continue;
    // Nascimentos automáticos (inclui intervalos)
    const bAbs = canonBirthAbsTurn(state, rng, def);
    if (typeof bAbs === 'number' && bAbs === abs) {
      const key = `auto_birth:${def.canonId}`;
      if (!state.canon!.appliedEventIds[key]) {
        state.canon!.appliedEventIds[key] = true;
        tryApplyOrQueueCanonBirth(state, rng, def, bAbs);
        const c = state.characters[canonCharId(def.canonId)];
        const manualKey = `${def.canonId}:${absTurn(state.date.year, state.date.turn)}`;
        if (c && !CANON_MANUAL_BIRTH_KEYS.has(manualKey)) {
          pushChronicle(state, {
            absTurn: state.date.absoluteTurn,
            title: `Nascimento canônico: ${c.name}`,
            body: `${c.name} nasce (registro canônico).`,
            tags: ['canon', 'birth'],
          });
          // se não nasceu de fato (foi adiado), o helper já cuidou.
          if (c.ageYears === 0) pushNarration(state, `👶 ${c.name} nasce (canônico).`);
        }
      }
    }

    // Mortes automáticas (inclui intervalos)
    const dAbs = canonDeathAbsTurn(state, rng, def);
    if (typeof dAbs === 'number' && dAbs === abs) {
      const manualKey = `${def.canonId}:${absTurn(state.date.year, state.date.turn)}`;
      // Existe um evento explícito para esta morte neste turno: ele é a fonte
      // única da verdade. Antes os dois caminhos rodavam e se contradiziam.
      if (CANON_MANUAL_DEATH_KEYS.has(manualKey)) continue;

      const key = `auto_death:${def.canonId}`;
      if (!state.canon!.appliedEventIds[key]) {
        state.canon!.appliedEventIds[key] = true;
        const killed = killCanonCharacter(state, rng, def.canonId, 'registro canônico');
        if (!killed) {
          pushChronicle(state, {
            absTurn: state.date.absoluteTurn,
            title: `Morte canônica evitada: ${def.name}`,
            body: `O registro canônico marcaria a morte aqui, mas o destino divergiu por ações do jogador.`,
            tags: ['canon', 'death', 'divergence'],
          });
        }
      }
    }
  }
}

function mandateActive(m: CanonLeaderMandate, abs: number): boolean {
  const fromAbs = absTurn(m.fromYear, m.fromTurn);
  const toAbs = (typeof m.toYear === 'number') ? absTurn(m.toYear, m.toTurn ?? 20) : undefined;
  return abs >= fromAbs && (toAbs === undefined || abs <= toAbs);
}

function applyCanonLeaderMandates(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  if (!state.canon!.enabled) return;
  const abs = state.date.absoluteTurn;

  for (const m of CANON_LEADER_MANDATES) {
    if (!mandateActive(m, abs)) continue;
    const h = state.houses[m.houseId];
    if (!h) continue;

    const leader = ensureCanonPerson(state, rng, m.leaderCanonId, state.date.year, state.date.turn);
    if (!leader || !leader.alive) continue;

    // Se o destino do líder divergiu por interferência do jogador, não forçamos este mandato.
    if (leader.canonId && canonIsDiverged(state, leader.canonId)) {
      continue;
    }

    // O mandato é o caminho que realmente instala líderes canônicos, e ele
    // ignorava se o assento ainda estava ocupado por alguém que deveria ter
    // morrido — o titular era deposto em silêncio. Agora isso abre disputa,
    // e enquanto o sobrevivente governar, a linha canônica daquele assento
    // permanece fora do trilho.
    const incumbent = state.characters[h.leaderId];
    if (incumbent && incumbent.id !== leader.id && seatIsContested(state, incumbent)) {
      const crisis = state.canon!.successionCrises?.[h.id];
      const alreadyHandled = !!crisis && crisis.pretenders.some(p => p.characterId === incumbent.id);
      if (!alreadyHandled) openSuccessionCrisis(state, h, incumbent, leader);
      continue;
    }

    const key = `mandate:${m.id}`;
    const changed = h.leaderId !== leader.id;
    h.leaderId = leader.id;
    leader.title = titleForHouse(h.id, leader.gender);

    if (changed && !state.canon!.appliedEventIds[key]) {
      state.canon!.appliedEventIds[key] = true;
      pushChronicle(state, {
        absTurn: state.date.absoluteTurn,
        title: `Liderança canônica: ${h.name}`,
        body: `${leader.name} é reconhecido como líder de ${h.name} (registro canônico).`,
        tags: ['canon', 'leaders'],
      });
      pushNarration(state, `👑 ${leader.name} assume ${h.name} (canônico).`);
    }
  }
}

function warActive(w: CanonWarDef, abs: number): boolean {
  const fromAbs = absTurn(w.fromYear, w.fromTurn);
  const toAbs = (typeof w.toYear === 'number') ? absTurn(w.toYear, w.toTurn ?? 20) : undefined;
  return abs >= fromAbs && (toAbs === undefined || abs <= toAbs);
}


function canonWarState(
  state: GameState,
  warId: string
): { scoreA: number; scoreB: number; lastBattleAbsTurn: number; recentBattles: Array<{ absTurn: number; summary: string }> } {
  ensureCanonDefaults(state);
  const ws = (state.canon as any).warStates as any;
  ws[warId] = ws[warId] ?? { scoreA: 0, scoreB: 0, lastBattleAbsTurn: -999999, recentBattles: [] };
  return ws[warId];
}

function pickRandomHouse(state: GameState, rng: Rng, ids: string[]): HouseState | null {
  const choices = ids.map(id => state.houses[id]).filter(Boolean) as HouseState[];
  if (!choices.length) return null;
  return choices[rng.int(0, choices.length - 1)];
}

function tickCanonWarBattles(state: GameState, rng: Rng, w: CanonWarDef): void {
  const ws = canonWarState(state, w.id);
  const abs = state.date.absoluteTurn;

  const freq = w.intensity === 'high' ? 2 : w.intensity === 'medium' ? 3 : 5;
  const chance = w.intensity === 'high' ? 0.85 : w.intensity === 'medium' ? 0.70 : 0.55;

  if ((abs - ws.lastBattleAbsTurn) < freq) return;
  if (!rng.chance(chance)) return;

  const ha = pickRandomHouse(state, rng, w.sideAHouseIds);
  const hb = pickRandomHouse(state, rng, w.sideBHouseIds);
  if (!ha || !hb) return;

  const pa = armyPower(ha.army) + (state.characters[ha.leaderId]?.martial ?? 40) * 35;
  const pb = armyPower(hb.army) + (state.characters[hb.leaderId]?.martial ?? 40) * 35;
  const pWinA = pa <= 0 && pb <= 0 ? 0.5 : clamp(pa / (pa + pb), 0.05, 0.95);

  const aWins = rng.chance(pWinA);
  const winner = aWins ? ha : hb;
  const loser = aWins ? hb : ha;

  const winLoss = w.intensity === 'high' ? rng.float(0.03, 0.08) : w.intensity === 'medium' ? rng.float(0.02, 0.06) : rng.float(0.01, 0.05);
  const loseLoss = w.intensity === 'high' ? rng.float(0.08, 0.16) : w.intensity === 'medium' ? rng.float(0.06, 0.13) : rng.float(0.04, 0.10);

  applyArmyLoss(winner.army, winLoss);
  applyArmyLoss(loser.army, loseLoss);

  // chance de sítio: degrada defesas e economia do perdedor
  if (rng.chance(0.22)) {
    loser.economy.walls = Math.max(0, (loser.economy.walls ?? 0) - 1);
    loser.resources.gold = Math.max(0, (loser.resources.gold ?? 0) - 10);
    loser.resources.food = Math.max(0, (loser.resources.food ?? 0) - 25);
    pushChronicle(state, {
      absTurn: abs,
      title: `Sítio — ${w.name}`,
      body: `${loser.name} sofre um sítio após a batalha. Defesas e reservas são corroídas.`,
      tags: ['war', 'siege', 'canon', ...w.tags],
    });

    // Muralhas caídas abrem caminho para a tomada do assento.
    if ((loser.economy.walls ?? 0) <= 0 && rng.chance(0.45)) {
      occupySeat(state, loser, winner, w.id);
    }
  }

  // pontuação
  const pts = w.intensity === 'high' ? 2 : 1;
  if (aWins) ws.scoreA += pts;
  else ws.scoreB += pts;

  ws.lastBattleAbsTurn = abs;

  const locA = state.locations[ha.seatLocationId]?.name ?? 'um campo de batalha';
  const locB = state.locations[hb.seatLocationId]?.name ?? 'um campo de batalha';
  const loc = rng.chance(0.5) ? locA : locB;

  const summary = `Batalha em ${loc}: ${winner.name} vence ${loser.name}.`;
  ws.recentBattles.push({ absTurn: abs, summary });
  ws.recentBattles = ws.recentBattles.slice(-20);

  pushChronicle(state, {
    absTurn: abs,
    title: `Batalha — ${w.name}`,
    body: `${summary} Perdas estimadas: vencedor ${(winLoss * 100).toFixed(0)}%, perdedor ${(loseLoss * 100).toFixed(0)}%.`,
    tags: ['war', 'battle', 'canon', ...w.tags],
  });

  const playerHouse = state.houses[state.playerHouseId];
  const involved = [ha.id, hb.id].includes(playerHouse?.id);
  if (involved) pushNarration(state, `⚔️ ${summary}`);
}

/**
 * Uma guerra precisa de quem a declare. Se o instigador morreu antes da hora
 * — ou nunca chegou ao poder porque o jogador mudou a sucessão — o conflito
 * simplesmente não acontece.
 */
function canonWarInstigatorOk(state: GameState, w: CanonWarDef): { ok: boolean; why?: string } {
  if (!w.instigatorCanonId) return { ok: true };

  const c = state.characters[canonCharId(w.instigatorCanonId)];
  const who = CANON_INDEX[w.instigatorCanonId]?.name ?? w.instigatorCanonId;
  if (!c || !c.alive) return { ok: false, why: `${who} não está vivo para conduzi-la` };

  if (w.instigatorHouseId) {
    const h = state.houses[w.instigatorHouseId];
    if (!h || h.leaderId !== c.id) {
      return { ok: false, why: `${c.name} não comanda ${h?.name ?? w.instigatorHouseId}` };
    }
  }
  return { ok: true };
}

function topHouseOf(state: GameState, ids: string[]): HouseState | null {
  const hs = ids.map(id => state.houses[id]).filter(Boolean) as HouseState[];
  if (!hs.length) return null;
  return hs.sort((a, b) => b.prestige - a.prestige)[0];
}

function finalizeEndedCanonWar(state: GameState, rng: Rng, w: CanonWarDef): void {
  const ws = canonWarState(state, w.id);
  const endKey = `war_end:${w.id}`;
  if (state.canon!.appliedEventIds[endKey]) return;
  state.canon!.appliedEventIds[endKey] = true;

  const result = ws.scoreA === ws.scoreB ? 'empate' : ws.scoreA > ws.scoreB ? 'A' : 'B';
  const winIds = result === 'A' ? w.sideAHouseIds : result === 'B' ? w.sideBHouseIds : [];
  const loseIds = result === 'A' ? w.sideBHouseIds : result === 'B' ? w.sideAHouseIds : [];

  const margin = Math.abs(ws.scoreA - ws.scoreB);
  const decisive = margin >= 4;

  for (const hid of winIds) {
    const h = state.houses[hid];
    if (!h) continue;
    h.prestige = clamp(h.prestige + (decisive ? 4 : 2), 1, 100);
    // espólio de guerra
    h.resources.goods = (h.resources.goods ?? 0) + rng.int(20, 60);
  }

  const consequences: string[] = [];

  for (const hid of loseIds) {
    const h = state.houses[hid];
    if (!h) continue;
    h.prestige = clamp(h.prestige - (decisive ? 5 : 2), 1, 100);
    h.resources.goods = Math.max(0, (h.resources.goods ?? 0) - rng.int(15, 45));

    // Derrota real custa gente: o líder do lado perdedor pode tombar.
    const leader = state.characters[h.leaderId];
    if (leader?.alive && rng.chance(decisive ? 0.22 : 0.10)) {
      const protectedByCanon =
        leader.isCanonical && leader.canonId && !canonIsDiverged(state, leader.canonId) &&
        typeof leader.canonDeathAbsTurn === 'number' && state.date.absoluteTurn < leader.canonDeathAbsTurn;

      if (!protectedByCanon) {
        if (leader.canonId) markCanonDeathBypassed(state, leader.canonId);
        consequences.push(`${leader.name} tomba entre os derrotados`);
        handleDeathImmediate(state, rng, leader, `Derrota em ${w.name}`);
      }
    }
  }

  // Guerra decisiva redesenha a política: o principal derrotado passa a
  // responder ao principal vencedor.
  if (decisive) {
    const winTop = topHouseOf(state, winIds);
    const loseTop = topHouseOf(state, loseIds);
    if (winTop && loseTop && loseTop.suzerainId !== winTop.id && !loseTop.isIronThrone && loseTop.id !== winTop.id) {
      loseTop.suzerainId = winTop.id;
      loseTop.economy.taxRate = Math.max(loseTop.economy.taxRate ?? 0.15, 0.20);
      consequences.push(`${loseTop.name} passa a jurar a ${winTop.name}`);
    }
  }

  // Assentos tomados durante o conflito voltam com a paz — exceto quando a
  // vitória foi decisiva e o ocupante estava do lado vencedor.
  for (const o of Object.values(ensureOccupations(state))) {
    if (o.warId !== w.id) continue;
    const keep = decisive && winIds.includes(o.occupierHouseId);
    if (keep) {
      const seat = state.houses[o.seatHouseId];
      if (seat) {
        seat.suzerainId = o.occupierHouseId;
        consequences.push(`${seat.name} permanece sob ${state.houses[o.occupierHouseId]?.name ?? 'o ocupante'}`);
      }
    } else {
      releaseSeat(state, o.locationId, 'a guerra termina');
    }
  }

  const outcomeText = result === 'empate'
    ? 'O conflito termina sem um vencedor claro.'
    : `Vitória do lado ${result} (pontuação ${ws.scoreA}–${ws.scoreB})${decisive ? ', de forma decisiva' : ''}.`;

  const full = consequences.length ? `${outcomeText} ${consequences.join('. ')}.` : outcomeText;

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Fim da guerra — ${w.name}`,
    body: full,
    tags: ['war', 'canon', 'end', ...w.tags],
  });

  pushNarration(state, `🕊️ Fim da guerra: ${w.name}. ${full}`);
}

function applyCanonWarsForTurn(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  if (!state.canon!.enabled) return;
  const abs = state.date.absoluteTurn;
  const prevActiveWarIds = (state.canon!.activeWarIds ?? []).slice();
  const cancelled = state.canon!.cancelledWarIds!;

  // Uma guerra só existe se ainda houver quem a declare.
  const scheduled = CANON_WARS.filter(w => warActive(w, abs));
  const active: CanonWarDef[] = [];

  for (const w of scheduled) {
    if (cancelled[w.id]) continue;

    const startedNow = !prevActiveWarIds.includes(w.id);
    if (startedNow) {
      const check = canonWarInstigatorOk(state, w);
      if (!check.ok) {
        cancelled[w.id] = true;
        pushChronicle(state, {
          absTurn: abs,
          title: `Guerra que não houve — ${w.name}`,
          body: w.altBody ?? `O conflito previsto não se materializa: ${check.why}.`,
          tags: ['canon', 'war', 'divergence', ...w.tags],
        });
        pushNarration(state, `🕊️ ${w.name} não acontece: ${check.why}.`);
        continue;
      }
    }
    active.push(w);
  }

  state.canon!.activeWarIds = active.map(w => w.id);

  // Efeitos leves por turno (o grosso vem de eventos/batalhas e decisões do jogador).
  for (const w of active) {
    const all = [...w.sideAHouseIds, ...w.sideBHouseIds];
    const levyLoss = w.intensity === 'high' ? 0.012 : w.intensity === 'medium' ? 0.008 : 0.004;
    const foodLoss = w.intensity === 'high' ? 0.010 : w.intensity === 'medium' ? 0.006 : 0.003;

    for (const hid of all) {
      const h = state.houses[hid];
      if (!h) continue;

      // perda fracional com piso mínimo 0 (não mata economia sozinha)
      h.army.levies = Math.max(0, Math.floor((h.army.levies ?? 0) * (1 - levyLoss)));
      h.resources.food = Math.max(0, Math.floor((h.resources.food ?? 0) * (1 - foodLoss)));

      // custo de guerra em ouro (pequeno, para não esmagar as tiers)
      const goldLoss = w.intensity === 'high' ? 6 : w.intensity === 'medium' ? 4 : 2;
      h.resources.gold = Math.max(0, (h.resources.gold ?? 0) - goldLoss);
    }

    // Narrativa (uma vez por guerra por save)
    const announceKey = `war_announce:${w.id}`;
    if (!state.canon!.appliedEventIds[announceKey]) {
      state.canon!.appliedEventIds[announceKey] = true;
      pushNarration(state, `⚔️ Guerra canônica: ${w.name}.`);
      pushChronicle(state, {
        absTurn: state.date.absoluteTurn,
        title: `Guerra: ${w.name}`,
        body: `Conflito em andamento. (${w.tags.join(', ')})`,
        tags: ['canon', 'war', ...w.tags],
      });
    }

    // Simulação de batalhas (mais profunda que atrito)
    tickCanonWarBattles(state, rng, w);
  }

  // Finaliza guerras que acabaram neste turno
  const activeSet = new Set(state.canon!.activeWarIds ?? []);
  for (const wid of prevActiveWarIds) {
    if (activeSet.has(wid)) continue;
    const ended = CANON_WARS.find(x => x.id === wid);
    if (ended) finalizeEndedCanonWar(state, rng, ended);
  }
}


function applyCanonEventsForTurn(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  if (!state.canon!.enabled) return;
  const anchorsMode = state.canon!.mode === 'anchors';

  const due = CANON_EVENTS_ALL.filter(e =>
    e.year === state.date.year &&
    e.turn === state.date.turn &&
    (!anchorsMode || isAnchorCanonEvent(e))
  );

  // A ordem dentro do turno importa: quem está vivo precisa estar decidido
  // antes de decidir quem manda. Com liderança sendo resolvida primeiro, um
  // rei salvo pelo jogador era deposto antes mesmo de o marco de morte rodar.

  // 1) nascimentos pendentes e marcos explícitos de nascimento/morte
  processPendingCanonBirths(state, rng);
  for (const e of due) {
    if (e.kind === 'birth' || e.kind === 'death') applyCanonEvent(state, rng, e);
  }

  // 2) nascimentos/mortes por registro (para quem não tem evento explícito)
  applyCanonAutoPeopleForTurn(state, rng);

  // 3) liderança e guerras por cronologia (camadas históricas)
  applyCanonLeaderMandates(state, rng);
  applyCanonWarsForTurn(state, rng);

  // 4) disputas abertas por divergência
  tickSuccessionCrises(state, rng);

  // 5) demais marcos (sucessões, dinastias, torneios, crônicas)
  for (const e of due) {
    if (e.kind !== 'birth' && e.kind !== 'death') applyCanonEvent(state, rng, e);
  }
}

function bootstrapCanonAtStart(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  if (!state.canon!.enabled) return;

  // cria todos canônicos já vivos no turno inicial (respeita datas e intervalos)
  for (const def of CANON_PEOPLE) {
    const bAbs = canonBirthAbsTurn(state, rng, def);
    if (typeof bAbs === 'number' && bAbs > state.date.absoluteTurn) continue;

    const dAbs = canonDeathAbsTurn(state, rng, def);
    if (typeof dAbs === 'number' && dAbs <= state.date.absoluteTurn) continue;

    ensureCanonPerson(state, rng, def.canonId, state.date.year, state.date.turn);
  }

  // Garante que o Trono de Ferro esteja com Aegon III no start
  const throne = state.houses['targaryen_throne'];
  const aegon = ensureCanonPerson(state, rng, 'aegon_iii', state.date.year, state.date.turn);
  if (throne && aegon) throne.leaderId = aegon.id;

  // aplica eventos do turno inicial (contexto)
  applyCanonEventsForTurn(state, rng);
}

const DANY_HOUSE_ID = 'targaryen_dany';


export function buildInitialState(seed: number, params: NewGameParams, baseState: Omit<GameState,
  'version'|'date'|'playerId'|'playerHouseId'|'houses'|'characters'|'chronicle'|'chat'|'ironBankDebt'|'ui'|'tournaments'|'game'|'endgame'
> & {houses: Record<string, HouseState>, characters: Record<string, Character>}): GameState {

  const rng = new Rng(seed);

  // 1) Clona as casas e cria relações base
  const houses: Record<string, HouseState> = {};
  for (const [id, h] of Object.entries(baseState.houses)) {
    const tier = econTierGold(h);
    const tierFactor = tier / 200; // 1.0, 1.75, 2.5, 3.5

    houses[id] = {
      ...h,
      prestige: clamp(h.prestigeBase, 1, 100),
      relations: {},
      leaderId: '', // será preenchido quando gerar personagens
      economy: {
        peasants: rng.int(Math.floor(420 * tierFactor), Math.floor(760 * tierFactor)),
        soldiers: rng.int(Math.floor(45 * tierFactor), Math.floor(85 * tierFactor)),
        farms: rng.int(1 + Math.floor(tierFactor * 0.8), 2 + Math.floor(tierFactor * 1.6)),
        trainingGrounds: rng.int(0, 1),
        walls: rng.int(0, 1),
        tradeLastDelegationTurn: 0,
        tradePartners: [],
        taxRate: h.suzerainId ? 0.15 : 0.0,
      },
      resources: {
        // ouro inicial segue tier (200/350/500/700), com variação moderada
        gold: rng.int(Math.floor(tier * 0.8), Math.floor(tier * 1.6)),
        food: rng.int(Math.floor(520 * tierFactor), Math.floor(980 * tierFactor)),
        goods: rng.int(Math.floor(tier * 0.18), Math.floor(tier * 0.55)),
      },
      army: {
        levies: rng.int(Math.floor(45 * tierFactor), Math.floor(95 * tierFactor)),
        menAtArms: rng.int(Math.floor(12 * tierFactor), Math.floor(30 * tierFactor)),
        squires: rng.int(0, Math.floor(6 * tierFactor)),
        knights: rng.int(0, Math.floor(3 * tierFactor)),
        dragons: 0,
        stationedRatio: 0.7,
      },
    };
  }

  // relações iniciais
  const houseIds = Object.keys(houses);
  for (const a of houseIds) {
    for (const b of houseIds) {
      if (a === b) continue;
      const ha = houses[a];
      const hb = houses[b];
      let rel = 45;
      if (hb.isIronThrone) rel = 60;
      if (ha.isIronThrone) rel = 55;
      if (ha.regionId === hb.regionId) rel = 58;
      if (ha.suzerainId && ha.suzerainId === b) rel = 62;
      if (hb.suzerainId && hb.suzerainId === a) rel = 55;
      // rivalidade leve com distâncias de prestígio grandes
      const delta = hb.prestigeBase - ha.prestigeBase;
      rel += clamp(-Math.floor(Math.abs(delta) / 12), -10, 0);
      ha.relations[b] = clamp(rel + rng.int(-6, 6), 0, 100);
    }
  }

  // 2) Gera personagens: um pequeno "elenco" por casa (líder + consorte + 2-4 filhos + 1 parente)
  const characters: Record<string, Character> = {};

  function mkChar(houseId: string, gender: Gender, age: number, locationId: string, martialBase: number): Character {
    const name = genFirstName(rng, gender) + maybeEpithet(rng, gender);
    const beauty = clamp(rng.int(25, 65) + (martialBase > 60 ? 8 : 0), 0, 100);
    const charm = clamp(rng.int(25, 70), 0, 100);
    const wellLiked = clamp(rng.int(25, 75), 0, 100);
    const martial = clamp(martialBase + rng.int(-10, 10), 0, 100);


    const personalPrestige = clamp(rng.int(6, 22) + (martial > 60 ? 6 : 0) + (houseId.includes('targaryen') ? 6 : 0), 0, 100);

    // esterilidade baixa para "personagens fictícios"
    const fertility: 'fertile' | 'sterile' = rng.chance(0.05) ? 'sterile' : 'fertile';

    const id = uid('c');
    const c: Character = {
      id,
      name,
      gender,
      ageYears: age,
      alive: true,

      birthHouseId: houseId,
      currentHouseId: houseId,

      maritalStatus: 'single',
      keepsBirthName: false,

      locationId,

      martial,
      charm,
      beauty,
      renownTier: renownFromMartial(martial),
      fertility,
      wellLiked,
      personalPrestige,

      knownToPlayer: false,
      relationshipToPlayer: 0,
      personalGold: rng.int(15, 45),
      kissedIds: [],
    };
    characters[id] = c;
    return c;
  }

  function marry(a: Character, b: Character, keepName: boolean): void {
    a.spouseId = b.id;
    b.spouseId = a.id;
    a.maritalStatus = 'married';
    b.maritalStatus = 'married';

    // Regra de sobrenome: normalmente a mulher vai para a casa do marido
    if (a.gender === 'F' && b.gender === 'M') {
      a.keepsBirthName = keepName;
      if (!keepName) a.currentHouseId = b.currentHouseId;
    } else if (b.gender === 'F' && a.gender === 'M') {
      b.keepsBirthName = keepName;
      if (!keepName) b.currentHouseId = a.currentHouseId;
    }
  }

  function addChild(father: Character, mother: Character, gender: Gender, age: number, locationId: string): Character {
    const childHouseId = father.currentHouseId; // regra do jogo: sem bastardos, filhos seguem o sobrenome dominante
    const child = mkChar(childHouseId, gender, age, locationId, rng.int(10, 35));
    child.fatherId = father.id;
    child.motherId = mother.id;
    return child;
  }

  // para cada casa, cria um líder e família
  for (const houseId of houseIds) {
    const house = houses[houseId];
    const seat = house.seatLocationId;

    const lordGender: Gender = rng.chance(0.18) ? 'F' : 'M'; // raramente líder mulher
    const lordAge = rng.int(38, 58);
    const leader = mkChar(houseId, lordGender, lordAge, seat, rng.int(35, 72));
    leader.title = titleForHouse(houseId, lordGender);
    house.leaderId = leader.id;

    // consorte
    const spouseGender: Gender = lordGender === 'M' ? 'F' : 'M';
    const spouse = mkChar(houseId, spouseGender, rng.int(30, 52), seat, rng.int(15, 45));
    spouse.title = spouseGender === 'F' ? 'Lady Consorte' : 'Lorde Consorte';
    marry(lordGender === 'M' ? leader : spouse, lordGender === 'F' ? leader : spouse, false);

    // filhos
    const childCount = rng.int(2, 4);
    const children: Character[] = [];
    for (let i=0;i<childCount;i++){
      const g: Gender = rng.chance(0.55) ? 'M' : 'F';
      const age = rng.int(8, 24);
      const child = addChild(lordGender === 'M' ? leader : spouse, lordGender === 'F' ? leader : spouse, g, age, seat);
      children.push(child);
    }

    // irmão/irmã do líder
    const sib = mkChar(houseId, rng.chance(0.55) ? 'M' : 'F', rng.int(30, 55), seat, rng.int(20, 55));
    sib.title = 'Parente da Casa';

    // trade partners iniciais (agora randômico e respeitando tier)
    const sameRegion = houseIds.filter((id) => id !== houseId && houses[id].regionId === house.regionId);
    const tier = econTierGold(house);
    const maxPartners = tier === 700 ? 5 : tier === 500 ? 4 : tier === 350 ? 3 : 2;
    const want = sameRegion.length ? rng.int(1, Math.min(maxPartners, sameRegion.length)) : 0;
    house.economy.tradePartners = want > 0 ? pickMany(rng, sameRegion, want) : [];
    house.economy.tradeLastDelegationTurn = 0;
  }

  // 3) cria jogador como último na sucessão da casa escolhida
  const playerHouse = houses[params.playerHouseId];
  const playerSeat = playerHouse.seatLocationId;

  // pega líder e consorte para criar o jogador como filho(a) mais novo(a)
  const leader = characters[playerHouse.leaderId];
  const spouse = leader.spouseId ? characters[leader.spouseId] : undefined;

  const player = mkChar(params.playerHouseId, params.gender, 18, playerSeat, rng.int(22, 45));
  player.title = params.gender === 'M' ? 'Herdeiro Distante' : 'Herdeira Distante';

  if (spouse && leader.gender !== spouse.gender) {
    // define como filho do casal (jogador como último)
    if (leader.gender === 'M') {
      player.fatherId = leader.id;
      player.motherId = spouse.id;
    } else {
      player.motherId = leader.id;
      player.fatherId = spouse.id;
    }
  } else {
    player.fatherId = leader.id;
  }

  // coloca o jogador como conhecido apenas de pessoas locais (mesma região e mesma localização)
  for (const c of Object.values(characters)) {
    if (c.locationId === playerSeat && houses[c.currentHouseId]?.regionId === playerHouse.regionId) {
      c.knownToPlayer = true;
      c.relationshipToPlayer = clamp(35 + rng.int(-10, 10), 0, 100);
    }
  }
  player.knownToPlayer = true;
  player.relationshipToPlayer = 50;

  player.personalPrestige = clamp(player.personalPrestige ?? 12, 0, 100);

  // 4) estado final
  const state: GameState = {
    version: 3,
    date: { year: 150, turn: 1, absoluteTurn: 1 },

    game: { over: false, victory: false, reason: '' },
    endgame: {
      wallBreached: false,
      danyArrived: false,
      danyRelation: 0,
      kingsLandingBurned: false,
    },

    playerId: player.id,
    playerHouseId: player.currentHouseId,

    locations: baseState.locations,
    regions: baseState.regions,
    travelGraph: baseState.travelGraph,

    houses,
    characters,

    tournaments: [],

    missions: [],
    claims: [],
    occupations: {},
    wars: [],

    chronicle: [],
    chat: [],

    ironBankDebt: null,

    canon: { enabled: true, mode: 'strict', appliedEventIds: {} },

    ui: { activeTab: 'chat', showSetup: false, pendingNameQueue: [] },
  };

  // Canon (história real): injeta reis/personagens e marcos no calendário
  bootstrapCanonAtStart(state, rng);

  // Mensagem inicial
  pushNarration(
    state,
    `Você desperta em uma Westeros ainda marcada por cicatrizes antigas, agora no ano 150 DC, sob o reinado de Aegon III.
` +
      `Você é ${player.name}, da ${houses[player.currentHouseId].name}, com 18 anos — o último na linha de sucessão principal.
` +
      'Seu futuro depende de escolhas: alianças, casamentos, guerras, comércio e honra.'
  );

  promptMainMenu(state, rng);
  return state;
}


export function promptMainMenu(state: GameState, rng: Rng): void {
  if (state.game.over) {
    return pushSystem(state, `Fim de jogo. Motivo: ${state.game.reason}`, [
      { id: 'saves', label: 'Abrir Saves' },
      { id: 'reset', label: 'Reiniciar (voltar ao menu inicial)' },
    ]);
  }

  const player = state.characters[state.playerId];
  const playerHouse = state.houses[state.playerHouseId];
  const isLeader = playerHouse.leaderId === player.id;

  const choices: Choice[] = [
    { id: 'travel', label: 'Viajar', hint: 'Mover-se no mapa (pode haver encontros)' },
    { id: 'missions', label: 'Missões', hint: 'Aceite tarefas por recompensa em ouro pessoal' },
    { id: 'local', label: 'Pessoas no local', hint: 'Ver quem está aqui e interagir (conversa, bebida, caça, flores)' },
    { id: 'tournaments', label: 'Torneios', hint: 'Ver torneios anunciados e participar/organizar' },
    { id: 'diplomacy', label: 'Diplomacia', hint: 'Conversar, presentear, negociar, casamentos, Banco de Ferro' },
    { id: 'train', label: 'Treinar', hint: 'Melhorar combate/beleza e renome' },
    { id: 'chronicle', label: 'Crônicas', hint: 'Ver eventos do reino e deste turno' },
    { id: 'end_turn', label: 'Encerrar turno', hint: 'Avança o tempo (1/20 de ano)' },
  ];

  if (isLeader) choices.splice(2, 0, { id: 'house', label: 'Gerenciar Casa', hint: 'População, fazendas, exército, tributos, delegações' });

  choices.push({ id: 'saves', label: 'Salvar/Carregar', hint: '3 slots de salvamento' });

  pushSystem(state, `Turno ${state.date.turn}/20 • Ano ${state.date.year} DC — O que você fará?`, choices);
}


export function promptLocal(state: GameState, rng: Rng): void {
  const player = state.characters[state.playerId];
  const here = player.locationId;
  const locName = state.locations[here]?.name ?? 'local';
  pushNarration(state, `📍 Você olha ao redor em ${locName}. Abra a aba “Local” para ver personagens presentes e interagir.`);
  // volta ao menu principal para decisões rápidas
  promptMainMenu(state, rng);
}

export function promptTournaments(state: GameState, rng: Rng): void {
  const open = state.tournaments.filter(t => t.status === 'anunciado').length;
  pushNarration(state, `🏇 Torneios anunciados: ${open}. Abra a aba “Torneios” para detalhes, organizar ou participar.`);
  promptMainMenu(state, rng);
}

export function applyChoice(state: GameState, rng: Rng, choiceId: string): void {
  if (state.game.over && !['saves', 'reset'].includes(choiceId)) return;
  const last = state.chat.at(-1);
  if (!last || !last.choices || last.chosenId) return;
  last.chosenId = choiceId;

  switch (choiceId) {
    case 'travel': return promptTravel(state, rng);
    case 'local': state.ui.activeTab = 'local'; return promptLocal(state, rng);
    case 'missions': return promptMissions(state, rng);
    case 'tournaments': state.ui.activeTab = 'tournaments'; return promptTournaments(state, rng);
    case 'diplomacy': state.ui.activeTab = 'diplomacy'; return promptDiplomacy(state, rng);
    case 'train': return promptTraining(state, rng);
    case 'house': state.ui.activeTab = 'house'; return promptHouseMgmt(state, rng);
    case 'chronicle': state.ui.activeTab = 'chronicle'; return promptChronicle(state, rng);
    case 'saves': state.ui.activeTab = 'saves'; return pushNarration(state, 'Abra a aba “Saves” para salvar/carregar em 3 slots.');
    case 'end_turn': return advanceTurn(state, rng);
  }
}


function ensureDaenerysFaction(state: GameState, rng: Rng): void {
  if (state.endgame.danyArrived) return;

  // Cria casa + Daenerys apenas quando ela "chega".
  const kl = Object.values(state.locations).find(l => l.name.toLowerCase().includes('porto real') || l.id === 'kings_landing')?.id
    ?? Object.values(state.locations)[0].id;

  state.houses[DANY_HOUSE_ID] = {
    id: DANY_HOUSE_ID,
    name: 'Casa Targaryen (Daenerys)',
    regionId: 'crownlands',
    seatLocationId: kl,
    prestigeBase: 96,
    prestige: 96,
    relations: {},
    leaderId: '',
    economy: {
      peasants: 0,
      soldiers: 0,
      farms: 0,
      trainingGrounds: 0,
      walls: 0,
      tradeLastDelegationTurn: 0,
      tradePartners: [],
    taxRate: 0.0,
    },
    resources: {
      gold: 12000,
      food: 9000,
    },
    army: {
      levies: 0,
      menAtArms: 9000, // Imaculados (abstração)
      squires: 0,
      knights: 2500,   // elite + cavaleiros aliados (abstração)
      dragons: 3,      // sem mecânica; só equivalência em poder
      stationedRatio: 0.0,
    },
  };

  // Relações iniciais com as outras casas
  for (const h of Object.values(state.houses)) {
    if (h.id === DANY_HOUSE_ID) continue;
    const base = clamp(35 + Math.floor((h.prestige - 50) / 3), 5, 70);
    h.relations[DANY_HOUSE_ID] = base;
    state.houses[DANY_HOUSE_ID].relations[h.id] = clamp(40 + rng.int(-8, 8), 0, 100);
  }

  // Daenerys como personagem
  const id = uid('c');
  state.characters[id] = {
    id,
    name: 'Daenerys Targaryen',
    gender: 'F',
    ageYears: 19,
    alive: true,

    birthHouseId: DANY_HOUSE_ID,
    currentHouseId: DANY_HOUSE_ID,

    maritalStatus: 'single',
    keepsBirthName: true,

    locationId: kl,

    martial: 25,
    charm: 88,
    beauty: 82,
    renownTier: 'comum',
    fertility: 'fertile',
    wellLiked: 65,

    personalPrestige: 35,

    knownToPlayer: true,
    relationshipToPlayer: 10,

    title: 'Pretendente ao Trono',
  };
  state.houses[DANY_HOUSE_ID].leaderId = id;

  state.endgame.danyArrived = true;
  state.endgame.danyHouseId = DANY_HOUSE_ID;
  state.endgame.danyLeaderId = id;
  state.endgame.danyRelation = 10;
}

function promptTravel(state: GameState, rng: Rng): void {
  state.ui.activeTab = 'map';
  const player = state.characters[state.playerId];
  const here = state.locations[player.locationId];
  const options = state.travelGraph[here.id] ?? [];

  if (options.length === 0) {
    pushNarration(state, 'Você está em um local sem rotas mapeadas. (Você pode expandir TRAVEL_GRAPH em src/app/core/data/regions.ts)');
    return promptMainMenu(state, rng);
  }

  const armySize = getActiveArmySize(state, 0.6);
  const house = state.houses[state.playerHouseId];
  const base = `Você está em **${here.name}**. Escolha um destino.
` +
    `Levar mais exército reduz risco de emboscada, mas encarece os mantimentos. ` +
    `Comida no cofre: ${house.resources.food}.`;

  const choices: Choice[] = [];
  for (const opt of options) {
    const to = state.locations[opt.toLocationId];
    const foodCost = travelFoodCost(state, opt.distance, armySize);
    choices.push({
      id: `go:${to.id}`,
      label: `Ir para ${to.name}`,
      hint: `Distância ${opt.distance} • ${opt.distance} turno(s) • ~${foodCost} comida`,
    });
  }
  choices.push({ id: 'back', label: 'Voltar', hint: 'Retorna ao menu principal' });

  pushSystem(state, base, choices);
}

/**
 * Custo de mantimentos da viagem.
 *
 * O valor era calculado e descartado (a chamada existia, o resultado nunca
 * era usado), então distância não tinha peso econômico nenhum. Agora a comitiva
 * consome comida proporcional ao tamanho da hoste e à distância.
 */
function travelFoodCost(state: GameState, distance: number, armySize: number): number {
  const escort = Math.max(12, armySize);
  return Math.round(distance * (4 + escort * 0.05));
}

function getActiveArmySize(state: GameState, marchingRatio: number): number {
  const army = state.houses[state.playerHouseId].army;
  const total = army.levies + army.menAtArms + army.squires + army.knights;
  return Math.round(total * marchingRatio);
}


function ensureMissions(state: GameState, rng: Rng): void {
  state.missions = state.missions ?? [];
  const now = state.date.absoluteTurn;
  // limpa expiradas
  state.missions = state.missions.filter(m => m.status !== 'expirada' && m.expiresTurn > now);

  // se houver poucas, cria missões locais (mantém sistema original) + complementos inteligentes
  const player = state.characters[state.playerId];
  const here = state.locations[player.locationId];
  const regionId = here.regionId;
  const playerHouse = state.houses[state.playerHouseId];
  const playerIsLeader = playerHouse?.leaderId === player.id;
  const playerPower = Math.round((player.martial * 0.65) + (player.personalPrestige * 0.35));

  const openInRegion = state.missions.filter(m => m.regionId === regionId && m.status === 'aberta');
  const needed = 3 - openInRegion.length;

  const localeFlavor = state.locations[here.id]?.name ?? 'a região';
  const localTitlesByKind: Record<string, string[]> = {
    diplomacia: [
      `Tratado nas sombras de ${localeFlavor}`,
      `Palavras antes do aço em ${localeFlavor}`,
      `Conselho de paz em ${localeFlavor}`,
    ],
    comercio: [
      `Rota de mercadores de ${localeFlavor}`,
      `Caravana do amanhecer em ${localeFlavor}`,
      `Ouro e sal rumo a ${localeFlavor}`,
    ],
    bandidos: [
      `Sangue na estrada de ${localeFlavor}`,
      `Caçada ao estandarte negro em ${localeFlavor}`,
      `Lâminas contra saqueadores de ${localeFlavor}`,
    ],
    selvagens: [
      `Vigília fria de ${localeFlavor}`,
      `Ecos além das colinas de ${localeFlavor}`,
      `Patrulha de ferro em ${localeFlavor}`,
    ],
  };

  const activeStatuses = new Set(['aberta', 'aceita', 'delegada']);
  const activeTitles = new Set(
    (state.missions ?? [])
      .filter(m => activeStatuses.has(m.status))
      .map(m => m.title.trim().toLowerCase())
  );

  const uniqueMissionTitle = (baseTitle: string): string => {
    const base = baseTitle.trim();
    const low = base.toLowerCase();
    if (!activeTitles.has(low)) {
      activeTitles.add(low);
      return base;
    }
    const suffixes = ['(novo despacho)', '(segunda ordem)', '(ordem extraordinária)', '(ordem urgente)'];
    for (const suffix of suffixes) {
      const candidate = `${base} ${suffix}`;
      const key = candidate.toLowerCase();
      if (!activeTitles.has(key)) {
        activeTitles.add(key);
        return candidate;
      }
    }
    let n = 2;
    while (activeTitles.has(`${base} #${n}`.toLowerCase())) n += 1;
    const fallback = `${base} #${n}`;
    activeTitles.add(fallback.toLowerCase());
    return fallback;
  };

  const tuneMissionRewards = (mission: Mission): Mission => {
    const rewardLevel = mission.kind === 'lider' ? 0
      : mission.kind === 'suserano' ? 1
      : mission.kind === 'coroa' ? 2
      : mission.kind === 'vassalo' ? 1
      : 1;

    const goldMult = rewardLevel === 0 ? 0.70 : rewardLevel === 1 ? 1.25 : 2.10;
    const houseMult = rewardLevel === 0 ? 0.60 : rewardLevel === 1 ? 1.45 : 2.30;

    mission.rewardGold = Math.max(8, Math.floor((mission.rewardGold ?? 0) * goldMult));

    const baseHouse = mission.rewardHouseGold ?? 0;
    mission.rewardHouseGold = rewardLevel === 0
      ? Math.floor(baseHouse * houseMult)
      : Math.max(Math.floor(mission.rewardGold * (rewardLevel === 2 ? 0.85 : 0.55)), Math.floor(baseHouse * houseMult));

    mission.rewardPrestige = rewardLevel === 0
      ? Math.max(0, Math.min(1, mission.rewardPrestige ?? 1))
      : rewardLevel === 1
      ? Math.max(2, mission.rewardPrestige ?? 2)
      : Math.max(4, mission.rewardPrestige ?? 3);

    mission.rewardRelation = rewardLevel === 0
      ? Math.max(1, Math.min(2, mission.rewardRelation ?? 2))
      : rewardLevel === 1
      ? Math.max(4, mission.rewardRelation ?? 3)
      : Math.max(8, mission.rewardRelation ?? 6);

    return mission;
  };

  const addMission = (mission: Mission): void => {
    mission.title = uniqueMissionTitle(mission.title);
    state.missions!.push(tuneMissionRewards(mission));
  };

  for (let i = 0; i < needed; i++) {
    const earlyWeights = ['lider', 'lider', 'diplomacia', 'comercio', 'bandidos'];
    const midWeights = ['lider', 'diplomacia', 'comercio', 'bandidos', 'selvagens', 'suserano'];
    const lateWeights = ['diplomacia', 'comercio', 'bandidos', 'selvagens', 'suserano', 'vassalo', 'coroa'];
    const basePool = playerPower < 38 ? earlyWeights : playerPower < 62 ? midWeights : lateWeights;
    const pool = playerIsLeader ? basePool.filter(k => k !== 'lider') : basePool;
    let kind = rng.pick(pool.length ? pool : ['diplomacia', 'comercio', 'bandidos']) as any;
    if (kind === 'coroa') {
      const crownChance = playerPower >= 72 ? 0.22 : playerPower >= 60 ? 0.12 : 0.05;
      if (!rng.chance(crownChance)) kind = rng.pick(['diplomacia', 'comercio', 'bandidos', 'selvagens']) as any;
    }

    const req = kind === 'diplomacia' ? rng.int(12, 38)
      : kind === 'comercio' ? rng.int(16, 44)
      : kind === 'lider' ? rng.int(14, 40)
      : kind === 'coroa' ? rng.int(50, 82)
      : rng.int(24, 74);

    const baseRequester = kind === 'lider' ? 1.10
      : kind === 'suserano' ? 1.25
      : kind === 'vassalo' ? 1.35
      : kind === 'coroa' ? 1.75
      : 1.0;
    const reward = Math.floor((rng.int(25, 120) + Math.floor(req * 1.2)) * baseRequester);

    const titlePools: Record<string, string[]> = {
      diplomacia: localTitlesByKind['diplomacia'],
      comercio: localTitlesByKind['comercio'],
      bandidos: localTitlesByKind['bandidos'],
      selvagens: localTitlesByKind['selvagens'],
      lider: ['Ordens do líder da Casa', 'Recado urgente do líder', 'Serviço direto ao salão da Casa'],
      suserano: ['Pedido do suserano local', 'Carta lacrada do suserano', 'Chamado feudal do suserano'],
      vassalo: ['Pedido de casa suserana regional', 'Apelo de um vassalo inquieto', 'Disputa em feudo juramentado'],
      coroa: ['Chamado da Coroa', 'Despacho de Porto Real', 'Corvos reais: tarefa sigilosa'],
    };
    const title = rng.pick(titlePools[kind] ?? ['Missão local']);
    const desc = kind === 'diplomacia'
      ? 'Leve uma mensagem e tente melhorar relações com uma vila ou castelo próximo.'
      : kind === 'comercio'
      ? 'Garanta que uma caravana chegue ao destino sem incidentes.'
      : kind === 'lider'
      ? `Um recado direto de ${state.characters[playerHouse.leaderId]?.name ?? 'seu líder'} pede serviço inicial para provar seu valor.`
      : kind === 'suserano'
      ? 'A casa suserana exige ação rápida para manter sua posição feudal.'
      : kind === 'vassalo'
      ? 'Uma casa sob sua influência pede uma resposta firme para manter a ordem.'
      : kind === 'coroa'
      ? 'Um emissário real traz tarefa rara. O risco é alto, mas a recompensa é nobre.'
      : kind === 'bandidos'
      ? 'Um clã de bandidos tem atacado viajantes. Encontre-os e elimine a ameaça.'
      : 'Relatos de selvagens/fora-da-lei. Faça patrulhas e afaste-os.';
    const edges = state.travelGraph[here.id] ?? [];
    const target = edges.length ? rng.pick(edges).toLocationId : here.id;

    const requesterHouseId = kind === 'coroa'
      ? 'targaryen_throne'
      : kind === 'lider'
      ? playerHouse.id
      : kind === 'suserano'
      ? (playerHouse.suzerainId ?? undefined)
      : undefined;

    addMission({
      id: uid('m'),
      kind,
      title,
      description: desc,
      regionId,
      targetLocationId: target,
      requiredMartial: req,
      rewardGold: reward,
      rewardPrestige: kind === 'coroa' ? 3 : kind === 'vassalo' ? 2 : 1,
      rewardRelation: kind === 'coroa' ? 5 : kind === 'vassalo' ? 3 : 2,
      requesterHouseId,
      createdTurn: now,
      expiresTurn: now + rng.int(6, 16),
      status: 'aberta',
    });
  }

  // Complemento: enquanto não for líder e ainda estiver em ascensão, recebe missões do líder da própria Casa.
  const leaderMissionOpen = state.missions.some(m => m.kind === 'lider' && m.status === 'aberta');
  if (!playerIsLeader && !leaderMissionOpen) {
    const leader = state.characters[playerHouse.leaderId];
    const leaderChance = playerPower < 35 ? 0.85 : playerPower < 55 ? 0.55 : 0.25;
    if (leader && leader.alive && rng.chance(leaderChance)) {
      const leaderTitles = [
        `Selo de ${leader.name}: juramento de serviço`,
        `Ordem de ${leader.name}: provar lealdade`,
        `Chamado do salão de ${playerHouse.name}`,
      ];
      const edges = state.travelGraph[here.id] ?? [];
      const target = edges.length ? rng.pick(edges).toLocationId : here.id;
      const req = playerPower < 35 ? rng.int(16, 34) : rng.int(24, 46);
      addMission({
        id: uid('m'),
        kind: 'lider',
        title: rng.pick(leaderTitles),
        description: `${leader.name} pede uma tarefa inicial para fortalecer seu nome dentro de ${playerHouse.name}.`,
        regionId,
        targetLocationId: target,
        requiredMartial: req,
        rewardGold: rng.int(30, 95),
        rewardRelation: 3,
        rewardPrestige: 1,
        requesterHouseId: playerHouse.id,
        createdTurn: now,
        expiresTurn: now + rng.int(7, 14),
        status: 'aberta',
      });
    }
  }

  // Complemento raro: missões da Coroa (não substitui as demais).
  const crownMissionOpen = state.missions.some(m => m.kind === 'coroa' && m.status === 'aberta');
  if (!crownMissionOpen) {
    const crownChance = playerPower >= 75 ? 0.18 : playerPower >= 60 ? 0.10 : 0.03;
    if (rng.chance(crownChance)) {
      const crownSeat = state.houses['targaryen_throne']?.seatLocationId ?? here.id;
      const crownTitles = [
        'Lacre Real: Negócios do Trono de Ferro',
        'Corvos de Porto Real: Missão da Coroa',
        'Decreto selado pelo Mestre dos Sussurros',
      ];
      addMission({
        id: uid('m'),
        kind: 'coroa',
        title: rng.pick(crownTitles),
        description: 'Um emissário real exige discrição e eficácia. Falhar mancha o nome da Casa, vencer abre portas no reino.',
        regionId,
        targetLocationId: crownSeat,
        requiredMartial: rng.int(48, 82),
        rewardGold: rng.int(120, 260),
        rewardHouseGold: rng.int(80, 220),
        rewardPrestige: 3,
        rewardRelation: 6,
        requesterHouseId: 'targaryen_throne',
        createdTurn: now,
        expiresTurn: now + rng.int(8, 18),
        status: 'aberta',
      });
    }
  }


  // --- Missões de suserania/vassalagem (pedidos individuais) ---
  // Mantém poucas ativas ao mesmo tempo para não virar spam.
  if (!playerIsLeader) return;

  const openFeudal = state.missions.filter(m => (m.kind === 'suserano' || m.kind === 'vassalo') && m.status === 'aberta');
  if (openFeudal.length >= 2) return;
  if (!rng.chance(0.65)) return;

  const playerTier = econTierGold(playerHouse);
  const suzerain = playerHouse.suzerainId ? state.houses[playerHouse.suzerainId] : undefined;
  const vassals = Object.values(state.houses).filter(h => h.suzerainId === playerHouse.id);

  const suzerainTier = suzerain ? econTierGold(suzerain) : playerTier;
  const warPressure = (state.canon?.activeWarIds?.length ?? 0) > 0;

  function capByStock(req: number, stock: number, frac: number, floor: number = 0): number {
    const cap = Math.floor(stock * frac);
    return Math.max(floor, Math.min(req, cap));
  }

  // escolhe se vem do suserano (se houver) ou de um vassalo (se você tiver)
  const canSuz = !!suzerain;
  const canVas = vassals.length > 0;
  const kindPick: 'suserano' | 'vassalo' = (canSuz && canVas) ? (rng.chance(0.55) ? 'suserano' : 'vassalo') : (canSuz ? 'suserano' : 'vassalo');
  if (kindPick === 'suserano' && !suzerain) return;
  if (kindPick === 'vassalo' && vassals.length === 0) return;

  if (kindPick === 'suserano') {
    // pedidos do suserano: tributo extra / reforço / escolta
    // Em guerra, suseranos tendem a exigir tropas/tributos; em paz, mais demandas políticas/logísticas.
    const template = (warPressure
      ? rng.pick(['levies', 'tributo', 'escolta'] as const)
      : (rng.pick(['tributo', 'escolta', 'conselho', 'suprimentos'] as any) as any)
    ) as 'tributo' | 'levies' | 'escolta' | 'conselho' | 'suprimentos';

    const baseGoods = suzerainTier === 700 ? 140 : suzerainTier === 500 ? 105 : suzerainTier === 350 ? 75 : 55;
    const baseLevies = suzerainTier === 700 ? 130 : suzerainTier === 500 ? 95 : suzerainTier === 350 ? 70 : 50;
    const baseFood = suzerainTier === 700 ? 260 : suzerainTier === 500 ? 210 : suzerainTier === 350 ? 165 : 125;

    // Respeita a capacidade real da Casa do jogador (não pede o impossível).
    const reqGoods = capByStock(baseGoods, playerHouse.resources.goods ?? 0, 0.45, 15);
    const reqFood = capByStock(baseFood, playerHouse.resources.food ?? 0, 0.45, 25);
    const reqLevies = capByStock(baseLevies, playerHouse.army.levies ?? 0, 0.35, 15);
    const reqMartial = playerTier === 700 ? rng.int(45, 70)
      : playerTier === 500 ? rng.int(40, 65)
      : playerTier === 350 ? rng.int(35, 60)
      : rng.int(28, 55);

    if (template === 'tributo') {
      addMission({
        id: uid('m'),
        kind: 'suserano',
        title: rng.pick(['Cobrança de estandarte: tributo extraordinário','Arca de guerra do suserano','Dízimo de lealdade ao suserano']),
        description: `Um mensageiro de ${suzerain!.name} exige reforço de tributos (recursos). Leve o tributo e mantenha sua posição.`,
        regionId,
        targetLocationId: suzerain!.seatLocationId,
        requiredMartial: 0,
        requiredGoods: reqGoods,
        rewardGold: rng.int(20, 55),
        rewardRelation: 4,
        rewardPrestige: 1,
        requesterHouseId: suzerain!.id,
        createdTurn: now,
        expiresTurn: now + rng.int(8, 16),
        status: 'aberta',
      });
      return;
    }

    if (template === 'levies') {
      addMission({
        id: uid('m'),
        kind: 'suserano',
        title: rng.pick(['Convocação de hoste: envio de levies','Bandeiras erguidas para o suserano','Chamado de guerra do seu suserano']),
        description: `O suserano solicita homens para uma hoste temporária. Envie levies e evite suspeitas de deslealdade.`,
        regionId,
        targetLocationId: suzerain!.seatLocationId,
        requiredMartial: 0,
        requiredLevies: reqLevies,
        rewardGold: rng.int(15, 45),
        rewardHouseGold: rng.int(40, 120),
        rewardRelation: 3,
        rewardPrestige: 1,
        requesterHouseId: suzerain!.id,
        createdTurn: now,
        expiresTurn: now + rng.int(8, 18),
        status: 'aberta',
      });
      return;
    }

    if (template === 'suprimentos') {
      addMission({
        id: uid('m'),
        kind: 'suserano',
        title: rng.pick(['Celeiros para a campanha do suserano','Comboio de víveres da vassalagem','Mantimentos para a marcha do estandarte']),
        description: `O suserano pede mantimentos para abastecer uma campanha. Entregar comida/recursos melhora sua posição na corte.`,
        regionId,
        targetLocationId: suzerain!.seatLocationId,
        requiredMartial: 0,
        requiredFood: reqFood,
        requiredGoods: Math.max(10, Math.floor(reqGoods * 0.6)),
        rewardGold: rng.int(20, 60),
        rewardHouseGold: rng.int(30, 110),
        rewardRelation: 4,
        rewardPrestige: 1,
        requesterHouseId: suzerain!.id,
        createdTurn: now,
        expiresTurn: now + rng.int(8, 16),
        status: 'aberta',
      });
      return;
    }

    if (template === 'conselho') {
      addMission({
        id: uid('m'),
        kind: 'suserano',
        title: rng.pick(['Conselho fechado do suserano','Audiência de lealdade no salão feudal','Mesa de guerra convocada pelo suserano']),
        description: `O suserano convoca você para um conselho privado. Vá ao assento dele para demonstrar lealdade e colher favores.`,
        regionId,
        targetLocationId: suzerain!.seatLocationId,
        requiredMartial: rng.int(10, 25),
        rewardGold: rng.int(25, 75),
        rewardRelation: 5,
        rewardPrestige: 1,
        requesterHouseId: suzerain!.id,
        createdTurn: now,
        expiresTurn: now + rng.int(6, 14),
        status: 'aberta',
      });
      return;
    }

    // escolta
    const edges = state.travelGraph[here.id] ?? [];
    const target = edges.length ? rng.pick(edges).toLocationId : here.id;
    addMission({
      id: uid('m'),
      kind: 'suserano',
      title: rng.pick(['Escolta do comboio feudal','Estrada segura para o tributo da coroa','Guarda de caravana sob juramento']),
      description: `Uma caravana ligada a ${suzerain!.name} precisa atravessar estradas perigosas. Escolte-a até o destino.`,
      regionId,
      targetLocationId: target,
      requiredMartial: reqMartial,
      rewardGold: rng.int(40, 120),
      rewardRelation: 2,
      rewardPrestige: 1,
      requesterHouseId: suzerain!.id,
      createdTurn: now,
      expiresTurn: now + rng.int(6, 14),
      status: 'aberta',
    });
    return;
  }

  // kindPick === 'vassalo'
  const vassal = vassals[rng.int(0, vassals.length - 1)];
  const template = (warPressure
    ? rng.pick(['protecao', 'ajuda', 'media'] as const)
    : (rng.pick(['ajuda', 'media', 'protecao', 'reparos'] as any) as any)
  ) as 'protecao' | 'ajuda' | 'media' | 'reparos';

  // Vassalos pedem ajuda; o suserano deve conseguir atender sem quebrar o cofre.
  const reqFood = capByStock(playerTier === 700 ? 280 : playerTier === 500 ? 220 : playerTier === 350 ? 170 : 130, playerHouse.resources.food ?? 0, 0.45, 20);
  const reqGoods = capByStock(playerTier === 700 ? 100 : playerTier === 500 ? 80 : playerTier === 350 ? 60 : 40, playerHouse.resources.goods ?? 0, 0.45, 10);
  const reqMartial = playerTier === 700 ? rng.int(40, 65)
    : playerTier === 500 ? rng.int(35, 60)
    : playerTier === 350 ? rng.int(30, 55)
    : rng.int(22, 48);

  if (template === 'ajuda') {
    addMission({
      id: uid('m'),
      kind: 'vassalo',
      title: rng.pick([`Inverno curto em ${vassal.name}: auxílio de mantimentos`,`Celeiros vazios em ${vassal.name}`,`Pedido urgente de víveres por ${vassal.name}`]),
      description: `${vassal.name} relata escassez e pede ajuda (comida/recursos). Um suserano forte mantém seus vassalos de pé.`,
      regionId,
      targetLocationId: vassal.seatLocationId,
      requiredMartial: 0,
      requiredFood: reqFood,
      requiredGoods: reqGoods,
      rewardGold: rng.int(15, 50),
      rewardRelation: 4,
      rewardPrestige: 1,
      requesterHouseId: vassal.id,
      createdTurn: now,
      expiresTurn: now + rng.int(8, 16),
      status: 'aberta',
    });
    return;
  }

  if (template === 'media') {
    const others = vassals.filter(x => x.id !== vassal.id);
    const other = others.length ? others[rng.int(0, others.length - 1)] : undefined;
    addMission({
      id: uid('m'),
      kind: 'vassalo',
      title: rng.pick([`Disputa de fronteira sob ${vassal.name}`,`Conciliação feudal solicitada por ${vassal.name}`,`Paz armada entre vassalos`]),
      description: `${vassal.name} pede que você imponha ordem numa disputa local${other ? ` envolvendo ${other.name}` : ''}. Vá até o feudo e resolva com firmeza.`,
      regionId,
      targetLocationId: vassal.seatLocationId,
      requiredMartial: reqMartial,
      rewardGold: rng.int(30, 95),
      rewardRelation: 3,
      rewardPrestige: 1,
      requesterHouseId: vassal.id,
      otherHouseId: other?.id,
      createdTurn: now,
      expiresTurn: now + rng.int(6, 14),
      status: 'aberta',
    });
    return;
  }

  if (template === 'reparos') {
    addMission({
      id: uid('m'),
      kind: 'vassalo',
      title: rng.pick([`Pedra e cal para ${vassal.name}`,`Reforço de muralhas em ${vassal.name}`,`Reconstrução urgente no assento vassalo`]),
      description: `${vassal.name} precisa de recursos para reforçar muralhas e celeiros. Apoiar infraestrutura aumenta lealdade e reduz riscos futuros.`,
      regionId,
      targetLocationId: vassal.seatLocationId,
      requiredMartial: 0,
      requiredGoods: Math.max(10, Math.floor(reqGoods * 1.1)),
      rewardGold: rng.int(10, 40),
      rewardRelation: 4,
      rewardPrestige: 1,
      requesterHouseId: vassal.id,
      createdTurn: now,
      expiresTurn: now + rng.int(8, 18),
      status: 'aberta',
    });
    return;
  }

  // proteção
  addMission({
    id: uid('m'),
    kind: 'vassalo',
    title: rng.pick([`Estandarte sob ataque em ${vassal.name}`,`Caça aos saqueadores de ${vassal.name}`,`Punho de ferro contra bandos locais`]),
    description: `${vassal.name} sofre com saqueadores. Um exemplo de força evita revoltas e traições.`,
    regionId,
    targetLocationId: vassal.seatLocationId,
    requiredMartial: reqMartial,
    rewardGold: rng.int(35, 110),
    rewardGoods: rng.int(15, 55),
    rewardRelation: 3,
    rewardPrestige: 1,
    requesterHouseId: vassal.id,
    createdTurn: now,
    expiresTurn: now + rng.int(6, 14),
    status: 'aberta',
  });
}


function tickMissions(state: GameState, rng: Rng): void {
  // mantém um pequeno estoque de missões na região atual do jogador
  ensureMissions(state, rng);

  const now = state.date.absoluteTurn;
  state.missions = state.missions ?? [];

  // expira missões abertas que passaram do prazo
  for (const m of state.missions) {
    if ((m.status === 'aberta' || m.status === 'aceita') && m.expiresTurn <= now) {
      m.status = 'expirada';
      if (m.assignedToId === state.playerId) {
        pushNarration(state, `⏳ Você perdeu o prazo da missão: ${m.title}.`);
      }

      // penalidade feudal por ignorar pedidos diretos
      if ((m.kind === 'suserano' || m.kind === 'vassalo') && m.requesterHouseId) {
        const ph = state.houses[state.playerHouseId];
        const req = state.houses[m.requesterHouseId];
        if (ph && req) {
          const d = m.kind === 'suserano' ? 5 : 3;
          ph.relations[req.id] = clamp((ph.relations[req.id] ?? 50) - d, 0, 100);
          req.relations[ph.id] = clamp((req.relations[ph.id] ?? 50) - d, 0, 100);
          if (m.kind === 'suserano') ph.prestige = clamp(ph.prestige - 1, 1, 100);
        }
      }
    }
  }

  // resolve missões delegadas após alguns turnos
  const house = state.houses[state.playerHouseId];
  for (const m of state.missions) {
    if (m.status !== 'delegada' || !m.assignedToId) continue;
    const delegatedTurn = (m as any).delegatedTurn ?? m.createdTurn;
    if (now - delegatedTurn < 3) continue;

    const assignee = state.characters[m.assignedToId];
    if (!assignee || !assignee.alive) {
      m.status = 'falhou';
      if (house) pushNarration(state, `⚠️ A missão delegada falhou: ${m.title} (o delegado não está disponível).`);
      continue;
    }

    const pass = assignee.martial >= m.requiredMartial;
    const p = pass ? 0.75 : 0.15;
    if (!rng.chance(p)) continue; // tenta novamente em turnos futuros

    if (pass) {
      m.status = 'concluida';
      // recompensa: vai para o cofre da casa, e uma parte para o delegado
      const houseGold = m.rewardGold + (m.rewardHouseGold ?? 0);
      house.resources.gold += houseGold;
      if ((m.rewardGoods ?? 0) > 0) house.resources.goods = (house.resources.goods ?? 0) + (m.rewardGoods ?? 0);
      if ((m.rewardPrestige ?? 0) > 0) house.prestige = clamp(house.prestige + (m.rewardPrestige ?? 0), 1, 100);

      // relação com a casa que pediu
      if (m.requesterHouseId) {
        const reqHouse = state.houses[m.requesterHouseId];
        if (reqHouse) {
          const d = m.rewardRelation ?? 2;
          house.relations[reqHouse.id] = clamp((house.relations[reqHouse.id] ?? 50) + d, 0, 100);
          reqHouse.relations[house.id] = clamp((reqHouse.relations[house.id] ?? 50) + d, 0, 100);
        }
      }

      const delegateShare = Math.floor(houseGold * 0.20);
      assignee.personalGold = (assignee.personalGold ?? 0) + delegateShare;
      pushNarration(state, `✅ Missão delegada concluída por ${assignee.name}: ${m.title}. +${houseGold} ouro (Casa), +${delegateShare} ouro (delegado).`);
    } else {
      m.status = 'falhou';
      pushNarration(state, `❌ Missão delegada falhou: ${m.title}.`);
    }
  }
}

function promptMissions(state: GameState, rng: Rng): void {
  ensureMissions(state, rng);
  const player = state.characters[state.playerId];
  const here = state.locations[player.locationId];
  const region = state.regions[here.regionId];

  // Mostra missões locais + missões feudo (suserano/vassalo) em qualquer região.
  const seenMissionKeys = new Set<string>();
  const missions = (state.missions ?? [])
    .filter(m => (m.kind === 'suserano' || m.kind === 'vassalo' || m.kind === 'lider' || m.kind === 'coroa') || m.regionId === here.regionId)
    .filter(m => {
      const key = `${m.kind}|${(m.requesterHouseId ?? '-') }|${m.targetLocationId}|${m.title.toLowerCase().trim()}`;
      if (seenMissionKeys.has(key)) return false;
      seenMissionKeys.add(key);
      return true;
    })
    .slice(0, 12);

const playerHouse = state.houses[state.playerHouseId];
const isLeader = playerHouse.leaderId === player.id;
const delegates = isLeader
  ? Object.values(state.characters)
      .filter(c => c.alive && c.currentHouseId === state.playerHouseId && c.id !== player.id && c.ageYears >= 14)
      .sort((a,b)=> b.martial - a.martial)
      .slice(0, 4)
  : [];

  const choices: Choice[] = [];
  for (const m of missions) {
    const targetName = state.locations[m.targetLocationId]?.name ?? m.targetLocationId;
    const requesterName = m.requesterHouseId ? (state.houses[m.requesterHouseId]?.name ?? m.requesterHouseId) : '';

    const reqParts: string[] = [];
    if ((m.requiredGoods ?? 0) > 0) reqParts.push(`Recursos ${m.requiredGoods}`);
    if ((m.requiredFood ?? 0) > 0) reqParts.push(`Comida ${m.requiredFood}`);
    if ((m.requiredGold ?? 0) > 0) reqParts.push(`Ouro ${m.requiredGold}`);
    if ((m.requiredLevies ?? 0) > 0) reqParts.push(`Levies ${m.requiredLevies}`);
    if ((m.requiredMartial ?? 0) > 0) reqParts.push(`Força ${m.requiredMartial}`);
    const reqText = reqParts.length ? reqParts.join(' • ') : '—';

    const rewParts: string[] = [];
    if ((m.rewardGold ?? 0) > 0) rewParts.push(`+${m.rewardGold} ouro pessoal`);
    if ((m.rewardHouseGold ?? 0) > 0) rewParts.push(`+${m.rewardHouseGold} ouro (Casa)`);
    if ((m.rewardGoods ?? 0) > 0) rewParts.push(`+${m.rewardGoods} recursos`);
    if ((m.rewardPrestige ?? 0) > 0) rewParts.push(`Prestígio +${m.rewardPrestige}`);
    if ((m.rewardRelation ?? 0) > 0) rewParts.push(`Relação +${m.rewardRelation}`);
    const rewardText = rewParts.length ? rewParts.join(' • ') : '—';

    const fromText = requesterName ? ` • Pedido: ${requesterName}` : '';
    const isMartialOnly = (m.requiredMartial ?? 0) > 0 && !m.requiredGoods && !m.requiredFood && !m.requiredGold && !m.requiredLevies;
    if (m.status === 'aberta') {
      choices.push({ id: `ms:accept:${m.id}`, label: `Aceitar: ${m.title}`, hint: `Alvo: ${targetName} • Req: ${reqText} • Recompensa: ${rewardText}${fromText}` });
      if (isLeader && delegates.length && isMartialOnly) {
        for (const d of delegates) {
          choices.push({ id: `ms:delegate:${m.id}:${d.id}`, label: `Delegar: ${m.title}`, hint: `Para ${d.name} (força ${d.martial}) • Alvo: ${targetName} • Recompensa: ${rewardText}${fromText}` });
        }
      }
    } else if (m.status === 'aceita' && m.assignedToId === player.id) {
      choices.push({ id: `ms:complete:${m.id}`, label: `Tentar concluir: ${m.title}`, hint: `Vá até ${targetName} e conclua (req ${reqText})` });
      choices.push({ id: `ms:abandon:${m.id}`, label: `Abandonar: ${m.title}`, hint: 'Perde reputação e a missão falha' });
    } else if (m.status === 'concluida') {
      choices.push({ id: `ms:done:${m.id}`, label: `Concluída: ${m.title}`, hint: 'Já concluída', disabled: true });
    }
  }
  choices.push({ id: 'back', label: 'Voltar', hint: 'Retorna ao menu principal' });

  pushSystem(state, `Missões — ${region?.name ?? here.regionId}. Ouro pessoal: ${player.personalGold ?? 0}`, choices);
}

export function applyMissionAction(state: GameState, rng: Rng, cmd: string): void {
  ensureMissions(state, rng);
  const player = state.characters[state.playerId];
  const parts = cmd.split(':');
  const action = parts[0];
  const id = parts[1];
  const extra = parts[2];
  const m = (state.missions ?? []).find(x => x.id === id);
  if (!m) {
    pushNarration(state, 'Missão não encontrada.');
    return promptMissions(state, rng);
  }

  if (action === 'delegate') {
    const house = state.houses[state.playerHouseId];
    const isLeader = house.leaderId === player.id;
    if (!isLeader) {
      pushNarration(state, 'Apenas o líder da Casa pode delegar missões.');
      return promptMissions(state, rng);
    }
    const assigneeId = extra;
    const assignee = assigneeId ? state.characters[assigneeId] : null;
    if (!assignee || !assignee.alive || assignee.currentHouseId !== state.playerHouseId) {
      pushNarration(state, 'Delegado inválido.');
      return promptMissions(state, rng);
    }
    if (m.status !== 'aberta') {
      pushNarration(state, 'Esta missão não está disponível para delegação.');
      return promptMissions(state, rng);
    }
    // delegação só faz sentido para missões de combate/ação
    if ((m.requiredMartial ?? 0) <= 0 || m.requiredGoods || m.requiredFood || m.requiredGold || m.requiredLevies) {
      pushNarration(state, 'Esta missão não pode ser delegada (requer decisões/recursos da Casa).');
      return promptMissions(state, rng);
    }
    m.status = 'delegada';
    m.assignedToId = assignee.id;
    (m as any).delegatedTurn = state.date.absoluteTurn;
    pushNarration(state, `Você delegou a missão “${m.title}” para ${assignee.name}.`);
    return promptMissions(state, rng);
  }

  if (action === 'accept') {
    if (m.status !== 'aberta') {
      pushNarration(state, 'Esta missão não está disponível.');
      return promptMissions(state, rng);
    }
    m.status = 'aceita';
    m.assignedToId = player.id;
    pushNarration(state, `Você aceitou a missão: ${m.title}.`);
    return promptMissions(state, rng);
  }

  if (action === 'complete') {
    if (m.status !== 'aceita' || m.assignedToId !== player.id) {
      pushNarration(state, 'Você não está encarregado desta missão.');
      return promptMissions(state, rng);
    }
    const here = state.locations[player.locationId];
    if (here.id !== m.targetLocationId) {
      pushNarration(state, `Você precisa estar em ${state.locations[m.targetLocationId]?.name ?? m.targetLocationId} para concluir.`);
      return promptMissions(state, rng);
    }

    const house = state.houses[state.playerHouseId];

    // Requisitos de recursos (feudais) — usam o cofre da Casa
    const needGold = m.requiredGold ?? 0;
    const needGoods = m.requiredGoods ?? 0;
    const needFood = m.requiredFood ?? 0;
    const needLevies = m.requiredLevies ?? 0;

    if (needGold > 0 && (house.resources.gold ?? 0) < needGold) {
      pushNarration(state, `Ouro insuficiente no cofre da Casa (${house.resources.gold} / req ${needGold}).`);
      return promptMissions(state, rng);
    }
    if (needGoods > 0 && (house.resources.goods ?? 0) < needGoods) {
      pushNarration(state, `Recursos insuficientes (${house.resources.goods ?? 0} / req ${needGoods}).`);
      return promptMissions(state, rng);
    }
    if (needFood > 0 && (house.resources.food ?? 0) < needFood) {
      pushNarration(state, `Comida insuficiente (${house.resources.food} / req ${needFood}).`);
      return promptMissions(state, rng);
    }
    if (needLevies > 0 && (house.army.levies ?? 0) < needLevies) {
      pushNarration(state, `Levies insuficientes (${house.army.levies} / req ${needLevies}).`);
      return promptMissions(state, rng);
    }

    // Requisito de combate/dificuldade (se aplicável)
    if ((m.requiredMartial ?? 0) > 0 && player.martial < m.requiredMartial) {
      pushNarration(state, `Força insuficiente (você ${player.martial} / req ${m.requiredMartial}). Você falhou desta vez.`);
      // pequena penalidade
      player.personalPrestige = clamp((player.personalPrestige ?? 0) - 1, 0, 100);
      return promptMissions(state, rng);
    }

    // Consome requisitos
    if (needGold > 0) house.resources.gold -= needGold;
    if (needGoods > 0) house.resources.goods = (house.resources.goods ?? 0) - needGoods;
    if (needFood > 0) house.resources.food -= needFood;
    if (needLevies > 0) house.army.levies -= needLevies;

    // sucesso
    m.status = 'concluida';

    // Recompensas
    if ((m.rewardGold ?? 0) > 0) player.personalGold = (player.personalGold ?? 0) + m.rewardGold;
    if ((m.rewardHouseGold ?? 0) > 0) house.resources.gold += m.rewardHouseGold ?? 0;
    if ((m.rewardGoods ?? 0) > 0) house.resources.goods = (house.resources.goods ?? 0) + (m.rewardGoods ?? 0);
    if ((m.rewardPrestige ?? 0) > 0) house.prestige = clamp(house.prestige + (m.rewardPrestige ?? 0), 1, 100);

    // relação com quem pediu
    if (m.requesterHouseId) {
      const req = state.houses[m.requesterHouseId];
      if (req) {
        const d = m.rewardRelation ?? 2;
        house.relations[req.id] = clamp((house.relations[req.id] ?? 50) + d, 0, 100);
        req.relations[house.id] = clamp((req.relations[house.id] ?? 50) + d, 0, 100);
      }
    }

    player.personalPrestige = clamp((player.personalPrestige ?? 0) + 1, 0, 100);

    const rewardBits: string[] = [];
    if ((m.rewardGold ?? 0) > 0) rewardBits.push(`+${m.rewardGold} ouro pessoal`);
    if ((m.rewardHouseGold ?? 0) > 0) rewardBits.push(`+${m.rewardHouseGold} ouro (Casa)`);
    if ((m.rewardGoods ?? 0) > 0) rewardBits.push(`+${m.rewardGoods} recursos`);
    if ((m.rewardPrestige ?? 0) > 0) rewardBits.push(`Prestígio +${m.rewardPrestige}`);
    if ((m.rewardRelation ?? 0) > 0) rewardBits.push(`Relação +${m.rewardRelation}`);

    pushNarration(state, `Missão concluída: ${m.title}. ${rewardBits.length ? rewardBits.join(' • ') : ''}`.trim());
    return promptMissions(state, rng);
  }

  if (action === 'abandon') {
    if (m.status === 'aceita' && m.assignedToId === player.id) {
      m.status = 'falhou';
      const basePenalty = (m.kind === 'suserano' || m.kind === 'vassalo') ? 3 : 2;
      player.personalPrestige = clamp((player.personalPrestige ?? 0) - basePenalty, 0, 100);

      // penaliza relação feudal se for pedido direto
      if (m.requesterHouseId) {
        const house = state.houses[state.playerHouseId];
        const req = state.houses[m.requesterHouseId];
        if (house && req) {
          const d = (m.kind === 'suserano') ? 6 : 4;
          house.relations[req.id] = clamp((house.relations[req.id] ?? 50) - d, 0, 100);
          req.relations[house.id] = clamp((req.relations[house.id] ?? 50) - d, 0, 100);
        }
      }
      pushNarration(state, `Você abandonou a missão: ${m.title}.`);
      return promptMissions(state, rng);
    }
  }

  promptMissions(state, rng);
}

export function applyTravel(state: GameState, rng: Rng, toLocationId: string): void {
  const player = state.characters[state.playerId];
  const from = state.locations[player.locationId];
  const edges = state.travelGraph[from.id] ?? [];
  const edge = edges.find((e) => e.toLocationId === toLocationId);
  if (!edge) {
    pushNarration(state, 'Caminho inválido.');
    return promptMainMenu(state, rng);
  }

  const armySize = getActiveArmySize(state, 0.6); // padrão: marcha com 60% (o resto fica)
  const cost = travelFoodCost(state, edge.distance, armySize);
  const house = state.houses[state.playerHouseId];

  // Mantimentos da comitiva
  const paid = Math.min(house.resources.food, cost);
  house.resources.food -= paid;
  if (paid < cost) {
    // Sair sem mantimentos suficientes cobra o preço na estrada.
    house.prestige = clamp(house.prestige - 1, 1, 100);
    pushNarration(state, `⚠️ Mantimentos insuficientes para a jornada (${paid}/${cost}). A comitiva sofre na estrada. Prestígio -1.`);
  }

  // encontro
  const risk = travelEncounterRisk(state, from.regionId, armySize, house.prestige);
  pushNarration(state, `Você parte rumo a ${state.locations[toLocationId].name}. Mantimentos: -${paid} comida.`);

  if (rng.chance(risk)) {
    resolveEncounter(state, rng, armySize);
    // pode morrer aqui
    if (!state.characters[state.playerId].alive) return;
  } else {
    pushNarration(state, 'A estrada foi silenciosa. Apenas o vento e os corvos como testemunhas.');
  }

  player.locationId = toLocationId;

  // conhecer gente local automaticamente
  markLocalsKnown(state, rng, toLocationId);

  // a distância define quantos turnos se passam durante a viagem
  const travelTurns = Math.max(1, edge.distance);
  for (let i = 0; i < travelTurns; i++) {
    advanceTurn(state, rng, { silent: true });
    if (state.game.over) return;
  }

  pushNarration(state, `🧭 A viagem consumiu ${travelTurns} turno(s), conforme a distância percorrida.`);
  pushNarration(state, `⏳ Agora é Ano ${state.date.year} DC, Turno ${state.date.turn}/20.`);
  promptMainMenu(state, rng);
}

function travelEncounterRisk(state: GameState, regionId: string, armySize: number, prestige: number): number {
  // base por região (norte e rios um pouco mais perigosos)
  let base = 0.10;
  if (regionId === 'north') base = 0.14;
  if (regionId === 'riverlands') base = 0.13;
  if (regionId === 'iron_islands') base = 0.12;
  if (regionId === 'reach') base = 0.08;

  // exército reduz risco
  const armyFactor = clamp(1 - armySize / 260, 0.25, 1);
  // prestígio reduz risco (medo/respeito)
  const prestigeFactor = clamp(1 - prestige / 250, 0.6, 1);
  return clamp(base * armyFactor * prestigeFactor, 0.02, 0.25);
}

function resolveEncounter(state: GameState, rng: Rng, armySize: number): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  const bandits = rng.int(18, 120);
  const banditPower = bandits * rng.int(1, 3);

  const playerPower = Math.round(
    (armySize * 2.0) +
    (house.army.knights * 12) +
    (house.army.squires * 6) +
    (house.army.menAtArms * 4) +
    (player.martial * 2)
  );

  pushNpc(state, 'Batedor', `Emboscada na estrada! Um grupo de ${bandits} bandidos tenta cercar sua comitiva.`);

  const winChance = clamp(playerPower / (playerPower + banditPower), 0.1, 0.9);
  if (rng.chance(winChance)) {
    const lootGold = rng.int(20, 120);
    const lootFood = rng.int(30, 140);
    house.resources.gold += lootGold;
    house.resources.food += lootFood;
    house.prestige = clamp(house.prestige + 1, 1, 100);

    pushNarration(state, `Você repele os bandidos e recolhe espólios: +${lootGold} ouro, +${lootFood} comida. Prestígio +1.`);
  } else {
    // chance de morte do jogador na derrota
    const deathChance = clamp(0.30 + (banditPower - playerPower) / 900, 0.25, 0.80);
    if (rng.chance(deathChance)) {
      player.alive = false;
      pushNarration(state, 'A emboscada dá errado. Sua visão escurece — e o mundo segue sem você.');
      handlePlayerDeath(state, rng, 'Morte em emboscada');
      return;
    }
    const lossGold = Math.min(house.resources.gold, rng.int(40, 180));
    const lossFood = Math.min(house.resources.food, rng.int(60, 220));
    house.resources.gold -= lossGold;
    house.resources.food -= lossFood;
    house.prestige = clamp(house.prestige - 2, 1, 100);

    pushNarration(state, `Você consegue escapar, mas paga caro: -${lossGold} ouro, -${lossFood} comida. Prestígio -2.`);
  }
}

function markLocalsKnown(state: GameState, rng: Rng, locationId: string): void {
  const playerHouse = state.houses[state.playerHouseId];
  const regionId = state.locations[locationId].regionId;

  const localChars = Object.values(state.characters)
    .filter(c => c.alive && c.locationId === locationId && state.houses[c.currentHouseId]?.regionId === regionId);

  // garante que algumas pessoas locais sejam “conhecidas”
  for (const c of localChars.slice(0, 6)) {
    if (!c.knownToPlayer) {
      c.knownToPlayer = true;
      c.relationshipToPlayer = clamp(25 + rng.int(-5, 10), 0, 100);
      pushNarration(state, `Você passa a conhecer ${c.name} (${state.houses[c.currentHouseId]?.name ?? 'Casa desconhecida'}).`);
    }
  }
}


function isRegionalSuzerain(state: GameState, h: HouseState): boolean {
  // aproximação: prestígio de suserano e vassalagem direta ao Trono (exceto Terras da Coroa)
  return !h.isIronThrone && h.prestige >= 76 && h.suzerainId === 'targaryen_throne' && h.regionId !== 'crownlands';
}

function computeContactableHouses(state: GameState): HouseState[] {
  const playerHouse = state.houses[state.playerHouseId];
  const sameRegion = Object.values(state.houses).filter(h => h.regionId === playerHouse.regionId);

  const set = new Map<string, HouseState>();
  for (const h of sameRegion) set.set(h.id, h);

  if (playerHouse.suzerainId && state.houses[playerHouse.suzerainId]) {
    set.set(playerHouse.suzerainId, state.houses[playerHouse.suzerainId]);
  }

  const playerIsSuzerain = Object.values(state.houses).some(h => h.suzerainId === playerHouse.id);
  const playerIsHighPrestige = playerHouse.prestige >= 76 || playerIsSuzerain;
  const iron = Object.values(state.houses).find(h => h.isIronThrone);

  if (playerHouse.isIronThrone) {
    // A Coroa fala basicamente com suseranos regionais e nobres do nível de suserano
    for (const h of Object.values(state.houses)) {
      if (isRegionalSuzerain(state, h) || (h.prestige >= 76 && !h.isIronThrone)) set.set(h.id, h);
    }
  } else if (playerIsHighPrestige) {
    // Suseranos/nobres prestigiados podem falar com: outros suseranos + casas nobres relevantes fora da região + Coroa
    for (const h of Object.values(state.houses)) {
      if (h.regionId === playerHouse.regionId) continue;
      if (isRegionalSuzerain(state, h) || h.prestige >= 51) set.set(h.id, h);
    }
    if (iron) set.set(iron.id, iron);
  }

  return [...set.values()].sort((a,b)=> b.prestige - a.prestige);
}

function promptDiplomacy(state: GameState, rng: Rng): void {
  const player = state.characters[state.playerId];
  const here = state.locations[player.locationId];
  const regionId = here.regionId;
  const playerHouse = state.houses[state.playerHouseId];

  const nearbyHouses = Object.values(state.houses)
    .filter(h => h.regionId === regionId)
    .sort((a,b) => b.prestige - a.prestige)
    .slice(0, 10);

  const lines = nearbyHouses.map(h => {
    const rel = playerHouse.relations[h.id] ?? 50;
    return `• ${h.name} — Prestígio ${h.prestige} • Relação ${rel}`;
  }).join('\n');

  const text =
    `Você está em ${here.name} (${state.regions[regionId].name}).
` +
    `Casas da região (top 10):
${lines}

` +
    `Escolha uma ação diplomática:`;

  const choices: Choice[] = [
    { id: 'dip:talk', label: 'Conversar', hint: 'Melhora relação com uma pessoa conhecida (leve)' },
    { id: 'dip:gift', label: 'Dar presente', hint: 'Custa ouro, melhora relação (médio)' },
    { id: 'dip:audience', label: 'Pedir audiência', hint: 'Tentar contato com casas mais prestigiosas (difícil)' },
    { id: 'dip:marriage', label: 'Propor casamento', hint: 'Aliança via casamento (exige boa relação)' },
    ...(state.endgame.danyArrived && !state.endgame.kingsLandingBurned ? [{
      id: 'dip:dany',
      label: 'Daenerys Targaryen',
      hint: 'Negociar / atacar (condição especial de “vitória”)'
    }] as Choice[] : []),
    { id: 'dip:war', label: 'Guerra', hint: 'Declarar guerra ou negociar paz (apenas líderes)' },
    { id: 'dip:ironbank', label: 'Banco de Ferro', hint: 'Pedir empréstimo / pagar dívida' },
    { id: 'back', label: 'Voltar' },
  ];
  pushSystem(state, text, choices);
}

export function applyDiplomacy(state: GameState, rng: Rng, action: string): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  switch (action) {
    case 'dany': {
      if (!state.endgame.danyArrived || state.endgame.kingsLandingBurned) {
        pushNarration(state, 'Você não consegue mais alcançar Daenerys a tempo.');
        return promptMainMenu(state, rng);
      }
      const rel = clamp(state.endgame.danyRelation, 0, 100);
      const p = state.characters[state.playerId];
      const genderOk = p.gender === 'M';
      const married = p.maritalStatus === 'married';

      const choices: Choice[] = [
        { id: 'dany:talk', label: 'Conversar', hint: `Relação com Daenerys: ${rel}/100` },
        { id: 'dany:gift', label: 'Enviar presente', hint: 'Custa ouro, melhora relação' },
        { id: 'dany:ally', label: 'Oferecer apoio', hint: 'Tenta evitar conflito (não é “vitória”)' },
        {
          id: 'dany:marry',
          label: 'Propor casamento',
          disabled: !genderOk || married,
          hint: genderOk ? (married ? 'Você já é casado.' : 'Requer relação muito alta (90+)') : 'Relações apenas heterossexuais: seu personagem precisa ser masculino.'
        },
        { id: 'dany:attack', label: 'Atacar Daenerys', hint: 'Batalha arriscada contra um exército quase impossível' },
        { id: 'back', label: 'Voltar' },
      ];

      pushSystem(state,
        `Daenerys Targaryen está em Westeros. Relação atual: ${rel}/100.
\nSem mecânica de dragões em cena — mas, em batalha, cada dragão equivale a 10.000 cavaleiros.`,
        choices
      );
      return;
    }
    case 'talk': {
      const known = Object.values(state.characters)
        .filter(c => c.alive && c.knownToPlayer && c.id !== player.id && c.locationId === player.locationId)
        .slice(0, 8);

      if (known.length === 0) {
        pushNarration(state, 'Não há conhecidos por perto. Viaje, faça torneios ou peça audiência.');
        return promptMainMenu(state, rng);
      }
      const choices: Choice[] = known.map(c => ({
        id: `talk:${c.id}`,
        label: `Conversar com ${c.name}`,
        hint: `Relação atual ${c.relationshipToPlayer}/100`
      }));
      choices.push({ id: 'back', label: 'Voltar' });
      pushSystem(state, 'Com quem você quer conversar?', choices);
      return;
    }
    case 'gift': {
      const known = Object.values(state.characters)
        .filter(c => c.alive && c.knownToPlayer && c.id !== player.id && c.locationId === player.locationId)
        .slice(0, 8);
      if (known.length === 0) {
        pushNarration(state, 'Você precisa conhecer alguém primeiro.');
        return promptMainMenu(state, rng);
      }
      const choices: Choice[] = known.map(c => ({
        id: `gift:${c.id}`,
        label: `Presentear ${c.name}`,
        hint: `Custo 35 ouro • Relação +6~+14`
      }));
      choices.push({ id: 'back', label: 'Voltar' });
      pushSystem(state, 'Presentes: flores raras, vinho de Arbor, seda de Lys (abstrato). Quem receberá?', choices);
      return;
    }
    case 'audience': {
      // lista de casas acima do seu prestígio
      const regionHouses = Object.values(state.houses)
        .filter(h => h.regionId === state.locations[player.locationId].regionId && h.id !== house.id)
        .sort((a,b)=> b.prestige - a.prestige)
        .slice(0, 8);

      const choices: Choice[] = regionHouses.map(h => {
        const rel = house.relations[h.id] ?? 50;
        const delta = h.prestige - house.prestige;
        const hint = `Prestígio ${h.prestige} (Δ ${delta}) • Relação ${rel} • Sucesso depende do seu prestígio`;
        return { id: `aud:${h.id}`, label: `Pedir audiência à ${h.name}`, hint };
      });
      choices.push({ id: 'back', label: 'Voltar' });
      pushSystem(state, 'A quem você tentará acesso?', choices);
      return;
    }
    case 'marriage': {
      pushNarration(state, 'Sistema de casamento: nesta versão, você propõe ao nível de Casa (não personagem específico) e o jogo escolhe um par plausível.');
      const candidates = Object.values(state.houses)
        .filter(h => h.id !== house.id)
        .sort((a,b)=> b.prestige - a.prestige)
        .slice(0, 10);

      const choices: Choice[] = candidates.map(h => {
        const rel = house.relations[h.id] ?? 50;
        const ok = rel >= 50;
        return { id: `mar:${h.id}`, label: `Propor aliança/casamento com ${h.name}`, hint: ok ? `Relação ${rel} (ok)` : `Relação ${rel} (mín. 50)` , disabled: !ok };
      });
      choices.push({ id: 'back', label: 'Voltar' });
      pushSystem(state, 'Qual casa receberá a proposta? (mínimo relação 50)', choices);
      return;
    }
    case 'war': {
      const isLeader = house.leaderId === player.id;
      if (!isLeader) {
        pushNarration(state, 'Só o líder da Casa pode declarar guerra ou assinar a paz.');
        return promptMainMenu(state, rng);
      }

      const mine = warsOf(state, house.id);
      const choices: Choice[] = [];

      for (const w of mine) {
        const other = w.attackerHouseId === house.id ? w.defenderHouseId : w.attackerHouseId;
        const side = sideOf(w, house.id);
        const mineScore = side === 'attacker' ? w.scoreAttacker : w.scoreDefender;
        const theirScore = side === 'attacker' ? w.scoreDefender : w.scoreAttacker;
        choices.push({
          id: `war:peace:${w.id}`,
          label: `Propor paz a ${state.houses[other]?.name ?? other}`,
          hint: `Placar ${mineScore}–${theirScore} • termos seguem quem está à frente`,
        });
      }

      // Alvos possíveis: casas alcançáveis com quem você ainda não está em guerra.
      const targets = computeContactableHouses(state)
        .filter(h => h.id !== house.id && !warBetween(state, house.id, h.id))
        .slice(0, 8);

      for (const t of targets) {
        const cbs = availableCasusBelli(state, house.id, t.id);
        const best = cbs[0];
        const rel = house.relations[t.id] ?? 50;
        choices.push({
          id: `war:declare:${t.id}:${best}`,
          label: `Declarar guerra a ${t.name}`,
          hint: `${casusBelliLabel(best)} • prestígio ${t.prestige} • relação ${rel}`
            + (best === 'conquest' ? ' • SEM justificativa: -6 prestígio e todo o reino se afasta' : ''),
        });
      }

      choices.push({ id: 'back', label: 'Voltar' });
      pushSystem(state,
        mine.length
          ? `Você está em ${mine.length} guerra(s). Escolha uma ação.`
          : 'Nenhuma guerra em andamento. Escolha um alvo — e um motivo que o reino aceite.',
        choices);
      return;
    }
    case 'ironbank': {
      const debt = state.ironBankDebt;
      if (!debt) {
        pushSystem(state, 'Banco de Ferro (Braavos): você pode pedir um empréstimo. Juros 12% a.a. (cobrança a cada 20 turnos).', [
          { id: 'ib:loan:300', label: 'Pedir 300 ouro', hint: 'Prestígio -1 (suspeitas), +300 ouro' },
          { id: 'ib:loan:600', label: 'Pedir 600 ouro', hint: 'Prestígio -2, +600 ouro' },
          { id: 'ib:loan:1000', label: 'Pedir 1000 ouro', hint: 'Prestígio -3, +1000 ouro' },
          { id: 'back', label: 'Voltar' },
        ]);
      } else {
        pushSystem(state,
          `Dívida ativa: principal ${debt.principal} • juros ${Math.round(debt.interestRateYear*100)}% a.a.
` +
          `Pagamento mínimo: ${debt.minimumPayment} ouro • Próxima cobrança no turno ${debt.nextPaymentTurn}.
` +
          `Atrasos: ${debt.missedPayments}.`,
          [
            { id: 'ib:paymin', label: 'Pagar mínimo', hint: 'Reduz risco de intervenção' },
            { id: 'ib:payall', label: 'Quitar tudo', hint: 'Limpa dívida, prestígio +1' },
            { id: 'back', label: 'Voltar' },
          ]
        );
      }
      return;
    }
  }
}

export function applyDiplomacyChoice(state: GameState, rng: Rng, action: string, targetId: string): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  if (action === 'talk') {
    const target = state.characters[targetId];
    if (!target || !target.alive) {
      pushNarration(state, 'Essa pessoa não está disponível.');
      return promptMainMenu(state, rng);
    }
    const gain = rng.int(2, 6);
    target.relationshipToPlayer = clamp(target.relationshipToPlayer + gain, 0, 100);
    canonTouchIfCanonical(state, target, 'diplomacy_talk', 1);
    // relação entre casas também sobe levemente
    house.relations[target.currentHouseId] = clamp((house.relations[target.currentHouseId] ?? 50) + 1, 0, 100);
    pushNpc(state, target.name, '“O mundo é grande… e perigoso. Ainda bem que existem amigos.”');
    pushNarration(state, `Relação pessoal +${gain}. Relação entre casas +1.`);
    return promptMainMenu(state, rng);
  }

  if (action === 'gift') {
    const target = state.characters[targetId];
    if (!target || !target.alive) {
      pushNarration(state, 'Essa pessoa não está disponível.');
      return promptMainMenu(state, rng);
    }
    if (house.resources.gold < 35) {
      pushNarration(state, 'Ouro insuficiente para um presente digno.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= 35;
    const gain = rng.int(6, 14);
    target.relationshipToPlayer = clamp(target.relationshipToPlayer + gain, 0, 100);
    canonTouchIfCanonical(state, target, 'diplomacy_gift', 2);
    house.relations[target.currentHouseId] = clamp((house.relations[target.currentHouseId] ?? 50) + rng.int(2, 5), 0, 100);
    pushNpc(state, target.name, '“Isso… é mais do que eu esperava. Você tem minha atenção.”');
    pushNarration(state, `Você gasta 35 ouro. Relação pessoal +${gain}. Relação entre casas melhora.`);
    return promptMainMenu(state, rng);
  }

  if (action === 'aud') {
    const targetHouse = state.houses[targetId];
    if (!targetHouse) {
      pushNarration(state, 'Casa inválida.');
      return promptMainMenu(state, rng);
    }
    const rel = house.relations[targetHouse.id] ?? 50;
    const prestigeGap = targetHouse.prestige - house.prestige;
    // dificuldade aumenta com gap; relação ajuda
    const base = 0.45 - clamp(prestigeGap / 120, 0, 0.35) + clamp((rel - 50) / 200, -0.10, 0.20);
    const chance = clamp(base, 0.08, 0.75);

    if (rng.chance(chance)) {
      // cria um NPC representante da casa se não existir na localização
      const rep = spawnEnvoy(state, rng, targetHouse.id, player.locationId);
      rep.knownToPlayer = true;
      rep.relationshipToPlayer = clamp(30 + rng.int(-5, 10), 0, 100);

      pushNarration(state, `Você consegue uma audiência. Um emissário de ${targetHouse.name} lhe recebe.`);
      pushNpc(state, rep.name, '“Fale. Mas seja breve.”');
      // melhora relação entre casas pelo gesto
      house.relations[targetHouse.id] = clamp(rel + rng.int(2, 6), 0, 100);
    } else {
      pushNarration(state, `A tentativa falha. Guardas e criados lhe fazem esperar… e a porta nunca se abre.`);
      house.relations[targetHouse.id] = clamp(rel - rng.int(1, 4), 0, 100);
      house.prestige = clamp(house.prestige - 1, 1, 100);
    }
    return promptMainMenu(state, rng);
  }

  if (action === 'mar') {
    const targetHouse = state.houses[targetId];
    if (!targetHouse) {
      pushNarration(state, 'Casa inválida.');
      return promptMainMenu(state, rng);
    }
    const rel = house.relations[targetHouse.id] ?? 50;
    if (rel < 50) {
      pushNarration(state, 'Relação insuficiente para uma proposta séria.');
      return promptMainMenu(state, rng);
    }

    // chance base: casas tendem a aceitar igual nível; gap grande reduz
    const gap = targetHouse.prestige - house.prestige;
    const accept = clamp(0.55 - clamp(gap / 120, -0.10, 0.35) + (rel - 50) / 120, 0.15, 0.90);

    if (rng.chance(accept)) {
      // aliança
      house.relations[targetHouse.id] = clamp(rel + rng.int(10, 18), 0, 100);
      targetHouse.relations[house.id] = clamp((targetHouse.relations[house.id] ?? 50) + rng.int(8, 14), 0, 100);

      pushNarration(state, `Proposta aceita. Um pacto de casamento/aliança com ${targetHouse.name} é firmado (em termos gerais).`);
      state.chronicle.unshift({
        turn: state.date.absoluteTurn,
        title: 'Aliança selada',
        body: `${house.name} e ${targetHouse.name} firmam acordos matrimoniais e juram apoio mútuo.`,
        tags: ['aliança', 'casamento']
      });
      // prestígio sobe um pouco
      house.prestige = clamp(house.prestige + 2, 1, 100);
    } else {
      pushNarration(state, `Proposta recusada. A recusa ecoa pelos salões, e sua Casa paga o preço social.`);
      // penalidade depende do gap
      const loss = clamp(2 + Math.floor(Math.max(0, gap) / 18), 2, 10);
      house.prestige = clamp(house.prestige - loss, 1, 100);
      house.relations[targetHouse.id] = clamp(rel - rng.int(4, 10), 0, 100);
    }

    return promptMainMenu(state, rng);
  }

  if (action === 'ib') {
    // handled separately in applyIronBank
  }
}

export function applyDaenerysAction(state: GameState, rng: Rng, action: string): void {
  if (state.game.over) return;
  if (!state.endgame.danyArrived || state.endgame.kingsLandingBurned) {
    pushNarration(state, 'Daenerys não está mais acessível.');
    return promptMainMenu(state, rng);
  }
  const p = state.characters[state.playerId];
  const playerHouse = state.houses[state.playerHouseId];
  const danyHouse = state.houses[DANY_HOUSE_ID];

  const relBefore = clamp(state.endgame.danyRelation, 0, 100);

  if (action === 'talk') {
    const gain = rng.int(3, 7);
    state.endgame.danyRelation = clamp(relBefore + gain, 0, 100);
    pushNpc(state, 'Daenerys', '“Westeros é feito de promessas quebradas. Dê-me uma razão para acreditar na sua.”');
    pushNarration(state, `Relação com Daenerys +${gain}.`);
    return promptMainMenu(state, rng);
  }

  if (action === 'gift') {
    const cost = 120;
    if (playerHouse.resources.gold < cost) {
      pushNarration(state, `Ouro insuficiente. Um gesto que alcance a Rainha Dragão custa pelo menos ${cost} ouro.`);
      return promptMainMenu(state, rng);
    }
    playerHouse.resources.gold -= cost;
    const gain = rng.int(8, 16);
    state.endgame.danyRelation = clamp(relBefore + gain, 0, 100);
    pushNpc(state, 'Daenerys', '“Você entende o valor de um símbolo… e do custo de mantê-lo.”');
    pushNarration(state, `Você gasta ${cost} ouro. Relação com Daenerys +${gain}.`);
    return promptMainMenu(state, rng);
  }

  if (action === 'ally') {
    // Não é "vitória" – apenas melhora relação/evita hostilidade imediata.
    const gain = clamp(4 + Math.floor(playerHouse.prestige / 25), 4, 10);
    state.endgame.danyRelation = clamp(relBefore + gain, 0, 100);
    playerHouse.relations[DANY_HOUSE_ID] = clamp((playerHouse.relations[DANY_HOUSE_ID] ?? 40) + gain, 0, 100);
    pushNarration(state, 'Você oferece apoio político e logístico. Isso não muda o destino do reino… mas muda o olhar que ela lança para você.');
    pushNarration(state, `Relação com Daenerys +${gain}. Relação entre casas melhora.`);
    return promptMainMenu(state, rng);
  }

  if (action === 'marry') {
    if (p.gender !== 'M') {
      pushNarration(state, 'Pelas regras desta campanha, casamentos/romances são apenas heterossexuais.');
      return promptMainMenu(state, rng);
    }
    if (p.maritalStatus === 'married') {
      pushNarration(state, 'Você já é casado.');
      return promptMainMenu(state, rng);
    }
    const rel = clamp(state.endgame.danyRelation, 0, 100);
    if (rel < 90) {
      pushNarration(state, 'Daenerys não aceita. Sua proposta é ousada demais sem confiança absoluta (requer 90+).');
      state.endgame.danyRelation = clamp(rel - 3, 0, 100);
      return promptMainMenu(state, rng);
    }
    if (playerHouse.prestige < 70) {
      pushNarration(state, 'Mesmo com simpatia pessoal, sua Casa não tem peso suficiente para um casamento que reescreva o mundo (requer prestígio 70+).');
      return promptMainMenu(state, rng);
    }

    // Sucesso: vitória.
    pushNarration(state, '📜 Um casamento impensável é firmado. O destino de Westeros se desvia — e a história termina na sua sombra.');
    state.chronicle.unshift({
      turn: state.date.absoluteTurn,
      title: 'Aliança Impossível',
      body: `${playerHouse.name} e Daenerys Targaryen firmam um casamento que muda os Nove Reinos.`,
      tags: ['daenerys', 'casamento', 'vitória'],
    });
    return setVictory(state, 'Você se casou com Daenerys Targaryen — uma vitória rara, conquistada por prestígio e confiança extrema.');
  }

  if (action === 'attack') {
    pushNarration(state, '⚔️ Você escolhe a guerra contra Daenerys.');

    const playerPower = computeArmyPower(playerHouse.army) + (p.martial * 6) + (playerHouse.prestige * 4);
    const danyLeader = state.characters[danyHouse.leaderId];
    const danyPower = computeArmyPower(danyHouse.army) + ((danyLeader?.charm ?? 0) * 2) + (danyHouse.prestige * 4);

    const winChance = clamp(playerPower / (playerPower + danyPower), 0.01, 0.80);
    if (rng.chance(winChance)) {
      state.chronicle.unshift({
        turn: state.date.absoluteTurn,
        title: 'O Impossível Acontece',
        body: `${playerHouse.name} derrota as forças de Daenerys em batalha. Os bardos cantarão por gerações — se houver bardo para cantar.`,
        tags: ['daenerys', 'guerra', 'vitória'],
      });
      return setVictory(state, 'Você derrotou o exército de Daenerys em batalha — a única outra forma de “vencer”.');
    }

    // derrota -> o jogador morre; sucessão segue regra normal (se houver)
    p.alive = false;
    pushNarration(state, '🔥 A batalha é um desastre. O céu se ilumina e o chão vira cinza. Você cai.');
    handlePlayerDeath(state, rng, 'Derrota contra Daenerys');
    return;
  }

  pushNarration(state, 'Ação inválida.');
  return promptMainMenu(state, rng);
}

function spawnEnvoy(state: GameState, rng: Rng, houseId: string, locationId: string): Character {
  const id = uid('c');
  const gender: Gender = rng.chance(0.55) ? 'M' : 'F';
  const name = genFirstName(rng, gender) + maybeEpithet(rng, gender);
  const c: Character = {
    id,
    name,
    gender,
    ageYears: rng.int(20, 45),
    alive: true,

    birthHouseId: houseId,
    currentHouseId: houseId,

    maritalStatus: 'single',
    keepsBirthName: false,

    locationId,

    martial: clamp(rng.int(20, 55), 0, 100),
    charm: clamp(rng.int(30, 70), 0, 100),
    beauty: clamp(rng.int(30, 70), 0, 100),
    renownTier: 'comum',
    fertility: rng.chance(0.05) ? 'sterile' : 'fertile',
    wellLiked: clamp(rng.int(25, 75), 0, 100),

    // emissários são “pessoas” com alguma reputação pessoal, mas baixa
    personalPrestige: clamp(rng.int(0, 12), 0, 100),

    knownToPlayer: true,
    relationshipToPlayer: clamp(25 + rng.int(-10, 10), 0, 100),

    title: 'Emissário',
  };
  state.characters[id] = c;
  return c;
}

function promptTraining(state: GameState, rng: Rng): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  const text =
    `Treino e aparência.
` +
    `• Combate (martial): aumenta chance de sobreviver e vencer encontros.
` +
    `• Beleza/Apresentação: ajuda em relações e casamentos.
` +
    `• Renome: evolui com martial.

` +
    `Seu martial: ${player.martial} (${player.renownTier}) • beleza: ${player.beauty} • ouro: ${house.resources.gold}`;

  pushSystem(state, text, [
    { id: 'tr:yard', label: 'Treinar no pátio', hint: 'Custo 20 ouro • martial +2~+6' },
    { id: 'tr:drill', label: 'Treino disciplinado (instrutor)', hint: 'Custo 55 ouro • martial +3~+8 • charm +0~+2 • crescimento estável' },
    { id: 'tr:attire_basic', label: 'Comprar roupa simples', hint: 'Custo 15 ouro • beleza +1~+3' },
    { id: 'tr:attire', label: 'Comprar traje refinado', hint: 'Custo 35 ouro • beleza +3~+8' },
    { id: 'tr:attire_noble', label: 'Encomendar vestes nobres', hint: 'Custo 90 ouro • beleza +6~+12 • prestígio pessoal +1' },
    { id: 'tr:duel', label: 'Treino de combate arriscado', hint: 'Custo 0 • martial +4~+10 (10% ferimento social: prestígio -1)' },
    { id: 'back', label: 'Voltar' },
  ]);
}

export function applyTraining(state: GameState, rng: Rng, trainingId: string): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  if (trainingId === 'yard') {
    if (house.resources.gold < 20) {
      pushNarration(state, 'Ouro insuficiente para pagar mestres/armas e equipamentos.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= 20;
    const gain = rng.int(2, 6);
    player.martial = clamp(player.martial + gain, 0, 100);
    player.renownTier = renownFromMartial(player.martial);
    pushNarration(state, `Você treina intensamente. Martial +${gain}.`);
    return promptMainMenu(state, rng);
  }

  if (trainingId === 'drill') {
    if (house.resources.gold < 55) {
      pushNarration(state, 'Ouro insuficiente para contratar um instrutor disciplinado.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= 55;
    const martialGain = rng.int(3, 8);
    const charmGain = rng.int(0, 2);
    player.martial = clamp(player.martial + martialGain, 0, 100);
    player.charm = clamp(player.charm + charmGain, 0, 100);
    player.renownTier = renownFromMartial(player.martial);
    pushNarration(state, `Treino metódico concluído. Martial +${martialGain}${charmGain > 0 ? ` • Carisma +${charmGain}` : ''}.`);
    return promptMainMenu(state, rng);
  }

  if (trainingId === 'attire_basic') {
    if (house.resources.gold < 15) {
      pushNarration(state, 'Ouro insuficiente até mesmo para roupas simples.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= 15;
    const gain = rng.int(1, 3);
    player.beauty = clamp(player.beauty + gain, 0, 100);
    pushNarration(state, `Você melhora sua apresentação com roupas comuns, porém limpas e bem talhadas. Beleza +${gain}.`);
    return promptMainMenu(state, rng);
  }

  if (trainingId === 'attire') {
    if (house.resources.gold < 35) {
      pushNarration(state, 'Ouro insuficiente para um traje digno.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= 35;
    const gain = rng.int(3, 8);
    player.beauty = clamp(player.beauty + gain, 0, 100);
    pushNarration(state, `Você adquire um traje: “Veludo Sombrio de Lys” e “Fivela de Prata de Valdocaso”. Beleza +${gain}.`);
    return promptMainMenu(state, rng);
  }

  if (trainingId === 'attire_noble') {
    if (house.resources.gold < 90) {
      pushNarration(state, 'Ouro insuficiente para vestes nobres de alto custo.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= 90;
    const gain = rng.int(6, 12);
    player.beauty = clamp(player.beauty + gain, 0, 100);
    player.personalPrestige = clamp((player.personalPrestige ?? 0) + 1, 0, 100);
    pushNarration(state, `Suas vestes chamam atenção em toda a região. Beleza +${gain} • Prestígio pessoal +1.`);
    return promptMainMenu(state, rng);
  }

  if (trainingId === 'duel') {
    const gain = rng.int(4, 10);
    player.martial = clamp(player.martial + gain, 0, 100);
    player.renownTier = renownFromMartial(player.martial);
    if (rng.chance(0.10)) {
      house.prestige = clamp(house.prestige - 1, 1, 100);
      pushNarration(state, `Você vence por pouco, mas espalham boatos de imprudência. Martial +${gain}, prestígio -1.`);
    } else {
      pushNarration(state, `Sparring brutal e produtivo. Martial +${gain}.`);
    }
    return promptMainMenu(state, rng);
  }
}

function promptHouseMgmt(state: GameState, rng: Rng): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];
  const isLeader = house.leaderId === player.id;

  if (!isLeader) {
    pushNarration(state, 'Você ainda não é o líder da Casa. (Herança pode ocorrer por idade, guerra ou eventos de viagem.)');
    return promptMainMenu(state, rng);
  }

  const econ = house.economy;
  const army = house.army;

  const text =
    `Gestão da Casa — ${house.name}
` +
    `Prestígio: ${house.prestige}

` +
    `Economia:
` +
    `• Camponeses: ${econ.peasants}
` +
    `• Soldados (cidadãos armados): ${econ.soldiers}
` +
    `• Fazendas: ${econ.farms}
` +
    `• Campos de treino: ${econ.trainingGrounds}

` +
    `Recursos:
` +
    `• Comida: ${house.resources.food}
` +
    `• Ouro: ${house.resources.gold}
` +
    `• Recursos: ${house.resources.goods ?? 0}

` +
    `Exército:
` +
    `• Levies: ${army.levies} • Homens-de-Armas: ${army.menAtArms} • Escudeiros: ${army.squires} • Cavaleiros: ${army.knights}

` +
    `Necessidade mínima de comida: ${foodNeedMin(house)}
` +
    `Taxa do suserano: ${(econ.taxRate*100).toFixed(0)}% (tributo em Recursos)

` +
    `Delegações comerciais: enviar a cada 5 turnos para manter bônus. Último envio no turno ${econ.tradeLastDelegationTurn}.`;

    const choices: Choice[] = [
    { id: 'hm:farm', label: 'Comprar fazenda', hint: 'Custo 120 ouro • +80 comida/turno (aprox.) • +40 camponeses' },
    { id: 'hm:recruit', label: 'Recrutar cidadãos', hint: 'Custo 60 ouro • +50 levies (consome comida)' },
    { id: 'hm:train', label: 'Treinar tropas', hint: 'Custo 90 ouro • Converte parte em escudeiros/cavaleiros' },
    { id: 'hm:delegate', label: 'Enviar delegação', hint: 'Custo 30 ouro • Mantém comércio • Relações +1 com parceiros' },
    { id: 'back', label: 'Voltar' },
  ];

  // Apoio a guerras canônicas (se sua Casa estiver envolvida)
  const wars = (state.canon?.activeWarIds ?? []).map(id => CANON_WARS.find(w => w.id === id)).filter(Boolean) as CanonWarDef[];
  const playerSideWars = wars.filter(w => w.sideAHouseIds.includes(house.id) || w.sideBHouseIds.includes(house.id));
  for (const w of playerSideWars.slice(0, 2)) {
    for (const [size, label] of WAR_AID_TIERS) {
      const t = WAR_AID_COST[size];
      choices.splice(choices.length - 1, 0, {
        id: `hm:warAid:${w.id}:${size}`,
        label: `Apoiar ${w.name} — ${label}`,
        hint: `${t.goods} recursos + ${t.levies} levies • +${t.points} no placar`,
      });
    }
  }

  pushSystem(state, text, choices);
}

export function applyHouseMgmt(state: GameState, rng: Rng, action: string): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];
  if (house.leaderId !== player.id) {
    pushNarration(state, 'Você não é o líder da Casa.');
    return promptMainMenu(state, rng);
  }


// Apoio de guerra canônica
if (action.startsWith('warAid:')) {
  ensureCanonDefaults(state);
  const parts = action.split(':');
  const warId = parts[1];
  const size = (parts[2] ?? 'medium') as WarAidSize;
  const w = CANON_WARS.find(x => x.id === warId);
  if (!w) {
    pushNarration(state, 'Guerra não encontrada.');
    return promptMainMenu(state, rng);
  }

  const onSideA = w.sideAHouseIds.includes(house.id);
  const onSideB = w.sideBHouseIds.includes(house.id);
  if (!onSideA && !onSideB) {
    pushNarration(state, 'Sua Casa não está envolvida nesta guerra.');
    return promptMainMenu(state, rng);
  }

  const cost = WAR_AID_COST[size] ?? WAR_AID_COST.medium;
  const goods = house.resources.goods ?? 0;
  if (goods < cost.goods || house.army.levies < cost.levies) {
    pushNarration(state, `Recursos insuficientes (precisa ${cost.goods} recursos e ${cost.levies} levies).`);
    return promptMainMenu(state, rng);
  }

  house.resources.goods = goods - cost.goods;
  house.army.levies -= cost.levies;

  const ws = canonWarState(state, w.id);
  if (onSideA) ws.scoreA += cost.points;
  else ws.scoreB += cost.points;

  // Sustentar um esforço de guerra é reconhecido pelos aliados.
  const allies = onSideA ? w.sideAHouseIds : w.sideBHouseIds;
  for (const hid of allies) {
    if (hid === house.id) continue;
    const ally = state.houses[hid];
    if (!ally) continue;
    ally.relations[house.id] = clamp((ally.relations[house.id] ?? 50) + cost.points, 0, 100);
  }
  house.prestige = clamp(house.prestige + (cost.points >= 3 ? 1 : 0), 1, 100);

  pushNarration(state, `🛡️ Você envia apoio à guerra: ${w.name} (+${cost.points}). Progresso agora ${ws.scoreA}–${ws.scoreB}.`);
  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Apoio de guerra — ${w.name}`,
    body: `${house.name} envia tropas e recursos para o esforço de guerra.`,
    tags: ['war', 'politica'],
  });

  return promptMainMenu(state, rng);
}

  switch (action) {
    case 'farm': {
      if (house.resources.gold < 120) {
        pushNarration(state, 'Ouro insuficiente.');
        return promptMainMenu(state, rng);
      }
      house.resources.gold -= 120;
      house.economy.farms += 1;
      house.economy.peasants += 40;
      house.prestige = clamp(house.prestige + 1, 1, 100);
      pushNarration(state, 'Você compra novas fazendas e atrai mais camponeses. Produção aumenta. Prestígio +1.');
      return promptMainMenu(state, rng);
    }
    case 'recruit': {
      if (house.resources.gold < 60) {
        pushNarration(state, 'Ouro insuficiente.');
        return promptMainMenu(state, rng);
      }
      house.resources.gold -= 60;
      house.army.levies += 50;
      house.economy.soldiers += 20;
      pushNarration(state, 'Você recruta e arma cidadãos. Levies +50.');
      return promptMainMenu(state, rng);
    }
    case 'train': {
      if (house.resources.gold < 90) {
        pushNarration(state, 'Ouro insuficiente.');
        return promptMainMenu(state, rng);
      }
      house.resources.gold -= 90;
      // conversões simples: parte dos levies vira men-at-arms; parte vira squires; pequena chance de knights
      const toMen = Math.min(house.army.levies, rng.int(12, 22));
      house.army.levies -= toMen;
      house.army.menAtArms += toMen;

      const toSquires = Math.min(house.army.menAtArms, rng.int(6, 14));
      house.army.menAtArms -= toSquires;
      house.army.squires += toSquires;

      const toKnights = Math.min(house.army.squires, rng.int(1, 4));
      house.army.squires -= toKnights;
      house.army.knights += toKnights;

      house.economy.trainingGrounds = clamp(house.economy.trainingGrounds + (rng.chance(0.25) ? 1 : 0), 0, 3);
      pushNarration(state, `Treinamento concluído: +${toMen} homens-de-armas, +${toSquires} escudeiros, +${toKnights} cavaleiros.`);
      return promptMainMenu(state, rng);
    }
    case 'delegate': {
      if (house.resources.gold < 30) {
        pushNarration(state, 'Ouro insuficiente.');
        return promptMainMenu(state, rng);
      }
      house.resources.gold -= 30;
      house.economy.tradeLastDelegationTurn = state.date.absoluteTurn;

      for (const partnerId of house.economy.tradePartners) {
        house.relations[partnerId] = clamp((house.relations[partnerId] ?? 50) + 1, 0, 100);
        // o parceiro também melhora
        const partner = state.houses[partnerId];
        if (partner) partner.relations[house.id] = clamp((partner.relations[house.id] ?? 50) + 1, 0, 100);
      }
      pushNarration(state, 'Delegação enviada. O comércio continua a fluir (e a etiqueta também).');
      return promptMainMenu(state, rng);
    }
  }
}

function promptChronicle(state: GameState, rng: Rng): void {
  const last = state.chronicle.slice(0, 10).map(e => `• [T${e.turn}] ${e.title}`).join('\n');
  const scheduled = SCHEDULED_EVENTS
    .filter(e => e.year === state.date.year && e.turn === state.date.turn)
    .map(e => `• (Agendado) ${e.title}`)
    .join('\n');

  const canon = (state.canon?.enabled ? CANON_EVENTS : [])
    .filter(e => e.year === state.date.year && e.turn === state.date.turn)
    .map(e => `• (Canônico) ${e.title}`)
    .join('\n');

  pushSystem(
    state,
    `Crônicas (últimas 10):
${last || '—'}

Neste turno:
${(canon || scheduled) ? [canon, scheduled].filter(Boolean).join('\n') : '—'}

Você também pode ver detalhes na aba “Crônicas”.`,
    [{ id: 'back', label: 'Voltar' }]
  );
}

export function advanceTurn(state: GameState, rng: Rng, options?: { silent?: boolean }): void {
  if (state.game.over) return;

  ensureCanonDefaults(state);

  // Endgame rígido por tempo: se chegarmos além do limite, encerra.
  if (state.date.year > ENDGAME_BURN_YEAR) {
    return setGameOver(state, 'O mundo mudou além do ponto de retorno. Sua história termina aqui.', false);
  }

  // Eventos "fixos" do fim da era (Gelo & Fogo)
  // Se o modo canônico estiver ligado, estes eventos ficam DESATIVADOS (pois não são marcos históricos fechados).
  if (!state.canon?.enabled && !state.endgame.wallBreached && state.date.year === ENDGAME_WALL_YEAR && state.date.turn === ENDGAME_WALL_TURN) {
    state.endgame.wallBreached = true;
    state.chronicle.unshift({
      turn: state.date.absoluteTurn,
      title: 'A Muralha é Rompida',
      body: 'No extremo Norte, a Muralha ruge — e uma brecha se abre. O frio caminha para o sul.',
      tags: ['norte', 'ameaça', 'white-walkers'],
    });
    pushNarration(state, '❄️ A Muralha é rompida. Os White Walkers avançam — um presságio que engole os reinos.');
  }

  if (!state.canon?.enabled && !state.endgame.danyArrived && state.date.year === ENDGAME_DANY_YEAR && state.date.turn === ENDGAME_DANY_TURN) {
    ensureDaenerysFaction(state, rng);
    pushNarration(state, '🔥 Rumores se tornam certeza: Daenerys Targaryen chega a Westeros com um exército quase impossível de derrotar.');
    pushNarration(state, '🐉 Seus dragões não aparecem como mecânica — mas, em batalha, contam como **10.000 cavaleiros** cada, além do exército que ela já possui.');
  }

  if (!state.canon?.enabled && !state.endgame.kingsLandingBurned && state.date.year === ENDGAME_BURN_YEAR && state.date.turn === ENDGAME_BURN_TURN) {
    state.endgame.kingsLandingBurned = true;
    state.chronicle.unshift({
      turn: state.date.absoluteTurn,
      title: 'As Cinzas de Porto Real',
      body: 'Porto Real cai em chamas. A cidade e o reino entram em uma nova era de medo e ruínas.',
      tags: ['porto-real', 'daenerys', 'fim'],
    });
    pushNarration(state, '🔥 Porto Real queima. O mundo entra em ruínas — e a sua crônica se aproxima do fim.');

    // Se o jogador ainda não alcançou uma condição de "vitória" (casar/derrotar), é game over por tempo.
    if (!state.game.victory) {
      return setGameOver(state, 'Porto Real ardeu e a era chegou ao seu ponto final. Sem uma virada impossível, a história termina.', false);
    }
    return;
  }

  // 0) Processa eventos canônicos (história real)
  applyCanonEventsForTurn(state, rng);

  // 1) Processa eventos agendados
  for (const e of SCHEDULED_EVENTS) {
    if (e.year === state.date.year && e.turn === state.date.turn) {
      state.chronicle.unshift({ turn: state.date.absoluteTurn, title: e.title, body: e.body, tags: e.tags });
      pushNarration(state, `📜 ${e.title}: ${e.body}`);
    }
  }

  // 1.5) Rumores (preenche lacunas)
  tickRumors(state, rng);

  // 1.75) Laços fracos com figuras históricas esfriam com o tempo
  tickCanonDivergenceDecay(state);

  // 2) Economia, tributos e consumo (todas as casas)
  tickEconomyAll(state, rng);

  // 3) Idade e mortes por idade (regras do usuário)
  tickAgesAndDeaths(state, rng);

  // 3.5) Política: casamentos arranjados (IA)
  tickArrangedMarriages(state, rng);

  // 3.75) Progressão pessoal natural (atributos e prestígio)
  tickPersonalProgression(state, rng);

  // 4) Concepções e gravidez (15 turnos) + partos
  tickConceptions(state, rng);
  tickPregnancies(state, rng);

  // 4.25) Missões (geração/expiração/resolução de delegações)
  tickMissions(state, rng);

  // 4.5) Torneios (geração + expiração)
  tickTournaments(state, rng);

  // 4.5) Guerras declaradas em jogo
  tickWars(state, rng);

  // 4.75) Assentos ocupados militarmente
  tickOccupations(state, rng);

  // 5) Pressão do Banco de Ferro
  tickIronBank(state, rng);

  // 6) Avança data
  state.date.absoluteTurn += 1;
  state.date.turn += 1;
  if (state.date.turn > 20) {
    state.date.turn = 1;
    state.date.year += 1;
  }

  if (!options?.silent) {
    pushNarration(state, `⏳ O tempo passa. Agora é Ano ${state.date.year} DC, Turno ${state.date.turn}/20.`);

    // 7) Menu
    promptMainMenu(state, rng);
  }
}


function randomTournamentReason(rng: Rng): TournamentReason {
  const pool: TournamentReason[] = ['maioridade', 'casamento', 'vitoria', 'colheita', 'outro'];
  return pool[rng.int(0, pool.length - 1)];
}

function tickTournaments(state: GameState, rng: Rng): void {
  // expira torneios antigos (após ~6 turnos)
  for (const t of state.tournaments) {
    if (t.status === 'anunciado' && (state.date.absoluteTurn - t.announcedTurn) > 6) {
      t.status = 'encerrado';
    }
  }

  // chance moderada de surgir 0-1 torneio por turno no reino (simplificado)
  if (rng.chance(0.10)) {
    const hostPool = Object.values(state.houses);
    const host = hostPool[rng.int(0, hostPool.length - 1)];
    const size = prestigeToTournamentSize(host.prestige);
    const reason = randomTournamentReason(rng);
    const t: Tournament = {
      id: uid('t'),
      hostHouseId: host.id,
      locationId: host.seatLocationId,
      size,
      reason,
      announcedTurn: state.date.absoluteTurn,
      status: 'anunciado',
      categories: categoriesForSize(size),
    };
    state.tournaments.unshift(t);

    const title = `Torneio ${size === 'menor' ? 'menor' : size === 'medio' ? 'mediano' : 'importante'} anunciado`;
    const body = `${state.houses[host.id].name} anuncia um torneio em ${state.locations[t.locationId]?.name ?? 'seus domínios'} (${t.reason}).`;
    state.chronicle.unshift({ turn: state.date.absoluteTurn, title, body, tags: ['torneio'] });
    pushNarration(state, `🏇 ${body}`);
  }
}


export function applyLocalAction(
  state: GameState,
  rng: Rng,
  action: 'talk' | 'flowers' | 'drink' | 'hunt' | 'kiss' | 'relations' | 'marry',
  targetId: string,
  extra?: string
): void {
  const player = state.characters[state.playerId];
  const target = state.characters[targetId];
  if (!target || !target.alive) return;

  const originalPlayerHouseId = state.playerHouseId;

  if (target.locationId !== player.locationId) {
    pushNarration(state, 'Essa pessoa não está no mesmo local que você.');
    return;
  }

  // Regras de etiqueta e preparo
  if (action === 'flowers') {
    if (target.gender === 'M') {
      pushNarration(state, 'Você não pode dar flores para um homem.');
      return;
    }
    const flowersToParent = (target.id === player.fatherId) || (target.id === player.motherId);
    const flowersToChild = (target.fatherId === player.id) || (target.motherId === player.id);
    if (flowersToParent || flowersToChild) {
      pushNarration(state, 'Dar flores para pai/mãe ou filhos não é permitido nesta campanha.');
      return;
    }
  }

  if (action === 'drink' && (player.ageYears < 18 || target.ageYears < 18)) {
    pushNarration(state, 'Crianças e adolescentes não bebem (mínimo 18 anos).');
    return;
  }

  if (action === 'hunt') {
    if (player.gender !== 'M') {
      pushNarration(state, 'Pelas regras desta campanha, caçadas locais são para personagem masculino.');
      return;
    }
    const canHunt = target.gender === 'M' || (target.martial ?? 0) >= 35;
    if (!canHunt) {
      pushNarration(state, 'Esta pessoa não parece preparada para caçar com segurança.');
      return;
    }
  }

  // Romance: bloqueia pai/mãe
  const isParent = (target.id === player.fatherId) || (target.id === player.motherId);
  const isChild = (target.fatherId === player.id) || (target.motherId === player.id);
  if ((action === 'kiss' || action === 'relations') && (isParent || isChild)) {
    pushNarration(state, 'Isso não é permitido com pai/mãe ou filhos.');
    return;
  }

  if (action === 'kiss') {
    if ((target.relationshipToPlayer ?? 0) < 80) {
      pushNarration(state, 'A relação ainda não é alta o suficiente para um beijo (mínimo 80).');
      return;
    }
    const kissedIds = (player.kissedIds ??= []);
    if (!kissedIds.includes(target.id)) kissedIds.push(target.id);
    target.relationshipToPlayer = clamp(target.relationshipToPlayer + 2 + rng.int(-1, 2), 0, 100);
    pushNarration(state, `Você beijou ${target.name}.`);
    canonTouchIfCanonical(state, target, 'kiss', 2);
    return;
  }

  if (action === 'relations') {
    if ((target.relationshipToPlayer ?? 0) < 90) {
      pushNarration(state, 'A relação ainda não é alta o suficiente para relações (mínimo 90).');
      return;
    }
    const kissedIds = (player.kissedIds ??= []);
    if (!kissedIds.includes(target.id)) {
      pushNarration(state, 'Primeiro vocês precisam se beijar.');
      return;
    }

    target.relationshipToPlayer = clamp(target.relationshipToPlayer + 1 + rng.int(-1, 2), 0, 100);
    pushNarration(state, `Você teve relações com ${target.name}.`);
    canonTouchIfCanonical(state, target, 'relations', 3);

    // chance de concepção (se houver uma mulher fértil envolvida)
    const a = player;
    const b = target;
    const mother: Character | undefined = a.gender === 'F' ? a : (b.gender === 'F' ? b : undefined);
    const father: Character | undefined = a.gender === 'M' ? a : (b.gender === 'M' ? b : undefined);

    if (mother && father) {
      const isBastard = !(a.maritalStatus === 'married' && a.spouseId === b.id && b.maritalStatus === 'married');
      if (isFertileFemale(mother) && isAdultMale(father) && !(mother as any).pregnancy) {
        // chance padrão de concepção em relações: 25%
        if (rng.chance(0.25)) {
          beginPregnancy(state, rng, mother, father, isBastard);
        } else if (mother.id === state.playerId || father.id === state.playerId) {
          pushNarration(state, 'Nada acontece desta vez.');
        }
      }
    }
    return;
  }

  if (action === 'marry') {
    const p = player;
    const t = target;

    // regras básicas
    if (p.maritalStatus === 'married') {
      pushNarration(state, 'Você já é casado(a).');
      return;
    }
    if (t.maritalStatus === 'married') {
      pushNarration(state, 'Esta pessoa já é casada.');
      return;
    }
    if (p.ageYears < 16 || t.ageYears < 16) {
      pushNarration(state, 'Casamento exige maioridade (16+).');
      return;
    }
    if (!((p.gender === 'M' && t.gender === 'F') || (p.gender === 'F' && t.gender === 'M'))) {
      pushNarration(state, 'Pelas regras desta campanha, casamentos são apenas heterossexuais.');
      return;
    }

    // bloqueia pai/mãe/filhos
    if (isParent || isChild) {
      pushNarration(state, 'Isso não é permitido com pai/mãe ou filhos.');
      return;
    }

    const rel = t.relationshipToPlayer ?? 0;
    const kissed = (p.kissedIds ?? []).includes(t.id);
    if (rel < 92 || !kissed) {
      pushNarration(state, 'Para casar, é necessário relação 92+ e um beijo anterior.');
      return;
    }

    const groom = p.gender === 'M' ? p : t;
    const bride = p.gender === 'F' ? p : t;

    // regra do usuário:
    // - padrão: sobrenome/casa do homem (patrilinear)
    // - exceção: se a mulher for a ÚLTIMA viva da sua casa, pode escolher preservar o sobrenome dela
    const brideHouseId = bride.currentHouseId;
    const brideIsLast = houseAliveCount(state, brideHouseId, bride.id) === 0;

    const wantsMatri = (extra ?? '').toLowerCase() === 'matri';
    const lineage: 'patri' | 'matri' = wantsMatri && brideIsLast ? 'matri' : 'patri';
    const chosenHouseId = lineage === 'matri' ? brideHouseId : groom.currentHouseId;

    // aplica casamento
    groom.spouseId = bride.id;
    bride.spouseId = groom.id;
    groom.maritalStatus = 'married';
    bride.maritalStatus = 'married';

    if (lineage === 'patri') {
      // mulher muda sobrenome
      bride.keepsBirthName = false;
      bride.currentHouseId = chosenHouseId;
    } else {
      // homem assume a casa da mulher
      groom.currentHouseId = chosenHouseId;
    }

    // Atualiza a casa do jogador se o sobrenome dele(a) mudou
    if (p.currentHouseId !== state.playerHouseId) {
      state.playerHouseId = p.currentHouseId;
    }

    // melhora relações entre casas (leve)
    const oldPhId = originalPlayerHouseId;
    const otherHouseId = t.currentHouseId;
    if (oldPhId && otherHouseId && oldPhId !== otherHouseId) {
      const aHouse = state.houses[oldPhId];
      const bHouse = state.houses[otherHouseId];
      if (aHouse && bHouse) {
        aHouse.relations[bHouse.id] = clamp((aHouse.relations[bHouse.id] ?? 50) + 6, 0, 100);
        bHouse.relations[aHouse.id] = clamp((bHouse.relations[aHouse.id] ?? 50) + 4, 0, 100);
      }
    }

    // Casar entre Casas cria direito sobre os dois assentos.
    registerMarriageClaims(state, p, t);

    // marca divergência canônica se aplicável
    canonTouchIfCanonical(state, t, 'marry', 5);
    canonTouchIfCanonical(state, p, 'marry', 5);

    const houseLabel = state.houses[chosenHouseId]?.name ?? chosenHouseId;
    pushNarration(state, `💍 Casamento: você se casa com ${t.name}. Sobrenome/casa do casal: ${houseLabel}.`);
    state.chronicle.unshift({
      turn: state.date.absoluteTurn,
      title: 'Casamento',
      body: `${p.name} casa-se com ${t.name}. Casa do casal: ${houseLabel}.`,
      tags: ['casamento'],
    });

    promptMainMenu(state, rng);
    return;
  }

  // ações melhoram relação pessoal e, suavemente, relações entre casas
  const delta = action === 'flowers' ? 6 : action === 'talk' ? 4 : 5;
  target.knownToPlayer = true;
  target.relationshipToPlayer = clamp(target.relationshipToPlayer + delta + rng.int(-2, 2), 0, 100);

  // registra interferência com canônicos (ações leves também contam, mas com peso baixo)
  const touchWeight = action === 'talk' ? 1 : action === 'drink' ? 1 : action === 'flowers' ? 1 : action === 'hunt' ? 1 : 1;
  canonTouchIfCanonical(state, target, action, touchWeight);

  const ph = state.houses[state.playerHouseId];
  const th = state.houses[target.currentHouseId];
  if (th && th.id !== ph.id) {
    ph.relations[th.id] = clamp((ph.relations[th.id] ?? 50) + 1, 0, 100);
  }

  const label = action === 'flowers' ? 'flores' : action === 'drink' ? 'beber' : action === 'hunt' ? 'caçar' : 'conversar';
  pushNpc(state, target.name, `Você decide ${label}. A relação com você agora é ${target.relationshipToPlayer}/100.`);
  promptMainMenu(state, rng);
}

export function applyTournamentAction(state: GameState, rng: Rng, cmd: string): void {
  const [action, tid] = cmd.split(':');

  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  if (action !== 'join') {
    pushNarration(state, 'Ação inválida.');
    return promptMainMenu(state, rng);
  }

  const t = state.tournaments.find(x => x.id === tid);
  if (!t) {
    pushNarration(state, 'Torneio não encontrado (talvez já tenha acabado).');
    return promptMainMenu(state, rng);
  }

  // Participar
  if (player.injuredUntilTurn && player.injuredUntilTurn > state.date.absoluteTurn) {
    pushNarration(state, 'Você está ferido(a) e não pode competir neste turno.');
    return promptMainMenu(state, rng);
  }

  if (player.locationId !== t.locationId) {
    pushNarration(state, 'Você precisa estar no local do torneio para competir.');
    return promptMainMenu(state, rng);
  }

  if (!t.categories.includes(player.renownTier)) {
    pushNarration(state, `Você não se enquadra nas categorias deste torneio. Sua categoria atual: ${player.renownTier}.`);
    return promptMainMenu(state, rng);
  }

  // Resultado conforme probabilidades pedidas: morrer 10%, derrota 30%, ferido 20%, vitória 40%
  const roll = rng.next(); // 0..1

  if (roll < 0.10) {
    pushNarration(state, '☠️ Você cai mortalmente ferido(a) nas justas.');
    player.alive = false;
    handlePlayerDeath(state, rng, 'Morte em torneio');
    return;
  }

  if (roll < 0.40) {
    // derrota comum
    player.personalPrestige = clamp((player.personalPrestige ?? 0) - 2, 0, 100);
    pushNarration(state, `🥀 Você perde a justa na categoria ${player.renownTier}. Prestígio pessoal -2.`);
    return promptMainMenu(state, rng);
  }

  if (roll < 0.60) {
    // ferido e perde prestígio
    player.personalPrestige = clamp((player.personalPrestige ?? 0) - 5, 0, 100);
    if (house) house.prestige = clamp(house.prestige - 1, 1, 100);
    player.injuredUntilTurn = state.date.absoluteTurn + 2;
    pushNarration(state, '🩸 Você se fere gravemente e perde a luta. Prestígio pessoal -5, prestígio da Casa -1. (Ferido por 2 turnos)');
    return promptMainMenu(state, rng);
  }

  // vitória
  player.personalPrestige = clamp((player.personalPrestige ?? 0) + 10, 0, 100);
  if (house) {
    house.prestige = clamp(house.prestige + 2, 1, 100);
    house.resources.gold += 60;
  }
  pushNarration(state, `🏆 Você vence as justas (${player.renownTier})! +10 prestígio pessoal, +2 prestígio da Casa, +60 ouro.`);

  // chance pequena de rumores de casamento
  if (rng.chance(0.18)) {
    pushNarration(state, '💍 Rumores correm: uma família observa você como possível pretendente(a) após a vitória.');
  }

  return promptMainMenu(state, rng);
}

export function applyIronBank(state: GameState, rng: Rng, cmd: string): void {
  const house = state.houses[state.playerHouseId];
  if (cmd.startsWith('loan:')) {
    const amount = parseInt(cmd.split(':')[1], 10);
    house.resources.gold += amount;
    house.prestige = clamp(house.prestige - Math.ceil(amount / 350), 1, 100);
    state.ironBankDebt = {
      principal: amount,
      interestRateYear: 0.12,
      nextPaymentTurn: state.date.absoluteTurn + 20,
      minimumPayment: Math.round(amount * 0.18),
      missedPayments: 0,
    };
    pushNarration(state, `🏦 Empréstimo aprovado: +${amount} ouro. Próximo pagamento em 20 turnos.`);
    return promptMainMenu(state, rng);
  }
  if (cmd === 'paymin') {
    const debt = state.ironBankDebt;
    if (!debt) return promptMainMenu(state, rng);
    if (house.resources.gold < debt.minimumPayment) {
      pushNarration(state, 'Ouro insuficiente para pagar o mínimo.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= debt.minimumPayment;
    debt.principal = Math.max(0, Math.round(debt.principal - debt.minimumPayment * 0.60));
    debt.nextPaymentTurn += 20;
    debt.missedPayments = Math.max(0, debt.missedPayments - 1);
    pushNarration(state, `🏦 Pagamento mínimo efetuado. Principal agora ${debt.principal}.`);
    if (debt.principal <= 0) {
      state.ironBankDebt = null;
      house.prestige = clamp(house.prestige + 1, 1, 100);
      pushNarration(state, '🏦 Dívida quitada. Prestígio +1.');
    }
    return promptMainMenu(state, rng);
  }
  if (cmd === 'payall') {
    const debt = state.ironBankDebt;
    if (!debt) return promptMainMenu(state, rng);
    const pay = debt.principal;
    if (house.resources.gold < pay) {
      pushNarration(state, 'Ouro insuficiente para quitar tudo.');
      return promptMainMenu(state, rng);
    }
    house.resources.gold -= pay;
    state.ironBankDebt = null;
    house.prestige = clamp(house.prestige + 1, 1, 100);
    pushNarration(state, `🏦 Você quita ${pay} ouro. Dívida encerrada. Prestígio +1.`);
    return promptMainMenu(state, rng);
  }
}

/** Declaração de guerra e pedido de paz (ações do líder da Casa). */
export function applyWarAction(state: GameState, rng: Rng, cmd: string): void {
  const player = state.characters[state.playerId];
  const house = state.houses[state.playerHouseId];

  if (house.leaderId !== player.id) {
    pushNarration(state, 'Só o líder da Casa pode declarar guerra ou assinar a paz.');
    return promptMainMenu(state, rng);
  }

  const parts = cmd.split(':');

  if (parts[0] === 'declare') {
    const targetId = parts[1];
    const cb = (parts[2] ?? 'conquest') as any;
    const target = state.houses[targetId];

    if (!target) {
      pushNarration(state, 'Casa inválida.');
      return promptMainMenu(state, rng);
    }
    if (warBetween(state, house.id, targetId)) {
      pushNarration(state, 'Vocês já estão em guerra.');
      return promptMainMenu(state, rng);
    }
    if (!availableCasusBelli(state, house.id, targetId).includes(cb)) {
      pushNarration(state, 'Esse motivo não se sustenta contra esta Casa.');
      return promptMainMenu(state, rng);
    }

    // Uma hoste precisa existir antes de marchar.
    if (house.army.levies < 60) {
      pushNarration(state, 'Sua hoste é pequena demais para uma campanha (mínimo 60 levies).');
      return promptMainMenu(state, rng);
    }

    const w = declareWar(state, rng, house.id, targetId, cb);
    if (w && (w.attackerAllies.length || w.defenderAllies.length)) {
      const mine = w.attackerAllies.map(id => state.houses[id]?.name).filter(Boolean).join(', ') || 'ninguém';
      const theirs = w.defenderAllies.map(id => state.houses[id]?.name).filter(Boolean).join(', ') || 'ninguém';
      pushNarration(state, `🤝 Ao seu lado: ${mine}. Ao lado deles: ${theirs}.`);
    }
    return promptMainMenu(state, rng);
  }

  if (parts[0] === 'peace') {
    const warId = parts[1];
    const w = activeWars(state).find(x => x.id === warId);
    if (!w) {
      pushNarration(state, 'Essa guerra já terminou.');
      return promptMainMenu(state, rng);
    }

    const side = sideOf(w, house.id);
    const mineScore = side === 'attacker' ? w.scoreAttacker : w.scoreDefender;
    const theirScore = side === 'attacker' ? w.scoreDefender : w.scoreAttacker;

    // O outro lado só aceita se não estiver claramente ganhando.
    const gap = theirScore - mineScore;
    const acceptChance = clamp(0.75 - gap / 90, 0.08, 0.95);

    if (!rng.chance(acceptChance)) {
      pushNarration(state, 'Sua proposta de paz é recusada. Eles ainda acreditam que podem vencer.');
      return promptMainMenu(state, rng);
    }

    const outcome = mineScore === theirScore
      ? 'white'
      : (mineScore > theirScore
          ? (side === 'attacker' ? 'attacker' : 'defender')
          : (side === 'attacker' ? 'defender' : 'attacker'));

    endWar(state, rng, w, outcome as any, 'paz negociada');
    return promptMainMenu(state, rng);
  }

  return promptMainMenu(state, rng);
}
