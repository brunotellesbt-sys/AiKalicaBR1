import { test, assert, assertEqual, run } from './harness';

import { GameState, Character, HouseState } from '../src/app/core/models';
import { REGIONS, LOCATIONS, TRAVEL_GRAPH } from '../src/app/core/data/regions';
import { HOUSES } from '../src/app/core/data/houses';
import { Rng } from '../src/app/core/engine/rng';
import {
  buildInitialState,
  advanceTurn,
  applyLocalAction,
  handlePlayerDeath,
  CANON_DIVERGENCE_THRESHOLD,
} from '../src/app/core/engine/sim';
import {
  availableCasusBelli, declareWar, warsOf, activeWars,
} from '../src/app/core/engine/warfare';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function toMap<T extends { id: string }>(arr: T[]): Record<string, T> {
  return arr.reduce((acc, x) => { acc[x.id] = x; return acc; }, {} as Record<string, T>);
}

function baseHouses(): Record<string, HouseState> {
  const map: Record<string, HouseState> = {};
  for (const h of HOUSES) {
    map[h.id] = {
      ...h,
      prestige: h.prestigeBase,
      relations: {},
      leaderId: '',
      economy: {
        peasants: 0, soldiers: 0, farms: 0, trainingGrounds: 0, walls: 0,
        tradeLastDelegationTurn: 0, tradePartners: [],
        taxRate: h.suzerainId ? 0.15 : 0.0,
      },
      resources: { gold: 0, food: 0, goods: 0 },
      army: { levies: 0, menAtArms: 0, squires: 0, knights: 0, dragons: 0, stationedRatio: 0.7 },
    };
  }
  return map;
}

function newGame(seed: number, houseId = 'manderly'): { state: GameState; rng: Rng } {
  const rng = new Rng(seed);
  const state = buildInitialState(seed, { playerHouseId: houseId, gender: 'M' }, {
    locations: toMap(LOCATIONS),
    regions: toMap(REGIONS),
    travelGraph: TRAVEL_GRAPH,
    houses: baseHouses(),
    characters: {},
  });
  return { state, rng };
}

/** Avança até um ano/turno alvo sem gerar ruído de menu. */
function runUntil(state: GameState, rng: Rng, year: number, turn = 20): void {
  let guard = 0;
  while (!state.game.over && guard++ < 20000) {
    if (state.date.year > year || (state.date.year === year && state.date.turn >= turn)) break;
    advanceTurn(state, rng, { silent: true });
  }
}

/**
 * Simula o MUNDO até o ano alvo, independente da sobrevivência do jogador.
 *
 * A linhagem do jogador pode se extinguir muito antes de 305 (o que é um
 * desfecho legítimo do jogo), mas aqui interessa verificar o motor canônico.
 */
function runWorldUntil(state: GameState, rng: Rng, year: number, turn = 20): void {
  let guard = 0;
  while (guard++ < 40000) {
    if (state.date.year > year || (state.date.year === year && state.date.turn >= turn)) break;
    state.game.over = false;
    advanceTurn(state, rng, { silent: true });
  }
}

function canonChar(state: GameState, canonId: string): Character | undefined {
  return state.characters[`canon_${canonId}`];
}

/**
 * Assinatura do mundo por VALOR.
 *
 * `uid()` deriva de Math.random()/Date.now(), então os ids das entidades não
 * são reprodutíveis entre execuções — mas tudo que a simulação decide vem do
 * RNG semeado. A assinatura compara estado, não identidade.
 */
function worldSignature(state: GameState): string {
  const alive = Object.values(state.characters).filter(c => c.alive).length;
  const houses = Object.values(state.houses)
    .map(h => {
      const leader = state.characters[h.leaderId];
      return [
        h.id,
        h.prestige,
        h.resources.gold,
        h.resources.food,
        h.army.levies,
        leader ? `${leader.name}/${Math.floor(leader.ageYears)}` : '—',
      ].join(':');
    })
    .sort()
    .join('|');
  return `${state.date.year}.${state.date.turn}#${alive}#${houses}`;
}

function chronicleHas(state: GameState, needle: string): boolean {
  const n = needle.toLowerCase();
  return state.chronicle.some(e => `${e.title} ${e.body}`.toLowerCase().includes(n));
}

