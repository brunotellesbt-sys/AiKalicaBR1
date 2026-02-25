import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character, GameState } from '../core/models';

@Component({
  selector: 'app-character-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-panel.component.html',
  styleUrl: './character-panel.component.css',
})
export class CharacterPanelComponent {
  @Input({ required: true }) state!: GameState;

  /**
   * Templates do Angular não suportam arrow functions em expressões (ex.: filter(c=>...)).
   * Centralizamos filtros aqui.
   */
  nearbyKnown(state: GameState, playerId: string): Character[] {
    const p = state.characters[playerId];
    if (!p) return [];
    const here = p.locationId;
    return Object.values(state.characters).filter(
      c => c.alive && c.knownToPlayer && c.id !== playerId && c.locationId === here
    );
  }
}
