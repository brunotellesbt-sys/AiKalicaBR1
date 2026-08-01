/**
 * Guerras declaradas em jogo.
 *
 * Distintas das guerras canônicas (que a história traz pronta): estas nascem de
 * uma decisão — sua ou da IA — e precisam de um motivo que o reino aceite. Sem
 * justificativa, o resto de Westeros trata a agressão como o que ela é.
 */
import { CasusBelli, GameState, HouseState, PeaceTerms, War } from '../models';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { pushNarration, pushChronicle } from './narration';
import { armyPower, applyArmyLoss } from './rules';
import { claimsOnSeat, occupySeat, releaseSeat, ensureOccupations } from './claims';
import {
  forceMarriage, hostageCandidate, hostageFrom, marriagePair, punishBrokenFaith, takeHostage,
} from './hostages';

/** Depois disso, as duas partes estão exaustas demais para continuar. */
const WAR_EXHAUSTION_TURNS = 80;

/** Pontuação necessária para impor termos. */
const WAR_SCORE_VICTORY = 100;

export function ensureWars(state: GameState): War[] {
  state.wars = state.wars ?? [];
  return state.wars;
}

export function activeWars(state: GameState): War[] {
  return ensureWars(state).filter(w => !w.endedAbsTurn);
}

export function warBetween(state: GameState, a: string, b: string): War | undefined {
  return activeWars(state).find(w =>
    (w.attackerHouseId === a && w.defenderHouseId === b) ||
    (w.attackerHouseId === b && w.defenderHouseId === a));
}

export function warsOf(state: GameState, houseId: string): War[] {
  return activeWars(state).filter(w => sideOf(w, houseId) !== null);
}

export function sideOf(w: War, houseId: string): 'attacker' | 'defender' | null {
  if (w.attackerHouseId === houseId || w.attackerAllies.includes(houseId)) return 'attacker';
  if (w.defenderHouseId === houseId || w.defenderAllies.includes(houseId)) return 'defender';
  return null;
}

export function casusBelliLabel(cb: CasusBelli): string {
  switch (cb) {
    case 'claim': return 'reivindicação de assento';
    case 'feud': return 'rixa de fronteira';
    case 'tribute': return 'tributo negado';
    default: return 'conquista';
  }
}

/**
 * Motivos disponíveis para atacar um alvo.
 *
 * `conquest` sempre aparece — mas custa caro em prestígio e relações, porque é
 * uma guerra sem desculpa nenhuma.
 */
export function availableCasusBelli(state: GameState, attackerId: string, defenderId: string): CasusBelli[] {
  const attacker = state.houses[attackerId];
  const defender = state.houses[defenderId];
  if (!attacker || !defender || attackerId === defenderId) return [];

  const out: CasusBelli[] = [];

  // Alguém da sua Casa reivindica o assento do alvo.
  const claims = claimsOnSeat(state, defenderId);
  if (claims.some(c => c.person.currentHouseId === attackerId)) out.push('claim');

  // Relação no chão é motivo suficiente para os vizinhos entenderem.
  if ((attacker.relations[defenderId] ?? 50) <= 20) out.push('feud');

  // Vassalo que não paga.
  if (defender.suzerainId === attackerId && (defender.economy.taxRate ?? 0) < 0.10) out.push('tribute');

  out.push('conquest');
  return out;
}

/** Casas que entram na guerra ao lado de alguém (relação alta e mesma região contam). */
function gatherAllies(state: GameState, houseId: string, enemyId: string): string[] {
  const house = state.houses[houseId];
  if (!house) return [];

  return Object.values(state.houses)
    .filter(h =>
      h.id !== houseId && h.id !== enemyId &&
      (h.relations[houseId] ?? 50) >= 72 &&
      (h.relations[enemyId] ?? 50) < 60 &&
      !h.isIronThrone)
    .sort((a, b) => (b.relations[houseId] ?? 50) - (a.relations[houseId] ?? 50))
    .slice(0, 3)
    .map(h => h.id);
}

