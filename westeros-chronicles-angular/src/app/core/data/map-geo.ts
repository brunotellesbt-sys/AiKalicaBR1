/**
 * Geografia do mapa de Westeros.
 *
 * Sobre a arte: este é um desenho vetorial **original**, feito à mão para o
 * projeto, com a geografia canônica de Westeros — litoral, posição relativa
 * das nove regiões, a Muralha, as grandes baías e as ilhas. Não é um mapa
 * oficial da HBO/GRRM (que é material protegido por direitos autorais e não
 * pode ser redistribuído aqui), nem uma imagem gerada por IA: são coordenadas
 * escritas explicitamente, o que também permite ancorar cada local do jogo em
 * um ponto real do mapa.
 *
 * Sistema de coordenadas: 1000 × 1600, norte no topo.
 */

export const MAP_VIEWBOX = '0 0 1000 1600';

export type Point = { x: number; y: number };

// ---------------------------------------------------------------------------
// Litoral
// ---------------------------------------------------------------------------

/** Contorno do continente, da ponta oeste da Muralha e no sentido horário. */
const MAINLAND: Array<[number, number]> = [
  // costa oeste, descendo (Baía de Gelo, Dedo de Flint, Baía do Homem de Ferro)
  [252, 244], [240, 268], [246, 296], [268, 318], [258, 344], [236, 366],
  [228, 392], [244, 416], [262, 442], [252, 470], [268, 496], [292, 516],
  [306, 542], [286, 560], [312, 584], [352, 598], [374, 618], [358, 642],
  [312, 654], [296, 678], [304, 702], [330, 722], [316, 746], [298, 772],
  [306, 800], [300, 834], [308, 866], [296, 894], [312, 922], [330, 952],
  [322, 984], [338, 1012], [330, 1044], [344, 1074], [358, 1104], [382, 1132],
  // sul da Campina e entrada de Dorne
  [404, 1152], [432, 1168], [462, 1182], [474, 1206], [462, 1236], [452, 1266],
  [462, 1296], [486, 1320], [512, 1342], [548, 1360], [588, 1372], [630, 1374],
  [668, 1362], [702, 1344], [730, 1318], [748, 1288], [762, 1256],
  // Braço Partido
  [774, 1224], [768, 1196], [748, 1180], [722, 1172], [700, 1160], [676, 1146],
  [652, 1132], [630, 1124],
  // Mar de Dorne e Cabo da Ira
  [648, 1108], [676, 1096], [706, 1090], [738, 1072], [760, 1044], [752, 1014],
  [734, 990], [716, 962], [722, 934], [706, 906], [692, 880],
  // Baía da Água Negra e Ponta das Garras
  [704, 858], [686, 842], [658, 850], [632, 860], [614, 842], [620, 816],
  [642, 798], [668, 784], [690, 766], [672, 748], [646, 758], [628, 744],
  // costa do Vale, Dedos e a Mordida
  [634, 720], [656, 700], [678, 684], [700, 670], [724, 658], [752, 644],
  [782, 632], [800, 610], [786, 590], [760, 584], [738, 600], [716, 592],
  [698, 572], [670, 584],
  // A Mordida: baía profunda que separa o Vale do Norte e forma o Pescoço
  [642, 606], [610, 620], [576, 626], [546, 614], [524, 592], [520, 564],
  [544, 546], [574, 536],
  // costa leste do Norte, subindo até a Muralha
  [596, 528], [604, 500], [614, 470], [626, 442], [618, 412], [624, 384],
  [632, 354], [626, 322], [616, 290], [610, 262], [612, 244],
];

/** Terras Além da Muralha (fora das nove regiões jogáveis). */
const BEYOND_THE_WALL: Array<[number, number]> = [
  [252, 244], [236, 206], [252, 168], [292, 140], [340, 118], [396, 106],
  [452, 108], [508, 122], [556, 146], [592, 180], [608, 214], [612, 244],
];

function toPath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
}

export const MAINLAND_PATH = toPath(MAINLAND);
export const BEYOND_WALL_PATH = toPath(BEYOND_THE_WALL);

/** A Muralha: 300 léguas de gelo entre o Norte e o que vem depois. */
export const WALL_PATH = 'M252,244 L612,244';

// ---------------------------------------------------------------------------
// Regiões
// ---------------------------------------------------------------------------
//
// Os polígonos são intencionalmente generosos: tudo é recortado pelo litoral
// via <clipPath>, então basta acertar as fronteiras internas.

