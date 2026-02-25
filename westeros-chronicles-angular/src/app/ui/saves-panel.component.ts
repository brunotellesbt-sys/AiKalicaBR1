import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';
import { SaveService } from '../core/engine/save.service';

@Component({
  selector: 'app-saves-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './saves-panel.component.html',
  styleUrl: './saves-panel.component.css',
})
export class SavesPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() loadState = new EventEmitter<GameState>();

  // Mantém tipagem estrita (evita "slot" virar number no template)
  readonly SLOTS: readonly (1|2|3)[] = [1, 2, 3] as const;

  constructor(public saves: SaveService) {}

  updatedAt(slot: 1|2|3): number | undefined {
    const file = this.saves.loadFile();
    return file.slots[slot]?.updatedAt;
  }

  hasSave(slot: 1|2|3): boolean {
    return !!this.updatedAt(slot);
  }

  save(slot: 1|2|3): void {
    this.saves.save(slot, this.state);
  }

  load(slot: 1|2|3): void {
    const st = this.saves.load(slot);
    if (st) this.loadState.emit(st);
  }

  clear(slot: 1|2|3): void {
    this.saves.clear(slot);
  }

  fmt(ts?: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('pt-BR');
  }
}