export function declareWar(
  state: GameState,
  rng: Rng,
  attackerId: string,
  defenderId: string,
  cb: CasusBelli
): War | null {
  const attacker = state.houses[attackerId];
  const defender = state.houses[defenderId];
  if (!attacker || !defender) return null;
  if (warBetween(state, attackerId, defenderId)) return null;

  const war: War = {
    id: uid('war'),
    attackerHouseId: attackerId,
    defenderHouseId: defenderId,
    attackerAllies: gatherAllies(state, attackerId, defenderId),
    defenderAllies: gatherAllies(state, defenderId, attackerId),
    casusBelli: cb,
    startedAbsTurn: state.date.absoluteTurn,
    scoreAttacker: 0,
    scoreDefender: 0,
    lastBattleAbsTurn: state.date.absoluteTurn,
    recentBattles: [],
  };
  ensureWars(state).push(war);

  // Marchar contra quem guarda o seu sangue tem um preço imediato, e a Casa
  // que declarou sabia disso quando declarou.
  punishBrokenFaith(state, rng, attackerId, defenderId);

  // Guerra sem justificativa é lembrada por todo o reino.
  if (cb === 'conquest') {
    attacker.prestige = clamp(attacker.prestige - 6, 1, 100);
    for (const h of Object.values(state.houses)) {
      if (h.id === attackerId) continue;
      h.relations[attackerId] = clamp((h.relations[attackerId] ?? 50) - 4, 0, 100);
    }
  } else {
    attacker.prestige = clamp(attacker.prestige - 1, 1, 100);
  }

  attacker.relations[defenderId] = clamp((attacker.relations[defenderId] ?? 50) - 40, 0, 100);
  defender.relations[attackerId] = clamp((defender.relations[attackerId] ?? 50) - 45, 0, 100);

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Guerra declarada: ${attacker.name} contra ${defender.name}`,
    body: `Motivo alegado: ${casusBelliLabel(cb)}.`,
    tags: ['war', 'politica'],
  });
  pushNarration(state, `⚔️ ${attacker.name} declara guerra a ${defender.name} (${casusBelliLabel(cb)}).`);

  return war;
}

function sideHouses(state: GameState, w: War, side: 'attacker' | 'defender'): HouseState[] {
  const ids = side === 'attacker'
    ? [w.attackerHouseId, ...w.attackerAllies]
    : [w.defenderHouseId, ...w.defenderAllies];
  return ids.map(id => state.houses[id]).filter(Boolean) as HouseState[];
}

function sidePower(state: GameState, houses: HouseState[]): number {
  return houses.reduce((sum, h) => {
    const leader = state.characters[h.leaderId];
    return sum + armyPower(h.army) + (leader?.martial ?? 40) * 25;
  }, 0);
}

function battle(state: GameState, rng: Rng, w: War): void {
  const atk = sideHouses(state, w, 'attacker');
  const def = sideHouses(state, w, 'defender');
  if (!atk.length || !def.length) return;

  const pa = sidePower(state, atk);
  const pb = sidePower(state, def);
  const pWinA = pa <= 0 && pb <= 0 ? 0.5 : clamp(pa / (pa + pb), 0.05, 0.95);

  const attackerWins = rng.chance(pWinA);
  const winner = attackerWins ? atk[rng.int(0, atk.length - 1)] : def[rng.int(0, def.length - 1)];
  const loser = attackerWins ? def[rng.int(0, def.length - 1)] : atk[rng.int(0, atk.length - 1)];

  applyArmyLoss(winner.army, rng.float(0.03, 0.09));
  applyArmyLoss(loser.army, rng.float(0.08, 0.18));

  const gain = rng.int(6, 14);
  if (attackerWins) w.scoreAttacker = clamp(w.scoreAttacker + gain, 0, WAR_SCORE_VICTORY);
  else w.scoreDefender = clamp(w.scoreDefender + gain, 0, WAR_SCORE_VICTORY);

  w.lastBattleAbsTurn = state.date.absoluteTurn;

  const where = state.locations[loser.seatLocationId]?.name ?? 'campo aberto';
  const summary = `Batalha em ${where}: ${winner.name} vence ${loser.name}.`;
  w.recentBattles.push({ absTurn: state.date.absoluteTurn, summary });
  w.recentBattles = w.recentBattles.slice(-12);

  // Vitória esmagadora abre caminho para o assento.
  if (rng.chance(0.20)) {
    loser.economy.walls = Math.max(0, (loser.economy.walls ?? 0) - 1);
    if ((loser.economy.walls ?? 0) <= 0 && rng.chance(0.5)) {
      occupySeat(state, loser, winner, w.id);
      if (attackerWins) w.scoreAttacker = clamp(w.scoreAttacker + 12, 0, WAR_SCORE_VICTORY);
      else w.scoreDefender = clamp(w.scoreDefender + 12, 0, WAR_SCORE_VICTORY);
    }
  }

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Batalha — ${state.houses[w.attackerHouseId]?.name} × ${state.houses[w.defenderHouseId]?.name}`,
    body: summary,
    tags: ['war', 'battle'],
  });

  const involvesPlayer = sideOf(w, state.playerHouseId) !== null;
  if (involvesPlayer) pushNarration(state, `⚔️ ${summary} (placar ${w.scoreAttacker}–${w.scoreDefender})`);
}

