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

/**
 * Contorno do continente, da ponta oeste da Muralha e no sentido horário.
 *
 * Proporções, que era o erro mais grosseiro da versão anterior: o Norte sozinho
 * ocupa cerca de um terço do continente — é do tamanho de todos os reinos do sul
 * somados. Antes ele saía pequeno e o mapa inteiro parecia outra coisa.
 *
 * Feições que dão a silhueta reconhecível, e sem as quais nenhum contorno de
 * Westeros funciona:
 *
 *  - Muralha reta no topo, e o continente cheio abaixo dela
 *  - Baía de Gelo mordendo o oeste; a Mordida mordendo o leste
 *  - entre as duas, o Pescoço: um istmo estreito, o único caminho por terra
 *  - Vale saliente a leste, terminando nos Dedos
 *  - Baía da Água Negra, com a Ponta das Garras ganchada por cima
 *  - Cabo da Ira no sudeste, e o Mar de Dorne recuado atrás dele
 *  - Braço Partido: a península de Dorne apontando a sudeste, rompida
 */
const MAINLAND: Array<[number, number]> = [
  // — costa oeste do Norte —
  // Baía de Gelo: entra fundo pelo oeste, logo abaixo da ponta da Muralha.
  [270, 190], [287, 224], [310, 258], [323, 292],
  [310, 322], [280, 336], [249, 328],
  [229, 344], [223, 378], [232, 410],
  // Cabo Kraken, apontando para o mar do Poente
  [209, 430], [185, 446], [210, 462], [239, 474], [267, 470],
  // Baía do Braseiro, estreitando em direção ao istmo
  [289, 496], [318, 520], [345, 542], [365, 566], [383, 590],

  // — O PESCOÇO, lado oeste —
  [407, 610], [420, 634],

  // — costa oeste do sul: Baía do Homem de Ferro e Terras Ocidentais —
  [405, 660], [378, 676], [345, 690], [318, 712],
  [296, 742], [289, 780], [305, 812], [318, 846],
  [310, 884], [321, 922], [338, 958], [334, 996], [345, 1034],

  // — sudoeste da Campina —
  [361, 1072], [383, 1106], [412, 1136], [445, 1160], [474, 1182],

  // — Dorne, costa sul —
  // Dorne é a ponta LARGA do continente, não um afunilamento. A versão
  // anterior estreitava indo para o sul e espremia a região inteira contra o
  // Braço Partido, deixando metade dela no mar.
  [492, 1216], [503, 1256], [518, 1296], [542, 1330],
  [576, 1356], [618, 1374], [664, 1378], [705, 1366],
  [740, 1342], [764, 1310],

  // — Braço Partido —
  // A península aponta a sudeste e termina rompida: o que sobrou dela são os
  // Degraus, ilhas soltas fora do continente.
  [784, 1276], [800, 1244], [809, 1208],
  [793, 1188], [769, 1196], [751, 1218],
  [733, 1244], [709, 1262], [684, 1272], [658, 1272],

  // — Mar de Dorne: recua para oeste, atrás do Cabo da Ira —
  [633, 1250], [607, 1230], [587, 1206],
  [596, 1182], [623, 1170], [654, 1166], [687, 1156], [718, 1138],

  // — Cabo da Ira e costa das Terras da Tempestade —
  [747, 1114], [769, 1084], [778, 1048], [765, 1018], [744, 996],
  [724, 968], [714, 936], [725, 906], [720, 876],

  // — Baía da Água Negra e Ponta das Garras —
  [702, 856], [674, 846], [645, 852], [622, 866],
  [602, 850], [598, 822], [614, 800], [638, 786],
  [664, 770], [684, 750], [669, 730], [644, 740], [623, 730],

  // — Vale: saliente a leste, terminando nos Dedos —
  [629, 706], [653, 690], [680, 676], [707, 664], [736, 652], [765, 640],
  [793, 622], [778, 606], [755, 614], [738, 600],
  [762, 586], [773, 570], [751, 560], [729, 572], [713, 588],
  [693, 578], [682, 560],

  // — A MORDIDA: baía funda que separa o Vale do Norte —
  // Junto com a Baía de Gelo do outro lado, é ela que estrangula o continente.
  [656, 574], [627, 594], [596, 610], [563, 620], [531, 622],
  [502, 612], [482, 594],

  // — O PESCOÇO, lado leste —
  [478, 570],

  // — costa leste do Norte, subindo até a Muralha —
  [492, 546], [518, 528], [547, 518],
  [578, 508], [594, 480], [603, 448], [611, 414], [603, 380],
  [611, 346], [620, 312], [614, 272], [607, 230], [611, 190],
];

