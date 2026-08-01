import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, War } from '../core/models';
import { activeWars, warsOf, casusBelliLabel, sideOf } from '../core/engine/warfare';
import { activeRivalries } from '../core/engine/politics';

@Component({
  selector: 'app-diplomacy-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diplomacy-panel.component.html',
  styleUrl: './diplomacy-panel.component.css',
})
export class DiplomacyPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

  onChoose(id: string): void {
    this.choose.emit(id);
  }

  // --- guerras ---

  myWars(): War[] {
    return warsOf(this.state, this.state.playerHouseId);
  }

  otherWars(): War[] {
    const mine = new Set(this.myWars().map(w => w.id));
    return activeWars(this.state).filter(w => !mine.has(w.id)).slice(0, 6);
  }

  houseName(id: string): string {
    return this.state.houses[id]?.name ?? id;
  }

  warTitle(w: War): string {
    return `${this.houseName(w.attackerHouseId)} × ${this.houseName(w.defenderHouseId)}`;
  }

  warReason(w: War): string {
    return casusBelliLabel(w.casusBelli);
  }

  /** Placar sempre da perspectiva de quem lê. */
  warScore(w: War): string {
    const side = sideOf(w, this.state.playerHouseId);
    if (!side) return `${w.scoreAttacker}–${w.scoreDefender}`;
    const mine = side === 'attacker' ? w.scoreAttacker : w.scoreDefender;
    const theirs = side === 'attacker' ? w.scoreDefender : w.scoreAttacker;
    return `${mine}–${theirs}`;
  }

  warAllies(w: War): string {
    const a = w.attackerAllies.map(id => this.houseName(id)).join(', ') || '—';
    const d = w.defenderAllies.map(id => this.houseName(id)).join(', ') || '—';
    return `Aliados do atacante: ${a} • do defensor: ${d}`;
  }

  lastBattles(w: War): Array<{ absTurn: number; summary: string }> {
    return [...w.recentBattles].reverse().slice(0, 4);
  }

  suePeace(w: War): void {
    this.choose.emit(`war:peace:${w.id}`);
  }

  isLeader(): boolean {
    const h = this.state.houses[this.state.playerHouseId];
    return h?.leaderId === this.state.playerId;
  }

  /** Rixas ao alcance do jogador (mesma região da Casa). */
  rivalries(): Array<{ id: string; a: string; b: string; cause: string; rel: number; side: string }> {
    const minha = this.state.houses[this.state.playerHouseId]?.regionId;
    return activeRivalries(this.state)
      .filter(r => this.state.houses[r.aHouseId]?.regionId === minha)
      .map(r => {
        const a = this.state.houses[r.aHouseId]!;
        const b = this.state.houses[r.bHouseId]!;
        return {
          id: r.id,
          a: a.name,
          b: b.name,
          cause: r.cause,
          rel: a.relations[b.id] ?? 50,
          side: r.playerFavors === 'peace'
            ? 'você mediou'
            : r.playerFavors
              ? `você apoia ${this.houseName(r.playerFavors)}`
              : '',
        };
      })
      .slice(0, 6);
  }

  topRelations(): Array<{name: string, rel: number, prestige: number}> {
    const h = this.state.houses[this.state.playerHouseId];
    const list = Object.entries(h.relations).map(([id, rel]) => ({
      name: this.state.houses[id]?.name ?? id,
      rel,
      prestige: this.state.houses[id]?.prestige ?? 0,
    }));
    return list.sort((a,b)=> b.rel - a.rel).slice(0, 12);
  }
}
