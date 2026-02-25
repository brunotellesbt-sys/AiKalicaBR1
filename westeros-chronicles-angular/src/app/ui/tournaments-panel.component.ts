import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, Tournament } from '../core/models';

@Component({
  selector: 'app-tournaments-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournaments-panel.component.html',
  styleUrl: './tournaments-panel.component.css',
})
export class TournamentsPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

  openTournaments(): Tournament[] {
    return (this.state.tournaments ?? []).filter(t => t.status === 'anunciado').slice(0, 20);
  }

  hostName(t: Tournament): string {
    return this.state.houses[t.hostHouseId]?.name ?? t.hostHouseId;
  }

  locName(t: Tournament): string {
    return this.state.locations[t.locationId]?.name ?? t.locationId;
  }

  turnsLeft(t: Tournament): number {
    return Math.max(0, 6 - (this.state.date.absoluteTurn - t.announcedTurn));
  }

  canJoin(t: Tournament): boolean {
    const p = this.state.characters[this.state.playerId];
    if (!p.alive) return false;
    if (p.locationId !== t.locationId) return false;
    if (!t.categories.includes(p.renownTier)) return false;
    if ((p.injuredUntilTurn ?? 0) > this.state.date.absoluteTurn) return false;
    return true;
  }

  isLeader(): boolean {
    const p = this.state.characters[this.state.playerId];
    const h = this.state.houses[this.state.playerHouseId];
    return h?.leaderId === p?.id;
  }

  organize(): void {
    this.choose.emit('tour:organize');
  }

  join(t: Tournament): void {
    this.choose.emit(`tour:join:${t.id}`);
  }
}
