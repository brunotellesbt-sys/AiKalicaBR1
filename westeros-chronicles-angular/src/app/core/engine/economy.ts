/**
 * Economia das Casas, IA econômica e Banco de Ferro.
 *
 * Roda para todas as Casas a cada turno: produção, consumo, tributo feudal ao
 * suserano, fome e as decisões automáticas de quem não é o jogador.
 */
import { GameState, HouseState } from '../models';
import { Rng } from './rng';
import { clamp } from './utils';
import { pushNarration, pushChronicle, pushSystem } from './narration';
import { econTierGold, foodNeedMin, armyMassCount } from './rules';

export function tickEconomyAll(state: GameState, rng: Rng): void {
  const now = state.date.absoluteTurn;

  // IA: sua casa só deixa de ser IA quando você herda (vira líder)
  const player = state.characters[state.playerId];
  const playerHouse = state.houses[state.playerHouseId];
  const playerIsLeader = playerHouse.leaderId === player.id;

  for (const house of Object.values(state.houses)) {
    const econ = house.economy;
    const res = house.resources;
    res.goods = res.goods ?? 0;

    // crescimento populacional (bem leve por turno)
    econ.peasants = Math.max(0, econ.peasants + Math.max(0, Math.floor(econ.peasants * 0.001 + rng.int(-2, 4))));
    econ.soldiers = Math.max(0, econ.soldiers + (rng.chance(0.05) ? 1 : 0));

    // produção de comida: camponeses + fazendas
    const foodProd = Math.round(econ.peasants * 0.25 + econ.farms * 80);
    const need = foodNeedMin(house);
    res.food += (foodProd - need);

    // produção de "recursos/goods" proporcional à comida produzida
    const goodsProd = Math.max(0, Math.floor(foodProd / 3));
    res.goods += goodsProd;

    // renda em ouro (impostos + comércio)
    const baseGold = Math.round((econ.peasants + econ.soldiers) * 0.06);
    let tradeGold = 0;
    const turnsSinceDel = now - econ.tradeLastDelegationTurn;
    if (turnsSinceDel <= 5 && econ.tradePartners.length > 0) {
      tradeGold = 30 + econ.tradePartners.length * 12;
    } else if (econ.tradePartners.length > 0 && turnsSinceDel > 5) {
      // deteriora relações lentamente por negligência
      for (const partnerId of econ.tradePartners) {
        house.relations[partnerId] = clamp((house.relations[partnerId] ?? 50) - 1, 0, 100);
      }
    }
    res.gold += baseGold + tradeGold;

    // tributo ao suserano (em goods)
    const taxRate = clamp(econ.taxRate ?? (house.suzerainId ? 0.15 : 0.0), 0, 0.60);
    econ.taxRate = taxRate;

    if (house.suzerainId) {
      const suz = state.houses[house.suzerainId];
      if (suz) {
        const due = Math.floor(goodsProd * taxRate);
        if (due > 0) {
          const paid = Math.min(res.goods, due);
          res.goods -= paid;
          suz.resources.goods = (suz.resources.goods ?? 0) + paid;

          if (paid >= due) {
            house.relations[suz.id] = clamp((house.relations[suz.id] ?? 50) + 1, 0, 100);
            suz.relations[house.id] = clamp((suz.relations[house.id] ?? 50) + 1, 0, 100);
          } else {
            house.relations[suz.id] = clamp((house.relations[suz.id] ?? 50) - 2, 0, 100);
            suz.relations[house.id] = clamp((suz.relations[house.id] ?? 50) - 2, 0, 100);
          }

          if (house.id === state.playerHouseId) {
            pushNarration(state, `📦 Tributo ao suserano (${suz.name}): devido ${due}, pago ${paid} (taxa ${(taxRate*100).toFixed(0)}%).`);
          }
        }
      }
    }

    // fome
    if (res.food < 0) {
      const deficit = Math.abs(res.food);
      res.food = 0;

      const lossPeasants = Math.min(econ.peasants, Math.ceil(deficit / 45));
      econ.peasants -= lossPeasants;

      // perde tropas em massa primeiro (levies)
      const a = house.army;
      const lossLevies = Math.min(a.levies, Math.ceil(deficit / 75));
      a.levies -= lossLevies;

      house.prestige = clamp(house.prestige - 2, 1, 100);

      if (house.id === state.playerHouseId) {
        pushNarration(state, `⚠️ Fome em suas terras: -${lossPeasants} camponeses e -${lossLevies} soldados em massa. Prestígio -2.`);
      }
    }

    // IA (todas as casas não-controladas; e sua casa antes de você herdar)
    const shouldAI = (house.id !== state.playerHouseId) || !playerIsLeader;
    if (shouldAI) {
      tickHouseAI(state, rng, house);
    }
  }
}

