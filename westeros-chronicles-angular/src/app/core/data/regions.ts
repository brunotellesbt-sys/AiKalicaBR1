import { Location, Region, TravelOption } from '../models';
import { EXTRA_LOCATIONS } from './expanded';
import { BASE_HOUSE_SEAT_LOCATIONS } from './base-seats';

export const REGIONS: Region[] = [
  { id: 'north', name: 'O Norte', capitalLocationId: 'winterfell' },
  { id: 'vale', name: 'O Vale', capitalLocationId: 'eyrie' },
  { id: 'riverlands', name: 'Terras Fluviais', capitalLocationId: 'riverrun' },
  { id: 'iron_islands', name: 'Ilhas de Ferro', capitalLocationId: 'pyke' },
  { id: 'westerlands', name: 'Terras Ocidentais', capitalLocationId: 'casterly_rock' },
  { id: 'crownlands', name: 'Terras da Coroa', capitalLocationId: 'kings_landing' },
  { id: 'stormlands', name: 'Terras da Tempestade', capitalLocationId: 'storms_end' },
  { id: 'reach', name: 'A Campina', capitalLocationId: 'highgarden' },
  { id: 'dorne', name: 'Dorne', capitalLocationId: 'sunspear' },
];

const BASE_LOCATIONS: Location[] = [
  // Capitais (assentos)
  { id: 'winterfell', name: 'Winterfell', regionId: 'north', kind: 'seat' },
  { id: 'eyrie', name: 'Ninho da Águia', regionId: 'vale', kind: 'seat' },
  { id: 'riverrun', name: 'Correrrio', regionId: 'riverlands', kind: 'seat' },
  { id: 'pyke', name: 'Pyke', regionId: 'iron_islands', kind: 'seat' },
  { id: 'casterly_rock', name: 'Rochedo Casterly', regionId: 'westerlands', kind: 'seat' },
  { id: 'kings_landing', name: 'Porto Real', regionId: 'crownlands', kind: 'seat' },
  { id: 'storms_end', name: 'Ponta Tempestade', regionId: 'stormlands', kind: 'seat' },
  { id: 'highgarden', name: 'Jardim de Cima', regionId: 'reach', kind: 'seat' },
  { id: 'sunspear', name: 'Lançassolar', regionId: 'dorne', kind: 'seat' },

  // Outros pontos (alguns exemplos por região)
  { id: 'white_harbor', name: 'Porto Branco', regionId: 'north', kind: 'port' },
  { id: 'dreadfort', name: 'Forte do Pavor', regionId: 'north', kind: 'fortress' },
  // A Muralha (útil para eventos canônicos a partir de 298)
  { id: 'castle_black', name: 'Castelo Negro', regionId: 'north', kind: 'fortress' },
  { id: 'eastwatch', name: 'Guarda Leste', regionId: 'north', kind: 'port' },
  { id: 'shadow_tower', name: 'Torre Sombria', regionId: 'north', kind: 'fortress' },
  { id: 'gulltown', name: 'Vila Gaivota', regionId: 'vale', kind: 'port' },
  { id: 'harrenhal', name: 'Harrenhal', regionId: 'riverlands', kind: 'fortress' },
  { id: 'seagard', name: 'Guarda-Mar', regionId: 'riverlands', kind: 'fortress' },
  { id: 'lannisport', name: 'Lannisporto', regionId: 'westerlands', kind: 'port' },
  { id: 'dragonstone', name: 'Pedra do Dragão', regionId: 'crownlands', kind: 'fortress' },
  { id: 'duskendale', name: 'Valdocaso', regionId: 'crownlands', kind: 'town' },
  { id: 'tarth', name: 'Tarth', regionId: 'stormlands', kind: 'port' },
  { id: 'oldtown', name: 'Vila Velha', regionId: 'reach', kind: 'port' },
  { id: 'horn_hill', name: 'Colina do Chifre', regionId: 'reach', kind: 'fortress' },
  { id: 'starfall', name: 'Queda d’Estrela', regionId: 'dorne', kind: 'fortress' },
];

export const LOCATIONS: Location[] = [
  ...BASE_LOCATIONS,
  ...BASE_HOUSE_SEAT_LOCATIONS,
  ...EXTRA_LOCATIONS,
];

function addEdge(g: Record<string, TravelOption[]>, from: string, to: string, distance: number): void {
  g[from] = g[from] ?? [];
  const exists = g[from].some(e => e.toLocationId === to);
  if (!exists) g[from].push({ toLocationId: to, distance });
}

