/**
 * Ciclo de vida: casamentos, concepção, nascimentos, envelhecimento e morte.
 *
 * É o que mantém o mundo povoado ao longo dos 155 anos da campanha. Depende de
 * sucessão (uma morte precisa resolver assentos) e de claims (casamentos e
 * nascimentos criam direito), mas nada aqui é acionado diretamente pelo jogador.
 */
import { Character, Gender, GameState, HouseState } from '../models';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { genFirstName } from './names';
import { pushNarration, pushChronicle } from './narration';
import { renownFromMartial, titleForHouse, deathChanceByAge, econTierGold } from './rules';
import { canonIsDiverged } from './canon-divergence';
import { registerMarriageClaims, registerBirthClaims } from './claims';
import { computeSuccessor, handlePlayerDeath, handleDeathImmediate } from './succession';

export function isFertileFemale(c: Character): boolean {
  return c.alive && c.gender === 'F' && c.fertility !== 'sterile' && c.ageYears >= 16 && c.ageYears <= 40;
}

export function isAdultMale(c: Character): boolean {
  return c.alive && c.gender === 'M' && c.ageYears >= 16 && c.ageYears <= 60;
}

export function areCloseKin(a: Character, b: Character): boolean {
  // pai/mãe/filho
  if (a.id === b.fatherId || a.id === b.motherId) return true;
  if (b.id === a.fatherId || b.id === a.motherId) return true;
  // irmãos completos/por um dos pais
  if (a.fatherId && b.fatherId && a.fatherId === b.fatherId) return true;
  if (a.motherId && b.motherId && a.motherId === b.motherId) return true;
  return false;
}

export function aiCanMarry(a: Character, b: Character): boolean {
  if (!a.alive || !b.alive) return false;
  if (a.maritalStatus === 'married' || b.maritalStatus === 'married') return false;
  if (a.ageYears < 16 || b.ageYears < 16) return false;
  if (!((a.gender === 'M' && b.gender === 'F') || (a.gender === 'F' && b.gender === 'M'))) return false;
  if (areCloseKin(a, b)) return false;
  return true;
}

export function beginPregnancy(state: GameState, rng: Rng, mother: Character, father: Character, isBastard: boolean): void {
  if ((mother as any).pregnancy) return;
  (mother as any).pregnancy = {
    fatherId: father.id,
    conceivedTurn: state.date.absoluteTurn,
    turnsLeft: 15,
    isBastard,
  };
  if (mother.id === state.playerId || father.id === state.playerId) {
    pushNarration(state, `🤰 Gravidez iniciada (${isBastard ? 'bastardo' : 'legítimo'}). Parto previsto em ~15 turnos.`);
  }
}

