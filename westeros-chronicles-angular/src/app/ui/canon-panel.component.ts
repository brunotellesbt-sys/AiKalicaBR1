import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameState } from '../core/models';
import { CANON_EVENTS, CANON_PEOPLE, CANON_EVENT_ONLY_PEOPLE, CANON_WARS, absTurn, CanonEventDef, CanonWarDef } from '../core/data/canon';

const DIVERGENCE_THRESHOLD = 5;

function canonIsAnchorEvent(e: CanonEventDef): boolean {
  const tags = e.tags ?? [];
  if (tags.includes('anchor')) return true;
  const major = ['war', 'rebellion', 'throne', 'leaders', 'endgame', 'porto-real', 'corte', 'kings_landing'];
  if (tags.some(t => major.includes(t))) return true;
  // births/deaths de figuras maiores também contam como âncoras
  if (tags.includes('birth') || tags.includes('death')) {
    return true;
  }
  return false;
}

@Component({
  selector: 'app-canon-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './canon-panel.component.html',
  styleUrl: './canon-panel.component.css',
})
export class CanonPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

  filterText = '';
  eventFilter = '';

  private defIndex(): Record<string, { name: string }> {
    const idx: Record<string, { name: string }> = {};
    for (const p of [...CANON_PEOPLE, ...CANON_EVENT_ONLY_PEOPLE]) idx[p.canonId] = { name: p.name };
    return idx;
  }

  canonName(canonId: string): string {
    const idx = this.defIndex();
    return idx[canonId]?.name ?? canonId;
  }

  toggleCanon(): void {
    this.choose.emit('canon:toggle');
  }

  setMode(mode: 'strict' | 'anchors'): void {
    this.choose.emit(`canon:mode:${mode}`);
  }

  touchedList(): Array<{ canonId: string; score: number; reasons: string[] }> {
    const map = this.state.canon?.playerTouchedCanonIds ?? {};
    const reasons = this.state.canon?.playerTouchedReasons ?? {};
    const arr = Object.entries(map).map(([canonId, score]) => ({ canonId, score, reasons: reasons[canonId] ?? [] }));
    const q = (this.filterText || '').toLowerCase().trim();
    return arr
      .filter(x => (q ? this.canonName(x.canonId).toLowerCase().includes(q) : true))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }

  isDiverged(canonId: string): boolean {
    const score = (this.state.canon?.playerTouchedCanonIds ?? {})[canonId] ?? 0;
    const bypass = !!(this.state.canon?.bypassedDeathCanonIds ?? {})[canonId];
    return bypass || score >= DIVERGENCE_THRESHOLD;
  }

  pendingBirths(): Array<{ canonId: string; desired: number; expires: number }> {
    const p = this.state.canon?.pendingBirths ?? {};
    const out: Array<{ canonId: string; desired: number; expires: number }> = [];
    for (const [k, v] of Object.entries(p)) {
      if (!v) continue;
      const canonId = k.replace(/^birth:/, '');
      out.push({ canonId, desired: v.desiredAbsTurn, expires: v.expireAbsTurn });
    }
    return out.sort((a, b) => a.expires - b.expires).slice(0, 30);
  }

  activeWars(): CanonWarDef[] {
    const ids = this.state.canon?.activeWarIds ?? [];
    const idx = new Set(ids);
    return CANON_WARS.filter(w => idx.has(w.id));
  }

  warScoreLabel(w: CanonWarDef): string {
    const ws = (this.state.canon as any)?.warStates?.[w.id];
    if (!ws) return '0–0';
    return `${ws.scoreA}–${ws.scoreB}`;
  }

  warRecentBattles(w: CanonWarDef): Array<{ absTurn: number; summary: string }> {
    const ws = (this.state.canon as any)?.warStates?.[w.id];
    return (ws?.recentBattles ?? []).slice().sort((a: any, b: any) => b.absTurn - a.absTurn).slice(0, 6);
  }

  upcomingEvents(): Array<{ abs: number; e: CanonEventDef; isAnchor: boolean }> {
    const now = this.state.date.absoluteTurn;
    const q = (this.eventFilter || '').toLowerCase().trim();
    return CANON_EVENTS
      .map(e => ({ abs: absTurn(e.year, e.turn), e, isAnchor: canonIsAnchorEvent(e) }))
      .filter(x => x.abs >= now)
      .filter(x => (q ? ((x.e.title + ' ' + (x.e.body ?? '')).toLowerCase().includes(q)) : true))
      .sort((a, b) => a.abs - b.abs)
      .slice(0, 35);
  }
}
