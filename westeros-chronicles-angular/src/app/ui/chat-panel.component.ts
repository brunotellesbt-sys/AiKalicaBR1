import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.css',
})
export class ChatPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

  onChoose(id: string, disabled?: boolean): void {
    if (disabled) return;
    this.choose.emit(id);
  }

  trackById(_: number, m: any): string {
    return m.id;
  }
}