/**
 * O que o vencedor pode exigir, e o preço de cada coisa em pontuação de guerra.
 * Exigir mais do que se conquistou faz o outro lado simplesmente recusar.
 */
export const PEACE_TERM_COST: Record<PeaceTerms, number> = {
  white: 0,
  // Laços pessoais custam pouco: são baratos de exigir e caros de honrar.
  // Casamento pede mais que refém porque entrega direito de sangue, não só
  // uma garantia com prazo.
  hostage: 20,
  tribute: 25,
  marriage: 35,
  seat: 60,
  vassalage: 85,
};

export function peaceTermLabel(t: PeaceTerms): string {
  switch (t) {
    case 'tribute': return 'tributo de guerra';
    case 'vassalage': return 'vassalagem';
    case 'seat': return 'cessão do assento tomado';
    case 'hostage': return 'refém';
    case 'marriage': return 'casamento de paz';
    default: return 'paz branca';
  }
}

/** Quem perde, se estes termos forem assinados agora. */
function loserOf(state: GameState, w: War, side: 'attacker' | 'defender'): HouseState | undefined {
  return state.houses[side === 'attacker' ? w.defenderHouseId : w.attackerHouseId];
}

/** Termos que a pontuação atual sustenta, do mais brando ao mais duro. */
export function affordableTerms(state: GameState, w: War, side: 'attacker' | 'defender'): PeaceTerms[] {
  const score = side === 'attacker' ? w.scoreAttacker : w.scoreDefender;
  const winner = state.houses[side === 'attacker' ? w.attackerHouseId : w.defenderHouseId];
  const loser = loserOf(state, w, side);

  const out: PeaceTerms[] = ['white'];

  // Só oferece o que existe: sem criança elegível não há refém a exigir, e sem
  // par solteiro dos dois lados não há casamento a impor.
  if (score >= PEACE_TERM_COST.hostage && loser && hostageCandidate(state, loser.id)) out.push('hostage');

  if (score >= PEACE_TERM_COST.tribute) out.push('tribute');

  if (score >= PEACE_TERM_COST.marriage && winner && loser && marriagePair(state, winner, loser)) {
    out.push('marriage');
  }

  // Cessão só faz sentido se este lado realmente segura algum assento.
  const holdsSeat = Object.values(state.occupations ?? {})
    .some(o => o.warId === w.id && sideOf(w, o.occupierHouseId) === side);
  if (score >= PEACE_TERM_COST.seat && holdsSeat) out.push('seat');

  if (score >= PEACE_TERM_COST.vassalage) out.push('vassalage');
  return out;
}

