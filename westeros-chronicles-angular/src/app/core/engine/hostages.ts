/**
 * Reféns e casamentos impostos na mesa de paz.
 *
 * Os termos de paz eram todos institucionais — tributo, assento, vassalagem —
 * e por isso a guerra não deixava marca em ninguém. Em Westeros o que amarra
 * duas Casas é pessoal: um filho criado na corte do inimigo, uma filha casada
 * com quem venceu.
 *
 * As duas coisas funcionam por mecanismos opostos e complementares. O refém é
 * uma garantia de curto prazo: enquanto durar, a Casa de origem não ataca o
 * guardião — e se atacar mesmo assim, o refém paga. O casamento é o contrário:
 * compra paz imediata (as relações sobem de verdade) mas planta um direito de
 * sangue sobre o assento do derrotado, que pode reaparecer como reivindicação
 * numa crise sucessória décadas depois. Quem impõe casamento está trocando um
 * inimigo hoje por uma guerra de herança amanhã.
 */
import { Character, GameState, HouseState } from '../models';
import { Rng } from './rng';
import { clamp } from './utils';
import { pushChronicle, pushNarration } from './narration';
import { handleDeathImmediate } from './succession';
import { aiCanMarry, applyMarriage } from './lifecycle';

/** Um refém é devolvido, no mínimo, depois disto. */
const MIN_HOSTAGE_TURNS = 200; // 10 anos
const MAX_HOSTAGE_TURNS = 400; // 20 anos

/** Idade em que se é entregue como pupilo — nem bebê, nem homem feito. */
const HOSTAGE_MIN_AGE = 5;
const HOSTAGE_MAX_AGE = 24;

function shiftRelations(a: HouseState, b: HouseState, delta: number): void {
  a.relations[b.id] = clamp((a.relations[b.id] ?? 50) + delta, 0, 100);
  b.relations[a.id] = clamp((b.relations[a.id] ?? 50) + delta, 0, 100);
}

/** O refém que `holder` guarda da Casa `home`, se houver. */
export function hostageFrom(state: GameState, holderHouseId: string, homeHouseId: string): Character | undefined {
  return Object.values(state.characters).find(c =>
    c.alive && c.hostage &&
    c.hostage.holderHouseId === holderHouseId &&
    c.hostage.homeHouseId === homeHouseId);
}

/** Todos os reféns que uma Casa guarda hoje. */
export function hostagesHeldBy(state: GameState, holderHouseId: string): Character[] {
  return Object.values(state.characters)
    .filter(c => c.alive && c.hostage?.holderHouseId === holderHouseId);
}

/**
 * Quem a Casa derrotada teria a entregar.
 *
 * Preferência pelos filhos do senhor: um sobrinho distante não garante coisa
 * nenhuma. O próprio líder nunca vai — isso seria captura, não refém.
 */
export function hostageCandidate(state: GameState, loserId: string): Character | undefined {
  const loser = state.houses[loserId];
  if (!loser) return undefined;

  const pool = Object.values(state.characters).filter(c =>
    c.alive &&
    !c.hostage &&
    c.currentHouseId === loserId &&
    c.id !== loser.leaderId &&
    c.id !== state.playerId &&
    c.ageYears >= HOSTAGE_MIN_AGE &&
    c.ageYears <= HOSTAGE_MAX_AGE);

  if (!pool.length) return undefined;

  const filhosDoSenhor = pool.filter(c => c.fatherId === loser.leaderId || c.motherId === loser.leaderId);
  const escolha = filhosDoSenhor.length ? filhosDoSenhor : pool;

  // O mais novo entre os elegíveis: é quem passa mais tempo sob a guarda.
  return escolha.sort((a, b) => a.ageYears - b.ageYears)[0];
}

