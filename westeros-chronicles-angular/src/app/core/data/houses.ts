import { HouseDef } from '../models';
import { EXTRA_HOUSES } from './expanded';

/**
 * Observação prática:
 * - É impossível listar "todas" as casas conhecidas em um único arquivo curto sem virar uma enciclopédia.
 * - Aqui vai um conjunto grande e coerente (Grandes Casas + dezenas de vassalas relevantes por região),
 *   com IDs estáveis para você expandir facilmente.
 *
 * Para adicionar mais casas: inclua um item novo e (opcionalmente) defina suzerainId.
 */
const BASE_HOUSES: HouseDef[] = [
  // Trono de Ferro (casa governante dos 9 reinos)
  { id: 'targaryen_throne', name: 'Casa Targaryen (Trono de Ferro)', regionId: 'crownlands', seatLocationId: 'kings_landing', prestigeBase: 98, isIronThrone: true },

  // Casa rebelde/pretendente (Blackfyre) — assento próprio para cumprir a regra de castelo único
  { id: 'blackfyre', name: 'Casa Blackfyre', regionId: 'crownlands', seatLocationId: 'blackfyre_hold', prestigeBase: 70 },

  // Grandes Casas (suseranas regionais)
  { id: 'stark', name: 'Casa Stark', regionId: 'north', seatLocationId: 'winterfell', prestigeBase: 90, suzerainId: 'targaryen_throne' },
  { id: 'arryn', name: 'Casa Arryn', regionId: 'vale', seatLocationId: 'eyrie', prestigeBase: 88, suzerainId: 'targaryen_throne' },
  { id: 'tully', name: 'Casa Tully', regionId: 'riverlands', seatLocationId: 'riverrun', prestigeBase: 87, suzerainId: 'targaryen_throne' },
  { id: 'greyjoy', name: 'Casa Greyjoy', regionId: 'iron_islands', seatLocationId: 'pyke', prestigeBase: 86, suzerainId: 'targaryen_throne' },
  { id: 'lannister', name: 'Casa Lannister', regionId: 'westerlands', seatLocationId: 'casterly_rock', prestigeBase: 92, suzerainId: 'targaryen_throne' },
  { id: 'baratheon', name: 'Casa Baratheon', regionId: 'stormlands', seatLocationId: 'storms_end', prestigeBase: 89, suzerainId: 'targaryen_throne' },
  { id: 'tyrell', name: 'Casa Tyrell', regionId: 'reach', seatLocationId: 'highgarden', prestigeBase: 91, suzerainId: 'targaryen_throne' },
  { id: 'martell', name: 'Casa Martell', regionId: 'dorne', seatLocationId: 'sunspear', prestigeBase: 88, suzerainId: 'targaryen_throne' },

  // Terras da Coroa (casas importantes locais, diretamente sob o Trono)
  { id: 'velaryon', name: 'Casa Velaryon', regionId: 'crownlands', seatLocationId: 'driftmark', prestigeBase: 78, suzerainId: 'targaryen_throne' },
  { id: 'celtigar', name: 'Casa Celtigar', regionId: 'crownlands', seatLocationId: 'claw_isle', prestigeBase: 62, suzerainId: 'targaryen_throne' },
  { id: 'massey', name: 'Casa Massey', regionId: 'crownlands', seatLocationId: 'duskendale', prestigeBase: 55, suzerainId: 'targaryen_throne' },
  { id: 'bar_emmon', name: 'Casa Bar Emmon', regionId: 'crownlands', seatLocationId: 'sharp_point', prestigeBase: 50, suzerainId: 'targaryen_throne' },

  // O Norte (vassalas de Stark)
  { id: 'bolton', name: 'Casa Bolton', regionId: 'north', seatLocationId: 'dreadfort', prestigeBase: 70, suzerainId: 'stark' },
  { id: 'manderly', name: 'Casa Manderly', regionId: 'north', seatLocationId: 'white_harbor', prestigeBase: 72, suzerainId: 'stark' },
  { id: 'umber', name: 'Casa Umber', regionId: 'north', seatLocationId: 'last_hearth', prestigeBase: 62, suzerainId: 'stark' },
  { id: 'karstark', name: 'Casa Karstark', regionId: 'north', seatLocationId: 'karhold', prestigeBase: 58, suzerainId: 'stark' },
  { id: 'mormont', name: 'Casa Mormont', regionId: 'north', seatLocationId: 'bear_island', prestigeBase: 45, suzerainId: 'stark' },
  { id: 'glover', name: 'Casa Glover', regionId: 'north', seatLocationId: 'deepwood_motte', prestigeBase: 44, suzerainId: 'stark' },
  { id: 'reed', name: 'Casa Reed', regionId: 'north', seatLocationId: 'greywater_watch', prestigeBase: 40, suzerainId: 'stark' },
  { id: 'hornwood', name: 'Casa Hornwood', regionId: 'north', seatLocationId: 'hornwood_castle', prestigeBase: 38, suzerainId: 'stark' },
  { id: 'tallhart', name: 'Casa Tallhart', regionId: 'north', seatLocationId: 'torrhens_square', prestigeBase: 36, suzerainId: 'stark' },
  { id: 'cerwyn', name: 'Casa Cerwyn', regionId: 'north', seatLocationId: 'castle_cerwyn', prestigeBase: 34, suzerainId: 'stark' },

  // Vale (vassalas de Arryn)
  { id: 'royce', name: 'Casa Royce', regionId: 'vale', seatLocationId: 'runestone', prestigeBase: 70, suzerainId: 'arryn' },
  { id: 'corbray', name: 'Casa Corbray', regionId: 'vale', seatLocationId: 'hearts_home', prestigeBase: 60, suzerainId: 'arryn' },
  { id: 'waynwood', name: 'Casa Waynwood', regionId: 'vale', seatLocationId: 'ironoaks', prestigeBase: 58, suzerainId: 'arryn' },
  { id: 'grafton', name: 'Casa Grafton', regionId: 'vale', seatLocationId: 'gulltown', prestigeBase: 55, suzerainId: 'arryn' },
  { id: 'redfort', name: 'Casa Redfort', regionId: 'vale', seatLocationId: 'redfort_castle', prestigeBase: 50, suzerainId: 'arryn' },
  { id: 'hunter', name: 'Casa Hunter', regionId: 'vale', seatLocationId: 'longbow_hall', prestigeBase: 45, suzerainId: 'arryn' },
  { id: 'sunderland', name: 'Casa Sunderland', regionId: 'vale', seatLocationId: 'three_sisters', prestigeBase: 42, suzerainId: 'arryn' },
  { id: 'baelish', name: 'Casa Baelish', regionId: 'vale', seatLocationId: 'baelish_tower', prestigeBase: 28, suzerainId: 'arryn' },

  // Terras Fluviais (vassalas de Tully)
  { id: 'frey', name: 'Casa Frey', regionId: 'riverlands', seatLocationId: 'the_twins', prestigeBase: 68, suzerainId: 'tully' },
  { id: 'whent', name: 'Casa Whent', regionId: 'riverlands', seatLocationId: 'harrenhal', prestigeBase: 58, suzerainId: 'tully' },
  { id: 'blackwood', name: 'Casa Blackwood', regionId: 'riverlands', seatLocationId: 'raventree_hall', prestigeBase: 62, suzerainId: 'tully' },
  { id: 'bracken', name: 'Casa Bracken', regionId: 'riverlands', seatLocationId: 'stone_hedge', prestigeBase: 58, suzerainId: 'tully' },
  { id: 'mallister', name: 'Casa Mallister', regionId: 'riverlands', seatLocationId: 'seagard', prestigeBase: 60, suzerainId: 'tully' },
  { id: 'mooton', name: 'Casa Mooton', regionId: 'riverlands', seatLocationId: 'maidenpool', prestigeBase: 50, suzerainId: 'tully' },
  { id: 'darry', name: 'Casa Darry', regionId: 'riverlands', seatLocationId: 'darry_castle', prestigeBase: 44, suzerainId: 'tully' },
  { id: 'piper', name: 'Casa Piper', regionId: 'riverlands', seatLocationId: 'pinkmaiden', prestigeBase: 40, suzerainId: 'tully' },

  // Ilhas de Ferro (vassalas de Greyjoy)
  { id: 'harlaw', name: 'Casa Harlaw', regionId: 'iron_islands', seatLocationId: 'ten_towers', prestigeBase: 60, suzerainId: 'greyjoy' },
  { id: 'botley', name: 'Casa Botley', regionId: 'iron_islands', seatLocationId: 'lordsport', prestigeBase: 45, suzerainId: 'greyjoy' },
  { id: 'goodbrother', name: 'Casa Goodbrother', regionId: 'iron_islands', seatLocationId: 'hammerhorn', prestigeBase: 44, suzerainId: 'greyjoy' },
  { id: 'drumm', name: 'Casa Drumm', regionId: 'iron_islands', seatLocationId: 'old_wyk', prestigeBase: 42, suzerainId: 'greyjoy' },
  { id: 'blacktyde', name: 'Casa Blacktyde', regionId: 'iron_islands', seatLocationId: 'blacktyde_keep', prestigeBase: 36, suzerainId: 'greyjoy' },

  // Terras Ocidentais (vassalas de Lannister)
  { id: 'clegane', name: 'Casa Clegane', regionId: 'westerlands', seatLocationId: 'cleganes_keep', prestigeBase: 38, suzerainId: 'lannister' },
  { id: 'crakehall', name: 'Casa Crakehall', regionId: 'westerlands', seatLocationId: 'crakehall_castle', prestigeBase: 55, suzerainId: 'lannister' },
  { id: 'marbrand', name: 'Casa Marbrand', regionId: 'westerlands', seatLocationId: 'ashemark', prestigeBase: 52, suzerainId: 'lannister' },
  { id: 'lefford', name: 'Casa Lefford', regionId: 'westerlands', seatLocationId: 'golden_tooth', prestigeBase: 48, suzerainId: 'lannister' },
  { id: 'swyft', name: 'Casa Swyft', regionId: 'westerlands', seatLocationId: 'cornfield', prestigeBase: 44, suzerainId: 'lannister' },
  { id: 'brax', name: 'Casa Brax', regionId: 'westerlands', seatLocationId: 'hornvale', prestigeBase: 40, suzerainId: 'lannister' },

  // Terras da Tempestade (vassalas de Baratheon)
  { id: 'dondarrion', name: 'Casa Dondarrion', regionId: 'stormlands', seatLocationId: 'blackhaven', prestigeBase: 50, suzerainId: 'baratheon' },
  { id: 'tarth_house', name: 'Casa Tarth', regionId: 'stormlands', seatLocationId: 'tarth', prestigeBase: 52, suzerainId: 'baratheon' },
  { id: 'selmy', name: 'Casa Selmy', regionId: 'stormlands', seatLocationId: 'harvest_hall', prestigeBase: 44, suzerainId: 'baratheon' },
  { id: 'swann', name: 'Casa Swann', regionId: 'stormlands', seatLocationId: 'stonehelm', prestigeBase: 46, suzerainId: 'baratheon' },
  { id: 'connington', name: 'Casa Connington', regionId: 'stormlands', seatLocationId: 'griffins_roost', prestigeBase: 48, suzerainId: 'baratheon' },
  { id: 'estermont', name: 'Casa Estermont', regionId: 'stormlands', seatLocationId: 'greenstone', prestigeBase: 40, suzerainId: 'baratheon' },
  { id: 'penrose', name: 'Casa Penrose', regionId: 'stormlands', seatLocationId: 'parchments', prestigeBase: 36, suzerainId: 'baratheon' },
  { id: 'caron', name: 'Casa Caron', regionId: 'stormlands', seatLocationId: 'nightsong', prestigeBase: 42, suzerainId: 'baratheon' },

  // A Campina (vassalas de Tyrell)
  { id: 'hightower', name: 'Casa Hightower', regionId: 'reach', seatLocationId: 'oldtown', prestigeBase: 78, suzerainId: 'tyrell' },
  { id: 'tarly', name: 'Casa Tarly', regionId: 'reach', seatLocationId: 'horn_hill', prestigeBase: 65, suzerainId: 'tyrell' },
  { id: 'redwyne', name: 'Casa Redwyne', regionId: 'reach', seatLocationId: 'the_arbor', prestigeBase: 62, suzerainId: 'tyrell' },
  { id: 'florent', name: 'Casa Florent', regionId: 'reach', seatLocationId: 'brightwater_keep', prestigeBase: 58, suzerainId: 'tyrell' },
  { id: 'rowan', name: 'Casa Rowan', regionId: 'reach', seatLocationId: 'goldengrove', prestigeBase: 54, suzerainId: 'tyrell' },
  { id: 'oakheart', name: 'Casa Oakheart', regionId: 'reach', seatLocationId: 'old_oak', prestigeBase: 50, suzerainId: 'tyrell' },
  { id: 'beesbury', name: 'Casa Beesbury', regionId: 'reach', seatLocationId: 'honeyholt', prestigeBase: 36, suzerainId: 'tyrell' },

  // Dorne (vassalas de Martell)
  { id: 'yronwood', name: 'Casa Yronwood', regionId: 'dorne', seatLocationId: 'yronwood_castle', prestigeBase: 70, suzerainId: 'martell' },
  { id: 'dayne', name: 'Casa Dayne', regionId: 'dorne', seatLocationId: 'starfall', prestigeBase: 68, suzerainId: 'martell' },
  { id: 'fowler', name: 'Casa Fowler', regionId: 'dorne', seatLocationId: 'skyreach', prestigeBase: 52, suzerainId: 'martell' },
  { id: 'uller', name: 'Casa Uller', regionId: 'dorne', seatLocationId: 'hellholt', prestigeBase: 44, suzerainId: 'martell' },
  { id: 'qorgyle', name: 'Casa Qorgyle', regionId: 'dorne', seatLocationId: 'sandstone', prestigeBase: 40, suzerainId: 'martell' },
  { id: 'manwoody', name: 'Casa Manwoody', regionId: 'dorne', seatLocationId: 'kingsgrave', prestigeBase: 38, suzerainId: 'martell' },
  { id: 'jordayne', name: 'Casa Jordayne', regionId: 'dorne', seatLocationId: 'the_tor', prestigeBase: 36, suzerainId: 'martell' },
];

// Export final: base + expansão (centenas de casas)
export const HOUSES: HouseDef[] = [
  ...BASE_HOUSES,
  ...EXTRA_HOUSES,
];
