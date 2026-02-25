import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GameService } from './core/engine/game.service';
import { SaveService } from './core/engine/save.service';
import { Gender, GameState } from './core/models';

import { HeaderBarComponent } from './ui/header-bar.component';
import { ChatPanelComponent } from './ui/chat-panel.component';
import { MapPanelComponent } from './ui/map-panel.component';
import { CharacterPanelComponent } from './ui/character-panel.component';
import { HousePanelComponent } from './ui/house-panel.component';
import { DiplomacyPanelComponent } from './ui/diplomacy-panel.component';
import { LocalPanelComponent } from './ui/local-panel.component';
import { TournamentsPanelComponent } from './ui/tournaments-panel.component';
import { ChroniclePanelComponent } from './ui/chronicle-panel.component';
import { CanonPanelComponent } from './ui/canon-panel.component';
import { SavesPanelComponent } from './ui/saves-panel.component';

import { HOUSES } from './core/data/houses';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderBarComponent,
    ChatPanelComponent,
    MapPanelComponent,
    CharacterPanelComponent,
    HousePanelComponent,
    DiplomacyPanelComponent,
    LocalPanelComponent,
    TournamentsPanelComponent,
    ChroniclePanelComponent,
    CanonPanelComponent,
    SavesPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  vm$ = this.game.vm$;

  // Setup
  setupHouseId = 'stark';
  setupGender: Gender = 'M';
  setupQuery = '';

  // Nomear bebês
  babyName = '';

  constructor(public game: GameService, public saves: SaveService) {}


housesFiltered() {
  const q = (this.setupQuery || '').toLowerCase().trim();
  const list = HOUSES.slice().sort((a,b)=> b.prestigeBase - a.prestigeBase);
  if (!q) return list;
  return list.filter(h => (h.name + ' ' + h.id).toLowerCase().includes(q));
}

startNewGame(): void {
  this.game.newGame(this.setupHouseId, this.setupGender);
}

nameNextBaby(state: GameState): void {
  const q = state.ui.pendingNameQueue ?? [];
  if (!q.length) return;
  const id = q[0];
  const name = (this.babyName || '').trim();
  if (!name) return;
  this.game.nameChild(id, name);
  this.babyName = '';
}


  setTab(state: GameState, tab: GameState['ui']['activeTab']): void {
    state.ui.activeTab = tab;
    this.game.setState({ ...state });
  }
}