const REGION_POLYGONS: Record<string, Array<[number, number]>> = {
  north: [
    [120, 220], [740, 220], [740, 570], [618, 600], [508, 650], [430, 658],
    [348, 614], [120, 540],
  ],
  vale: [
    [598, 528], [890, 496], [890, 744], [772, 806], [688, 770], [650, 700],
    [626, 606],
  ],
  riverlands: [
    [240, 588], [348, 608], [430, 654], [508, 646], [618, 594], [648, 618],
    [674, 714], [646, 798], [560, 854], [466, 842], [336, 790], [240, 700],
  ],
  crownlands: [
    [552, 736], [640, 712], [720, 730], [828, 766], [836, 894], [700, 948],
    [600, 908], [544, 830],
  ],
  westerlands: [
    [220, 766], [400, 760], [478, 786], [492, 896], [452, 1012], [304, 1034],
    [230, 912],
  ],
  iron_islands: [
    [140, 600], [322, 596], [328, 772], [142, 776],
  ],
  reach: [
    [268, 984], [446, 998], [488, 932], [578, 920], [664, 990], [638, 1150],
    [470, 1220], [334, 1164], [264, 1068],
  ],
  stormlands: [
    [584, 856], [700, 840], [844, 852], [856, 1074], [712, 1140], [614, 1104],
    [572, 978],
  ],
  dorne: [
    [404, 1166], [628, 1104], [856, 1164], [840, 1320], [668, 1412],
    [486, 1370], [392, 1268],
  ],
};

/**
 * Cor de cada reino. Sem isso o continente inteiro sai como uma mancha
 * verde-oliva única e as fronteiras não se leem.
 */
export const REGION_COLORS: Record<string, string> = {
  north: '#7d93a6',        // cinza-azulado: neve e pedra
  vale: '#8ca8ad',         // montanhas altas
  riverlands: '#7f9a63',   // várzeas do Tridente
  iron_islands: '#6c7a80', // rocha e sal
  westerlands: '#b09a5c',  // ouro de Rochedo Casterly
  crownlands: '#9c8672',   // terras da corte
  reach: '#8fae5c',        // o celeiro dos Sete Reinos
  stormlands: '#6f8b6a',   // florestas úmidas
  dorne: '#c2a06a',        // areia
};

export const REGION_SHAPES: Array<{ regionId: string; d: string; clip: boolean; color: string }> =
  Object.entries(REGION_POLYGONS).map(([regionId, pts]) => ({
    regionId,
    d: toPath(pts),
    // As Ilhas de Ferro não fazem parte do continente: não são recortadas.
    clip: regionId !== 'iron_islands',
    color: REGION_COLORS[regionId] ?? '#7f8f68',
  }));

// ---------------------------------------------------------------------------
// Ilhas
// ---------------------------------------------------------------------------

export const ISLANDS: Array<{ regionId: string; d: string; label?: string }> = [
  // Ilhas de Ferro
  { regionId: 'iron_islands', d: toPath([[186, 640], [214, 632], [232, 652], [222, 682], [194, 686], [178, 664]]), label: 'Grande Wyk' },
  { regionId: 'iron_islands', d: toPath([[236, 668], [268, 660], [284, 680], [268, 704], [240, 700]]), label: 'Harlaw' },
  { regionId: 'iron_islands', d: toPath([[214, 694], [246, 690], [258, 712], [236, 730], [208, 720]]), label: 'Pyke' },
  { regionId: 'iron_islands', d: toPath([[176, 700], [204, 700], [210, 722], [186, 736], [166, 720]]), label: 'Velho Wyk' },
  { regionId: 'iron_islands', d: toPath([[254, 726], [280, 722], [290, 742], [268, 756], [248, 746]]), label: 'Blacktyde' },
  // Norte
  { regionId: 'north', d: toPath([[214, 330], [248, 322], [262, 344], [240, 364], [212, 356]]), label: 'Ilha do Urso' },
  { regionId: 'north', d: toPath([[646, 300], [686, 292], [702, 322], [676, 348], [644, 336]]), label: 'Skagos' },
  // Vale
  { regionId: 'vale', d: toPath([[664, 546], [690, 540], [698, 558], [674, 566]]), label: 'Irmãs' },
  { regionId: 'vale', d: toPath([[706, 536], [730, 532], [736, 550], [712, 556]]) },
  // Terras da Coroa
  { regionId: 'crownlands', d: toPath([[726, 806], [762, 800], [776, 828], [754, 852], [724, 842]]), label: 'Pedra do Dragão' },
  { regionId: 'crownlands', d: toPath([[694, 862], [724, 858], [732, 880], [706, 890]]), label: 'Marcaderiva' },
  // Terras da Tempestade
  { regionId: 'stormlands', d: toPath([[742, 934], [780, 928], [792, 958], [766, 980], [738, 966]]), label: 'Tarth' },
  { regionId: 'stormlands', d: toPath([[788, 1000], [812, 996], [818, 1018], [794, 1024]]), label: 'Pedraverde' },
  // Campina
  { regionId: 'reach', d: toPath([[338, 1176], [382, 1170], [398, 1198], [368, 1220], [332, 1208]]), label: 'Arbor' },
];

