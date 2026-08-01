/**
 * Economia das Casas, IA econômica e Banco de Ferro.
 *
 * Roda para todas as Casas a cada turno: produção, consumo, tributo feudal ao
 * suserano, fome e as decisões automáticas de quem não é o jogador.
 */
import { GameState, HouseEconomy, HouseState } from '../models';
import { Rng } from './rng';
import { clamp } from './utils';
import { pushNarration, pushChronicle, pushSystem } from './narration';
import { econTierGold, foodNeedMin, armyMassCount } from './rules';

/**
 * Teto da terra e dos celeiros.
 *
 * A economia era acumulação pura: população composta sem limite, comida e
 * recursos somando para sempre, e nenhuma despesa recorrente. Medido em 155
 * anos, o ouro de uma Casa média multiplicava por 5.000 e os recursos por
 * 62.000 — como uma fazenda custa 120 e um presente 35, toda decisão econômica
 * deixava de significar algo por volta do ano 200.
 *
 * Fazendas passam a ser a alavanca de tudo: sustentam mais gente, guardam mais
 * comida e mais mercadoria.
 */
function carryingCapacity(econ: HouseEconomy): number {
  return 320 + econ.farms * 260;
}

function foodStorage(econ: HouseEconomy): number {
  return 900 + econ.farms * 1100;
}

function goodsStorage(econ: HouseEconomy): number {
  return 500 + econ.farms * 420;
}

/**
 * Quantos homens a terra sustenta em armas.
 *
 * Sem este teto o exército acumulava como o ouro: a IA recrutava sempre que
 * podia e, por volta do ano 220, uma Casa mantinha 27% da própria população sob
 * armas em tempo de paz — e o soldo disso sozinho a levava à falência. Campo
 * arado é o que paga a lança.
 */
function hostCapacity(econ: HouseEconomy): number {
  // Cerca de um em cada oito — já generoso para uma leva medieval.
  return Math.round(econ.peasants * 0.12);
}

/** Soldo da hoste e custo da corte, cobrados todo turno. */
function upkeepGold(house: HouseState): number {
  const wages = armyMassCount(house) * 0.16 + (house.army.knights ?? 0) * 1.2;
  const court = 3 + house.prestige * 0.22;
  return Math.round(wages + court);
}

/**
 * Tesouro que um salão consegue guardar.
 *
 * Limitar só o fluxo não resolve: qualquer saldo positivo, por menor que seja,
 * acumula sem fim em 3.100 turnos. O que mantém a economia relevante é o
 * ESTOQUE ser finito — assim ouro é vazão, não pilha, e vale gastar.
 */
function goldStorage(house: HouseState): number {
  return Math.round(500 + house.economy.farms * 350 + house.prestige * 25);
}

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

    // Crescimento logístico: acelera com terra sobrando e freia perto do teto.
    // (Antes somava sempre, nunca subtraía, e por isso compunha sem limite.)
    const cap = carryingCapacity(econ);
    const room = 1 - econ.peasants / Math.max(1, cap);
    const drift = econ.peasants * 0.006 * room;
    econ.peasants = Math.max(40, Math.round(econ.peasants + drift + rng.float(-0.7, 0.7)));

    const soldierCap = Math.round(econ.peasants * 0.14);
    econ.soldiers = Math.min(soldierCap, econ.soldiers + (rng.chance(0.05) ? 1 : 0));

    // produção de comida: camponeses + fazendas
    const foodProd = Math.round(econ.peasants * 0.25 + econ.farms * 80);
    const need = foodNeedMin(house);
    res.food += (foodProd - need);

    // Celeiro cheio: o excedente apodrece antes da próxima colheita.
    const fCap = foodStorage(econ);
    if (res.food > fCap) {
      const perdido = res.food - fCap;
      res.food = fCap;
      if (house.id === state.playerHouseId && perdido > 200) {
        pushNarration(state, `🌾 Celeiros cheios: ${perdido} de comida apodrece por falta de armazém. Mais fazendas aumentam a capacidade.`);
      }
    }

    // produção de "recursos/goods" proporcional à comida produzida
    const goodsProd = Math.max(0, Math.floor(foodProd / 3));
    res.goods = Math.min(goodsStorage(econ), res.goods + goodsProd);

    // renda em ouro (impostos + comércio)
    const baseGold = Math.round((econ.peasants + econ.soldiers) * 0.085);
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
    // Hoste acima do que a terra sustenta: os levies voltam para o campo.
    const hostCap = hostCapacity(econ);
    const mass = armyMassCount(house);
    if (mass > hostCap) {
      // Dispensa de baixo para cima: a leva volta ao campo antes de qualquer
      // profissional. Sem incluir as fileiras treinadas, os cavaleiros
      // acumulavam para sempre — e era o soldo deles, não o dos levies,
      // que quebrava a Casa.
      let excesso = mass - hostCap;
      let dispensados = 0;
      for (const tier of ['levies', 'menAtArms', 'squires', 'knights'] as const) {
        if (excesso <= 0) break;
        const corte = Math.min(house.army[tier], excesso);
        house.army[tier] -= corte;
        excesso -= corte;
        dispensados += corte;
      }
      if (house.id === state.playerHouseId && dispensados > 30) {
        pushNarration(state, `🌱 ${dispensados} homens voltam ao campo: suas terras não sustentam uma hoste maior.`);
      }
    }

    // Cavalaria é elite, não maioria. A IA treina sempre para cima e, sem este
    // limite, a hoste virava quase toda de cavaleiros — cujo soldo, sozinho,
    // superava a renda da Casa.
    const knightCap = Math.max(2, Math.round(hostCapacity(econ) * 0.08));
    if (house.army.knights > knightCap) {
      const rebaixados = house.army.knights - knightCap;
      house.army.knights = knightCap;
      house.army.menAtArms += rebaixados;
    }

    // Soldo e corte: manter hoste e salão custa todo turno.
    const upkeep = upkeepGold(house);
    const saldo = baseGold + tradeGold - upkeep;
    res.gold = res.gold + saldo;

    if (res.gold < 0) {
      // Cofre vazio: as tropas desertam antes de o senhor passar fome.
      res.gold = 0;
      const desertores = Math.min(house.army.levies, Math.ceil(upkeep / 3));
      house.army.levies -= desertores;
      house.prestige = clamp(house.prestige - 1, 1, 100);
      if (house.id === state.playerHouseId) {
        pushNarration(state, `💸 Sem ouro para o soldo: ${desertores} levies desertam. Prestígio -1.`);
      }
    }

    // Cofre cheio: o excedente escoa em festas, obras e furto.
    const gCap = goldStorage(house);
    if (res.gold > gCap) {
      res.gold = gCap;
    }

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