/** Impõe os termos de paz conforme quem venceu e por quanto. */
export function endWar(
  state: GameState,
  rng: Rng,
  w: War,
  outcome: 'attacker' | 'defender' | 'white',
  why: string,
  terms?: PeaceTerms
): void {
  if (w.endedAbsTurn) return;
  w.endedAbsTurn = state.date.absoluteTurn;
  w.outcome = outcome;

  const attacker = state.houses[w.attackerHouseId];
  const defender = state.houses[w.defenderHouseId];
  const imposto: string[] = [];
  let keepSeats = false;

  if (outcome !== 'white' && attacker && defender) {
    const winner = outcome === 'attacker' ? attacker : defender;
    const loser = outcome === 'attacker' ? defender : attacker;
    const score = outcome === 'attacker' ? w.scoreAttacker : w.scoreDefender;

    winner.prestige = clamp(winner.prestige + 4, 1, 100);
    loser.prestige = clamp(loser.prestige - 4, 1, 100);

    // Sem termo explícito (guerra entre IAs), o vencedor leva o mais duro que
    // a pontuação sustenta.
    const escolhido: PeaceTerms = terms
      ?? affordableTerms(state, w, outcome)
        .slice()
        .sort((a, b) => PEACE_TERM_COST[b] - PEACE_TERM_COST[a])[0]
      ?? 'white';

    if (escolhido === 'tribute' || escolhido === 'vassalage') {
      const tribute = Math.min(loser.resources.goods ?? 0, Math.round(score * 1.2));
      loser.resources.goods = (loser.resources.goods ?? 0) - tribute;
      winner.resources.goods = (winner.resources.goods ?? 0) + tribute;
      if (tribute > 0) imposto.push(`${tribute} recursos em tributo`);
    }

    if (escolhido === 'vassalage' && !loser.isIronThrone && loser.suzerainId !== winner.id) {
      loser.suzerainId = winner.id;
      loser.economy.taxRate = Math.max(loser.economy.taxRate ?? 0.15, 0.20);
      imposto.push(`${loser.name} passa a jurar a ${winner.name}`);
    }

    if (escolhido === 'hostage') {
      const refem = takeHostage(state, winner, loser);
      if (refem) imposto.push(`${refem.name} vai como refém para ${winner.name}`);
    }

    if (escolhido === 'marriage') {
      const par = forceMarriage(state, rng, winner, loser);
      if (par) imposto.push(`${par.groom.name} casa-se com ${par.bride.name}`);
    }

    if (escolhido === 'seat') {
      for (const o of Object.values(ensureOccupations(state))) {
        if (o.warId !== w.id) continue;
        if (sideOf(w, o.occupierHouseId) !== outcome) continue;
        const seat = state.houses[o.seatHouseId];
        if (seat && !seat.isIronThrone) {
          seat.suzerainId = o.occupierHouseId;
          seat.economy.taxRate = Math.max(seat.economy.taxRate ?? 0.15, 0.25);
          imposto.push(`${seat.name} fica sob ${state.houses[o.occupierHouseId]?.name ?? 'o ocupante'}`);
        }
      }
    }
    keepSeats = escolhido === 'seat' || escolhido === 'vassalage';

    // O selo da paz.
    //
    // Como termo isolado, o laço pessoal quase nunca saía da mesa: a IA leva o
    // mais duro que pode, e com o placar em 100 a vassalagem ganha sempre —
    // medido, 48% das pazes podiam exigir um refém e nenhuma exigia. Mas em
    // Westeros o refém e o casamento não competem com a vassalagem, eles a
    // selam: o derrotado jura E entrega um filho. Então qualquer paz imposta
    // pode vir acompanhada, sem custo extra de pontuação.
    if (escolhido !== 'white') {
      if (escolhido !== 'hostage' && rng.chance(0.35)) {
        const refem = takeHostage(state, winner, loser);
        if (refem) imposto.push(`${refem.name} vai como refém para ${winner.name}`);
      } else if (escolhido !== 'marriage' && rng.chance(0.25)) {
        const par = forceMarriage(state, rng, winner, loser);
        if (par) imposto.push(`${par.groom.name} casa-se com ${par.bride.name}`);
      }
    }
  }

  // Ocupações desta guerra são devolvidas, salvo quando os termos as mantêm.
  for (const o of Object.values(ensureOccupations(state))) {
    if (o.warId !== w.id) continue;
    const keep = keepSeats && sideOf(w, o.occupierHouseId) === outcome;
    if (!keep) releaseSeat(state, o.locationId, 'a paz é assinada');
  }

  const label = outcome === 'white'
    ? 'Paz branca: nenhum lado impõe termos.'
    : `Vitória de ${outcome === 'attacker' ? attacker?.name : defender?.name}.`;

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Fim da guerra — ${attacker?.name} × ${defender?.name}`,
    body: `${label} ${imposto.join('. ')}${imposto.length ? '.' : ''} (${why})`,
    tags: ['war', 'end', 'politica'],
  });

  if (sideOf(w, state.playerHouseId) !== null) {
    pushNarration(state, `🕊️ Fim da guerra: ${label} ${imposto.join('. ')}`);
  }
}


/**
 * Casas ambiciosas declaram as próprias guerras.
 *
 * Sem isto, todo conflito não canônico do mundo partia do jogador: as demais
 * Casas só se defendiam. Uma Casa forte, com motivo e vizinho fraco, agora
 * ataca por conta própria — e o jogador pode acordar em guerra sem ter feito
 * nada.
 */
function tickAiAggression(state: GameState, rng: Rng): void {
  // Raro por turno: ~uma guerra nova a cada poucos anos no reino inteiro.
  if (!rng.chance(0.02)) return;
  if (activeWars(state).length >= 5) return;

  const candidatos = Object.values(state.houses).filter(h =>
    h.id !== state.playerHouseId &&
    !h.isIronThrone &&
    warsOf(state, h.id).length === 0 &&
    // Calibrado ao teto de hoste: com a terra limitando o recrutamento, a
    // leva mediana de uma Casa fica na casa das dezenas, não das centenas.
    h.army.levies >= 30 &&
    h.prestige >= 45
  );
  if (!candidatos.length) return;

  const atacante = candidatos[rng.int(0, candidatos.length - 1)];

  // Alvos plausíveis: mesma região, sem guerra, mais fracos — e, sobretudo,
  // contra quem exista um motivo defensável. Filtrar o motivo ANTES do sorteio
  // é o que faz a agressão acontecer: apenas 5% dos vizinhos mais fracos dão
  // casus belli, então sortear primeiro e checar depois quase nunca resultava
  // em guerra nenhuma.
  const alvos = Object.values(state.houses)
    .filter(h =>
      h.id !== atacante.id &&
      h.regionId === atacante.regionId &&
      !h.isIronThrone &&
      !warBetween(state, atacante.id, h.id) &&
      h.suzerainId !== atacante.id &&
      // Um refém é uma garantia de verdade: a IA não marcha contra quem
      // guarda o próprio sangue.
      !hostageFrom(state, h.id, atacante.id) &&
      armyPower(h.army) < armyPower(atacante.army) * 0.8
    )
    .map(h => ({ casa: h, motivos: availableCasusBelli(state, atacante.id, h.id).filter(m => m !== 'conquest') }))
    .filter(x => x.motivos.length > 0);

  if (!alvos.length) return;

  const escolhido = alvos[rng.int(0, alvos.length - 1)];
  declareWar(state, rng, atacante.id, escolhido.casa.id, escolhido.motivos[0]);
}

/** Roda as guerras ativas: batalhas, desgaste e o cansaço que leva à paz. */
export function tickWars(state: GameState, rng: Rng): void {
  tickAiAggression(state, rng);

  for (const w of activeWars(state)) {
    const atk = sideHouses(state, w, 'attacker');
    const def = sideHouses(state, w, 'defender');

    // Desgaste por turno em todos os beligerantes.
    for (const h of [...atk, ...def]) {
      h.army.levies = Math.max(0, Math.floor(h.army.levies * 0.99));
      h.resources.gold = Math.max(0, h.resources.gold - 5);
      h.resources.food = Math.max(0, Math.floor(h.resources.food * 0.995));
    }

    if ((state.date.absoluteTurn - w.lastBattleAbsTurn) >= 3 && rng.chance(0.7)) {
      battle(state, rng, w);
    }

    if (w.scoreAttacker >= WAR_SCORE_VICTORY) { endWar(state, rng, w, 'attacker', 'vitória em campo'); continue; }
    if (w.scoreDefender >= WAR_SCORE_VICTORY) { endWar(state, rng, w, 'defender', 'vitória em campo'); continue; }

    const age = state.date.absoluteTurn - w.startedAbsTurn;
    if (age >= WAR_EXHAUSTION_TURNS) {
      const outcome = w.scoreAttacker === w.scoreDefender
        ? 'white'
        : (w.scoreAttacker > w.scoreDefender ? 'attacker' : 'defender');
      endWar(state, rng, w, outcome, 'exaustão dos dois lados');
      continue;
    }

    // A IA pede paz quando está claramente perdendo.
    const playerSide = sideOf(w, state.playerHouseId);
    const aiOnly = playerSide === null;
    if (aiOnly && age >= 20) {
      const gap = Math.abs(w.scoreAttacker - w.scoreDefender);
      if (gap >= 40 && rng.chance(0.25)) {
        endWar(state, rng, w, w.scoreAttacker > w.scoreDefender ? 'attacker' : 'defender', 'termos aceitos');
      }
    }
  }

  // Mantém o histórico recente (20 anos) para a crônica e os painéis; guerras
  // mais antigas que isso só sobrevivem como entrada de crônica.
  state.wars = ensureWars(state).filter(w =>
    !w.endedAbsTurn || (state.date.absoluteTurn - w.endedAbsTurn) <= 400);
}
