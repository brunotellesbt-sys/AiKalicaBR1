import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

@Component({
  selector: 'app-map-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-panel.component.html',
  styleUrl: './map-panel.component.css',
})
export class MapPanelComponent {
  @Input({ required: true }) state!: GameState;
  selectedRegionId: string | null = null;
  @Output() choose = new EventEmitter<string>();

  travelOptions(): Array<{label: string, id: string, hint: string}> {
    const p = this.state.characters[this.state.playerId];
    const here = this.state.locations[p.locationId];
    const edges = this.state.travelGraph[here.id] ?? [];
    return edges.map(e => {
      const to = this.state.locations[e.toLocationId];
      return {
        label: to.name,
        id: `go:${to.id}`,
        hint: `Distância ${e.distance}`,
      };
    });
  }

kingdoms(): Array<{id: string, name: string}> {
  return Object.values(this.state.regions).map(r => ({ id: r.id, name: r.name }));
}

selectKingdom(regionId: string): void {
  this.selectedRegionId = regionId;
}

areasInSelected(): Array<{label: string, id: string, hint: string, disabled: boolean}> {
  const rid = this.selectedRegionId;
  if (!rid) return [];
  const p = this.state.characters[this.state.playerId];
  const here = this.state.locations[p.locationId];
  const edges = this.state.travelGraph[here.id] ?? [];
  const edgeSet = new Set(edges.map(e => e.toLocationId));

  const locs = Object.values(this.state.locations)
    .filter(l => l.regionId === rid)
    .sort((a,b)=>a.name.localeCompare(b.name))
    .slice(0, 60);

  return locs.map(l => {
    const reachable = edgeSet.has(l.id);
    return {
      label: l.name,
      id: `go:${l.id}`,
      hint: reachable ? 'Clique para viajar' : 'Não é um destino direto a partir daqui',
      disabled: !reachable,
    };
  });
}

  onGo(id: string): void {
    this.choose.emit(id);
  }
}
