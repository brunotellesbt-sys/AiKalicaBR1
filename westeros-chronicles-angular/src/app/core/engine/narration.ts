/**
 * Saída do jogo: chat, crônica e fim de partida.
 *
 * Folha da árvore de dependências — quase todo o motor escreve aqui, e este
 * módulo não conhece nenhum outro domínio.
 */
import { GameState, Choice } from '../models';
import { uid } from './utils';

export function pushSystem(state: GameState, text: string, choices?: Choice[]): void {
  state.chat.push({
    id: uid('m'),
    speaker: 'sistema',
    text,
    tsTurn: state.date.absoluteTurn,
    choices,
  });
}

export function pushNarration(state: GameState, text: string): void {
  state.chat.push({
    id: uid('m'),
    speaker: 'narrador',
    text,
    tsTurn: state.date.absoluteTurn,
  });
}

export function pushNpc(state: GameState, title: string, text: string): void {
  state.chat.push({
    id: uid('m'),
    speaker: 'npc',
    title,
    text,
    tsTurn: state.date.absoluteTurn,
  });
}

export function pushChronicle(
  state: GameState,
  entry: { absTurn: number; title: string; body: string; tags: string[] }
): void {
  state.chronicle.unshift({
    turn: entry.absTurn,
    title: entry.title,
    body: entry.body,
    tags: entry.tags,
  });
}

export function setGameOver(state: GameState, reason: string, victory: boolean): void {
  state.game.over = true;
  state.game.victory = victory;
  state.game.reason = reason;

  const title = victory ? '🏆 Fim da Crônica (Vitória)' : '☠️ Fim da Crônica (Game Over)';
  pushNarration(state, `${title}: ${reason}`);
  pushSystem(state, 'Você pode carregar um save (3 slots) ou reiniciar a campanha.', [
    { id: 'saves', label: 'Abrir Saves' },
    { id: 'reset', label: 'Reiniciar (voltar ao menu inicial)' },
  ]);
}

export function setVictory(state: GameState, reason: string): void {
  setGameOver(state, reason, true);
}
