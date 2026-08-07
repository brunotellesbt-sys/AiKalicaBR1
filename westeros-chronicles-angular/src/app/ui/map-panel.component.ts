import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../core/models';
import { LOCATIONS } from '../core/data/regions';
import {
  MAP_VIEWBOX,
  MAINLAND_PATH,
  BEYOND_WALL_PATH,
  WALL_PATH,
  REGION_SHAPES,
  ISLANDS,
  RIVERS,
  REGION_LABELS,
  REGION_COLORS,
  TERRAIN_GLYPHS,
  TERRAIN_PATHS,
  TERRAIN_STROKED,
  buildLocationPoints,
  Point,
} from '../core/data/map-geo';

type MapMarker = {
  id: string;
  name: string;
  regionId: string;
  kind: string;
  x: number;
  y: number;
  reachable: boolean;
  isPlayer: boolean;
  isSeat: boolean;
  isMajor: boolean;
  occupiedBy: string | null;
  distance: number | null;
};

// Calculado uma vez: as posições são determinísticas por id de local.
const LOCATION_POINTS: Record<string, Point> = buildLocationPoints(LOCATIONS);

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

  readonly viewBox = MAP_VIEWBOX;
  readonly mainlandPath = MAINLAND_PATH;
  readonly beyondWallPath = BEYOND_WALL_PATH;
  readonly wallPath = WALL_PATH;
  readonly regionShapes = REGION_SHAPES;
  readonly islands = ISLANDS;
  readonly rivers = RIVERS;
  readonly regionLabels = REGION_LABELS;
  // O relevo é recortado por duas máscaras diferentes: as feições ao norte da
  // Muralha pertencem às Terras Além dela, que não fazem parte do continente.
  // Sem separar, as Presas de Gelo apareciam boiando no mar.
  readonly terrainMainland = TERRAIN_GLYPHS.filter(g => g.y >= 244);
  readonly terrainBeyond = TERRAIN_GLYPHS.filter(g => g.y < 244);

  terrainPath(kind: string): string {
    return TERRAIN_PATHS[kind as keyof typeof TERRAIN_PATHS] ?? '';
  }

  /** Juncos do pântano são traço; o resto é silhueta cheia. */
  terrainIsStroked(kind: string): boolean {
    return (TERRAIN_STROKED as readonly string[]).includes(kind);
  }

  /**
   * `trackBy` obrigatório aqui pelo mesmo motivo dos marcadores: são centenas
   * de nós, e recriá-los a cada ciclo de detecção custa caro e já causou bug
   * de clique neste componente.
   */
  trackTerrain(_i: number, g: { kind: string; x: number; y: number }): string {
    return `${g.kind}:${g.x}:${g.y}`;
  }

  regionColor(regionId: string): string {
    return REGION_COLORS[regionId] ?? '#7f8f68';
  }

  selectedRegionId: string | null = null;
  hoveredLocationId: string | null = null;
  showAllLocations = false;

  zoom = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  private pointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;

  ngOnInit(): void {
    this.selectedRegionId = this.playerRegionId();
  }

  // --- contexto do jogador -------------------------------------------------

  playerRegionId(): string {
    const player = this.state.characters[this.state.playerId];
    return this.state.locations[player.locationId]?.regionId;
  }

  playerLocationId(): string {
    return this.state.characters[this.state.playerId].locationId;
  }

  isPlayerRegion(regionId: string): boolean {
    return regionId === this.playerRegionId();
  }

  regionName(regionId: string): string {
    return this.state.regions[regionId]?.name ?? regionId;
  }

  regionLabelKeys(): string[] {
    return Object.keys(this.regionLabels);
  }

  // --- marcadores ----------------------------------------------------------

  private edgeMap(): Map<string, number> {
    const here = this.playerLocationId();
    const edges = this.state.travelGraph[here] ?? [];
    return new Map(edges.map(e => [e.toLocationId, e.distance]));
  }

  /** Identidade estável para o *ngFor (ver markers()). */
  trackMarker = (_: number, m: MapMarker): string => m.id;

  private markerCache: { key: string; value: MapMarker[] } | null = null;

  /**
   * Locais desenhados no mapa. Por padrão mostramos apenas o que importa
   * (assentos, destinos alcançáveis, região selecionada) — os 295 pontos de
   * uma vez viram ruído ilegível.
   *
   * O resultado é memoizado: sem isso cada ciclo de detecção de mudanças
   * devolvia objetos novos e o *ngFor recriava todos os nós SVG, o que fazia
   * o marcador ser destruído antes do clique chegar a disparar.
   */
  markers(): MapMarker[] {
    const key = [
      this.playerLocationId(),
      this.selectedRegionId,
      this.showAllLocations,
      this.state.date.absoluteTurn,
      Object.keys(this.state.houses).length,
      Object.keys(this.state.occupations ?? {}).join(','),
    ].join('|');

    if (this.markerCache?.key === key) return this.markerCache.value;

    const value = this.computeMarkers();
    this.markerCache = { key, value };
    return value;
  }

  private computeMarkers(): MapMarker[] {
    const edges = this.edgeMap();
    const playerLoc = this.playerLocationId();
    const seats = new Set(Object.values(this.state.houses).map(h => h.seatLocationId));
    const bigSeats = new Set(
      Object.values(this.state.houses)
        .filter(h => h.prestige >= 70)
        .map(h => h.seatLocationId)
    );
    // Capitais regionais também são referências de leitura do mapa.
    const capitals = new Set(Object.values(this.state.regions).map(r => r.capitalLocationId));
    const occupied = this.state.occupations ?? {};

    const out: MapMarker[] = [];
    for (const loc of Object.values(this.state.locations)) {
      const p = LOCATION_POINTS[loc.id];
      if (!p) continue;

      const reachable = edges.has(loc.id);
      const isPlayer = loc.id === playerLoc;
      const inSelected = loc.regionId === this.selectedRegionId;

      const relevant =
        this.showAllLocations || isPlayer || reachable || inSelected
        || bigSeats.has(loc.id) || capitals.has(loc.id);
      if (!relevant) continue;

      out.push({
        id: loc.id,
        name: loc.name,
        regionId: loc.regionId,
        kind: loc.kind,
        x: p.x,
        y: p.y,
        reachable,
        isPlayer,
        isSeat: seats.has(loc.id),
        isMajor: capitals.has(loc.id) || bigSeats.has(loc.id),
        occupiedBy: occupied[loc.id]
          ? (this.state.houses[occupied[loc.id].occupierHouseId]?.name ?? null)
          : null,
        distance: edges.get(loc.id) ?? null,
      });
    }

    // jogador e destinos por último, para ficarem por cima
    return out.sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer) || Number(a.reachable) - Number(b.reachable));
  }

  /**
   * Linhas do jogador até os destinos diretos.
   *
   * O grafo liga todos os locais de uma mesma região entre si, então desenhar
   * tudo vira uma teia ilegível: mostramos as rotas mais curtas.
   */
  routes(): Array<{ x1: number; y1: number; x2: number; y2: number; distance: number }> {
    const from = LOCATION_POINTS[this.playerLocationId()];
    if (!from) return [];

    return (this.state.travelGraph[this.playerLocationId()] ?? [])
      .filter(e => !!LOCATION_POINTS[e.toLocationId])
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12)
      .map(e => {
        const to = LOCATION_POINTS[e.toLocationId];
        return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, distance: e.distance };
      });
  }

  /**
   * Rótulo permanente só para o essencial. Antes todo destino alcançável
   * ganhava texto — e como a região do jogador tem dezenas deles, o mapa
   * virava uma mancha de nomes sobrepostos.
   */
  showLabel(m: MapMarker): boolean {
    if (m.isPlayer) return true;
    if (this.hoveredLocationId === m.id) return true;
    if (this.showAllLocations) return true;
    return m.isMajor;
  }

  markerRadius(m: MapMarker): number {
    if (m.isPlayer) return 9;
    if (m.reachable) return 7;
    if (m.isSeat) return 5;
    return 4;
  }

  hovered(): MapMarker | null {
    if (!this.hoveredLocationId) return null;
    return this.markers().find(m => m.id === this.hoveredLocationId) ?? null;
  }

  onMarkerEnter(id: string): void { this.hoveredLocationId = id; }
  onMarkerLeave(): void { this.hoveredLocationId = null; }

  onMarkerClick(m: MapMarker): void {
    this.selectedRegionId = m.regionId;
    if (m.reachable) this.choose.emit(`go:${m.id}`);
  }

  // --- controles -----------------------------------------------------------

  toggleAllLocations(): void {
    this.showAllLocations = !this.showAllLocations;
  }

  zoomIn(): void { this.zoom = Math.min(4, +(this.zoom + 0.25).toFixed(2)); }
  zoomOut(): void { this.zoom = Math.max(1, +(this.zoom - 0.25).toFixed(2)); }

  resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  mapTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  onPointerDown(event: PointerEvent): void {
    const target = event.target as Element | null;
    if (target?.closest('.marker')) return;

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

  // --- listas de apoio -----------------------------------------------------

  areasInSelected(): Array<{ label: string; id: string; hint: string; disabled: boolean }> {
    const rid = this.selectedRegionId;
    if (!rid) return [];
    const edges = this.edgeMap();

    return Object.values(this.state.locations)
      .filter(l => l.regionId === rid)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(l => ({
        label: l.name,
        id: `go:${l.id}`,
        hint: edges.has(l.id) ? `Distância ${edges.get(l.id)}` : 'Não é um destino direto a partir daqui',
        disabled: !edges.has(l.id),
      }));
  }

  travelOptions(): Array<{ label: string; id: string; hint: string }> {
    const here = this.playerLocationId();
    const edges = this.state.travelGraph[here] ?? [];
    return edges.map(e => {
      const to = this.state.locations[e.toLocationId];
      return {
        label: to?.name ?? e.toLocationId,
        id: `go:${e.toLocationId}`,
        hint: `Distância ${e.distance} • ${e.distance} turno(s)`,
      };
    });
  }

  onGo(id: string): void {
    this.choose.emit(id);
  }
}