function buildTravelGraph(regions: Region[], locations: Location[], base: Record<string, TravelOption[]>): Record<string, TravelOption[]> {
  const g: Record<string, TravelOption[]> = {};
  // clona base
  for (const [k, v] of Object.entries(base)) g[k] = v.map(x => ({ ...x }));

  const rmap = regions.reduce((acc, r) => { acc[r.id] = r; return acc; }, {} as Record<string, Region>);

  for (const loc of locations) {
    const reg = rmap[loc.regionId];
    if (!reg) continue;
    const cap = reg.capitalLocationId;
    if (!cap || cap === loc.id) continue;

    // distância “local” simples por tipo
    const dist = loc.kind === 'town' ? 2 : loc.kind === 'port' ? 3 : 3;
    addEdge(g, loc.id, cap, dist);
    addEdge(g, cap, loc.id, dist);
  }

  // garante que todos os nós existam no mapa (mesmo que sem arestas)
  for (const loc of locations) g[loc.id] = g[loc.id] ?? [];

  return g;
}

const BASE_TRAVEL_GRAPH: Record<string, TravelOption[]> = {
  // Conexões abstratas (distâncias proporcionais/simplificadas)
  winterfell: [
    { toLocationId: 'white_harbor', distance: 3 },
    { toLocationId: 'dreadfort', distance: 3 },
    { toLocationId: 'eyrie', distance: 7 },
  ],
  white_harbor: [
    { toLocationId: 'winterfell', distance: 3 },
    { toLocationId: 'eyrie', distance: 5 },
  ],
  dreadfort: [
    { toLocationId: 'winterfell', distance: 3 },
    { toLocationId: 'riverrun', distance: 6 },
  ],
  eyrie: [
    { toLocationId: 'winterfell', distance: 7 },
    { toLocationId: 'gulltown', distance: 2 },
    { toLocationId: 'riverrun', distance: 4 },
    { toLocationId: 'kings_landing', distance: 3 },
  ],
  gulltown: [
    { toLocationId: 'eyrie', distance: 2 },
    { toLocationId: 'kings_landing', distance: 3 },
  ],
  riverrun: [
    { toLocationId: 'eyrie', distance: 4 },
    { toLocationId: 'harrenhal', distance: 2 },
    { toLocationId: 'seagard', distance: 3 },
    { toLocationId: 'casterly_rock', distance: 5 },
    { toLocationId: 'storms_end', distance: 5 },
  ],
  harrenhal: [
    { toLocationId: 'riverrun', distance: 2 },
    { toLocationId: 'kings_landing', distance: 2 },
  ],
  seagard: [
    { toLocationId: 'riverrun', distance: 3 },
    { toLocationId: 'pyke', distance: 4 },
  ],
  pyke: [
    { toLocationId: 'seagard', distance: 4 },
    { toLocationId: 'casterly_rock', distance: 4 },
  ],
  casterly_rock: [
    { toLocationId: 'pyke', distance: 4 },
    { toLocationId: 'riverrun', distance: 5 },
    { toLocationId: 'lannisport', distance: 1 },
    { toLocationId: 'highgarden', distance: 4 },
  ],
  lannisport: [
    { toLocationId: 'casterly_rock', distance: 1 },
    { toLocationId: 'oldtown', distance: 5 },
  ],
  kings_landing: [
    { toLocationId: 'eyrie', distance: 3 },
    { toLocationId: 'harrenhal', distance: 2 },
    { toLocationId: 'duskendale', distance: 1 },
    { toLocationId: 'dragonstone', distance: 2 },
    { toLocationId: 'storms_end', distance: 3 },
  ],
  dragonstone: [
    { toLocationId: 'kings_landing', distance: 2 },
  ],
  duskendale: [
    { toLocationId: 'kings_landing', distance: 1 },
  ],
  storms_end: [
    { toLocationId: 'kings_landing', distance: 3 },
    { toLocationId: 'tarth', distance: 2 },
    { toLocationId: 'highgarden', distance: 4 },
    { toLocationId: 'riverrun', distance: 5 },
  ],
  tarth: [
    { toLocationId: 'storms_end', distance: 2 },
  ],
  highgarden: [
    { toLocationId: 'storms_end', distance: 4 },
    { toLocationId: 'casterly_rock', distance: 4 },
    { toLocationId: 'oldtown', distance: 2 },
    { toLocationId: 'horn_hill', distance: 2 },
    { toLocationId: 'sunspear', distance: 6 },
  ],
  oldtown: [
    { toLocationId: 'highgarden', distance: 2 },
    { toLocationId: 'lannisport', distance: 5 },
    { toLocationId: 'sunspear', distance: 5 },
  ],
  horn_hill: [
    { toLocationId: 'highgarden', distance: 2 },
  ],
  sunspear: [
    { toLocationId: 'highgarden', distance: 6 },
    { toLocationId: 'oldtown', distance: 5 },
    { toLocationId: 'starfall', distance: 3 },
  ],
  starfall: [
    { toLocationId: 'sunspear', distance: 3 },
  ],
};

export const TRAVEL_GRAPH: Record<string, TravelOption[]> = buildTravelGraph(REGIONS, LOCATIONS, BASE_TRAVEL_GRAPH);
