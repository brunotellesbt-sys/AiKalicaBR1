/**
 * Rixas entre Casas.
 *
 * As relações eram praticamente inertes: fora das ações do jogador, quase nada
 * as movia. Medido ao longo dos 155 anos, de 83.232 pares apenas 24 chegavam a
 * 20 ou menos — todos por guerras já acontecidas. Isso matava duas mecânicas:
 * o casus belli de rixa (exige ≤ 20) nunca era alcançável, e alianças fortes
 * (80+) também não.
 *
 * A primeira tentativa foi atrito difuso sobre pares sorteados, e falhou pela
 * aritmética: com dezenas de milhares de pares, cada um seria tocado meia vez
 * por campanha inteira. Westeros não funciona assim — tem feudos com nome.
 * Aqui um punhado de rixas ativas se aprofunda com o tempo, vira notícia
 * regional e pode terminar em guerra.
 */
import { GameState, HouseState, Rivalry } from '../models';
import { Rng } from './rng';
import { clamp, uid } from './utils';
import { pushChronicle, pushNarration } from './narration';

/** Quantas rixas o reino sustenta ao mesmo tempo. */
const MAX_ACTIVE_RIVALRIES = 9;

/** Abaixo disto a rixa é pública — e vira motivo de guerra. */
const FEUD_THRESHOLD = 20;

/** Depois disso, mesmo o ódio cansa. */
const RIVALRY_MAX_TURNS = 900; // ~45 anos

const CAUSES = [
  'uma disputa de fronteira que nenhum dos dois cede',
  'primazia na região, que ambos julgam sua',
  'um insulto num banquete que ninguém esqueceu',
  'um casamento prometido e desfeito',
  'a cobrança de portagens numa estrada compartilhada',
  'sangue derramado numa caçada, chamado de acidente',
];

export function ensureRivalries(state: GameState): Rivalry[] {
  state.rivalries = state.rivalries ?? [];
  return state.rivalries;
}

export function activeRivalries(state: GameState): Rivalry[] {
  return ensureRivalries(state);
}

export function rivalryBetween(state: GameState, a: string, b: string): Rivalry | undefined {
  return ensureRivalries(state).find(r =>
    (r.aHouseId === a && r.bHouseId === b) || (r.aHouseId === b && r.bHouseId === a));
}

function relation(a: HouseState, b: HouseState): number {
  return a.relations[b.id] ?? 50;
}

function shift(a: HouseState, b: HouseState, delta: number): void {
  a.relations[b.id] = clamp(relation(a, b) + delta, 0, 100);
  b.relations[a.id] = clamp(relation(b, a) + delta, 0, 100);
}

