/**
 * Direito e posse sobre assentos.
 *
 * Reivindicações nascem de casamentos entre Casas e passam aos filhos pelo
 * sangue; ocupações nascem de sítios vencidos. As duas coisas respondem à mesma
 * pergunta — de quem é este castelo — e por isso moram juntas.
 */
import { Character, GameState, HouseState, Occupation, SeatClaim } from '../models';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { pushChronicle } from './narration';

export function ensureClaims(state: GameState): SeatClaim[] {
  state.claims = state.claims ?? [];
  return state.claims;
}

/** Registra uma reivindicação, sem duplicar a mesma pessoa sobre o mesmo assento. */
export function addClaim(
  state: GameState,
  seatHouseId: string,
  claimant: Character,
  origin: SeatClaim['origin'],
  strength: number
): void {
  if (!state.houses[seatHouseId]) return;
  if (claimant.currentHouseId === seatHouseId && origin !== 'conquest') return;

  const claims = ensureClaims(state);
  const existing = claims.find(c => c.seatHouseId === seatHouseId && c.claimantId === claimant.id);
  if (existing) {
    existing.strength = Math.max(existing.strength, clamp(strength, 1, 100));
    return;
  }

  claims.push({
    id: uid('claim'),
    seatHouseId,
    claimantId: claimant.id,
    claimantHouseId: claimant.currentHouseId,
    origin,
    strength: clamp(strength, 1, 100),
    createdAbsTurn: state.date.absoluteTurn,
  });
}

/**
 * Casamento entre Casas gera direito recíproco sobre os dois assentos —
 * é assim que uma guerra de sucessão nasce duas gerações depois.
 */
export function registerMarriageClaims(state: GameState, a: Character, b: Character): void {
  // Compara a Casa de NASCIMENTO: quando esta função roda, o casamento já
  // igualou o sobrenome atual dos dois, e comparar `currentHouseId` faria
  // toda união parecer endogâmica.
  if (a.birthHouseId === b.birthHouseId) return;
  if (!state.houses[a.birthHouseId] || !state.houses[b.birthHouseId]) return;

  // Quem casou "para dentro" leva o direito da Casa de origem consigo.
  addClaim(state, a.birthHouseId, b, 'marriage', 35);
  addClaim(state, b.birthHouseId, a, 'marriage', 35);
}

/** Filhos de um casamento entre Casas herdam o direito pelo sangue materno. */
export function registerBirthClaims(state: GameState, child: Character, father: Character, mother: Character): void {
  if (child.isBastard) return;
  const motherHouse = mother.birthHouseId;
  if (!motherHouse || motherHouse === child.currentHouseId) return;
  addClaim(state, motherHouse, child, 'blood', 45);
}

/** Reivindicações vivas e válidas sobre um assento, da mais forte para a mais fraca. */
export function claimsOnSeat(state: GameState, seatHouseId: string): Array<{ claim: SeatClaim; person: Character }> {
  return ensureClaims(state)
    .map(claim => ({ claim, person: state.characters[claim.claimantId] }))
    .filter((x): x is { claim: SeatClaim; person: Character } =>
      !!x.person && x.person.alive && x.person.ageYears >= 12 && x.claim.seatHouseId === seatHouseId)
    .sort((a, b) => b.claim.strength - a.claim.strength);
}

export function ensureOccupations(state: GameState): Record<string, Occupation> {
  state.occupations = state.occupations ?? {};
  return state.occupations;
}

export function occupySeat(state: GameState, seat: HouseState, occupier: HouseState, warId?: string): void {
  const occ = ensureOccupations(state);
  const locationId = seat.seatLocationId;
  if (occ[locationId]?.occupierHouseId === occupier.id) return;

  occ[locationId] = {
    locationId,
    seatHouseId: seat.id,
    occupierHouseId: occupier.id,
    sinceAbsTurn: state.date.absoluteTurn,
    warId,
  };

  seat.prestige = clamp(seat.prestige - 3, 1, 100);
  occupier.prestige = clamp(occupier.prestige + 2, 1, 100);

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Assento tomado: ${state.locations[locationId]?.name ?? locationId}`,
    body: `${occupier.name} ocupa o assento de ${seat.name}.`,
    tags: ['war', 'ocupacao', 'politica'],
  });
}

export function releaseSeat(state: GameState, locationId: string, why: string): void {
  const occ = ensureOccupations(state);
  const o = occ[locationId];
  if (!o) return;
  delete occ[locationId];

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Assento devolvido: ${state.locations[locationId]?.name ?? locationId}`,
    body: `${state.houses[o.occupierHouseId]?.name ?? 'O ocupante'} deixa ${state.houses[o.seatHouseId]?.name ?? 'a Casa'} (${why}).`,
    tags: ['war', 'ocupacao', 'politica'],
  });
}

/** Enquanto ocupado, o assento rende para quem o tomou. */
export function tickOccupations(state: GameState, rng: Rng): void {
  const occ = ensureOccupations(state);

  for (const o of Object.values(occ)) {
    const seat = state.houses[o.seatHouseId];
    const occupier = state.houses[o.occupierHouseId];
    if (!seat || !occupier) { delete occ[o.locationId]; continue; }

    const tribute = Math.min(seat.resources.goods ?? 0, 6);
    seat.resources.goods = (seat.resources.goods ?? 0) - tribute;
    occupier.resources.goods = (occupier.resources.goods ?? 0) + tribute;

    seat.relations[occupier.id] = clamp((seat.relations[occupier.id] ?? 50) - 2, 0, 100);

    // Guarnição em terra hostil se desgasta; a Casa pode retomar o assento.
    const held = state.date.absoluteTurn - o.sinceAbsTurn;
    const retakeChance = clamp(0.01 + held / 900, 0.01, 0.12);
    if (rng.chance(retakeChance)) {
      releaseSeat(state, o.locationId, 'a guarnição é expulsa');
      seat.prestige = clamp(seat.prestige + 2, 1, 100);
    }
  }
}