/**
 * Terras Além da Muralha.
 *
 * Saía como uma cúpula arredondada apoiada na Muralha, o que dava a impressão
 * de uma ilha pequena. Nas fontes é o contrário: o território ao norte é vasto
 * e não tem limite conhecido. Aqui ele sobe até a borda do quadro e sai por
 * cima — é o que comunica "continua, e ninguém sabe até onde".
 */
const BEYOND_THE_WALL: Array<[number, number]> = [
  [270, 190], [246, 158], [224, 120], [208, 78], [197, 34], [193, 0],
  [704, 0],
  [698, 38], [687, 82], [671, 124], [651, 158], [630, 178], [611, 190],
];

function toPath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
}

export const MAINLAND_PATH = toPath(MAINLAND);
export const BEYOND_WALL_PATH = toPath(BEYOND_THE_WALL);

/** A Muralha: 300 léguas de gelo entre o Norte e o que vem depois. */
export const WALL_PATH = 'M270,190 L611,190';

// ---------------------------------------------------------------------------
// Regiões
// ---------------------------------------------------------------------------
//
// Os polígonos são intencionalmente generosos: tudo é recortado pelo litoral
// via <clipPath>, então basta acertar as fronteiras internas.

const REGION_POLYGONS: Record<string, Array<[number, number]>> = {
  north: [
    [110, 170], [780, 170], [780, 530], [650, 578], [540, 612], [452, 642],
    [372, 606], [110, 500],
  ],
  vale: [
    [592, 520], [880, 496], [880, 762], [764, 806], [682, 772], [640, 702],
    [612, 600],
  ],
  riverlands: [
    [268, 620], [400, 648], [512, 640], [614, 606], [668, 700], [658, 792],
    [560, 852], [450, 842], [330, 786], [252, 700],
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
    [120, 620], [300, 616], [306, 792], [122, 796],
  ],
  reach: [
    [268, 984], [446, 998], [488, 932], [578, 920], [664, 990], [638, 1150],
    [452, 1196], [330, 1156], [264, 1068],
  ],
  stormlands: [
    [584, 856], [700, 840], [852, 852], [862, 1080], [712, 1146], [614, 1104],
    [572, 978],
  ],
  dorne: [
    [452, 1180], [640, 1116], [872, 1180], [860, 1330], [676, 1420],
    [500, 1382], [438, 1268],
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

/**
 * Lagos.
 *
 * O Olho de Deus faltava por completo, o que é buraco de geografia e não
 * escolha de estilo: é a maior água interior do continente, fica no meio das
 * Terras Fluviais e tem a Ilha das Faces no centro. Mapa de Westeros sem ele
 * lê como mapa de outro lugar.
 */
export const LAKES: Array<{ d: string; label?: string; island?: string }> = [
  {
    d: 'M512,726 C540,714 576,718 592,738 C606,756 600,780 578,792 '
      + 'C554,806 520,802 506,782 C494,764 496,738 512,726 Z',
    label: 'Olho de Deus',
    // A Ilha das Faces, com o bosque sagrado que sobreviveu ao Pacto.
    island: 'M542,752 C554,746 568,750 570,760 C572,770 562,778 550,776 '
      + 'C538,774 532,760 542,752 Z',
  },
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
// Relevo
// ---------------------------------------------------------------------------
//
// Um mapa só de manchas coloridas não diz nada sobre o terreno: o Vale e a
// Campina são igualmente planos, e nada explica por que atravessar o Pescoço é
// difícil. O relevo entra como glifos repetidos dentro de áreas nomeadas —
// a mesma convenção dos mapas desenhados à mão, e a que sobrevive ao zoom sem
// virar textura borrada.
//
// As áreas seguem a geografia descrita nas fontes (onde ficam as Montanhas da
// Lua, o Bosque dos Lobos, o Pescoço pantanoso, os desertos de Dorne). O
// desenho de cada glifo é próprio.

export type TerrainKind = 'mountain' | 'hills' | 'forest' | 'swamp' | 'dunes';

export interface TerrainGlyph {
  kind: TerrainKind;
  x: number;
  y: number;
  /** Escala relativa, variada para o campo não parecer estampa. */
  s: number;
}

/**
 * Glifos desenhados na origem, ~20 unidades de largura.
 *
 * Todos são silhuetas cheias por um motivo prático: contorno fino de 1px some
 * quando o mapa é afastado, e o mapa nasce afastado.
 */
export const TERRAIN_PATHS: Record<TerrainKind, string> = {
  // Pico com neve no topo — o entalhe branco é o que separa montanha de colina.
  mountain: 'M-10,6 L-3.5,-4 L0,-8 L4,-3 L10,6 Z',
  hills: 'M-10,5 Q-5,-2 0,5 Q5,-2 10,5 Z',
  // Conífera: três saias e tronco. Árvore redonda lê como nuvem no tamanho pequeno.
  forest: 'M0,-9 L4.5,-2 L2,-2 L6,3 L2.5,3 L7,8 L-7,8 L-2.5,3 L-6,3 L-2,-2 L-4.5,-2 Z',
  // Juncos sobre água parada.
  swamp: 'M-8,5 H8 M-5,5 V-1 M0,5 V-4 M5,5 V-2 M-5,-1 L-7,-4 M0,-4 L2,-7 M5,-2 L7,-5',
  // Dunas: duas cristas sobrepostas.
  dunes: 'M-10,4 Q-4,-3 2,4 Z M-2,6 Q4,-1 10,6 Z',
};

/** Glifo de pântano é traço, não preenchimento. */
export const TERRAIN_STROKED: readonly TerrainKind[] = ['swamp'];

interface TerrainField {
  kind: TerrainKind;
  /** Nome da feição, para referência de quem editar. */
  label: string;
  poly: Array<[number, number]>;
  /** Passo da grade: menor = mais denso. */
  step: number;
}

const TERRAIN_FIELDS: TerrainField[] = [
  // — Além da Muralha —
  { kind: 'mountain', label: 'Presas de Gelo', step: 30, poly: [[236, 48], [368, 28], [390, 150], [258, 168]] },
  { kind: 'forest', label: 'Floresta Assombrada', step: 26, poly: [[410, 30], [600, 44], [604, 162], [418, 166]] },

  // — Norte —
  { kind: 'mountain', label: 'Montanhas do Norte', step: 30, poly: [[262, 220], [404, 208], [416, 278], [270, 292]] },
  { kind: 'forest', label: 'Bosque dos Lobos', step: 26, poly: [[268, 348], [386, 342], [396, 452], [280, 462]] },
  { kind: 'forest', label: 'Bosque Lobo (leste)', step: 28, poly: [[466, 330], [578, 344], [572, 426], [468, 414]] },
  { kind: 'hills', label: 'Colinas do Norte', step: 30, poly: [[336, 480], [500, 490], [498, 554], [340, 544]] },
  { kind: 'swamp', label: 'O Pescoço', step: 24, poly: [[416, 574], [492, 582], [480, 646], [408, 632]] },

  // — Vale —
  { kind: 'mountain', label: 'Montanhas da Lua', step: 26, poly: [[634, 592], [782, 566], [800, 668], [656, 698]] },
  { kind: 'hills', label: 'Dedos', step: 30, poly: [[724, 618], [812, 604], [816, 656], [730, 672]] },

  // — Terras Ocidentais —
  { kind: 'hills', label: 'Colinas Ocidentais', step: 28, poly: [[300, 812], [452, 806], [462, 918], [306, 924]] },
  { kind: 'mountain', label: 'Serra de Castamere', step: 32, poly: [[350, 930], [452, 938], [446, 1000], [346, 992]] },

  // — Terras Fluviais —
  { kind: 'hills', label: 'Colinas do Tridente', step: 32, poly: [[404, 668], [524, 676], [518, 730], [400, 722]] },

  // — Terras da Coroa —
  { kind: 'forest', label: 'Bosque do Rei', step: 26, poly: [[584, 838], [696, 848], [688, 922], [580, 912]] },

  // — Terras da Tempestade —
  { kind: 'forest', label: 'Bosque da Chuva', step: 26, poly: [[672, 976], [788, 990], [776, 1078], [664, 1064]] },
  { kind: 'hills', label: 'Marcas de Dorne', step: 30, poly: [[598, 1040], [682, 1048], [676, 1108], [594, 1098]] },

  // — Campina —
  { kind: 'hills', label: 'Colinas da Campina', step: 34, poly: [[380, 1020], [500, 1028], [494, 1086], [376, 1078]] },

  // — Dorne —
  { kind: 'mountain', label: 'Montanhas Vermelhas', step: 26, poly: [[496, 1150], [664, 1120], [690, 1194], [516, 1222]] },
  { kind: 'dunes', label: 'Deserto de Dorne', step: 30, poly: [[534, 1248], [744, 1222], [760, 1322], [560, 1348]] },
];

function pointInTerrainField(x: number, y: number, poly: Array<[number, number]>): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Ruído determinístico em [0,1) — mesmo mapa em toda sessão e toda máquina. */
function jitter(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/**
 * Preenche cada campo com glifos numa grade sacudida.
 *
 * Grade pura lê como papel quadriculado; posição totalmente aleatória
 * amontoa e deixa buracos. Grade com deslocamento de até meio passo dá o
 * espaçamento irregular dos mapas desenhados à mão.
 */
function buildTerrain(): TerrainGlyph[] {
  const out: TerrainGlyph[] = [];
  TERRAIN_FIELDS.forEach((campo, idx) => {
    const xs = campo.poly.map(p => p[0]);
    const ys = campo.poly.map(p => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];

    for (let y = y0; y <= y1; y += campo.step) {
      // Linhas alternadas entram meio passo: evita colunas alinhadas.
      const offset = (Math.round((y - y0) / campo.step) % 2) * campo.step * 0.5;
      for (let x = x0 + offset; x <= x1; x += campo.step) {
        const jx = x + (jitter(x, y, idx) - 0.5) * campo.step * 0.55;
        const jy = y + (jitter(x, y, idx + 97) - 0.5) * campo.step * 0.55;
        if (!pointInTerrainField(jx, jy, campo.poly)) continue;
        out.push({
          kind: campo.kind,
          x: Math.round(jx * 10) / 10,
          y: Math.round(jy * 10) / 10,
          s: 0.8 + jitter(x, y, idx + 331) * 0.45,
        });
      }
    }
  });
  return out;
}

export const TERRAIN_GLYPHS: TerrainGlyph[] = buildTerrain();

// ---------------------------------------------------------------------------
// Posições dos locais
// ---------------------------------------------------------------------------

/** Locais com posição canônica conhecida. */
const NAMED_POINTS: Record<string, Point> = {
  // Norte
  winterfell: { x: 424, y: 432 },
  castle_black: { x: 432, y: 198 },
  eastwatch: { x: 606, y: 198 },
  shadow_tower: { x: 268, y: 198 },
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
/**
 * Rótulos dos reinos.
 *
 * Ficam deliberadamente em vazios de mapa — costa, mar interior, canto de
 * região — e não no centroide. O centroide é exatamente onde os castelos se
 * acumulam, e o nome do reino saía cortado por três nomes de local. "Terras da
 * Coroa" e "Terras da Tempestade" foram para o mar à direita pelo mesmo motivo:
 * são regiões pequenas e cheias, sem vão interno que caiba o nome.
 */
export const REGION_LABELS: Record<string, Point> = {
  north: { x: 250, y: 420 },
  vale: { x: 800, y: 700 },
  riverlands: { x: 476, y: 686 },
  iron_islands: { x: 176, y: 606 },
  westerlands: { x: 322, y: 968 },
  crownlands: { x: 836, y: 792 },
  reach: { x: 424, y: 1112 },
  stormlands: { x: 700, y: 1104 },
  dorne: { x: 610, y: 1306 },
};