export function tickHouseAI(state: GameState, rng: Rng, house: HouseState): void {
  const econ = house.economy;
  const res = house.resources;
  const need = foodNeedMin(house);

  const tier = econTierGold(house);
  const reserve = tier; // regra: tenta manter pelo menos esse ouro em caixa
  const foodBuffer = tier === 700 ? 320 : tier === 500 ? 240 : tier === 350 ? 170 : 120;
  const desiredMass = tier === 700 ? 320 : tier === 500 ? 250 : tier === 350 ? 190 : 150;

  // Envia delegação comercial periodicamente
  const delChance = tier >= 500 ? 0.90 : tier === 350 ? 0.82 : 0.75;
  if (econ.tradePartners.length > 0 && (state.date.absoluteTurn - econ.tradeLastDelegationTurn) >= 5 && (res.gold - 30) >= reserve && rng.chance(delChance)) {
    res.gold -= 30;
    econ.tradeLastDelegationTurn = state.date.absoluteTurn;
    for (const partnerId of econ.tradePartners) {
      house.relations[partnerId] = clamp((house.relations[partnerId] ?? 50) + 1, 0, 100);
      const partner = state.houses[partnerId];
      if (partner) partner.relations[house.id] = clamp((partner.relations[house.id] ?? 50) + 1, 0, 100);
    }
  }

  // Se comida baixa, compra fazenda
  const farmChance = tier >= 500 ? 0.78 : tier === 350 ? 0.70 : 0.62;
  if (res.food < need + foodBuffer && (res.gold - 120) >= reserve && rng.chance(farmChance)) {
    res.gold -= 120;
    econ.farms += 1;
    econ.peasants += 35;
    house.prestige = clamp(house.prestige + 1, 1, 100);
    return;
  }

  // Se exército muito baixo, recruta
  const mass = armyMassCount(house);
  const recruitChance = tier >= 500 ? 0.66 : tier === 350 ? 0.60 : 0.54;
  if (mass < desiredMass && (res.gold - 60) >= reserve && rng.chance(recruitChance)) {
    res.gold -= 60;
    house.army.levies += 50;
    econ.soldiers += 15;
    return;
  }

  // Treino ocasional
  const trainChance = tier === 700 ? 0.28 : tier === 500 ? 0.22 : tier === 350 ? 0.18 : 0.14;
  if ((res.gold - 90) >= reserve && rng.chance(trainChance)) {
    res.gold -= 90;
    const toMen = Math.min(house.army.levies, rng.int(8, 18));
    house.army.levies -= toMen;
    house.army.menAtArms += toMen;

    const toSquires = Math.min(house.army.menAtArms, rng.int(4, 10));
    house.army.menAtArms -= toSquires;
    house.army.squires += toSquires;

    const toKnights = Math.min(house.army.squires, rng.int(1, 3));
    house.army.squires -= toKnights;
    house.army.knights += toKnights;
  }
}

