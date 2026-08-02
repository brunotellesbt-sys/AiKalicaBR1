/**
 * Herança, morte e disputa por assentos.
 *
 * Reúne o que decide quem senta onde: a ordem de sucessão de uma Casa, o efeito
 * de uma morte sobre todos os assentos que a pessoa ocupava, a busca pelo
 * herdeiro do jogador (que segue o sangue, não o sobrenome) e as crises com
 * múltiplos pretendentes.
 */
import { Character, CrisisPretender, Gender, GameState, HouseState, PretenderBasis, SuccessionCrisis } from '../models';
import { CanonEventDef } from '../data/canon';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { genFirstName } from './names';
import { pushNarration, pushChronicle, setGameOver } from './narration';
import { renownFromMartial, titleForHouse } from './rules';
import { ensureCanonDefaults, markCanonDeathBypassed, markCanonTouched } from './canon-divergence';
import { addClaim, claimsOnSeat } from './claims';

export const SUCCESSION_CRISIS_TIMEOUT = 60;

export function crisisBaseSupport(c: Character): number {
  return clamp(
    28 + Math.round((c.personalPrestige ?? 0) / 4) + Math.round((c.martial ?? 0) / 6),
    10,
    70
  );
}

export function makePretender(c: Character, basis: PretenderBasis, bonus = 0): CrisisPretender {
  return {
    characterId: c.id,
    houseId: c.currentHouseId,
    basis,
    support: clamp(crisisBaseSupport(c) + bonus, 5, 85),
  };
}

/**
 * Monta a lista de pretendentes ao assento.
 *
 * Além do titular e do herdeiro do cânone, entram quem tem reivindicação
 * formal registrada (casamento/sangue) e parentes fortes da própria Casa —
 * é o que torna a disputa uma crise de verdade, e não um duelo de dois nomes.
 */
export function buildPretenders(
  state: GameState,
  house: HouseState,
  incumbent: Character,
  canonHeir: Character | null
): CrisisPretender[] {
  const out: CrisisPretender[] = [makePretender(incumbent, 'incumbent', 10)];
  const seen = new Set<string>([incumbent.id]);

  if (canonHeir && canonHeir.alive && !seen.has(canonHeir.id)) {
    out.push(makePretender(canonHeir, 'canon_heir', 6));
    seen.add(canonHeir.id);
  }

  for (const { claim, person } of claimsOnSeat(state, house.id)) {
    if (seen.has(person.id) || out.length >= 4) continue;
    out.push(makePretender(person, 'claim', Math.round(claim.strength / 8)));
    seen.add(person.id);
  }

  if (out.length < 4) {
    const kin = Object.values(state.characters)
      .filter(c => c.alive && !seen.has(c.id) && c.currentHouseId === house.id && c.ageYears >= 16 && !c.isBastard)
      .sort((a, b) => (b.personalPrestige ?? 0) - (a.personalPrestige ?? 0));
    for (const k of kin.slice(0, 4 - out.length)) {
      out.push(makePretender(k, 'blood'));
      seen.add(k.id);
    }
  }

  return out;
}

export function openSuccessionCrisis(
  state: GameState,
  house: HouseState,
  incumbent: Character,
  claimant: Character | null,
  e?: CanonEventDef
): void {
  ensureCanonDefaults(state);
  const crises = state.canon!.successionCrises!;
  const existing = crises[house.id];
  if (existing && !existing.resolvedAbsTurn) return;

  const pretenders = buildPretenders(state, house, incumbent, claimant);
  if (pretenders.length < 2) return;

  // Uma disputa já decidida nao se reabre com exatamente os mesmos nomes.
  if (existing) {
    const before = existing.pretenders.map(p => p.characterId).sort().join(',');
    const now = pretenders.map(p => p.characterId).sort().join(',');
    if (before === now) return;
  }

  const crisis: SuccessionCrisis = {
    id: uid('crisis'),
    houseId: house.id,
    startedAbsTurn: state.date.absoluteTurn,
    pretenders,
  };
  crises[house.id] = crisis;

  const names = pretenders
    .map(p => `${state.characters[p.characterId]?.name ?? '?'} (${pretenderLabel(p.basis)})`)
    .join(', ');

  const title = `Crise sucessória: ${house.name}`;
  const body = `${incumbent.name} segue no assento quando o registro previa outro desfecho. Pretendentes: ${names}.`;

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title,
    body,
    tags: Array.from(new Set([...(e?.tags ?? []), 'canon', 'divergence', 'sucessao'])),
  });
  pushNarration(state, `⚔️ ${title} — ${body}`);
}

