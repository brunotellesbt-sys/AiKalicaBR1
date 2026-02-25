import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

@Component({
  selector: 'app-header-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-bar.component.html',
  styleUrl: './header-bar.component.css',
})
export class HeaderBarComponent {
  @Input({ required: true }) state!: GameState;
  @Output() tab = new EventEmitter<GameState['ui']['activeTab']>();

  setTab(t: GameState['ui']['activeTab']): void {
    this.tab.emit(t);
  }
}