/** Nasce uma rixa nova entre vizinhos de porte parecido. */
function maybeStartRivalry(state: GameState, rng: Rng): void {
  const rivalries = ensureRivalries(state);
  if (rivalries.length >= MAX_ACTIVE_RIVALRIES) return;
  if (!rng.chance(0.03)) return;

  const houses = Object.values(state.houses).filter(h => !h.isIronThrone);
  if (houses.length < 2) return;

  const a = houses[rng.int(0, houses.length - 1)];

  // Vizinhos de porte semelhante, ainda sem rixa e sem grande amizade.
  const candidatos = houses.filter(h =>
    h.id !== a.id &&
    h.regionId === a.regionId &&
    Math.abs(h.prestige - a.prestige) <= 14 &&
    relation(a, h) < 58 &&
    !rivalryBetween(state, a.id, h.id)
  );
  if (!candidatos.length) return;

  const b = candidatos[rng.int(0, candidatos.length - 1)];
  const cause = CAUSES[rng.int(0, CAUSES.length - 1)];

  rivalries.push({
    id: uid('rival'),
    aHouseId: a.id,
    bHouseId: b.id,
    startedAbsTurn: state.date.absoluteTurn,
    cause,
  });

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Atrito entre ${a.name} e ${b.name}`,
    body: `A causa declarada é ${cause}.`,
    tags: ['politica', 'feud', 'local'],
    // a região é a das duas casas
  } as any);
}

/**
 * Aprofunda as rixas ativas.
 *
 * Ritmo deliberadamente lento: ~8 anos para uma desavença virar inimizade
 * declarada. Rápido demais e o mapa vira guerra civil permanente.
 */
export function tickRivalries(state: GameState, rng: Rng): void {
  maybeStartRivalry(state, rng);

  const rivalries = ensureRivalries(state);
  const sobreviventes: Rivalry[] = [];

  for (const r of rivalries) {
    const a = state.houses[r.aHouseId];
    const b = state.houses[r.bHouseId];
    if (!a || !b) continue;

    const idade = state.date.absoluteTurn - r.startedAbsTurn;

    // Rixa velha demais esfria: quem começou já morreu.
    if (idade > RIVALRY_MAX_TURNS) {
      pushChronicle(state, {
        absTurn: state.date.absoluteTurn,
        title: `A rixa esfria: ${a.name} e ${b.name}`,
        body: 'Os que começaram a briga já morreram, e os herdeiros têm outras preocupações.',
        tags: ['politica', 'local'],
      });
      continue;
    }

    const antes = relation(a, b);

    // O jogador pode inclinar a balança dos dois lados.
    const empurrao = r.playerFavors === 'peace' ? -0.5 : r.playerFavors ? 1.5 : 1;

    if (rng.chance(0.15 * empurrao)) {
      shift(a, b, -1);
    } else if (r.playerFavors === 'peace' && rng.chance(0.08)) {
      shift(a, b, 1);
    }

    const depois = relation(a, b);
    if (antes > FEUD_THRESHOLD && depois <= FEUD_THRESHOLD) {
      pushChronicle(state, {
        absTurn: state.date.absoluteTurn,
        title: `Rixa aberta: ${a.name} e ${b.name}`,
        body: `Anos de atrito viram inimizade declarada (${r.cause}). Os vizinhos escolhem lados.`,
        tags: ['politica', 'feud', 'local'],
      });

      const playerHouse = state.houses[state.playerHouseId];
      if (playerHouse && (playerHouse.regionId === a.regionId)) {
        pushNarration(state, `🗡️ ${a.name} e ${b.name} rompem de vez. Na sua região, todos vão ter de escolher um lado.`);
      }
    }

    sobreviventes.push(r);
  }

  state.rivalries = sobreviventes;
}

/**
 * Rancor de guerra.
 *
 * Terminada a guerra, as duas Casas continuam se odiando por muito tempo e a
 * recuperação é lenta — sem isso, a paz zerava o passado e a mesma dupla podia
 * voltar a ser aliada em poucos anos.
 */
export function tickWarGrudges(state: GameState, rng: Rng): void {
  if (!rng.chance(0.25)) return;

  for (const w of state.wars ?? []) {
    if (!w.endedAbsTurn) continue;
    if ((state.date.absoluteTurn - w.endedAbsTurn) < 60) continue;

    const a = state.houses[w.attackerHouseId];
    const b = state.houses[w.defenderHouseId];
    if (!a || !b) continue;

    // Recuperação lenta, e só até a desconfiança — nunca até a amizade.
    if (relation(a, b) < 40) shift(a, b, 1);
  }
}

/**
 * Intervenção do jogador numa rixa alheia.
 *
 * As histórias das casas menores chegavam como notícia e paravam aí. Agora dá
 * para mediar — caro, lento e com ganho de reputação — ou atiçar, tomando um
 * lado e ganhando um aliado e um inimigo.
 */
export function applyRivalryIntervention(
  state: GameState,
  rng: Rng,
  rivalryId: string,
  mode: 'mediate' | string
): { ok: boolean; message: string } {
  const r = ensureRivalries(state).find(x => x.id === rivalryId);
  if (!r) return { ok: false, message: 'Essa rixa já não existe.' };

  const playerHouse = state.houses[state.playerHouseId];
  const a = state.houses[r.aHouseId];
  const b = state.houses[r.bHouseId];
  if (!playerHouse || !a || !b) return { ok: false, message: 'Casas envolvidas não encontradas.' };

  if (r.playerFavors) {
    return { ok: false, message: 'Você já se envolveu nesta rixa. Voltar atrás custaria sua palavra.' };
  }

  if (mode === 'mediate') {
    const custo = 45;
    if ((playerHouse.resources.goods ?? 0) < custo) {
      return { ok: false, message: `Mediar exige ${custo} recursos em presentes e banquetes.` };
    }
    playerHouse.resources.goods = (playerHouse.resources.goods ?? 0) - custo;
    r.playerFavors = 'peace';

    // Mediar é lento: melhora um pouco agora e freia a deterioração daqui pra frente.
    shift(a, b, 4);
    a.relations[playerHouse.id] = clamp((a.relations[playerHouse.id] ?? 50) + 6, 0, 100);
    b.relations[playerHouse.id] = clamp((b.relations[playerHouse.id] ?? 50) + 6, 0, 100);
    playerHouse.prestige = clamp(playerHouse.prestige + 2, 1, 100);

    pushChronicle(state, {
      absTurn: state.date.absoluteTurn,
      title: `Mediação: ${a.name} e ${b.name}`,
      body: `${playerHouse.name} se oferece como fiador da paz entre as duas Casas.`,
      tags: ['politica', 'feud'],
    });
    return { ok: true, message: `🕊️ Você media a rixa entre ${a.name} e ${b.name}. Prestígio +2.` };
  }

  // Tomar partido de um dos lados.
  const aliado = mode === a.id ? a : mode === b.id ? b : null;
  const rival = aliado === a ? b : aliado === b ? a : null;
  if (!aliado || !rival) return { ok: false, message: 'Essa Casa não está nessa rixa.' };

  r.playerFavors = aliado.id;
  aliado.relations[playerHouse.id] = clamp((aliado.relations[playerHouse.id] ?? 50) + 14, 0, 100);
  playerHouse.relations[aliado.id] = clamp((playerHouse.relations[aliado.id] ?? 50) + 10, 0, 100);
  rival.relations[playerHouse.id] = clamp((rival.relations[playerHouse.id] ?? 50) - 18, 0, 100);
  playerHouse.relations[rival.id] = clamp((playerHouse.relations[rival.id] ?? 50) - 12, 0, 100);

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Lados tomados: ${a.name} e ${b.name}`,
    body: `${playerHouse.name} apoia ${aliado.name} contra ${rival.name}.`,
    tags: ['politica', 'feud'],
  });
  return { ok: true, message: `🗡️ Você apoia ${aliado.name} contra ${rival.name}. Ganhou um aliado e um inimigo.` };
}
