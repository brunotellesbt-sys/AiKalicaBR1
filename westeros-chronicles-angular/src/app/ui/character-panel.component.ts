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

  nearbyKnown(state: GameState, playerId: string): Character[] {
    const p = state.characters[playerId];
    if (!p) return [];
    const here = p.locationId;
    return Object.values(state.characters).filter(
      c => c.alive && c.knownToPlayer && c.id !== playerId && c.locationId === here
    );
  }

  relatedKnown(state: GameState, playerId: string): Character[] {
    return Object.values(state.characters)
      .filter(c => c.id !== playerId && c.alive && c.knownToPlayer)
      .filter(c => this.kinshipLabel(state, c, playerId) !== 'Sem parentesco direto');
  }

  kinshipLabel(state: GameState, target: Character, playerId: string): string {
    const player = state.characters[playerId];
    if (!player) return 'Sem laço conhecido';

    if (target.id === player.id) return 'Você';
    if (target.spouseId === player.id || player.spouseId === target.id) return 'Cônjuge';

    if (target.fatherId === player.id || target.motherId === player.id) {
      return target.gender === 'M' ? 'Filho' : 'Filha';
    }

    if (player.fatherId === target.id || player.motherId === target.id) {
      return target.gender === 'M' ? 'Pai/Mentor paterno' : 'Mãe/Mentora materna';
    }

    const playerParentIds = new Set([player.fatherId, player.motherId].filter(Boolean));
    const targetParentIds = new Set([target.fatherId, target.motherId].filter(Boolean));
    if (
      playerParentIds.size > 0 &&
      targetParentIds.size > 0 &&
      [...playerParentIds].some(id => targetParentIds.has(id))
    ) {
      return target.gender === 'M' ? 'Irmão' : 'Irmã';
    }

    if (target.fatherId && (target.fatherId === player.fatherId || target.fatherId === player.motherId)) {
      return target.gender === 'M' ? 'Meio-irmão' : 'Meia-irmã';
    }
    if (target.motherId && (target.motherId === player.fatherId || target.motherId === player.motherId)) {
      return target.gender === 'M' ? 'Meio-irmão' : 'Meia-irmã';
    }

    if (target.fatherId && (target.fatherId === player.id || target.motherId === player.id)) {
      return target.gender === 'M' ? 'Filho' : 'Filha';
    }

    if (target.fatherId && player.spouseId && (target.fatherId === player.spouseId || target.motherId === player.spouseId)) {
      return 'Enteado(a)';
    }

    if (player.fatherId && (target.id === state.characters[player.fatherId]?.fatherId || target.id === state.characters[player.fatherId]?.motherId)) {
      return target.gender === 'M' ? 'Avô' : 'Avó';
    }
    if (player.motherId && (target.id === state.characters[player.motherId]?.fatherId || target.id === state.characters[player.motherId]?.motherId)) {
      return target.gender === 'M' ? 'Avô' : 'Avó';
    }

    if (player.fatherId && (target.fatherId === player.fatherId || target.motherId === player.fatherId)) {
      return target.gender === 'M' ? 'Tio' : 'Tia';
    }
    if (player.motherId && (target.fatherId === player.motherId || target.motherId === player.motherId)) {
      return target.gender === 'M' ? 'Tio' : 'Tia';
    }

    return 'Sem parentesco direto';
  }
}
