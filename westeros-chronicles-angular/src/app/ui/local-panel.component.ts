import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, Character } from '../core/models';

@Component({
  selector: 'app-local-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './local-panel.component.html',
  styleUrl: './local-panel.component.css',
})
export class LocalPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

  pendingMarriage: {
    targetId: string;
    groomName: string;
    brideName: string;
    groomHouse: string;
    brideHouse: string;
  } | null = null;

  get player(): Character {
    return this.state.characters[this.state.playerId];
  }

  charsHere(): Character[] {
    const here = this.player.locationId;
    return Object.values(this.state.characters)
      .filter(c => c.alive && c.id !== this.player.id && c.locationId === here)
      .sort((a,b)=> (b.relationshipToPlayer ?? 0) - (a.relationshipToPlayer ?? 0))
      .slice(0, 40);
  }

  houseName(houseId: string): string {
    return this.state.houses[houseId]?.name ?? houseId;
  }


kinshipLabel(c: Character): string | null {
  const p = this.player;
  if (c.id === p.fatherId) return 'Pai';
  if (c.id === p.motherId) return 'Mãe';
  if (p.fatherId && (c.fatherId === p.fatherId) && c.id !== p.id) return c.gender === 'M' ? 'Irmão' : 'Irmã';
  if (p.motherId && (c.motherId === p.motherId) && c.id !== p.id) return c.gender === 'M' ? 'Irmão' : 'Irmã';
  if (c.fatherId === p.id || c.motherId === p.id) return c.gender === 'M' ? 'Filho' : 'Filha';
  if (c.spouseId === p.id) return 'Cônjuge';
  return null;
}

canFlowers(c: Character): boolean {
  return c.gender === 'F';
}

canHuntWith(c: Character): boolean {
  // Caçadas exigem preparo físico; usamos um limiar simples por força (marcial).
  return (c.martial ?? 0) >= 35;
}

canKiss(c: Character): boolean {
  const rel = c.relationshipToPlayer ?? 0;
  const p = this.player;
  // bloqueia pai/mãe e filhos
  const isParent = (c.id === p.fatherId) || (c.id === p.motherId);
  const isChild = (c.fatherId === p.id) || (c.motherId === p.id);
  return !isParent && !isChild && rel >= 80;
}

canRelations(c: Character): boolean {
  const rel = c.relationshipToPlayer ?? 0;
  const p = this.player;
  const kissed = (p.kissedIds ?? []).includes(c.id);
  const isParent = (c.id === p.fatherId) || (c.id === p.motherId);
  const isChild = (c.fatherId === p.id) || (c.motherId === p.id);
  return !isParent && !isChild && rel >= 90 && kissed;
}

canMarry(c: Character): boolean {
  const p = this.player;
  if (!c.alive) return false;
  if (p.locationId !== c.locationId) return false;
  if (p.maritalStatus === 'married') return false;
  if (c.maritalStatus === 'married') return false;
  if (p.ageYears < 16 || c.ageYears < 16) return false;
  // hetero (regra do protótipo)
  if (!((p.gender === 'M' && c.gender === 'F') || (p.gender === 'F' && c.gender === 'M'))) return false;
  // bloqueia pai/mãe/filhos
  const isParent = (c.id === p.fatherId) || (c.id === p.motherId);
  const isChild = (c.fatherId === p.id) || (c.motherId === p.id);
  if (isParent || isChild) return false;
  const kissed = (p.kissedIds ?? []).includes(c.id);
  const rel = c.relationshipToPlayer ?? 0;
  return kissed && rel >= 92;
}

private brideInMarriage(target: Character): Character | null {
  const p = this.player;
  if (p.gender === 'F') return p;
  if (target.gender === 'F') return target;
  return null;
}

needsSurnameChoice(target: Character): boolean {
  const bride = this.brideInMarriage(target);
  if (!bride) return false;
  // só aparece caixa se não existir mais NENHUM outro membro vivo da casa
  const count = Object.values(this.state.characters).filter(
    c => c.alive && c.currentHouseId === bride.currentHouseId && c.id !== bride.id
  ).length;
  return count === 0;
}

onMarry(target: Character): void {
  if (!this.canMarry(target)) return;

  if (this.needsSurnameChoice(target)) {
    const p = this.player;
    const groom = p.gender === 'M' ? p : target;
    const bride = p.gender === 'F' ? p : target;
    this.pendingMarriage = {
      targetId: target.id,
      groomName: groom.name,
      brideName: bride.name,
      groomHouse: this.houseName(groom.currentHouseId),
      brideHouse: this.houseName(bride.currentHouseId),
    };
    return;
  }

  this.choose.emit(`loc:marry:${target.id}:patri`);
}

confirmMarriage(lineage: 'patri' | 'matri'): void {
  if (!this.pendingMarriage) return;
  const targetId = this.pendingMarriage.targetId;
  this.pendingMarriage = null;
  this.choose.emit(`loc:marry:${targetId}:${lineage}`);
}

cancelMarriage(): void {
  this.pendingMarriage = null;
}

  on(action: 'talk'|'flowers'|'drink'|'hunt'|'kiss'|'relations', targetId: string): void {
    this.choose.emit(`loc:${action}:${targetId}`);
  }
}
