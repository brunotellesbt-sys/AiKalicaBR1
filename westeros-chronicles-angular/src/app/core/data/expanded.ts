import { HouseDef, Location } from '../models';

/**
 * Mundo expandido (centenas de casas e feudos)
 *
 * Objetivo:
 * - aumentar o “mapa político” sem transformar o projeto em uma enciclopédia manual.
 * - manter IDs estáveis (determinísticos) para que saves não quebrem.
 *
 * Observação:
 * - As listas abaixo misturam casas canônicas (quando conhecidas) e feudos menores “genéricos”.
 * - Você pode trocar/editar nomes livremente — desde que mantenha os IDs.
 */

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function strHash(s: string): number {
  // hash simples e determinístico (não criptográfico)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type RegionCfg = {
  regionId: string;
  suzerainId: string;
  names: string[];
};

// Listas por região. (Evite repetir nomes já presentes em houses.ts base.)
const REGION_HOUSE_NAMES: RegionCfg[] = [
  {
    regionId: 'north',
    suzerainId: 'stark',
    names: [
      'Dustin', 'Ryswell', 'Flint', 'Locke', 'Wull', 'Norrey', 'Liddle', 'Burley', 'Cassel', 'Forrester', 'Poole', 'Stout',
      'Mazin', 'Branch', 'Magnar', 'Moss', 'Fenn', 'Slate', 'Woods', 'Lake', 'Ash', 'Ice', 'Snowford', 'Crowl',
    ],
  },
  {
    regionId: 'vale',
    suzerainId: 'arryn',
    names: [
      'Belmore', 'Templeton', 'Egen', 'Lynderly', 'Coldwater', 'Hersy', 'Moore', 'Upcliff', 'Shett', 'Waxley', 'Melcolm', 'Tollet',
      'Hardyng', 'Pryor', 'Longthorpe', 'Baelish', 'Donniger', 'Sartoris', 'Borrell', 'Swayne', 'Uffering', 'Stone', 'Wydman', 'Giles',
    ],
  },
  {
    regionId: 'riverlands',
    suzerainId: 'tully',
    names: [
      'Whent', 'Vance', 'Vypren', 'Smallwood', 'Roote', 'Ryger', 'Lychester', 'Charlton', 'Keath', 'Paege', 'Mudd', 'Goodbrook',
      'Terrick', 'Haigh', 'Fisher', 'Mallery', 'Nayland', 'Holloway', 'Wode', 'Heddle', 'Byrch', 'Greystark', 'Brune (Rios)', 'Darry (Cadete)',
    ],
  },
  {
    regionId: 'iron_islands',
    suzerainId: 'greyjoy',
    names: [
      'Farwynd', 'Volmark', 'Tawney', 'Sunderly', 'Orkwood', 'Saltcliffe', 'Sharp', 'Merlyn', 'Stonetree', 'Wynch', 'Goodbrother (Cadete)', 'Drumm (Cadete)',
      'Humblestone', 'Ironmaker', 'Blackwater', 'Seastone', 'Nettle', 'Crow', 'Skane', 'Grim', 'Greyiron', 'Harlaw (Cadete)', 'Seawolf', 'Brine',
    ],
  },
  {
    regionId: 'westerlands',
    suzerainId: 'lannister',
    names: [
      'Payne', 'Lydden', 'Prester', 'Westerling', 'Serrett', 'Plumm', 'Farman', 'Reyne', 'Banefort', 'Tarbeck', 'Lannett', 'Clifton',
      'Stackspear', 'Kyndall', 'Jast', 'Sarsfield', 'Spicer', 'Estren', 'Turnberry', 'Slaine', 'Doggett', 'Lefford (Cadete)', 'Swyft (Cadete)', 'Marbrand (Cadete)',
    ],
  },
  {
    regionId: 'crownlands',
    suzerainId: 'targaryen_throne',
    names: [
      'Rosby', 'Stokeworth', 'Rykker', 'Wendwater', 'Staunton', 'Hayford', 'Brune', 'Thorne', 'Buckwell', 'Sunglass', 'Gaunt', 'Cave',
      'Crabb', 'Hardy', 'Manning', 'Bywater', 'Kettleblack', 'Pyne', 'Chelsted', 'Pyle', 'Langward', 'Farring', 'Chase', 'Hogg',
    ],
  },
  {
    regionId: 'stormlands',
    suzerainId: 'baratheon',
    names: [
      'Wylde', 'Fell', 'Morrigen', 'Grandison', 'Errol', 'Cafferen', 'Trant', 'Lonmouth', 'Seaworth', 'Carroway', 'Cole', 'Peasebury',
      'Tudbury', 'Wagstaff', 'Kellington', 'Storm', 'Mertyns', 'Whitehead', 'Musgood', 'Sharpstone', 'Selmy (Cadete)', 'Swann (Cadete)', 'Connington (Cadete)', 'Brune (Tempestade)',
    ],
  },
  {
    regionId: 'reach',
    suzerainId: 'tyrell',
    names: [
      'Fossoway', 'Merryweather', 'Crane', 'Bulwer', 'Caswell', 'Ashford', 'Ball', 'Cuy', 'Meadows', 'Mullendore', 'Peake', 'Vyrwel',
      'Webber', 'Chester', 'Hunt', 'Sloane', 'Osgrey', 'Footly', 'Norridge', 'Kidwell', 'Grimm', 'Hightower (Cadete)', 'Tarly (Cadete)', 'Redwyne (Cadete)',
    ],
  },
  {
    regionId: 'dorne',
    suzerainId: 'martell',
    names: [
      'Allyrion', 'Santagar', 'Vaith', 'Wyl', 'Toland', 'Gargalen', 'Dalt', 'Blackmont', 'Drinkwater', 'Ladybright', 'Wells', 'Sand',
      'Dune', 'Bright', 'Stone', 'Suns', 'Crown', 'Spear', 'Cinder', 'Jordayne (Cadete)', 'Manwoody (Cadete)', 'Qorgyle (Cadete)', 'Uller (Cadete)', 'Saltcliffe (Dorne)',
    ],
  },
];

// Gera feudos (localizações) e casas a partir da lista acima.
export const EXTRA_LOCATIONS: Location[] = [];
export const EXTRA_HOUSES: HouseDef[] = [];

for (const cfg of REGION_HOUSE_NAMES) {
  const n = cfg.names.length;
  for (let i = 0; i < n; i++) {
    const raw = cfg.names[i];
    const clean = raw.replace(/\s*\(.*\)\s*/g, '').trim();
    const slug = slugify(`${cfg.regionId}_${clean}`);

    // 70..28 (com jitter determinístico)
    const base = Math.round(70 - (70 - 28) * (i / Math.max(1, n - 1)));
    const jitter = (strHash(slug) % 9) - 4; // -4..+4
    const prestigeBase = clamp(base + jitter, 24, 72);

    const seatId = `keep_${slug}`;
    const houseId = `house_${slug}`;

    EXTRA_LOCATIONS.push({
      id: seatId,
      name: `Castelo ${clean}`,
      regionId: cfg.regionId,
      kind: 'fortress',
    });

    EXTRA_HOUSES.push({
      id: houseId,
      name: `Casa ${clean}`,
      regionId: cfg.regionId,
      seatLocationId: seatId,
      prestigeBase,
      suzerainId: cfg.suzerainId,
    });
  }
}