/** Força divergência sem depender de encontrar o personagem no mapa. */
function forceDivergence(state: GameState, canonId: string): void {
  state.canon!.playerTouchedDetail![canonId] = { vow: 6 };
  state.canon!.playerTouchedCanonIds![canonId] = 6;
  state.canon!.playerTouchedLastTurn![canonId] = state.date.absoluteTurn;
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test('mesma seed produz exatamente o mesmo mundo (determinismo)', () => {
  const a = newGame(12345);
  const b = newGame(12345);
  runUntil(a.state, a.rng, 155);
  runUntil(b.state, b.rng, 155);
  assertEqual(worldSignature(a.state), worldSignature(b.state), 'mundos divergiram com a mesma seed');
});

test('seeds diferentes produzem mundos diferentes', () => {
  const a = newGame(1);
  const b = newGame(2);
  runUntil(a.state, a.rng, 153);
  runUntil(b.state, b.rng, 153);
  assert(worldSignature(a.state) !== worldSignature(b.state), 'seeds diferentes geraram mundos idênticos');
});

test('conversas repetidas saturam e NÃO divergem um canônico', () => {
  const { state } = newGame(777);

  const target = Object.values(state.characters).find(c => c.isCanonical && c.alive);
  assert(target, 'nenhum personagem canônico encontrado');

  const player = state.characters[state.playerId];
  player.locationId = target!.locationId;
  target!.knownToPlayer = true;

  const rng = new Rng(1);
  for (let i = 0; i < 15; i++) applyLocalAction(state, rng, 'talk', target!.id);

  const score = state.canon!.playerTouchedCanonIds![target!.canonId!] ?? 0;
  assert(score < CANON_DIVERGENCE_THRESHOLD, `conversa sozinha divergiu (score ${score})`);
  assertEqual(score, 2, 'teto da categoria social deveria ser 2');
});

test('laços fracos decaem com o tempo', () => {
  const { state, rng } = newGame(999);

  const target = Object.values(state.characters).find(c => c.isCanonical && c.alive)!;
  const player = state.characters[state.playerId];
  player.locationId = target.locationId;

  applyLocalAction(state, new Rng(2), 'talk', target.id);
  const before = state.canon!.playerTouchedCanonIds![target.canonId!] ?? 0;
  assert(before > 0, 'a interação não registrou score');

  runUntil(state, rng, 153); // ~3 anos sem contato
  const after = state.canon!.playerTouchedCanonIds![target.canonId!] ?? 0;
  assert(after < before, `score não decaiu (${before} -> ${after})`);
});

test('a crônica nunca anuncia a morte de quem continua vivo', () => {
  const { state, rng } = newGame(4242);

  forceDivergence(state, 'aegon_iii');
  // Logo após o marco de morte (157.10), antes de a crise sucessória
  // seguinte poder cobrar seu preço.
  runUntil(state, rng, 157, 12);

  const aegon = canonChar(state, 'aegon_iii');
  assert(aegon?.alive, 'Aegon III deveria ter sobrevivido ao marco de morte por divergência');

  const declaredDead = state.chronicle.some(
    e => /morte de aegon iii|morre aegon iii/i.test(`${e.title} ${e.body}`)
      && !/não|divergente|evitada/i.test(`${e.title} ${e.body}`)
  );
  assert(!declaredDead, 'a crônica registrou a morte de um personagem vivo');
});

test('salvar um rei abre crise sucessória em vez de depor em silêncio', () => {
  const { state, rng } = newGame(4242);

  forceDivergence(state, 'aegon_iii');
  runUntil(state, rng, 158);

  const aegon = canonChar(state, 'aegon_iii')!;
  const throne = state.houses['targaryen_throne'];
  const daeron = canonChar(state, 'daeron_i');

  const crisis = state.canon!.successionCrises!['targaryen_throne'];
  assert(crisis, 'nenhuma crise sucessória foi aberta');

  const ids = crisis.pretenders.map(p => p.characterId);
  assert(ids.includes(aegon.id), 'Aegon III deveria estar entre os pretendentes');
  assert(
    crisis.pretenders.some(p => p.basis === 'incumbent' && p.characterId === aegon.id),
    'Aegon III deveria constar como titular'
  );
  if (daeron) assert(ids.includes(daeron.id), 'Daeron I deveria estar entre os pretendentes');

  // enquanto a crise corre, o pretendente não ocupa o trono automaticamente
  if (!crisis.resolvedAbsTurn && daeron) {
    assert(throne.leaderId !== daeron.id, 'Daeron assumiu o trono apesar da crise aberta');
  }
});

test('uma crise pode ter mais de dois pretendentes', () => {
  const { state, rng } = newGame(4242);
  forceDivergence(state, 'aegon_iii');
  runUntil(state, rng, 158);

  const crisis = state.canon!.successionCrises!['targaryen_throne'];
  assert(crisis, 'nenhuma crise aberta');
  assert(crisis.pretenders.length >= 2, `esperava 2+ pretendentes, veio ${crisis.pretenders.length}`);

  // cada pretendente precisa ter uma base declarada e apoio na faixa
  for (const p of crisis.pretenders) {
    assert(!!state.characters[p.characterId], 'pretendente inexistente');
    assert(p.support >= 0 && p.support <= 100, 'apoio fora de 0..100');
  }
});

test('casamento entre Casas gera reivindicação sobre o assento', () => {
  const { state, rng } = newGame(31415);
  const player = state.characters[state.playerId];

  const target = Object.values(state.characters).find(
    c => c.alive && c.gender !== player.gender && c.currentHouseId !== player.currentHouseId
      && c.maritalStatus === 'single' && c.ageYears >= 16
  );
  assert(target, 'nenhum par elegível encontrado');

  const otherHouse = target!.currentHouseId;
  const myBirthHouse = player.birthHouseId;

  // atende os requisitos da ação de casamento
  player.locationId = target!.locationId;
  target!.relationshipToPlayer = 100;
  (player.kissedIds ??= []).push(target!.id);

  applyLocalAction(state, rng, 'marry', target!.id);

  const claims = state.claims ?? [];
  assert(claims.length > 0, 'o casamento não registrou nenhuma reivindicação');
  assert(
    claims.some(c => c.seatHouseId === myBirthHouse || c.seatHouseId === otherHouse),
    'nenhuma reivindicação sobre os assentos envolvidos'
  );
  assert(claims.every(c => c.strength > 0 && c.strength <= 100), 'força de reivindicação fora da faixa');
});

test('cascata: sem Daeron I no trono, a Conquista de Dorne não acontece', () => {
  const { state, rng } = newGame(4242);

  forceDivergence(state, 'aegon_iii');
  runUntil(state, rng, 159);

  const cancelled = state.canon!.cancelledWarIds ?? {};
  const warRan = (state.canon!.activeWarIds ?? []).includes('war_dorne_conquest');

  assert(
    cancelled['war_dorne_conquest'] || !warRan,
    'a guerra de Dorne aconteceu mesmo sem seu instigador no trono'
  );
  assert(
    chronicleHas(state, 'Guerra que não houve') || chronicleHas(state, 'não aconteceu'),
    'nenhum registro de divergência foi publicado'
  );
});

test('sem interferência, a linha canônica segue normalmente', () => {
  const { state, rng } = newGame(2024);
  runUntil(state, rng, 158);

  const aegon = canonChar(state, 'aegon_iii');
  assert(aegon && !aegon.alive, 'Aegon III deveria ter morrido em 157 sem interferência');

  const throne = state.houses['targaryen_throne'];
  const daeron = canonChar(state, 'daeron_i');
  if (daeron?.alive) {
    assertEqual(throne.leaderId, daeron.id, 'Daeron I deveria ocupar o Trono de Ferro');
  }
});

test('mudança de dinastia renomeia o Trono de Ferro (evento antes inerte)', () => {
  const { state, rng } = newGame(31337);
  runWorldUntil(state, rng, 284);

  const throne = state.houses['targaryen_throne'];
  assert(
    /baratheon/i.test(throne.name),
    `a casa do Trono de Ferro deveria ter virado Baratheon após 283 (nome atual: "${throne.name}")`
  );
  assert(
    state.canon!.appliedEventIds['283_robert_crowned'],
    'o evento de mudança dinástica não chegou a ser processado'
  );
});

test('a campanha alcança o fim da era sem quebrar invariantes', () => {
  const { state, rng } = newGame(8675309);
  runWorldUntil(state, rng, 300);

  assertEqual(state.date.year, 300, 'a simulação não alcançou o ano 300');

  for (const h of Object.values(state.houses)) {
    assert(h.prestige >= 1 && h.prestige <= 100, `${h.name} com prestígio fora da faixa`);
    assert(h.resources.food >= 0 && h.resources.gold >= 0, `${h.name} com recursos negativos`);

    // A Casa do jogador é a única que pode ficar sem sucessor: a extinção da
    // linhagem é uma condição de fim de jogo, e o modo mundo ignora isso de
    // propósito para continuar simulando o resto de Westeros.
    if (h.id === state.playerHouseId) continue;

    const leader = state.characters[h.leaderId];
    assert(leader, `${h.name} sem líder`);
    assert(leader.alive, `${h.name} liderada por um morto (${leader.name})`);
  }

  // Nenhuma crise pode ficar aberta indefinidamente.
  for (const c of Object.values(state.canon!.successionCrises ?? {})) {
    if (!c || c.resolvedAbsTurn) continue;
    const age = state.date.absoluteTurn - c.startedAbsTurn;
    assert(age <= 61, `crise em ${c.houseId} aberta há ${age} turnos`);
  }
});

test('a linhagem do jogador segue o sangue, não só o sobrenome', () => {
  const { state, rng } = newGame(20260731);
  const player = state.characters[state.playerId];

  // Uma filha do jogador que casou em outra Casa: mudou de sobrenome,
  // mas continua sendo a linhagem dele.
  const daughter: Character = {
    ...player,
    id: 'test_daughter',
    name: 'Herdeira de Sangue',
    gender: 'F',
    ageYears: 22,
    fatherId: player.id,
    motherId: undefined,
    currentHouseId: 'lannister', // casou fora
    birthHouseId: player.birthHouseId,
    spouseId: undefined,
    maritalStatus: 'married',
  };
  state.characters[daughter.id] = daughter;

  // Extingue todos os outros portadores do sobrenome da Casa do jogador.
  for (const c of Object.values(state.characters)) {
    if (c.id === player.id || c.id === daughter.id) continue;
    if (c.currentHouseId === state.playerHouseId) c.alive = false;
  }

  handlePlayerDeath(state, rng, 'teste');

  assert(!state.game.over, 'a campanha terminou apesar de existir descendente vivo');
  assertEqual(state.playerId, daughter.id, 'o controle deveria ter passado à filha');
  assertEqual(state.playerHouseId, 'lannister', 'a Casa do jogador deveria acompanhar o herdeiro');

  // O assento abandonado não pode ficar com um líder morto.
  const oldHouse = state.houses[player.currentHouseId];
  const keeper = state.characters[oldHouse.leaderId];
  assert(keeper?.alive, 'o assento original ficou com um líder morto');
});

test('sem nenhum parente de sangue, a linhagem realmente se extingue', () => {
  const { state, rng } = newGame(555001);
  const player = state.characters[state.playerId];

  for (const c of Object.values(state.characters)) {
    if (c.id === player.id) continue;
    if (c.birthHouseId === player.birthHouseId || c.currentHouseId === state.playerHouseId) {
      c.alive = false;
    }
  }

  handlePlayerDeath(state, rng, 'teste');
  assert(state.game.over, 'deveria ser fim de jogo sem qualquer parente vivo');
});

test('guerra declarada pelo jogador roda e termina com termos', () => {
  const { state, rng } = newGame(90210);
  const house = state.houses[state.playerHouseId];
  const player = state.characters[state.playerId];

  // o jogador precisa liderar e ter hoste
  house.leaderId = player.id;
  house.army.levies = 400;
  house.army.menAtArms = 80;

  const target = Object.values(state.houses).find(
    h => h.id !== house.id && h.regionId === house.regionId && !h.isIronThrone
  )!;
  house.relations[target.id] = 10; // rixa de fronteira

  const cbs = availableCasusBelli(state, house.id, target.id);
  assert(cbs.includes('feud'), `esperava casus belli de rixa, veio ${cbs.join(',')}`);

  const war = declareWar(state, rng, house.id, target.id, 'feud');
  assert(war, 'a guerra não foi declarada');
  assertEqual(warsOf(state, house.id).length, 1, 'a guerra não aparece na lista da Casa');

  // roda até acabar (ou até a exaustão)
  let guard = 0;
  while (activeWars(state).length && guard++ < 400) {
    advanceTurn(state, rng, { silent: true });
    if (state.game.over) break;
  }

  const finished = (state.wars ?? []).find(w => w.id === war!.id);
  assert(finished?.endedAbsTurn, 'a guerra nunca terminou');
  assert(
    ['attacker', 'defender', 'white'].includes(finished!.outcome!),
    `desfecho inválido: ${finished!.outcome}`
  );
  assert(finished!.recentBattles.length > 0, 'nenhuma batalha foi travada');
});

test('guerra sem justificativa custa prestígio e relações', () => {
  const { state, rng } = newGame(70707);
  const house = state.houses[state.playerHouseId];
  house.leaderId = state.playerId;

  const target = Object.values(state.houses).find(
    h => h.id !== house.id && !h.isIronThrone && (house.relations[h.id] ?? 50) > 40
  )!;

  const cbs = availableCasusBelli(state, house.id, target.id);
  assertEqual(cbs[cbs.length - 1], 'conquest', 'conquista deveria estar sempre disponível');

  const prestigeBefore = house.prestige;
  const neutral = Object.values(state.houses).find(h => h.id !== house.id && h.id !== target.id)!;
  const relBefore = neutral.relations[house.id] ?? 50;

  declareWar(state, rng, house.id, target.id, 'conquest');

  assert(house.prestige < prestigeBefore, 'agressão sem motivo não custou prestígio');
  assert(
    (neutral.relations[house.id] ?? 50) < relBefore,
    'o resto do reino não reagiu à agressão sem motivo'
  );
});

test('a sincronização de 298 não tira o assento do jogador em silêncio', () => {
  const { state, rng } = newGame(24680, 'stark');

  // Leva o mundo até a véspera da rajada de sincronização canônica.
  let guard = 0;
  while (guard++ < 20000) {
    if (state.date.year === 297 && state.date.turn >= 19) break;
    state.game.over = false;
    advanceTurn(state, rng, { silent: true });
  }

  // Um jogador NÃO canônico sentado em Winterfell — o caso que o cânone
  // tentaria sobrescrever com Eddard Stark em 298.1.
  const usurper: Character = {
    ...state.characters[state.playerId],
    id: 'test_usurper',
    name: 'Senhor do Norte',
    ageYears: 34,
    alive: true,
    isCanonical: false,
    canonId: undefined,
    canonDeathAbsTurn: undefined,
    currentHouseId: 'stark',
    birthHouseId: 'stark',
  };
  state.characters[usurper.id] = usurper;
  state.playerId = usurper.id;
  state.playerHouseId = 'stark';
  state.houses['stark'].leaderId = usurper.id;

  for (let i = 0; i < 4; i++) {
    state.game.over = false;
    advanceTurn(state, rng, { silent: true });
  }

  const stark = state.houses['stark'];
  const crisis = state.canon!.successionCrises?.['stark'];

  // O assento pode mudar de mãos — mas só por disputa, nunca por decreto.
  const perdeuSemDisputa = stark.leaderId !== usurper.id && !crisis;
  assert(!perdeuSemDisputa, 'o cânone tomou o assento do jogador sem abrir disputa');

  if (crisis) {
    assert(
      crisis.pretenders.some(p => p.characterId === usurper.id),
      'o jogador deveria constar como pretendente na própria disputa'
    );
  }
});

test('a economia estabiliza em platô, não em explosão', () => {
  const { state, rng } = newGame(31337);

  const medianas = () => {
    const hs = Object.values(state.houses);
    const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    return {
      gold: med(hs.map(h => h.resources.gold)),
      food: med(hs.map(h => h.resources.food)),
      goods: med(hs.map(h => h.resources.goods ?? 0)),
      peasants: med(hs.map(h => h.economy.peasants)),
    };
  };

  runWorldUntil(state, rng, 200);
  const em200 = medianas();
  runWorldUntil(state, rng, 305);
  const em305 = medianas();

  // Sem tetos, cada uma destas grandezas multiplicava por milhares em 155 anos,
  // e qualquer preço do jogo (fazenda 120, presente 35) virava irrelevante.
  for (const [nome, a, b] of [
    ['ouro', em200.gold, em305.gold],
    ['comida', em200.food, em305.food],
    ['recursos', em200.goods, em305.goods],
    ['camponeses', em200.peasants, em305.peasants],
  ] as Array<[string, number, number]>) {
    const crescimento = b / Math.max(1, a);
    assert(crescimento < 2, `${nome} cresceu ${crescimento.toFixed(1)}x entre 200 e 305 (esperado platô)`);
  }

  // E o platô precisa deixar as Casas solventes, não falidas.
  assert(em305.gold > 200, `ouro mediano em 305 é ${em305.gold}: as Casas quebraram`);

  // A hoste não pode passar do que a terra sustenta.
  for (const h of Object.values(state.houses)) {
    const mass = h.army.levies + h.army.menAtArms + h.army.squires + h.army.knights;
    const teto = Math.round(h.economy.peasants * 0.12);
    assert(mass <= teto + 60, `${h.name} mantém ${mass} homens para um teto de ${teto}`);
  }
});

test('invariantes econômicas: nada fica negativo depois de 200 turnos', () => {
  const { state, rng } = newGame(555);
  runUntil(state, rng, 160);

  for (const h of Object.values(state.houses)) {
    assert(h.resources.gold >= 0, `${h.name} com ouro negativo`);
    assert(h.resources.food >= 0, `${h.name} com comida negativa`);
    assert((h.resources.goods ?? 0) >= 0, `${h.name} com recursos negativos`);
    assert(h.prestige >= 1 && h.prestige <= 100, `${h.name} com prestígio fora de 1..100`);
    assert(h.army.levies >= 0, `${h.name} com levies negativos`);
    assert(!!state.characters[h.leaderId], `${h.name} sem líder válido`);
  }
});

run();