export function takeHostage(state: GameState, winner: HouseState, loser: HouseState): Character | undefined {
  const refem = hostageCandidate(state, loser.id);
  if (!refem) return undefined;

  // Volta para casa aos 25, respeitando o piso e o teto.
  const anosRestantes = (25 - refem.ageYears) * 20;
  const duracao = clamp(anosRestantes, MIN_HOSTAGE_TURNS, MAX_HOSTAGE_TURNS);

  refem.hostage = {
    holderHouseId: winner.id,
    homeHouseId: loser.id,
    sinceAbsTurn: state.date.absoluteTurn,
    untilAbsTurn: state.date.absoluteTurn + duracao,
  };
  refem.locationId = winner.seatLocationId;

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Refém entregue: ${refem.name}`,
    body: `${loser.name} entrega ${refem.name}, de ${refem.ageYears} anos, à guarda de ${winner.name} como garantia da paz.`,
    tags: ['politica', 'war', 'refem'],
  });

  if (state.playerHouseId === winner.id || state.playerHouseId === loser.id) {
    pushNarration(state, `🔗 ${refem.name} vai viver em ${state.locations[winner.seatLocationId]?.name ?? winner.name} como pupilo de ${winner.name}. Volta em ${Math.round(duracao / 20)} anos.`);
  }
  return refem;
}

function sendHome(state: GameState, c: Character): void {
  const home = state.houses[c.hostage!.homeHouseId];
  c.hostage = undefined;
  if (home) c.locationId = home.seatLocationId;
}

/**
 * Passagem do tempo dos reféns.
 *
 * Um refém devolvido inteiro é a única coisa nesta simulação que transforma
 * ódio de guerra em confiança: os anos na corte do inimigo criam laço, e quem
 * cumpre a palavra colhe. Por isso o ganho é grande (+14) e o termo compete de
 * verdade com o tributo, que rende bens e mais nada.
 */
export function tickHostages(state: GameState, rng: Rng): void {
  for (const c of Object.values(state.characters)) {
    if (!c.hostage) continue;

    if (!c.alive) { c.hostage = undefined; continue; }

    const holder = state.houses[c.hostage.holderHouseId];
    const home = state.houses[c.hostage.homeHouseId];
    if (!holder || !home) { sendHome(state, c); continue; }

    // Enquanto está lá, cresce entre eles: se a Casa do jogador o guarda, ele
    // vira gente conhecida da corte.
    if (state.playerHouseId === holder.id && rng.chance(0.05)) {
      c.knownToPlayer = true;
      c.relationshipToPlayer = clamp(c.relationshipToPlayer + 1, 0, 100);
    }

    if (state.date.absoluteTurn < c.hostage.untilAbsTurn) continue;

    sendHome(state, c);
    shiftRelations(holder, home, 14);

    pushChronicle(state, {
      absTurn: state.date.absoluteTurn,
      title: `Refém devolvido: ${c.name}`,
      body: `${holder.name} cumpre a palavra e devolve ${c.name} a ${home.name}. Anos na corte do inimigo deixam marca dos dois lados.`,
      tags: ['politica', 'refem'],
    });
    if (state.playerHouseId === holder.id || state.playerHouseId === home.id) {
      pushNarration(state, `🕊️ ${c.name} volta para ${home.name}. A palavra cumprida vale mais que o refém.`);
    }
  }
}

/**
 * Quebra de fé: atacar quem guarda o seu sangue.
 *
 * Chamado quando `attacker` declara guerra a quem tem um refém dele. Não há
 * blefe — o refém morre. É isto que faz do termo uma garantia de verdade, e
 * não mais um número na mesa de paz.
 */
export function punishBrokenFaith(state: GameState, rng: Rng, attackerId: string, defenderId: string): boolean {
  const refem = hostageFrom(state, defenderId, attackerId);
  if (!refem) return false;

  const holder = state.houses[defenderId];
  const home = state.houses[attackerId];

  handleDeathImmediate(state, rng, refem, `${holder?.name ?? 'o guardião'} executa o refém: ${home?.name ?? 'a Casa de origem'} rompeu a paz`);
  refem.hostage = undefined;

  if (holder) holder.prestige = clamp(holder.prestige - 3, 1, 100);
  if (holder && home) shiftRelations(holder, home, -20);

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Refém executado: ${refem.name}`,
    body: `${home?.name ?? 'A Casa de origem'} marchou sabendo o preço. ${holder?.name ?? 'O guardião'} cobrou.`,
    tags: ['politica', 'war', 'refem'],
  });
  if (state.playerHouseId === defenderId || state.playerHouseId === attackerId) {
    pushNarration(state, `☠️ ${refem.name} paga pela guerra que a própria Casa declarou.`);
  }
  return true;
}

/**
 * Casamento imposto na paz.
 *
 * Casa alguém do lado derrotado com alguém do vencedor. Deliberadamente usa o
 * mesmo `applyMarriage` dos casamentos arranjados: é isso que faz o direito de
 * sangue sobre os dois assentos ser registrado como qualquer outro, e voltar
 * anos depois numa crise sucessória.
 */
export function forceMarriage(
  state: GameState,
  rng: Rng,
  winner: HouseState,
  loser: HouseState
): { groom: Character; bride: Character } | undefined {
  const par = marriagePair(state, winner, loser);
  if (!par) return undefined;

  applyMarriage(state, rng, par.groom, par.bride, 'patri', `paz imposta por ${winner.name}`);

  // A aliança forçada vale: um casamento é um casamento, mesmo assinado com a
  // hoste ainda em campo.
  shiftRelations(winner, loser, 18);

  pushChronicle(state, {
    absTurn: state.date.absoluteTurn,
    title: `Casamento de paz: ${par.groom.name} e ${par.bride.name}`,
    body: `${winner.name} e ${loser.name} selam a paz com sangue em vez de ouro. O direito sobre os dois assentos fica registrado.`,
    tags: ['politica', 'casamento', 'war'],
  });
  if (state.playerHouseId === winner.id || state.playerHouseId === loser.id) {
    pushNarration(state, `💍 ${par.groom.name} casa-se com ${par.bride.name}. A paz agora tem sangue dentro — e um direito sobre o assento deles.`);
  }
  return par;
}

/** Um par elegível entre as duas Casas, ou nada. */
export function marriagePair(
  state: GameState,
  winner: HouseState,
  loser: HouseState
): { groom: Character; bride: Character } | undefined {
  const solteiros = (houseId: string) => Object.values(state.characters).filter(c =>
    c.alive &&
    c.currentHouseId === houseId &&
    !c.hostage &&
    c.maritalStatus !== 'married' &&
    c.ageYears >= 16 && c.ageYears <= 45);

  const doVencedor = solteiros(winner.id);
  const doPerdedor = solteiros(loser.id);

  for (const a of doVencedor) {
    for (const b of doPerdedor) {
      if (!aiCanMarry(a, b)) continue;
      // `applyMarriage` com 'patri' leva a noiva para a Casa do noivo; a ordem
      // aqui é só quem é homem e quem é mulher.
      return a.gender === 'M' ? { groom: a, bride: b } : { groom: b, bride: a };
    }
  }
  return undefined;
}
