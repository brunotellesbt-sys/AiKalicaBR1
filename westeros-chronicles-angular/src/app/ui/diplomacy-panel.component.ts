import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

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
