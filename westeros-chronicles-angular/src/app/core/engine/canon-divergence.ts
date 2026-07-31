/**
 * Divergência canônica: quanto a presença do jogador afastou uma figura
 * histórica do próprio destino.
 *
 * Cada categoria de interação satura e laços fracos esfriam com o tempo, de modo
 * que só envolvimento real atravessa o limiar. Deliberadamente independente de
 * sucessão e de eventos — quem depende é quem importa daqui.
 */
import { Character, GameState } from '../models';
import { clamp } from './utils';
import { pushNarration, pushChronicle } from './narration';

export const CANON_DIVERGENCE_THRESHOLD = 5;

/**
 * Categorias de interferência.
 *
 * O modelo antigo somava peso bruto sem teto: cinco cliques em "Conversar"
 * bastavam para tirar qualquer figura histórica do próprio destino, por
 * acidente. Agora cada categoria satura, e só envolvimento real (intimidade,
 * vínculo, voto) consegue atravessar o limiar.
 */
export type CanonTouchCategory = 'social' | 'court' | 'intimate' | 'bond' | 'vow';

export const CANON_TOUCH_RULES: Record<string, { category: CanonTouchCategory; weight: number }> = {
  talk: { category: 'social', weight: 1 },
  drink: { category: 'social', weight: 1 },
  hunt: { category: 'social', weight: 1 },
  flowers: { category: 'social', weight: 1 },
  diplomacy_talk: { category: 'social', weight: 1 },
  gift: { category: 'court', weight: 2 },
  diplomacy_gift: { category: 'court', weight: 2 },
  kiss: { category: 'intimate', weight: 2 },
  relations: { category: 'bond', weight: 3 },
  marry: { category: 'vow', weight: 6 },
  war_support: { category: 'bond', weight: 2 },
  crisis_support: { category: 'vow', weight: 6 },
};

/** Teto por categoria (gentilezas repetidas saturam). */
export const CANON_TOUCH_CAPS: Record<CanonTouchCategory, number> = {
  social: 2,
  court: 2,
  intimate: 4,
  bond: 6,
  vow: 99,
};

/** Decaimento por ano sem contato — laços fracos esfriam, votos não. */
export const CANON_TOUCH_DECAY: Record<CanonTouchCategory, number> = {
  social: 1,
  court: 1,
  intimate: 0.5,
  bond: 0.25,
  vow: 0,
};

export function canonCharId(canonId: string): string {
  return `canon_${canonId}`;
}

export function ensureCanonDefaults(state: GameState): void {
  if (!state.canon) {
    state.canon = {
      enabled: true,
      mode: 'strict',
      appliedEventIds: {},
      resolvedAbsTurns: {},
      activeWarIds: [],
      playerTouchedCanonIds: {},
      playerTouchedReasons: {},
      playerTouchedDetail: {},
      playerTouchedLastTurn: {},
      bypassedDeathCanonIds: {},
      pendingBirths: {},
      warStates: {},
      cancelledWarIds: {},
      successionCrises: {},
    };
  } else {
    state.canon.enabled = state.canon.enabled ?? true;
    state.canon.mode = state.canon.mode ?? 'strict';
    state.canon.appliedEventIds = state.canon.appliedEventIds ?? {};
    state.canon.resolvedAbsTurns = state.canon.resolvedAbsTurns ?? {};
    state.canon.activeWarIds = state.canon.activeWarIds ?? [];
    state.canon.playerTouchedCanonIds = state.canon.playerTouchedCanonIds ?? {};
    state.canon.playerTouchedReasons = state.canon.playerTouchedReasons ?? {};
    state.canon.playerTouchedDetail = state.canon.playerTouchedDetail ?? {};
    state.canon.playerTouchedLastTurn = state.canon.playerTouchedLastTurn ?? {};
    state.canon.bypassedDeathCanonIds = state.canon.bypassedDeathCanonIds ?? {};
    state.canon.pendingBirths = state.canon.pendingBirths ?? {};
    (state.canon as any).warStates = (state.canon as any).warStates ?? {};
    state.canon.cancelledWarIds = state.canon.cancelledWarIds ?? {};
    state.canon.successionCrises = state.canon.successionCrises ?? {};

    // Migração de saves antigos: o placar era uma soma bruta sem categoria.
    // Sem isto, um save antigo perderia o histórico ao recalcular.
    for (const [canonId, score] of Object.entries(state.canon.playerTouchedCanonIds)) {
      if (state.canon.playerTouchedDetail[canonId]) continue;
      state.canon.playerTouchedDetail[canonId] = { bond: score };
      state.canon.playerTouchedLastTurn[canonId] =
        state.canon.playerTouchedLastTurn[canonId] ?? state.date.absoluteTurn;
    }
  }
}