export function tickRumors(state: GameState, rng: Rng): void {
  // pequenos rumores para preencher lacunas quando não há marcos grandes
  if (!rng.chance(0.08)) return;

  const houses = Object.values(state.houses);
  if (houses.length < 2) return;

  const a = houses[rng.int(0, houses.length - 1)];
  let b = houses[rng.int(0, houses.length - 1)];
  if (a.id === b.id) b = houses[(houses.indexOf(a) + 1) % houses.length];

  const rel = a.relations[b.id] ?? 50;

  const kinds = [
    { t: 'Rumores de casamento', body: `Sussurros apontam um possível casamento entre ${a.name} e ${b.name}.`, tags: ['rumor', 'casamento', 'politica'] },
    { t: 'Tensão fronteiriça', body: `Patrulhas relatam tensão entre ${a.name} e ${b.name}.`, tags: ['rumor', 'politica'] },
    { t: 'Disputa por tributos', body: `Mercadores reclamam de tributos e taxas entre ${a.name} e ${b.name}.`, tags: ['rumor', 'economia'] },
    { t: 'Boatos de conspiração', body: `A corte comenta uma conspiração envolvendo ${a.name} e ${b.name}.`, tags: ['rumor', 'corte'] },
  ];

  const pick = kinds[rng.int(0, kinds.length - 1)];
  const mood = rel >= 60 ? 'amistosa' : rel <= 40 ? 'hostil' : 'incerta';

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: pick.t,
    body: `${pick.body} Clima entre as casas: ${mood}.`,
    tags: pick.tags,
  });

  // só narra no chat quando envolve a casa do jogador ou mesma região
  const playerHouse = state.houses[state.playerHouseId];
  if (playerHouse && (a.id === playerHouse.id || b.id === playerHouse.id || a.regionId === playerHouse.regionId || b.regionId === playerHouse.regionId)) {
    pushNarration(state, `🗞️ ${pick.t}: ${pick.body}`);
  }
}

export function tickIronBank(state: GameState, rng: Rng): void {
  const debt = state.ironBankDebt;
  if (!debt) return;

  if (state.date.absoluteTurn >= debt.nextPaymentTurn) {
    const house = state.houses[state.playerHouseId];
    if (house.resources.gold >= debt.minimumPayment) {
      house.resources.gold -= debt.minimumPayment;
      debt.principal = Math.max(0, Math.round(debt.principal - debt.minimumPayment * 0.60)); // parte amortiza
      debt.nextPaymentTurn += 20;
      debt.missedPayments = Math.max(0, debt.missedPayments - 1);
      pushNarration(state, `🏦 Você paga ${debt.minimumPayment} ouro ao Banco de Ferro. A dívida diminui (principal agora ${debt.principal}).`);
      if (debt.principal <= 0) {
        state.ironBankDebt = null;
        house.prestige = clamp(house.prestige + 1, 1, 100);
        pushNarration(state, '🏦 Dívida quitada. Sua Casa respira. Prestígio +1.');
      }
    } else {
      debt.missedPayments += 1;
      debt.nextPaymentTurn += 10; // pressão acelera
      pushNarration(state, `🏦 Você não consegue pagar o Banco de Ferro. A pressão aumenta (atrasos: ${debt.missedPayments}).`);

      // intervenção se muito grave
      if (debt.missedPayments >= 3) {
        const house = state.houses[state.playerHouseId];
        house.prestige = clamp(house.prestige - 5, 1, 100);
        house.resources.gold = Math.max(0, house.resources.gold - 120);
        pushNarration(state, '⚔️ Braavos impõe sanções e “cobradores” — sua economia sofre e sua honra despenca. Prestígio -5.');
      }
      if (debt.missedPayments >= 5) {
        pushNarration(state, '🩸 Intervenção do Banco de Ferro: mercenários e credores exigem rendas e portos. Você corre risco de ruína total.');
      }
    }
  }

  // juros acumulam 1x ao ano (a cada 20 turnos, no pagamento)
}



export function pickMany<T>(rng: Rng, arr: T[], count: number): T[] {
  const pool = arr.slice();
  const out: T[] = [];
  const n = Math.max(0, Math.min(count, pool.length));
  for (let i = 0; i < n; i++) {
    const ix = rng.int(0, pool.length - 1);
    out.push(pool[ix]);
    pool.splice(ix, 1);
  }
  return out;
}