export function pretenderLabel(basis: PretenderBasis): string {
  switch (basis) {
    case 'incumbent': return 'titular';
    case 'canon_heir': return 'herdeiro do cânone';
    case 'claim': return 'reivindicação';
    default: return 'parente';
  }
}

export function resolveSuccessionCrisis(
  state: GameState,
  rng: Rng,
  crisis: SuccessionCrisis,
  winnerId: string,
  why: string
): void {
  crisis.resolvedAbsTurn = state.date.absoluteTurn;
  crisis.winnerId = winnerId;

  const house = state.houses[crisis.houseId];
  const winner = state.characters[winnerId];
  if (!house || !winner) return;

  house.leaderId = winner.id;
  winner.title = titleForHouse(house.id, winner.gender);
  winner.personalPrestige = clamp((winner.personalPrestige ?? 0) + 8, 0, 100);

  // A Casa do vencedor pode mudar de mãos junto com o assento.
  if (winner.currentHouseId !== house.id) {
    addClaim(state, house.id, winner, 'conquest', 90);
    winner.currentHouseId = house.id;
  }

  const fates: string[] = [];
  for (const p of crisis.pretenders) {
    if (p.characterId === winnerId) continue;
    const loser = state.characters[p.characterId];
    if (!loser?.alive) continue;

    if (rng.chance(0.45)) {
      if (loser.canonId) markCanonDeathBypassed(state, loser.canonId);
      fates.push(`${loser.name} não sobrevive ao desfecho`);
      handleDeathImmediate(state, rng, loser, `Derrota na crise sucessória de ${house.name}`);
    } else {
      loser.personalPrestige = clamp((loser.personalPrestige ?? 0) - 12, 0, 100);
      fates.push(`${loser.name} aceita o exílio`);
    }
  }

  house.prestige = clamp(house.prestige - 2, 1, 100);

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Crise resolvida: ${house.name}`,
    body: `${winner.name} garante o assento (${why}). ${fates.join('. ')}${fates.length ? '.' : ''}`,
    tags: ['canon', 'divergence', 'sucessao'],
  });
  pushNarration(state, `👑 ${winner.name} vence a disputa por ${house.name}.`);
}

export function tickSuccessionCrises(state: GameState, rng: Rng): void {
  ensureCanonDefaults(state);
  const crises = state.canon!.successionCrises!;

  for (const crisis of Object.values(crises)) {
    if (!crisis || crisis.resolvedAbsTurn) continue;

    const house = state.houses[crisis.houseId];
    if (!house) { crisis.resolvedAbsTurn = state.date.absoluteTurn; continue; }

    // Pretendentes mortos saem da disputa sozinhos.
    crisis.pretenders = crisis.pretenders.filter(p => state.characters[p.characterId]?.alive);

    if (crisis.pretenders.length === 0) { crisis.resolvedAbsTurn = state.date.absoluteTurn; continue; }
    if (crisis.pretenders.length === 1) {
      resolveSuccessionCrisis(state, rng, crisis, crisis.pretenders[0].characterId, 'os rivais desapareceram');
      continue;
    }

    for (const p of crisis.pretenders) {
      const c = state.characters[p.characterId]!;
      const backed = crisis.playerBackedId === p.characterId;
      const pull =
        1.5
        + (c.personalPrestige ?? 0) / 28
        + (c.martial ?? 0) / 45
        + (c.charm ?? 0) / 60
        + (p.basis === 'incumbent' ? 0.6 : 0)
        + (backed ? 1.8 : 0);
      p.support = clamp(p.support + pull * rng.float(0.4, 1.3), 0, 100);
    }

    // Uma Casa dividida sangra recursos e reputação.
    house.resources.gold = Math.max(0, house.resources.gold - 3);
    if (rng.chance(0.15)) house.prestige = clamp(house.prestige - 1, 1, 100);

    const sorted = [...crisis.pretenders].sort((a, b) => b.support - a.support);
    const decided = sorted[0].support >= 100;
    const timedOut = (state.date.absoluteTurn - crisis.startedAbsTurn) >= SUCCESSION_CRISIS_TIMEOUT;

    if (decided || timedOut) {
      resolveSuccessionCrisis(
        state, rng, crisis, sorted[0].characterId,
        decided ? 'apoio decisivo' : 'exaustão das casas'
      );
    }
  }
}

export function activeSuccessionCrises(state: GameState): SuccessionCrisis[] {
  const crises = state.canon?.successionCrises ?? {};
  return Object.values(crises).filter(c => c && !c.resolvedAbsTurn);
}

/** Cria um herdeiro de ramo colateral para manter uma Casa viva. */
export function spawnCadet(state: GameState, rng: Rng, houseId: string): Character | null {
  const house = state.houses[houseId];
  if (!house) return null;

  const gender: Gender = rng.chance(0.62) ? 'M' : 'F';
  const martial = clamp(rng.int(18, 55), 0, 100);
  const c: Character = {
    id: uid('c'),
    name: genFirstName(rng, gender),
    gender,
    ageYears: rng.int(19, 38),
    alive: true,
    birthHouseId: houseId,
    currentHouseId: houseId,
    maritalStatus: 'single',
    keepsBirthName: false,
    locationId: house.seatLocationId,
    martial,
    charm: clamp(rng.int(20, 60), 0, 100),
    beauty: clamp(rng.int(20, 60), 0, 100),
    renownTier: renownFromMartial(martial),
    fertility: rng.chance(0.05) ? 'sterile' : 'fertile',
    wellLiked: clamp(rng.int(25, 60), 0, 100),
    personalPrestige: clamp(rng.int(8, 28), 0, 100),
    knownToPlayer: false,
    relationshipToPlayer: 0,
    personalGold: rng.int(10, 40),
    kissedIds: [],
    title: 'Ramo distante',
  };

  state.characters[c.id] = c;
  return c;
}

export function computeSuccessor(
  state: GameState,
  rng: Rng,
  houseId: string,
  opts?: { allowCadet?: boolean; allowGrant?: boolean }
): Character | null {
  const house = state.houses[houseId];
  const currentLeader = state.characters[house.leaderId];

  // coletar candidatos que pertencem à casa (sobrenome atual == houseId) e estão vivos
  const candidates = Object.values(state.characters).filter(c => c.alive && c.currentHouseId === houseId && !(c as any).isBastard);

  // helper: filhos do líder (ordenados por idade desc), sexo
  const children = candidates.filter(c => c.fatherId === currentLeader.id || c.motherId === currentLeader.id);

  const sons = children.filter(c => c.gender === 'M').sort((a,b)=> b.ageYears - a.ageYears);
  const daughters = children.filter(c => c.gender === 'F').sort((a,b)=> b.ageYears - a.ageYears);

  const siblings = candidates.filter(c => c.fatherId && currentLeader.fatherId && c.fatherId === currentLeader.fatherId && c.id !== currentLeader.id);
  const brothers = siblings.filter(c => c.gender === 'M').sort((a,b)=> b.ageYears - a.ageYears);
  const sisters = siblings.filter(c => c.gender === 'F').sort((a,b)=> b.ageYears - a.ageYears);

  // tios/primos (aproximação): qualquer membro vivo da casa mais velho que 18, excluindo filhos/irmãos
  const extended = candidates
    .filter(c => c.id !== currentLeader.id && !children.includes(c) && !siblings.includes(c))
    .sort((a,b)=> b.ageYears - a.ageYears);

  const unclesCousinsMale = extended.filter(c => c.gender === 'M');
  const unclesCousinsFemale = extended.filter(c => c.gender === 'F');

  // regra do usuário (prioridade): filhos homens, irmãos homens, tios homens, primos homens, filhas, irmãs, tias, primas
  const order = [...sons, ...brothers, ...unclesCousinsMale, ...daughters, ...sisters, ...unclesCousinsFemale];

  // filtrar mulheres que “não podem” herdar por estarem casadas com outro sobrenome (nesta função, currentHouseId já garante)
  const chosen = order[0] ?? null;
  if (chosen) return chosen;

  // Sem herdeiro pelo sobrenome, quem tem reivindicação formal se apresenta.
  // É aqui que um casamento de duas gerações atrás cobra o seu preço.
  const claimants = claimsOnSeat(state, houseId);
  if (claimants.length) {
    // Dois pretendentes fortes não resolvem no papel: vira disputa aberta.
    const strong = claimants.filter(x => x.claim.strength >= 40);
    if (strong.length >= 2) {
      const first = strong[0].person;
      openSuccessionCrisis(state, house, first, strong[1].person);
      return first;
    }

    const heir = claimants[0].person;
    heir.currentHouseId = houseId;
    heir.keepsBirthName = false;
    pushChronicle(state, {
      absTurn: state.date.absoluteTurn,
      title: `Reivindicação atendida: ${house.name}`,
      body: `${heir.name} assume ${house.name} por direito de ${claimants[0].claim.origin === 'marriage' ? 'casamento' : 'sangue'}.`,
      tags: ['politica', 'sucessao', 'claim'],
    });
    return heir;
  }

  // Se a casa ficou sem herdeiros vivos, o suserano pode conceder o feudo a alguém de confiança.
  // Isso mantém o mundo povoado, mas NÃO é sucessão de sangue: a busca pelo
  // herdeiro do jogador desliga esta etapa, senão um vassalo do suserano
  // "herdaria" a campanha de uma linhagem que se extinguiu.
  if (house.suzerainId && opts?.allowGrant !== false) {
    const suz = state.houses[house.suzerainId];
    if (suz) {
      const pool = Object.values(state.characters).filter(c => c.alive && c.currentHouseId === suz.id && c.ageYears >= 16 && !(c as any).isBastard);
      if (pool.length) {
        pool.sort((a,b)=> ((b.personalPrestige ?? 0) + (b.martial ?? 0)) - ((a.personalPrestige ?? 0) + (a.martial ?? 0)));
        const pick = pool[0];
        // assume o nome/casa do feudo concedido
        pick.currentHouseId = houseId;
        pick.keepsBirthName = false;
        pushChronicle(state, {
          absTurn: state.date.absoluteTurn,
          title: `Concessão: ${house.name}`,
          body: `${suz.name} concede ${house.name} a ${pick.name} após a extinção da linha local.`,
          tags: ['politica', 'sucessao'],
        });
        return pick;
      }
    }
  }

  // Último recurso: um ramo distante reclama o assento.
  //
  // Sem isto a função devolvia null e quem chamou deixava `leaderId` apontando
  // para um morto — o mundo inteiro assume que toda Casa tem um líder vivo.
  //
  // A busca pelo herdeiro DO JOGADOR passa `allowCadet: false`: a extinção da
  // linhagem precisa ser decidida por sangue, não por um primo inventado na
  // hora. Depois de decidida, a Casa recebe um cadete assim mesmo, para o
  // mundo seguir consistente.
  if (opts?.allowCadet !== false) {
    const cadet = spawnCadet(state, rng, houseId);
    if (cadet) {
      pushChronicle(state, {
        absTurn: state.date.absoluteTurn,
        title: `Ramo distante: ${house.name}`,
        body: `Sem herdeiros diretos, ${cadet.name} chega de um ramo distante para reclamar ${house.name}.`,
        tags: ['politica', 'sucessao'],
      });
      return cadet;
    }
  }

  return null;
}

export function handleDeathImmediate(state: GameState, rng: Rng, c: Character, reason: string): void {
  if (!c.alive) return;
  c.alive = false;
  c.maritalStatus = c.maritalStatus === 'married' ? 'widowed' : c.maritalStatus;
  pushNarration(state, `☠️ ${c.name} morre. (${reason})`);

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

  if (c.id === state.playerId) {
    handlePlayerDeath(state, rng, reason);
  }
}

/**
 * Descendentes vivos de uma pessoa, em ordem de proximidade (filhos, netos...).
 * Uma filha que casou em outra Casa mudou de sobrenome, mas não de sangue.
 */
export function livingDescendants(state: GameState, rootId: string): Character[] {
  const out: Character[] = [];
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];

  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const next: string[] = [];
    for (const c of Object.values(state.characters)) {
      if (seen.has(c.id)) continue;
      const parentInFrontier =
        (c.fatherId && frontier.includes(c.fatherId)) ||
        (c.motherId && frontier.includes(c.motherId));
      if (!parentInFrontier) continue;
      seen.add(c.id);
      next.push(c.id);
      if (c.alive) out.push(c);
    }
    frontier = next;
  }
  return out;
}

/**
 * Herdeiro do jogador.
 *
 * A sucessão da Casa sozinha era estreita demais: só considerava quem carrega
 * o sobrenome atual, então uma campanha acabava assim que a linha masculina
 * daquele castelo secava — em Casas pequenas, quase sempre antes do ano 220,
 * com a campanha desenhada para ir até 305. Agora a busca segue o sangue.
 */
export function findPlayerHeir(state: GameState, rng: Rng): Character | null {
  const player = state.characters[state.playerId];
  if (!player) return null;

  const usable = (c: Character | null): c is Character =>
    !!c && c.alive && c.id !== state.playerId;

  // 1) sucessão normal da Casa (sem inventar um cadete)
  const byHouse = computeSuccessor(state, rng, state.playerHouseId, { allowCadet: false, allowGrant: false });
  if (usable(byHouse)) return byHouse;

  const rank = (c: Character) =>
    (c.ageYears >= 14 ? 2 : c.ageYears >= 6 ? 1 : 0) * 1000 + (c.personalPrestige ?? 0);

  // 2) descendentes diretos, mesmo que tenham mudado de Casa ao casar
  const descendants = livingDescendants(state, player.id)
    .filter(c => !c.isBastard)
    .sort((a, b) => rank(b) - rank(a));
  if (descendants.length) return descendants[0];

  // 3) parentes de sangue nascidos na mesma Casa (irmãos e primos que casaram fora)
  const kin = Object.values(state.characters)
    .filter(c =>
      c.alive &&
      c.id !== player.id &&
      !c.isBastard &&
      c.birthHouseId === player.birthHouseId &&
      c.ageYears >= 6
    )
    .sort((a, b) => rank(b) - rank(a));
  if (kin.length) return kin[0];

  return null;
}

export function handlePlayerDeath(state: GameState, rng: Rng, reason: string): void {
  const houseId = state.playerHouseId;

  // Garantia independente de quem chama: se estamos resolvendo a morte do
  // jogador, ele está morto. Sem isso a busca de herdeiro podia devolver o
  // próprio falecido, porque ele ainda constava como candidato vivo da Casa.
  const dying = state.characters[state.playerId];
  if (dying) dying.alive = false;

  const next = findPlayerHeir(state, rng);

  if (next) {
    state.playerId = next.id;
    state.playerHouseId = next.currentHouseId;

    // Se o herdeiro veio de fora da Casa original, o assento ainda precisa de
    // um senhor — o mundo não pode ficar com um castelo sem liderança.
    const oldHouse = state.houses[houseId];
    if (oldHouse && oldHouse.leaderId !== next.id && !state.characters[oldHouse.leaderId]?.alive) {
      const keeper = computeSuccessor(state, rng, houseId);
      if (keeper) {
        oldHouse.leaderId = keeper.id;
        keeper.title = titleForHouse(houseId, keeper.gender);
      }
    }

    pushNarration(state, `🕯️ Controle transferido para ${next.name} (${state.houses[state.playerHouseId].name}). Motivo: ${reason}.`);
    pushChronicle(state, {
      absTurn: state.date.absoluteTurn,
      title: 'A linhagem continua',
      body: `${next.name} assume o lugar do falecido. (${reason})`,
      tags: ['sucessao'],
    });
    return;
  }

  // Extinção de fato: a Casa segue existindo no mundo, mas sem você.
  const house = state.houses[houseId];
  if (house && !state.characters[house.leaderId]?.alive) {
    const keeper = computeSuccessor(state, rng, houseId);
    if (keeper) {
      house.leaderId = keeper.id;
      keeper.title = titleForHouse(houseId, keeper.gender);
    }
  }

  setGameOver(state, `Sua linhagem se apaga. Não há herdeiro elegível — fim de jogo. (${reason})`, false);
}

/**
 * Um personagem canônico "sobrevivente": o registro marcava a morte dele
 * neste ponto da linha do tempo, mas a interferência do jogador impediu.
 */
export function survivedOwnCanonDeath(state: GameState, c: Character | undefined): boolean {
  if (!c || !c.alive || !c.isCanonical || !c.canonId) return false;
  if (state.canon?.bypassedDeathCanonIds?.[c.canonId]) return true;
  // Estritamente DEPOIS: os mandatos rodam antes das mortes dentro do mesmo
  // turno, então `>=` marcaria como "sobrevivente" alguém que morre daqui a
  // alguns passos deste próprio turno.
  return typeof c.canonDeathAbsTurn === 'number' && state.date.absoluteTurn > c.canonDeathAbsTurn;
}