export function canonTouchScore(state: GameState, canonId: string): number {
  ensureCanonDefaults(state);
  return state.canon!.playerTouchedCanonIds?.[canonId] ?? 0;
}

export function canonIsDiverged(state: GameState, canonId: string): boolean {
  ensureCanonDefaults(state);
  const bypass = !!state.canon!.bypassedDeathCanonIds?.[canonId];
  return bypass || canonTouchScore(state, canonId) >= CANON_DIVERGENCE_THRESHOLD;
}

export function recomputeCanonTouchScore(state: GameState, canonId: string): number {
  const detail = state.canon!.playerTouchedDetail![canonId] ?? {};
  let total = 0;
  for (const [cat, val] of Object.entries(detail)) {
    const cap = CANON_TOUCH_CAPS[cat as CanonTouchCategory] ?? 99;
    total += Math.min(val, cap);
  }
  const rounded = Math.round(total * 100) / 100;
  state.canon!.playerTouchedCanonIds![canonId] = rounded;
  return rounded;
}

export function markCanonTouched(state: GameState, canonId: string, reason: string, weight: number): void {
  ensureCanonDefaults(state);

  const rule = CANON_TOUCH_RULES[reason]
    ?? { category: 'social' as CanonTouchCategory, weight: Math.max(1, Math.floor(weight)) };

  const before = canonTouchScore(state, canonId);

  const detailAll = state.canon!.playerTouchedDetail!;
  const detail = (detailAll[canonId] = detailAll[canonId] ?? {});
  detail[rule.category] = (detail[rule.category] ?? 0) + rule.weight;
  state.canon!.playerTouchedLastTurn![canonId] = state.date.absoluteTurn;

  const r = state.canon!.playerTouchedReasons!;
  r[canonId] = r[canonId] ?? [];
  if (!r[canonId].includes(reason)) r[canonId].push(reason);

  const after = recomputeCanonTouchScore(state, canonId);

  // Atravessar o limiar é um acontecimento: o jogador precisa saber que
  // acabou de tirar alguém da própria história.
  if (before < CANON_DIVERGENCE_THRESHOLD && after >= CANON_DIVERGENCE_THRESHOLD) {
    const c = state.characters[canonCharId(canonId)];
    const name = c?.name ?? canonId;
    pushNarration(state, `🕯️ O destino de ${name} deixa de estar escrito. O que vier agora depende de vocês.`);
    pushChronicle(state, {
      absTurn: state.date.absoluteTurn,
      title: `Destino divergente: ${name}`,
      body: `A proximidade com ${name} altera o curso previsto de sua vida.`,
      tags: ['canon', 'divergence'],
    });
  }
}

/** Laços fracos esfriam com o tempo; compromissos não. */
export function tickCanonDivergenceDecay(state: GameState): void {
  ensureCanonDefaults(state);
  const detailAll = state.canon!.playerTouchedDetail!;
  const lastAll = state.canon!.playerTouchedLastTurn!;
  const now = state.date.absoluteTurn;

  for (const canonId of Object.keys(detailAll)) {
    const last = lastAll[canonId] ?? now;
    const since = now - last;
    if (since < 20) continue;

    const years = Math.floor(since / 20);
    const detail = detailAll[canonId];
    let changed = false;

    for (const cat of Object.keys(CANON_TOUCH_DECAY) as CanonTouchCategory[]) {
      const perYear = CANON_TOUCH_DECAY[cat];
      if (perYear <= 0) continue;
      const cur = detail[cat] ?? 0;
      if (cur <= 0) continue;
      detail[cat] = Math.max(0, cur - perYear * years);
      changed = true;
    }

    lastAll[canonId] = last + years * 20;
    if (changed) recomputeCanonTouchScore(state, canonId);
  }
}

export function markCanonDeathBypassed(state: GameState, canonId: string): void {
  ensureCanonDefaults(state);
  state.canon!.bypassedDeathCanonIds![canonId] = true;
}

export function canonTouchIfCanonical(state: GameState, c: Character, reason: string, weight: number): void {
  if (!c?.isCanonical || !c.canonId) return;
  markCanonTouched(state, c.canonId, reason, weight);
}
