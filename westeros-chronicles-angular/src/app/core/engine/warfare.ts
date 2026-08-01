/**
 * Guerras declaradas em jogo.
 *
 * Distintas das guerras canônicas (que a história traz pronta): estas nascem de
 * uma decisão — sua ou da IA — e precisam de um motivo que o reino aceite. Sem
 * justificativa, o resto de Westeros trata a agressão como o que ela é.
 */
import { CasusBelli, GameState, HouseState, War } from '../models';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { pushNarration, pushChronicle } from './narration';
import { armyPower, applyArmyLoss } from './rules';
import { claimsOnSeat, occupySeat, releaseSeat, ensureOccupations } from './claims';

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

/** Impõe os termos de paz conforme quem venceu e por quanto. */
export function endWar(
  state: GameState,
  rng: Rng,
  w: War,
  outcome: 'attacker' | 'defender' | 'white',
  why: string
): void {
  if (w.endedAbsTurn) return;
  w.endedAbsTurn = state.date.absoluteTurn;
  w.outcome = outcome;

  const attacker = state.houses[w.attackerHouseId];
  const defender = state.houses[w.defenderHouseId];
  const terms: string[] = [];

  if (outcome !== 'white' && attacker && defender) {
    const winner = outcome === 'attacker' ? attacker : defender;
    const loser = outcome === 'attacker' ? defender : attacker;
    const score = outcome === 'attacker' ? w.scoreAttacker : w.scoreDefender;

    winner.prestige = clamp(winner.prestige + 4, 1, 100);
    loser.prestige = clamp(loser.prestige - 4, 1, 100);

    // Tributo de guerra
    const tribute = Math.min(loser.resources.goods ?? 0, Math.round(score * 1.2));
    loser.resources.goods = (loser.resources.goods ?? 0) - tribute;
    winner.resources.goods = (winner.resources.goods ?? 0) + tribute;
    if (tribute > 0) terms.push(`${tribute} recursos em tributo`);

    // Vitória esmagadora: vassalagem
    if (score >= 85 && !loser.isIronThrone && loser.suzerainId !== winner.id) {
      loser.suzerainId = winner.id;
      loser.economy.taxRate = Math.max(loser.economy.taxRate ?? 0.15, 0.20);
      terms.push(`${loser.name} passa a jurar a ${winner.name}`);
    }
  }

  // Ocupações desta guerra são devolvidas, salvo vitória esmagadora do ocupante.
  for (const o of Object.values(ensureOccupations(state))) {
    if (o.warId !== w.id) continue;
    const occupierSide = sideOf(w, o.occupierHouseId);
    const keep = outcome !== 'white' && occupierSide === outcome
      && (outcome === 'attacker' ? w.scoreAttacker : w.scoreDefender) >= 85;
    if (!keep) releaseSeat(state, o.locationId, 'a paz é assinada');
  }

  const label = outcome === 'white'
    ? 'Paz branca: nenhum lado impõe termos.'
    : `Vitória de ${outcome === 'attacker' ? attacker?.name : defender?.name}.`;

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Fim da guerra — ${attacker?.name} × ${defender?.name}`,
    body: `${label} ${terms.join('. ')}${terms.length ? '.' : ''} (${why})`,
    tags: ['war', 'end', 'politica'],
  });

  if (sideOf(w, state.playerHouseId) !== null) {
    pushNarration(state, `🕊️ Fim da guerra: ${label} ${terms.join('. ')}`);
  }
}

/** Roda as guerras ativas: batalhas, desgaste e o cansaço que leva à paz. */
export function tickWars(state: GameState, rng: Rng): void {
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

  // Limpa guerras encerradas há muito tempo, mantendo histórico recente.
  state.wars = ensureWars(state).filter(w =>
    !w.endedAbsTurn || (state.date.absoluteTurn - w.endedAbsTurn) <= 200);
}