// ---------------------------------------------------------------------------
// Rios (decorativos)
// ---------------------------------------------------------------------------

export const RIVERS: string[] = [
  // Tridente e afluentes
  'M406,690 C470,706 540,724 636,760',
  'M430,724 C486,742 540,758 616,782',
  'M392,742 C444,764 500,780 570,800',
  // Água Negra
  'M498,806 C540,820 572,828 610,836',
  // Mander
  'M470,962 C440,1020 412,1080 386,1132',
  'M528,952 C500,990 480,1010 470,1030',
  // Torrente (Dorne)
  'M556,1230 C520,1258 486,1280 462,1294',
  // Lança Verde
  'M626,1200 C664,1216 690,1226 716,1240',
];

// ---------------------------------------------------------------------------
// Posições dos locais
// ---------------------------------------------------------------------------

/** Locais com posição canônica conhecida. */
const NAMED_POINTS: Record<string, Point> = {
  // Norte
  winterfell: { x: 424, y: 432 },
  castle_black: { x: 428, y: 250 },
  eastwatch: { x: 596, y: 252 },
  shadow_tower: { x: 282, y: 252 },
  white_harbor: { x: 548, y: 520 },
  dreadfort: { x: 512, y: 386 },
  karhold: { x: 578, y: 336 },
  last_hearth: { x: 520, y: 300 },
  bear_island: { x: 236, y: 344 },
  deepwood_motte: { x: 306, y: 428 },
  torrhens_square: { x: 356, y: 486 },
  castle_cerwyn: { x: 436, y: 476 },
  hornwood_castle: { x: 496, y: 452 },
  greywater_watch: { x: 400, y: 600 },

  // Vale
  eyrie: { x: 700, y: 656 },
  gulltown: { x: 752, y: 700 },
  runestone: { x: 738, y: 636 },
  redfort_castle: { x: 716, y: 606 },
  ironoaks: { x: 748, y: 668 },
  longbow_hall: { x: 686, y: 606 },
  hearts_home: { x: 722, y: 690 },
  baelish_tower: { x: 782, y: 600 },
  three_sisters: { x: 676, y: 552 },

  // Terras Fluviais
  riverrun: { x: 428, y: 716 },
  harrenhal: { x: 524, y: 748 },
  seagard: { x: 352, y: 686 },
  the_twins: { x: 392, y: 656 },
  maidenpool: { x: 604, y: 756 },
  darry_castle: { x: 528, y: 786 },
  pinkmaiden: { x: 404, y: 776 },
  raventree_hall: { x: 476, y: 700 },
  stone_hedge: { x: 502, y: 690 },

  // Ilhas de Ferro
  pyke: { x: 232, y: 708 },
  lordsport: { x: 248, y: 704 },
  old_wyk: { x: 188, y: 716 },
  ten_towers: { x: 260, y: 680 },
  hammerhorn: { x: 200, y: 658 },
  blacktyde_keep: { x: 268, y: 738 },

  // Terras Ocidentais
  casterly_rock: { x: 322, y: 856 },
  lannisport: { x: 318, y: 876 },
  golden_tooth: { x: 412, y: 806 },
  ashemark: { x: 392, y: 870 },
  crakehall_castle: { x: 336, y: 934 },
  cornfield: { x: 404, y: 930 },
  hornvale: { x: 448, y: 848 },
  cleganes_keep: { x: 372, y: 902 },

  // Terras da Coroa
  kings_landing: { x: 604, y: 828 },
  duskendale: { x: 624, y: 782 },
  dragonstone: { x: 750, y: 826 },
  driftmark: { x: 712, y: 872 },
  claw_isle: { x: 668, y: 772 },
  sharp_point: { x: 692, y: 872 },
  blackfyre_hold: { x: 640, y: 856 },

  // Terras da Tempestade
  storms_end: { x: 690, y: 986 },
  tarth: { x: 764, y: 954 },
  evenfall_hall: { x: 758, y: 962 },
  greenstone: { x: 802, y: 1010 },
  griffins_roost: { x: 634, y: 964 },
  stonehelm: { x: 700, y: 1012 },
  blackhaven: { x: 612, y: 1056 },
  nightsong: { x: 596, y: 1030 },
  harvest_hall: { x: 640, y: 1024 },
  parchments: { x: 664, y: 902 },

  // Campina
  highgarden: { x: 452, y: 1000 },
  oldtown: { x: 388, y: 1128 },
  horn_hill: { x: 444, y: 1116 },
  the_arbor: { x: 364, y: 1194 },
  brightwater_keep: { x: 410, y: 1062 },
  goldengrove: { x: 436, y: 942 },
  honeyholt: { x: 400, y: 1096 },
  old_oak: { x: 366, y: 992 },

  // Dorne
  sunspear: { x: 700, y: 1228 },
  starfall: { x: 458, y: 1288 },
  yronwood_castle: { x: 618, y: 1198 },
  hellholt: { x: 522, y: 1284 },
  sandstone: { x: 540, y: 1230 },
  skyreach: { x: 500, y: 1192 },
  kingsgrave: { x: 480, y: 1214 },
  the_tor: { x: 664, y: 1272 },
};

