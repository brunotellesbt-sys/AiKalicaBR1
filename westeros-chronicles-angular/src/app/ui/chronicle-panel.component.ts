import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

@Component({
  selector: 'app-chronicle-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chronicle-panel.component.html',
  styleUrl: './chronicle-panel.component.css',
})
export class ChroniclePanelComponent {
  @Input({ required: true }) state!: GameState;
}
