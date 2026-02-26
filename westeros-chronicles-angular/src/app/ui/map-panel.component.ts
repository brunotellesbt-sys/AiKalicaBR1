import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';

type RegionPin = { id: string; x: number; y: number; };

@Component({
  selector: 'app-map-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-panel.component.html',
  styleUrl: './map-panel.component.css',
})
export class MapPanelComponent {
  @Input({ required: true }) state!: GameState;
  @Output() choose = new EventEmitter<string>();

  selectedRegionId: string | null = null;
  zoom = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  private pointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;

  readonly regionPins: RegionPin[] = [
    { id: 'north', x: 40, y: 18 },
    { id: 'iron_islands', x: 16, y: 46 },
    { id: 'vale', x: 56, y: 39 },
    { id: 'riverlands', x: 42, y: 50 },
    { id: 'westerlands', x: 28, y: 57 },
    { id: 'crownlands', x: 55, y: 56 },
    { id: 'reach', x: 36, y: 72 },
    { id: 'stormlands', x: 56, y: 73 },
    { id: 'dorne', x: 52, y: 90 },
  ];

  ngOnInit(): void {
    const playerRegion = this.playerRegionId();
    this.selectedRegionId = playerRegion;
  }

  playerRegionId(): string {
    const player = this.state.characters[this.state.playerId];
    return this.state.locations[player.locationId]?.regionId;
  }

  isPlayerRegion(regionId: string): boolean {
    return regionId === this.playerRegionId();
  }

  zoomIn(): void {
    this.zoom = Math.min(1.8, +(this.zoom + 0.2).toFixed(1));
  }

  zoomOut(): void {
    this.zoom = Math.max(1, +(this.zoom - 0.2).toFixed(1));
  }

  resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  mapTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  onPointerDown(event: PointerEvent): void {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('.pin')) return;

    this.pointerId = event.pointerId;
    this.isPanning = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning || this.pointerId !== event.pointerId) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  onPointerUp(): void {
    this.isPanning = false;
    this.pointerId = null;
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
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 80);

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

  onGo(id: string): void {
    this.choose.emit(id);
  }
}