export function applyMarriage(
  state: GameState,
  rng: Rng,
  groom: Character,
  bride: Character,
  lineage: 'patri' | 'matri',
  reason: string
): void {
  // vínculo
  groom.spouseId = bride.id;
  bride.spouseId = groom.id;
  groom.maritalStatus = 'married';
  bride.maritalStatus = 'married';

  // Sobrenome/casa:
  // - padrão: patri (casa do homem)
  // - matri: homem assume casa da mulher (usado apenas quando ela é a última viva da casa)
  const chosenHouseId = lineage === 'matri' ? bride.currentHouseId : groom.currentHouseId;

  if (lineage === 'patri') {
    bride.keepsBirthName = false;
    bride.currentHouseId = chosenHouseId;
  } else {
    groom.currentHouseId = chosenHouseId;
  }

  // Dote simples (política básica)
  // - brideHouse transfere um pouco de goods + gold para o casal (casa escolhida)
  const brideHouse = state.houses[bride.birthHouseId] ?? state.houses[bride.currentHouseId];
  const groomHouse = state.houses[groom.currentHouseId];
  if (brideHouse && groomHouse && brideHouse.id !== groomHouse.id) {
    brideHouse.resources.goods = brideHouse.resources.goods ?? 0;
    groomHouse.resources.goods = groomHouse.resources.goods ?? 0;

    // preserva reserva mínima por tier
    const brideReserve = econTierGold(brideHouse);
    const maxGold = Math.max(0, (brideHouse.resources.gold ?? 0) - brideReserve);
    const maxGoods = Math.max(0, (brideHouse.resources.goods ?? 0) - 60);

    const giveGold = Math.min(maxGold, rng.int(10, 40));
    const giveGoods = Math.min(maxGoods, rng.int(12, 45));

    if (giveGold > 0) {
      brideHouse.resources.gold -= giveGold;
      groomHouse.resources.gold += giveGold;
    }
    if (giveGoods > 0) {
      brideHouse.resources.goods -= giveGoods;
      groomHouse.resources.goods += giveGoods;
    }

    // melhora relações
    brideHouse.relations[groomHouse.id] = clamp((brideHouse.relations[groomHouse.id] ?? 50) + 6, 0, 100);
    groomHouse.relations[brideHouse.id] = clamp((groomHouse.relations[brideHouse.id] ?? 50) + 6, 0, 100);
  }

  // Crônica
  const houseLabel = state.houses[chosenHouseId]?.name ?? chosenHouseId;
  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Casamento (IA)`,
    body: `${groom.name} casa-se com ${bride.name}. Casa do casal: ${houseLabel}. Motivo: ${reason}.`,
    tags: ['casamento', 'politica'],
  });

  // Alianças por casamento viram direito sobre assentos, que podem
  // reaparecer como reivindicação numa crise décadas depois.
  registerMarriageClaims(state, groom, bride);

}

export function tickArrangedMarriages(state: GameState, rng: Rng): void {
  // roda a cada 5 turnos para não "explodir" o mundo com casamentos
  if ((state.date.absoluteTurn % 5) !== 0) return;

  const allChars = Object.values(state.characters);

  const eligibleM = allChars.filter(c => c.alive && c.gender === 'M' && c.ageYears >= 16 && c.ageYears <= 65 && c.maritalStatus !== 'married' && !c.isBastard);
  const eligibleF = allChars.filter(c => c.alive && c.gender === 'F' && c.ageYears >= 16 && c.ageYears <= 45 && c.maritalStatus !== 'married' && !c.isBastard);

  const leaderIds = new Set(Object.values(state.houses).map(h => h.leaderId));

  if (!eligibleM.length || !eligibleF.length) return;

  // número de tentativas por tick, proporcional ao tamanho do mundo
  const tries = clamp(Math.floor(Object.keys(state.houses).length / 45), 1, 6);

  for (let i = 0; i < tries; i++) {
    // escolhe uma casa com "necessidade": líder sem filhos adultos ou herdeiro solteiro
    const housePool = Object.values(state.houses).filter(h => h.id !== state.playerHouseId);
    const house = housePool.length ? housePool[rng.int(0, housePool.length - 1)] : null;
    if (!house) continue;

    const leader = state.characters[house.leaderId];
    if (!leader || !leader.alive) continue;

    const houseMembers = allChars.filter(c => c.alive && c.currentHouseId === house.id && !c.isBastard);
    const leaderChildren = houseMembers.filter(c => c.fatherId === leader.id || c.motherId === leader.id);
    const unmarriedHeirs = leaderChildren.filter(c => c.ageYears >= 16 && c.maritalStatus !== 'married');
    const needHeir = leaderChildren.filter(c => c.ageYears >= 10).length === 0; // sem filhos vivos crescendo

    // escolhe noivo: prioriza herdeiros solteiros; senão, o próprio líder se viúvo/solteiro e precisar de herdeiro
    let groom: Character | null = null;
    let bride: Character | null = null;

    const pickFrom = (list: Character[]): Character | null => list.length ? list[rng.int(0, list.length - 1)] : null;

    if (unmarriedHeirs.length) {
      // tenta casar um herdeiro (preferencialmente homem)
      const maleHeir = unmarriedHeirs.filter(c => c.gender === 'M');
      groom = pickFrom(maleHeir.length ? maleHeir : unmarriedHeirs.filter(c => c.gender === 'F'));
    } else if (needHeir && leader.maritalStatus !== 'married' && leader.gender === 'M') {
      groom = leader;
    } else if (needHeir && leader.maritalStatus !== 'married' && leader.gender === 'F') {
      // líder mulher: ela será a "noiva"; tentaremos buscar homem
      bride = leader;
    }

    // se escolhido foi mulher como alvo, inverter lógica
    if (groom && groom.gender === 'F') {
      bride = groom;
      groom = null;
    }

    // busca par
    if (bride && !groom) {
      // precisa de homem de outra casa
      let candidates = eligibleM.filter(m => m.currentHouseId !== bride!.currentHouseId && !areCloseKin(m, bride!));
      // evita arrancar líderes de outras casas (a não ser que não haja alternativa)
      const nonLeaders = candidates.filter(m => !leaderIds.has(m.id));
      if (nonLeaders.length) candidates = nonLeaders;
      if (!candidates.length) continue;
      // escolhe por relações entre casas
      candidates.sort((a, b) => {
        const ra = (state.houses[bride!.currentHouseId]?.relations[a.currentHouseId] ?? 50);
        const rb = (state.houses[bride!.currentHouseId]?.relations[b.currentHouseId] ?? 50);
        return rb - ra;
      });
      groom = candidates[0];
    } else if (groom && !bride) {
      const candidates = eligibleF.filter(f => f.currentHouseId !== groom!.currentHouseId && !areCloseKin(f, groom!));
      if (!candidates.length) continue;
      candidates.sort((a, b) => {
        const ra = (state.houses[groom!.currentHouseId]?.relations[a.currentHouseId] ?? 50);
        const rb = (state.houses[groom!.currentHouseId]?.relations[b.currentHouseId] ?? 50);
        return rb - ra;
      });
      bride = candidates[0];
    }

    if (!groom || !bride) continue;
    if (!aiCanMarry(groom, bride)) continue;

    // regra de preservação da casa da mulher: só se ela for a última viva da casa
    const brideHouseId = bride.currentHouseId;
    const aliveCountOther = Object.values(state.characters).filter(c => c.alive && c.currentHouseId === brideHouseId && c.id !== bride.id).length;
    const brideIsLast = aliveCountOther === 0;

    let lineage: 'patri' | 'matri' = 'patri';
    if (brideIsLast) {
      // IA: tende a preservar a casa da mulher quando ela é a última, especialmente se for líder
      const isLeader = state.houses[brideHouseId]?.leaderId === bride.id;
      const p = isLeader ? 0.90 : 0.65;
      lineage = rng.chance(p) ? 'matri' : 'patri';
    }

    applyMarriage(state, rng, groom, bride, lineage, 'arranjo entre Casas');
  }
}

export function tickConceptions(state: GameState, rng: Rng): void {
  const couples: Array<{father: Character, mother: Character}> = [];

  for (const c of Object.values(state.characters)) {
    if (!c.alive || c.maritalStatus !== 'married' || !c.spouseId) continue;
    const spouse = state.characters[c.spouseId];
    if (!spouse || !spouse.alive || spouse.maritalStatus !== 'married') continue;
    if (c.gender === 'M' && spouse.gender === 'F') {
      couples.push({ father: c, mother: spouse });
    }
  }

  for (const pair of couples) {
    const mother = pair.mother;
    const father = pair.father;
    if (!isFertileFemale(mother) || !isAdultMale(father)) continue;
    if ((mother as any).pregnancy) continue;

    if (rng.chance(0.015)) {
      beginPregnancy(state, rng, mother, father, false);
    }
  }
}

export function tickPregnancies(state: GameState, rng: Rng): void {
  for (const mother of Object.values(state.characters)) {
    const preg = (mother as any).pregnancy as any;
    if (!preg) continue;
    if (!mother.alive) { (mother as any).pregnancy = undefined; continue; }

    if (rng.chance(0.02)) {
      (mother as any).pregnancy = undefined;
      if (mother.id === state.playerId || preg.fatherId === state.playerId) {
        pushNarration(state, `🩸 Uma tragédia: o bebê não sobreviveu à gestação.`);
      }
      continue;
    }

    preg.turnsLeft -= 1;
    if (preg.turnsLeft > 0) continue;

    (mother as any).pregnancy = undefined;
    const father = state.characters[preg.fatherId];
    if (!father || !father.alive) continue;

    const roll = rng.next(); // 0..1
    const babyGender: Gender = rng.chance(0.55) ? 'M' : 'F';

    if (roll < 0.03) {
      handleDeathImmediate(state, rng, mother, 'Morreu no parto (mãe e bebê)');
      if (!state.game.over) pushNarration(state, '👶 O bebê também não sobreviveu ao parto.');
      continue;
    }
    if (roll < 0.08) {
      const baby = spawnNewborn(state, rng, father, mother, babyGender, preg.isBastard);
      handleDeathImmediate(state, rng, mother, 'Morreu no parto');
      if (!state.game.over) {
        pushNarration(state, `👶 O bebê sobrevive: ${baby.name}.`);
        queueNamingIfPlayerParent(state, baby, father, mother);
      }
      continue;
    }
    if (roll < 0.13) {
      if (mother.id === state.playerId || father.id === state.playerId) {
        pushNarration(state, '👶 O bebê não sobreviveu ao parto.');
      }
      continue;
    }

    const baby = spawnNewborn(state, rng, father, mother, babyGender, preg.isBastard);
    if (mother.id === state.playerId || father.id === state.playerId) {
      pushNarration(state, `👶 Nasce um(a) bebê (${preg.isBastard ? 'bastardo' : 'legítimo'}).`);
    }
    queueNamingIfPlayerParent(state, baby, father, mother);
  }
}

export function spawnNewborn(state: GameState, rng: Rng, father: Character, mother: Character, gender: Gender, isBastard: boolean): Character {
  const id = uid('c');
  const name = genFirstName(rng, gender);

  const houseId = father.currentHouseId;
  const locationId = mother.locationId;

  const child: Character = {
    id,
    name,
    gender,
    ageYears: 0,
    alive: true,

    birthHouseId: houseId,
    currentHouseId: houseId,

    fatherId: father.id,
    motherId: mother.id,

    maritalStatus: 'single',
    keepsBirthName: false,
    locationId,

    martial: rng.int(0, 5),
    charm: rng.int(0, 5),
    beauty: rng.int(0, 5),
    renownTier: 'comum',
    fertility: rng.chance(0.05) ? 'sterile' : 'fertile',
    wellLiked: rng.int(10, 40),
    personalPrestige: 0,

    knownToPlayer: false,
    relationshipToPlayer: 0,

    personalGold: 0,
    kissedIds: [],
    isBastard,
  };

  state.characters[id] = child;
  registerBirthClaims(state, child, father, mother);

  return child;
}

export function spawnChild(state: GameState, rng: Rng, father: Character, mother: Character, gender: Gender): Character {
  const id = uid('c');
  const name = genFirstName(rng, gender);
  const houseId = father.currentHouseId;
  const locationId = father.locationId;

  const child: Character = {
    id,
    name,
    gender,
    ageYears: 0,
    alive: true,

    birthHouseId: houseId,
    currentHouseId: houseId,

    fatherId: father.id,
    motherId: mother.id,

    maritalStatus: 'single',
    keepsBirthName: false,
    locationId,

    martial: rng.int(0, 5),
    charm: rng.int(0, 5),
    beauty: rng.int(0, 5),
    renownTier: 'comum',
    fertility: rng.chance(0.05) ? 'sterile' : 'fertile',
    wellLiked: rng.int(10, 40),
    personalPrestige: 0,

    knownToPlayer: false,
    relationshipToPlayer: 0,
  };

  state.characters[id] = child;
  registerBirthClaims(state, child, father, mother);
  return child;
}

export function queueNamingIfPlayerParent(state: GameState, baby: Character, father: Character, mother: Character): void {
  const isPlayerParent = father.id === state.playerId || mother.id === state.playerId;
  if (!isPlayerParent) {
    state.chronicle.unshift({
      turn: state.date.absoluteTurn,
      title: 'Nascimento',
      body: `${baby.name} nasce na ${state.houses[baby.currentHouseId].name}.`,
      tags: ['nascimento'],
    });
    return;
  }

  baby.name = '— sem nome —';
  state.ui.pendingNameQueue = state.ui.pendingNameQueue ?? [];
  state.ui.pendingNameQueue.push(baby.id);
  pushNarration(state, `👶 Você teve um(a) bebê! Abra a janela de nomeação para escolher o primeiro nome agora.`);
  state.chronicle.unshift({
    turn: state.date.absoluteTurn,
    title: 'Nascimento (sua família)',
    body: `Um bebê nasce em sua linhagem.`,
    tags: ['nascimento'],
  });
}

export function tickPersonalProgression(state: GameState, rng: Rng): void {
  for (const c of Object.values(state.characters)) {
    if (!c.alive) continue;

    const age = c.ageYears;
    const growthPhase = age < 16 ? 1.0 : age <= 28 ? 0.7 : age <= 45 ? 0.35 : 0.12;
    const declinePhase = age >= 56 ? (age >= 68 ? 0.45 : 0.25) : 0;

    // Combate cresce mais em juventude e cai gradualmente com idade avançada.
    if (rng.chance(0.22 * growthPhase)) {
      c.martial = clamp(c.martial + rng.int(0, 2), 0, 100);
    }
    if (declinePhase > 0 && rng.chance(declinePhase)) {
      c.martial = clamp(c.martial - rng.int(0, 2), 0, 100);
    }

    // Carisma amadurece com experiência; declínio suave apenas em idades muito altas.
    if (rng.chance(age < 50 ? 0.18 : 0.08)) {
      c.charm = clamp(c.charm + rng.int(0, 1), 0, 100);
    }
    if (age >= 72 && rng.chance(0.20)) {
      c.charm = clamp(c.charm - 1, 0, 100);
    }

    // Apresentação acompanha idade e recursos pessoais (quem tem ouro tende a manter status visual).
    if ((c.personalGold ?? 0) > 80 && rng.chance(0.16)) {
      c.beauty = clamp(c.beauty + 1, 0, 100);
      c.personalGold = Math.max(0, (c.personalGold ?? 0) - 5);
    } else if (age >= 60 && rng.chance(0.17)) {
      c.beauty = clamp(c.beauty - 1, 0, 100);
    }

    // Prestígio pessoal: cresce conforme conjunto de atributos, mais devagar no topo.
    const build = Math.round((c.martial + c.charm + c.beauty) / 3);
    const prestigeGainChance = build >= 72 ? 0.20 : build >= 56 ? 0.14 : 0.08;
    if (rng.chance(prestigeGainChance)) {
      const gain = c.personalPrestige >= 85 ? 0 : 1;
      c.personalPrestige = clamp((c.personalPrestige ?? 0) + gain, 0, 100);
    }

    c.renownTier = renownFromMartial(c.martial);
  }
}

export function tickAgesAndDeaths(state: GameState, rng: Rng): void {
  // 1 turno = 1/20 ano
  const delta = 1 / 20;

  for (const c of Object.values(state.characters)) {
    if (!c.alive) continue;
    c.ageYears = Math.round((c.ageYears + delta) * 100) / 100;

    // Personagens canônicos não morrem aleatoriamente antes do marco de morte conhecido,
    // a menos que o jogador tenha causado divergência relevante naquele destino.
    if (c.isCanonical && c.canonId && c.canonDeathAbsTurn && state.date.absoluteTurn < c.canonDeathAbsTurn) {
      if (!canonIsDiverged(state, c.canonId)) {
        continue;
      }
    }

    const p = deathChanceByAge(c.ageYears);
    if (p > 0 && rng.chance(p)) {
      c.alive = false;
      c.maritalStatus = c.maritalStatus === 'married' ? 'widowed' : c.maritalStatus;
      pushNarration(state, `⚰️ ${c.name} morre de causas naturais aos ${Math.floor(c.ageYears)} anos.`);

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

      // Se era líder de casa, resolve sucessão
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

      // Se o jogador morreu:
      if (c.id === state.playerId) {
        handlePlayerDeath(state, rng, 'Morte por idade');
        return;
      }
    }
  }
}
