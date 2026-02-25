import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

@Component({
  selector: 'app-house-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './house-panel.component.html',
  styleUrl: './house-panel.component.css',
})
export class HousePanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

foodNeed(h: any): number {
  const a = h.army ?? {};
  const total = (a.levies ?? 0) + (a.menAtArms ?? 0) + (a.squires ?? 0) + (a.knights ?? 0);
  return total + 100;
}

foodOk(h: any): boolean {
  return (h.resources?.food ?? 0) >= this.foodNeed(h);
}

goods(h: any): number {
  return h.resources?.goods ?? 0;
}

  onChoose(id: string): void {
    this.choose.emit(id);
  }
}
