import { Injectable } from '@angular/core';
import { GameState } from '../models';

const KEY = 'westeros_chronicles_saves_v1';

export interface SaveSlot {
  slot: 1 | 2 | 3;
  updatedAt: number;
  state: GameState;
}

export interface SaveFile {
  slots: Partial<Record<1|2|3, SaveSlot>>;
}

@Injectable({ providedIn: 'root' })
export class SaveService {
  loadFile(): SaveFile {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { slots: {} };
    try {
      return JSON.parse(raw) as SaveFile;
    } catch {
      return { slots: {} };
    }
  }

  save(slot: 1|2|3, state: GameState): void {
    const file = this.loadFile();
    file.slots[slot] = { slot, updatedAt: Date.now(), state };
    localStorage.setItem(KEY, JSON.stringify(file));
  }

  load(slot: 1|2|3): GameState | null {
    const file = this.loadFile();
    return file.slots[slot]?.state ?? null;
  }

  clear(slot: 1|2|3): void {
    const file = this.loadFile();
    delete file.slots[slot];
    localStorage.setItem(KEY, JSON.stringify(file));
  }
}