// --- Distribuição determinística dos demais locais -------------------------

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** PRNG determinístico a partir de uma string (mesmo local, mesma posição). */
function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function pointInPolygon(p: Point, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersects = (yi > p.y) !== (yj > p.y)
      && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function bbox(poly: Array<[number, number]>) {
  const xs = poly.map(p => p[0]);
  const ys = poly.map(p => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

const MAINLAND_POLY = MAINLAND;

/**
 * Coloca um local sem coordenada explícita dentro do polígono da sua região
 * (e, para regiões continentais, também dentro do litoral), mantendo distância
 * mínima dos vizinhos já posicionados.
 */
function placeInRegion(
  id: string,
  regionId: string,
  taken: Point[]
): Point | null {
  const poly = REGION_POLYGONS[regionId];
  if (!poly) return null;

  const box = bbox(poly);
  const rand = seededRandom(hash32(id));
  const mustBeOnMainland = regionId !== 'iron_islands';

  let best: Point | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 220; attempt++) {
    const p: Point = {
      x: Math.round(box.minX + rand() * (box.maxX - box.minX)),
      y: Math.round(box.minY + rand() * (box.maxY - box.minY)),
    };
    if (!pointInPolygon(p, poly)) continue;
    if (mustBeOnMainland && !pointInPolygon(p, MAINLAND_POLY)) continue;

    // maximiza a distância ao vizinho mais próximo
    let nearest = Infinity;
    for (const t of taken) {
      const d = (t.x - p.x) ** 2 + (t.y - p.y) ** 2;
      if (d < nearest) nearest = d;
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      best = p;
      if (nearest > 26 * 26) break; // espaçamento suficiente
    }
  }

  return best;
}

/** Constrói o mapa completo de posições, com cache por módulo. */
export function buildLocationPoints(
  locations: Array<{ id: string; regionId: string }>
): Record<string, Point> {
  const out: Record<string, Point> = {};
  const takenByRegion: Record<string, Point[]> = {};

  // 1) âncoras conhecidas
  for (const loc of locations) {
    const named = NAMED_POINTS[loc.id];
    if (!named) continue;
    out[loc.id] = named;
    (takenByRegion[loc.regionId] = takenByRegion[loc.regionId] ?? []).push(named);
  }

  // 2) o resto, em ordem estável
  const rest = locations
    .filter(l => !out[l.id])
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const loc of rest) {
    const taken = takenByRegion[loc.regionId] = takenByRegion[loc.regionId] ?? [];
    const p = placeInRegion(loc.id, loc.regionId, taken);
    if (!p) continue;
    out[loc.id] = p;
    taken.push(p);
  }

  return out;
}

/** Rótulos das regiões, posicionados à mão. */
export const REGION_LABELS: Record<string, Point> = {
  north: { x: 420, y: 330 },
  vale: { x: 740, y: 590 },
  riverlands: { x: 460, y: 748 },
  iron_islands: { x: 196, y: 618 },
  westerlands: { x: 360, y: 812 },
  crownlands: { x: 664, y: 812 },
  reach: { x: 470, y: 1064 },
  stormlands: { x: 706, y: 918 },
  dorne: { x: 600, y: 1280 },
};
