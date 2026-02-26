import { Gender } from '../models';

/**
 * Pacote canônico ("história real").
 *
 * Regra prática do jogo:
 * - Ano 150, Turno 1 = absoluteTurn 1
 * - absoluteTurn = (year - 150) * 20 + turn
 */

export function absTurn(year: number, turn: number = 10): number {
  return (year - 150) * 20 + turn;
}

export interface CanonPersonDef {
  canonId: string;
  name: string;
  gender: Gender;

  // Ano/turno de nascimento (quando conhecido).
  birthYear?: number;
  birthTurn?: number; // 1..20 (padrão 10)

  // Quando o material só dá um intervalo (ex.: 191–194), use min/max.
  birthYearMin?: number;
  birthYearMax?: number;

  // Ano/turno de morte (quando conhecido) — usado para "proteger" contra morte aleatória.
  deathYear?: number;
  deathTurn?: number;

  // Intervalo de morte quando não há precisão (ex.: 179–184).
  deathYearMin?: number;
  deathYearMax?: number;

  // Casas
  birthHouseId?: string;
  currentHouseId: string;

  // Onde começa / onde costuma estar quando criada (use apenas ids existentes em regions.ts)
  locationId?: string;

  // Parentesco direto
  fatherCanonId?: string;
  motherCanonId?: string;
  spouseCanonId?: string;

  title?: string;
}

export interface CanonLeaderMandate {
  id: string;
  houseId: string;
  leaderCanonId: string;
  fromYear: number;
  fromTurn: number;
  toYear?: number;
  toTurn?: number;
}

export interface CanonWarDef {
  id: string;
  name: string;
  fromYear: number;
  fromTurn: number;
  toYear?: number;
  toTurn?: number;

  // Participantes (por HouseId do jogo)
  sideAHouseIds: string[];
  sideBHouseIds: string[];

  intensity: 'low' | 'medium' | 'high';
  tags: string[];
}

export type CanonEventKind = 'chronicle' | 'birth' | 'death' | 'succession' | 'tournament' | 'dynasty_shift';

export interface CanonEventDef {
  id: string;
  year: number;
  turn: number; // 1..20
  kind: CanonEventKind;
  title: string;
  body: string;
  tags: string[];

  // Payloads
  personCanonId?: string;
  houseId?: string;
  newLeaderCanonId?: string;

  tournament?: {
    hostHouseId?: string;
    locationId: string;
    label: string;
  };

  dynasty?: {
    ironThroneHouseName: string;
  };
}

/**
 * "Canônico" aqui significa: fatos registrados no período 150–305 DC (Após a Conquista),
 * com a simulação preenchendo lacunas (casas menores, anos sem registro, etc.).
 *
 * Observação: o mundo do jogo (mapa) contém apenas localizações principais de Westeros.
 * Eventos em Essos aparecem na crônica, mas personagens permanecem em localizações válidas do mapa.
 */

export const CANON_PEOPLE: CanonPersonDef[] = [
  // --- Âncoras de 150 DC (início do jogo) ---
  { canonId: 'cregan_stark', name: 'Cregan Stark', gender: 'M', birthYear: 108, deathYearMin: 157, deathYearMax: 209, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', title: 'Lorde de Winterfell' },
  { canonId: 'lyonel_tyrell', name: 'Lyonel Tyrell', gender: 'M', deathYear: 160, deathTurn: 18, birthHouseId: 'tyrell', currentHouseId: 'tyrell', locationId: 'highgarden', title: 'Lorde de Jardim de Cima' },

  { canonId: 'aegon_iii', name: 'Aegon III Targaryen', gender: 'M', birthYear: 120, deathYear: 157, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Rei' },
  { canonId: 'daenaera', name: 'Daenaera Velaryon', gender: 'F', birthYear: 127, birthHouseId: 'velaryon', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', spouseCanonId: 'aegon_iii', title: 'Rainha Consorte' },
  { canonId: 'viserys_ii', name: 'Viserys II Targaryen', gender: 'M', birthYear: 122, deathYear: 172, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Rei' },
  { canonId: 'daeron_i', name: 'Daeron I Targaryen', gender: 'M', birthYear: 143, deathYear: 161, deathTurn: 12, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'aegon_iii', motherCanonId: 'daenaera', title: 'Rei' },
  { canonId: 'baelor_i', name: 'Baelor I Targaryen', gender: 'M', birthYear: 144, deathYear: 171, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'aegon_iii', motherCanonId: 'daenaera', title: 'Rei' },
  { canonId: 'daena', name: 'Daena Targaryen', gender: 'F', birthYear: 145, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'aegon_iii', motherCanonId: 'daenaera', title: 'Princesa' },
  { canonId: 'rhaena_daughter', name: 'Rhaena Targaryen', gender: 'F', birthYear: 147, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'aegon_iii', motherCanonId: 'daenaera', title: 'Princesa' },
  { canonId: 'naerys', name: 'Naerys Targaryen', gender: 'F', birthYear: 138, deathYear: 179, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', spouseCanonId: 'aegon_iv', title: 'Rainha Consorte' },
  { canonId: 'aemon_dragonknight', name: 'Aemon Targaryen (Dragonknight)', gender: 'M', birthYear: 136, deathYearMin: 178, deathYearMax: 183, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Príncipe / Lorde Comandante da Guarda Real' },
  { canonId: 'aegon_iv', name: 'Aegon IV Targaryen', gender: 'M', birthYear: 135, deathYear: 184, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'viserys_ii', spouseCanonId: 'naerys', title: 'Rei' },
  { canonId: 'daenerys_daughter_aegon_iv', name: 'Daenerys Targaryen (filha de Aegon IV)', gender: 'F', birthYear: 172, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'aegon_iv', motherCanonId: 'naerys', title: 'Princesa' },
  { canonId: 'daemon_blackfyre', name: 'Daemon I Blackfyre', gender: 'M', birthYear: 170, birthTurn: 18, deathYear: 196, deathTurn: 18, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', motherCanonId: 'daena', title: 'Grande Bastardo (Blackfyre)' },
  // Pretendentes Blackfyre posteriores (datas aproximadas quando necessário)
  { canonId: 'daemon_ii_blackfyre', name: 'Daemon II Blackfyre', gender: 'M', birthYearMin: 190, birthYearMax: 200, deathYear: 212, deathTurn: 10, birthHouseId: 'blackfyre', currentHouseId: 'blackfyre', locationId: 'riverrun', title: 'Pretendente Blackfyre' },
  { canonId: 'haegon_blackfyre', name: 'Haegon I Blackfyre', gender: 'M', birthYearMin: 200, birthYearMax: 210, deathYear: 219, deathTurn: 16, birthHouseId: 'blackfyre', currentHouseId: 'blackfyre', locationId: 'kings_landing', title: 'Pretendente Blackfyre' },
  { canonId: 'aenys_blackfyre', name: 'Aenys Blackfyre', gender: 'M', birthYearMin: 210, birthYearMax: 225, deathYear: 233, deathTurn: 8, birthHouseId: 'blackfyre', currentHouseId: 'blackfyre', locationId: 'kings_landing', title: 'Pretendente Blackfyre' },
  { canonId: 'daemon_iii_blackfyre', name: 'Daemon III Blackfyre', gender: 'M', birthYearMin: 210, birthYearMax: 220, deathYear: 236, deathTurn: 10, birthHouseId: 'blackfyre', currentHouseId: 'blackfyre', locationId: 'kings_landing', title: 'Pretendente Blackfyre' },
  { canonId: 'maelys_blackfyre', name: 'Maelys I Blackfyre', gender: 'M', birthYearMin: 235, birthYearMax: 245, deathYear: 260, deathTurn: 8, birthHouseId: 'blackfyre', currentHouseId: 'blackfyre', locationId: 'kings_landing', title: 'Pretendente Blackfyre' },
  { canonId: 'aegor_rivers', name: 'Aegor Rivers (Bittersteel)', gender: 'M', birthYear: 172, deathYear: 241, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Grande Bastardo' },
  { canonId: 'brynden_rivers', name: 'Brynden Rivers (Bloodraven)', gender: 'M', birthYear: 175, deathYear: 252, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Mão do Rei' },
  { canonId: 'shiera_seastar', name: 'Shiera Seastar', gender: 'F', birthYear: 175, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Grande Bastarda' },
  { canonId: 'daeron_ii', name: 'Daeron II Targaryen', gender: 'M', birthYear: 153, deathYear: 209, deathTurn: 18, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Rei' },
  { canonId: 'myriah_martell', name: 'Myriah Martell', gender: 'F', birthYearMin: 146, birthYearMax: 154, deathYearMin: 184, deathYearMax: 205, birthHouseId: 'martell', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', spouseCanonId: 'daeron_ii', title: 'Rainha Consorte' },
  { canonId: 'baelor_breakspear', name: 'Baelor Targaryen (Breakspear)', gender: 'M', birthYear: 170, deathYear: 209, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'daeron_ii', title: 'Príncipe / Mão do Rei' },
  { canonId: 'valarr', name: 'Valarr Targaryen', gender: 'M', birthYear: 183, deathYear: 209, deathTurn: 18, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'baelor_breakspear', title: 'Príncipe' },
  { canonId: 'matarys', name: 'Matarys Targaryen', gender: 'M', birthYear: 186, deathYear: 209, deathTurn: 18, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'baelor_breakspear', title: 'Príncipe' },
  { canonId: 'aerys_i', name: 'Aerys I Targaryen', gender: 'M', birthYear: 172, deathYear: 221, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'daeron_ii', title: 'Rei' },
  { canonId: 'rhaegel_targaryen', name: 'Rhaegel Targaryen', gender: 'M', birthYearMin: 173, birthYearMax: 178, deathYear: 215, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'daeron_ii', motherCanonId: 'myriah_martell', title: 'Príncipe de Pedra do Dragão' },
  { canonId: 'alys_arryn_rhaegel', name: 'Alys Arryn', gender: 'F', birthHouseId: 'arryn', currentHouseId: 'targaryen_throne', locationId: 'eyrie', spouseCanonId: 'rhaegel_targaryen', title: 'Lady' },
  { canonId: 'aelor_targaryen', name: 'Aelor Targaryen', gender: 'M', birthYearMin: 195, birthYearMax: 211, deathYear: 217, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'rhaegel_targaryen', motherCanonId: 'alys_arryn_rhaegel', spouseCanonId: 'aelora_targaryen', title: 'Príncipe de Pedra do Dragão' },
  { canonId: 'aelora_targaryen', name: 'Aelora Targaryen', gender: 'F', birthYearMin: 195, birthYearMax: 211, deathYearMin: 217, deathYearMax: 221, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'rhaegel_targaryen', motherCanonId: 'alys_arryn_rhaegel', spouseCanonId: 'aelor_targaryen', title: 'Princesa' },
  { canonId: 'maekar_i', name: 'Maekar I Targaryen', gender: 'M', birthYear: 187, deathYear: 233, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'daeron_ii', title: 'Rei' },
  { canonId: 'aerion_brightflame', name: 'Aerion Targaryen (Brightflame)', gender: 'M', birthYearMin: 191, birthYearMax: 194, deathYear: 232, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'maekar_i', title: 'Príncipe' },
  { canonId: 'aemon_maester', name: 'Aemon Targaryen (Maester Aemon)', gender: 'M', birthYear: 198, deathYear: 300, deathTurn: 16, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'castle_black', fatherCanonId: 'maekar_i', title: 'Meistre (Patrulha da Noite)' },
  { canonId: 'aegon_v', name: 'Aegon V Targaryen', gender: 'M', birthYear: 200, deathYear: 259, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Rei' },
  { canonId: 'betha_blackwood', name: 'Betha Blackwood', gender: 'F', birthYearMin: 198, birthYearMax: 206, deathYearMin: 259, deathYearMax: 270, birthHouseId: 'blackwood', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', spouseCanonId: 'aegon_v', title: 'Rainha Consorte' },
  { canonId: 'duncan_small', name: 'Duncan Targaryen (the Small)', gender: 'M', birthYearMin: 221, birthYearMax: 224, deathYear: 259, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', fatherCanonId: 'aegon_v', motherCanonId: 'betha_blackwood', locationId: 'kings_landing', title: 'Príncipe' },
  { canonId: 'shaera', name: 'Shaera Targaryen', gender: 'F', birthYearMin: 226, birthYearMax: 229, deathYearMin: 274, deathYearMax: 286, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', fatherCanonId: 'aegon_v', motherCanonId: 'betha_blackwood', locationId: 'kings_landing', title: 'Princesa' },
  { canonId: 'daeron_son_aegon_v', name: 'Daeron Targaryen (filho de Aegon V)', gender: 'M', birthYearMin: 228, birthYearMax: 232, deathYear: 251, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', fatherCanonId: 'aegon_v', motherCanonId: 'betha_blackwood', locationId: 'kings_landing', title: 'Príncipe' },
  { canonId: 'rhaelle_targaryen', name: 'Rhaelle Targaryen', gender: 'F', birthYearMin: 229, birthYearMax: 232, deathYearMin: 249, deathYearMax: 260, birthHouseId: 'targaryen_throne', currentHouseId: 'baratheon', fatherCanonId: 'aegon_v', motherCanonId: 'betha_blackwood', locationId: 'storms_end', spouseCanonId: 'ormund_baratheon', title: 'Lady' },
  { canonId: 'ormund_baratheon', name: 'Ormund Baratheon', gender: 'M', birthYearMin: 220, birthYearMax: 230, deathYear: 260, deathTurn: 10, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'storms_end', spouseCanonId: 'rhaelle_targaryen', title: 'Lorde de Ponta Tempestade' },
  { canonId: 'steffon_baratheon', name: 'Steffon Baratheon', gender: 'M', birthYear: 246, birthTurn: 10, deathYear: 278, deathTurn: 10, birthHouseId: 'baratheon', currentHouseId: 'baratheon', fatherCanonId: 'ormund_baratheon', motherCanonId: 'rhaelle_targaryen', locationId: 'storms_end', spouseCanonId: 'cassana_estermont', title: 'Lorde de Ponta Tempestade' },
  { canonId: 'cassana_estermont', name: 'Cassana Estermont', gender: 'F', birthYearMin: 245, birthYearMax: 255, deathYear: 278, deathTurn: 10, birthHouseId: 'estermont', currentHouseId: 'baratheon', locationId: 'storms_end', spouseCanonId: 'steffon_baratheon', title: 'Lady' },
  { canonId: 'dunk', name: 'Ser Duncan the Tall', gender: 'M', birthYear: 180, deathYear: 259, deathTurn: 10, currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Cavaleiro' },
  { canonId: 'jaehaerys_ii', name: 'Jaehaerys II Targaryen', gender: 'M', birthYear: 225, deathYear: 262, deathTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Rei' },
  { canonId: 'aerys_ii', name: 'Aerys II Targaryen', gender: 'M', birthYear: 244, deathYear: 283, deathTurn: 15, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', title: 'Rei' },
  { canonId: 'rhaella', name: 'Rhaella Targaryen', gender: 'F', birthYear: 245, deathYear: 284, deathTurn: 18, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'dragonstone', title: 'Rainha' },
  { canonId: 'rhaegar', name: 'Rhaegar Targaryen', gender: 'M', birthYear: 259, birthTurn: 10, deathYear: 283, deathTurn: 14, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'dragonstone', fatherCanonId: 'aerys_ii', motherCanonId: 'rhaella', title: 'Príncipe de Pedra do Dragão' },
  { canonId: 'elia', name: 'Elia Martell', gender: 'F', birthYear: 257, deathYear: 283, deathTurn: 15, birthHouseId: 'martell', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', spouseCanonId: 'rhaegar', title: 'Princesa' },
  { canonId: 'rhaenys_child', name: 'Rhaenys Targaryen', gender: 'F', birthYear: 280, birthTurn: 10, deathYear: 283, deathTurn: 15, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'rhaegar', motherCanonId: 'elia', title: 'Princesa' },
  { canonId: 'aegon_son', name: 'Aegon Targaryen', gender: 'M', birthYear: 281, birthTurn: 8, deathYear: 283, deathTurn: 15, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'rhaegar', motherCanonId: 'elia', title: 'Príncipe' },
  { canonId: 'viserys_beggar', name: 'Viserys Targaryen', gender: 'M', birthYear: 276, deathYear: 298, deathTurn: 8, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'dragonstone', fatherCanonId: 'aerys_ii', motherCanonId: 'rhaella', title: 'Príncipe Exilado' },
  { canonId: 'daenerys', name: 'Daenerys Targaryen', gender: 'F', birthYear: 284, birthTurn: 18, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'dragonstone', fatherCanonId: 'aerys_ii', motherCanonId: 'rhaella', title: 'Princesa Exilada' },
  { canonId: 'robert', name: 'Robert I Baratheon', gender: 'M', birthYear: 262, deathYear: 298, deathTurn: 12, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'kings_landing', fatherCanonId: 'steffon_baratheon', motherCanonId: 'cassana_estermont', title: 'Rei' },
  { canonId: 'stannis', name: 'Stannis Baratheon', gender: 'M', birthYear: 264, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'storms_end', fatherCanonId: 'steffon_baratheon', motherCanonId: 'cassana_estermont', title: 'Lorde' },
  { canonId: 'renly', name: 'Renly Baratheon', gender: 'M', birthYear: 277, deathYear: 299, deathTurn: 7, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'storms_end', fatherCanonId: 'steffon_baratheon', motherCanonId: 'cassana_estermont', title: 'Lorde' },
  { canonId: 'tywin', name: 'Tywin Lannister', gender: 'M', birthYear: 242, deathYear: 300, deathTurn: 18, birthHouseId: 'lannister', currentHouseId: 'lannister', locationId: 'casterly_rock', title: 'Lorde de Casterly Rock' },
  { canonId: 'cersei', name: 'Cersei Lannister', gender: 'F', birthYear: 266, birthHouseId: 'lannister', currentHouseId: 'lannister', locationId: 'kings_landing', spouseCanonId: 'robert', title: 'Rainha Regente' },
  { canonId: 'jaime', name: 'Jaime Lannister', gender: 'M', birthYear: 266, birthHouseId: 'lannister', currentHouseId: 'lannister', locationId: 'kings_landing', title: 'Cavaleiro' },
  { canonId: 'tyrion', name: 'Tyrion Lannister', gender: 'M', birthYear: 273, birthHouseId: 'lannister', currentHouseId: 'lannister', locationId: 'kings_landing', title: 'Anão de Casterly Rock' },
  { canonId: 'kevan', name: 'Kevan Lannister', gender: 'M', birthYear: 244, deathYear: 300, deathTurn: 18, birthHouseId: 'lannister', currentHouseId: 'lannister', locationId: 'kings_landing', title: 'Lorde' },
  { canonId: 'joffrey', name: 'Joffrey I Baratheon', gender: 'M', birthYear: 286, deathYear: 300, deathTurn: 1, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'kings_landing', fatherCanonId: 'robert', motherCanonId: 'cersei', title: 'Rei' },
  { canonId: 'tommen', name: 'Tommen Baratheon', gender: 'M', birthYear: 291, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'kings_landing', fatherCanonId: 'robert', motherCanonId: 'cersei', title: 'Rei' },
  { canonId: 'eddard', name: 'Eddard Stark', gender: 'M', birthYear: 263, deathYear: 299, deathTurn: 10, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', title: 'Lorde de Winterfell' },
  { canonId: 'catelyn', name: 'Catelyn Tully', gender: 'F', birthYear: 264, deathYear: 299, deathTurn: 18, birthHouseId: 'tully', currentHouseId: 'stark', locationId: 'winterfell', spouseCanonId: 'eddard', title: 'Lady de Winterfell' },
  { canonId: 'rob_stark', name: 'Robb Stark', gender: 'M', birthYear: 283, deathYear: 299, deathTurn: 18, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', fatherCanonId: 'eddard', motherCanonId: 'catelyn', title: 'Rei no Norte' },
  { canonId: 'sansa', name: 'Sansa Stark', gender: 'F', birthYear: 286, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', fatherCanonId: 'eddard', motherCanonId: 'catelyn', title: 'Lady' },
  { canonId: 'arya', name: 'Arya Stark', gender: 'F', birthYear: 289, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', fatherCanonId: 'eddard', motherCanonId: 'catelyn', title: 'Lady' },
  { canonId: 'bran', name: 'Bran Stark', gender: 'M', birthYear: 290, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', fatherCanonId: 'eddard', motherCanonId: 'catelyn', title: 'Lorde' },
  { canonId: 'rickon', name: 'Rickon Stark', gender: 'M', birthYear: 295, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', fatherCanonId: 'eddard', motherCanonId: 'catelyn', title: 'Lorde' },
  { canonId: 'lyanna_stark', name: 'Lyanna Stark', gender: 'F', birthYear: 266, deathYear: 283, deathTurn: 20, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', title: 'Lady' },
  { canonId: 'brandon_stark', name: 'Brandon Stark', gender: 'M', birthYear: 262, deathYear: 282, deathTurn: 10, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', title: 'Herdeiro de Winterfell' },
  { canonId: 'rickard_stark', name: 'Rickard Stark', gender: 'M', birthYear: 234, deathYear: 282, deathTurn: 10, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', title: 'Lorde de Winterfell' },
  { canonId: 'jon_arryn', name: 'Jon Arryn', gender: 'M', birthYear: 219, deathYear: 298, deathTurn: 5, birthHouseId: 'arryn', currentHouseId: 'arryn', locationId: 'eyrie', title: 'Lorde do Ninho da Águia' },
  { canonId: 'lysa', name: 'Lysa Tully', gender: 'F', birthYear: 266, deathYear: 300, deathTurn: 12, birthHouseId: 'tully', currentHouseId: 'arryn', locationId: 'eyrie', spouseCanonId: 'jon_arryn', title: 'Lady do Vale' },
  { canonId: 'robert_arryn', name: 'Robert Arryn', gender: 'M', birthYear: 292, birthHouseId: 'arryn', currentHouseId: 'arryn', locationId: 'eyrie', fatherCanonId: 'jon_arryn', motherCanonId: 'lysa', title: 'Lorde do Vale' },
  { canonId: 'hoster', name: 'Hoster Tully', gender: 'M', birthYear: 231, deathYear: 299, deathTurn: 16, birthHouseId: 'tully', currentHouseId: 'tully', locationId: 'riverrun', title: 'Lorde de Riverrun' },
  { canonId: 'edmure', name: 'Edmure Tully', gender: 'M', birthYear: 267, birthHouseId: 'tully', currentHouseId: 'tully', locationId: 'riverrun', fatherCanonId: 'hoster', title: 'Herdeiro de Riverrun' },
  { canonId: 'balon', name: 'Balon Greyjoy', gender: 'M', birthYear: 254, deathYear: 299, deathTurn: 12, birthHouseId: 'greyjoy', currentHouseId: 'greyjoy', locationId: 'pyke', title: 'Lorde de Pyke' },
  { canonId: 'theon', name: 'Theon Greyjoy', gender: 'M', birthYear: 278, birthHouseId: 'greyjoy', currentHouseId: 'greyjoy', locationId: 'pyke', fatherCanonId: 'balon', title: 'Herdeiro' },
  { canonId: 'euron', name: 'Euron Greyjoy', gender: 'M', birthYear: 256, birthHouseId: 'greyjoy', currentHouseId: 'greyjoy', locationId: 'pyke', title: 'Capitão' },
  { canonId: 'mace', name: 'Mace Tyrell', gender: 'M', birthYearMin: 256, birthYearMax: 263, birthHouseId: 'tyrell', currentHouseId: 'tyrell', locationId: 'highgarden', title: 'Lorde de Jardim de Cima' },
  { canonId: 'margaery', name: 'Margaery Tyrell', gender: 'F', birthYear: 283, birthHouseId: 'tyrell', currentHouseId: 'tyrell', locationId: 'highgarden', title: 'Lady' },
  { canonId: 'loras', name: 'Loras Tyrell', gender: 'M', birthYear: 282, birthHouseId: 'tyrell', currentHouseId: 'tyrell', locationId: 'highgarden', title: 'Sor' },
  { canonId: 'doran', name: 'Doran Martell', gender: 'M', birthYear: 247, birthHouseId: 'martell', currentHouseId: 'martell', locationId: 'sunspear', title: 'Príncipe de Dorne' },
  { canonId: 'oberyn', name: 'Oberyn Martell', gender: 'M', birthYear: 258, deathYear: 300, deathTurn: 14, birthHouseId: 'martell', currentHouseId: 'martell', locationId: 'sunspear', title: 'Príncipe' },
  { canonId: 'brienne', name: 'Brienne of Tarth', gender: 'F', birthYear: 280, birthHouseId: 'tarth_house', currentHouseId: 'tarth_house', locationId: 'tarth', title: 'Lady' },
  { canonId: 'barristan', name: 'Barristan Selmy', gender: 'M', birthYear: 237, birthHouseId: 'selmy', currentHouseId: 'baratheon', locationId: 'kings_landing', title: 'Sor Barristan' },
  { canonId: 'elaena', name: 'Elaena Targaryen', gender: 'F', birthYear: 150, birthTurn: 10, birthHouseId: 'targaryen_throne', currentHouseId: 'targaryen_throne', locationId: 'kings_landing', fatherCanonId: 'aegon_iii', motherCanonId: 'daenaera', title: 'Princesa' },

  // --- Personagens centrais adicionais do período 298–300 ---
  { canonId: 'myrcella', name: 'Myrcella Baratheon', gender: 'F', birthYear: 290, birthHouseId: 'baratheon', currentHouseId: 'baratheon', locationId: 'kings_landing', fatherCanonId: 'robert', motherCanonId: 'cersei', title: 'Princesa' },
  { canonId: 'jon_snow', name: 'Jon Snow', gender: 'M', birthYear: 283, birthHouseId: 'stark', currentHouseId: 'stark', locationId: 'winterfell', title: 'Bastardo de Winterfell' },
  { canonId: 'roose_bolton', name: 'Roose Bolton', gender: 'M', birthYearMin: 250, birthYearMax: 270, birthHouseId: 'bolton', currentHouseId: 'bolton', locationId: 'dreadfort', title: 'Lorde do Forte do Pavor' },
  { canonId: 'ramsay_bolton', name: 'Ramsay Bolton', gender: 'M', birthYearMin: 273, birthYearMax: 283, birthHouseId: 'bolton', currentHouseId: 'bolton', locationId: 'dreadfort', title: 'Bastardo de Bolton' },
  { canonId: 'walder_frey', name: 'Walder Frey', gender: 'M', birthYear: 208, birthHouseId: 'frey', currentHouseId: 'frey', locationId: 'the_twins', title: 'Lorde da Ponte' },
  { canonId: 'petyr_baelish', name: 'Petyr Baelish', gender: 'M', birthYear: 268, birthHouseId: 'baelish', currentHouseId: 'arryn', locationId: 'kings_landing', title: 'Mestre da Moeda' }
];

// Pessoas que só existem para eventos pontuais (se necessário).
export const CANON_EVENT_ONLY_PEOPLE: CanonPersonDef[] = [
  // (vazio por enquanto)
];

export const CANON_EVENTS: CanonEventDef[] = [
  { title: 'Nascimento: Elaena Targaryen', id: '150_elaena_birth', year: 150, turn: 10, kind: 'chronicle', body: 'Nasce a princesa Elaena, filha de Aegon III.', tags: ['birth', 'targaryen', 'canon'], personCanonId: 'elaena' },
  { title: 'Início da Crônica', id: '150_start', year: 150, turn: 1, kind: 'chronicle', body: 'A simulação começa em 150 DC (Após a Conquista), no reinado de Aegon III.', tags: ['start', 'canon'] },
  { title: 'Morte do último dragão', id: '153_last_dragon', year: 153, turn: 10, kind: 'chronicle', body: 'O último dragão morre; a era dos dragões se encerra e restam apenas ovos não-eclodidos.', tags: ['canon', 'dragons'] },
  { title: 'Morte de Aegon III', id: '157_aegon_iii_death', year: 157, turn: 10, kind: 'chronicle', body: 'Morre Aegon III; o Trono de Ferro passa ao seu herdeiro.', tags: ['death', 'targaryen', 'throne', 'canon'], personCanonId: 'aegon_iii' },
  { title: 'Daeron I é coroado', id: '157_daeron_i_crowned', year: 157, turn: 10, kind: 'dynasty_shift', body: 'Daeron I assume o Trono de Ferro.', tags: ['succession', 'throne', 'targaryen', 'canon'], dynasty: { ironThroneHouseName: 'Casa Targaryen' } },
  { title: 'Daeron I assume como rei', id: '157_daeron_i_leader', year: 157, turn: 10, kind: 'succession', body: 'Transição de governo no Trono de Ferro.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'daeron_i' },
  { title: 'Conquista de Dorne', id: '157_dorne_conquest', year: 157, turn: 12, kind: 'chronicle', body: 'Daeron I anuncia a invasão de Dorne e inicia a campanha.', tags: ['war', 'dorne', 'canon'] },
  { title: 'Submissão de Lançassolar', id: '158_sunspear_submission', year: 158, turn: 12, kind: 'chronicle', body: 'Após a tomada de Lançassolar, nobres dorneses se submetem temporariamente à coroa.', tags: ['dorne', 'canon', 'politics'] },
  { title: 'Casamento real', id: '160_baelor_daena_marriage', year: 160, turn: 8, kind: 'chronicle', body: 'Baelor casa-se com Daena, embora o casamento não seja consumado.', tags: ['marriage', 'targaryen', 'canon'] },
  { title: 'Retorno a Dorne', id: '160_return_dorne', year: 160, turn: 12, kind: 'chronicle', body: 'Daeron retorna a Dorne para conter a insurgência.', tags: ['war', 'dorne', 'canon'] },
  { title: 'Morte de Lyonel Tyrell', id: '160_lyonel_tyrell_death', year: 160, turn: 18, kind: 'chronicle', body: 'Lyonel Tyrell é assassinado em Sandstone.', tags: ['death', 'tyrell', 'canon'] },
  { title: 'Assassinato de Daeron I', id: '161_daeron_i_death', year: 161, turn: 12, kind: 'chronicle', body: 'Daeron I é morto traiçoeiramente durante um encontro sob bandeira de paz.', tags: ['death', 'targaryen', 'canon'], personCanonId: 'daeron_i' },
  { title: 'Baelor torna-se rei', id: '161_baelor_crowned', year: 161, turn: 12, kind: 'succession', body: 'Baelor assume o Trono de Ferro e encerra a Conquista de Dorne.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'baelor_i' },
  { title: 'Paz com Dorne', id: '161_baelor_peace_dorne', year: 161, turn: 14, kind: 'chronicle', body: 'Baelor caminha descalço até Lançassolar e firma paz com os dorneses.', tags: ['dorne', 'canon', 'peace'] },
  { title: 'Noivado político', id: '161_betrothal_daeron_myriah', year: 161, turn: 16, kind: 'chronicle', body: 'O jovem príncipe Daeron é prometido a Myriah Martell como parte do acordo.', tags: ['marriage', 'dorne', 'canon'] },
  { title: 'A Câmara das Donzelas', id: '161_maidenvault', year: 161, turn: 18, kind: 'chronicle', body: 'As irmãs de Baelor são confinadas no Maidenvault.', tags: ['canon', 'religion'] },
  { title: 'Morte de Baelor I', id: '171_baelor_death', year: 171, turn: 10, kind: 'chronicle', body: 'Morre Baelor I; abre-se a sucessão do Trono de Ferro.', tags: ['death', 'targaryen', 'canon'], personCanonId: 'baelor_i' },
  { title: 'Viserys II é coroado', id: '171_viserys_ii_crowned', year: 171, turn: 10, kind: 'succession', body: 'Viserys II assume o Trono de Ferro.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'viserys_ii' },
  { title: 'Morte de Viserys II', id: '172_viserys_death', year: 172, turn: 10, kind: 'chronicle', body: 'Morre Viserys II; Aegon IV torna-se rei.', tags: ['death', 'canon', 'throne'], personCanonId: 'viserys_ii' },
  { title: 'Aegon IV é coroado', id: '172_aegon_iv_crowned', year: 172, turn: 10, kind: 'succession', body: 'Aegon IV assume o Trono de Ferro.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'aegon_iv' },
  { title: 'Casamento de Daemon Blackfyre', id: '184_daemon_marriage', year: 184, turn: 6, kind: 'chronicle', body: 'Daemon Blackfyre casa-se com Rohanne de Tyrosh.', tags: ['marriage', 'blackfyre', 'canon'] },
  { title: 'Os Grandes Bastardos', id: '184_great_bastards', year: 184, turn: 10, kind: 'chronicle', body: 'No leito de morte, Aegon IV legitima seus bastardos, semeando futuras rebeliões.', tags: ['politics', 'canon'] },
  { title: 'Morte de Aegon IV', id: '184_aegon_iv_death', year: 184, turn: 10, kind: 'chronicle', body: 'Morre Aegon IV.', tags: ['death', 'targaryen', 'canon'], personCanonId: 'aegon_iv' },
  { title: 'Daeron II é coroado', id: '184_daeron_ii_crowned', year: 184, turn: 10, kind: 'succession', body: 'Daeron II é coroado pelo Alto Septão e reestrutura o conselho.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'daeron_ii' },  { title: 'Dorne entra no Reino', id: '187_dorne_joins', year: 187, turn: 10, kind: 'chronicle', body: 'Dorne se une formalmente aos Sete Reinos através do casamento de Daenerys Targaryen (filha de Daeron II) com Maron Martell.', tags: ['canon', 'dorne', 'marriage'] },

  { title: 'Primeira Rebelião Blackfyre', id: '196_first_blackfyre', year: 196, turn: 18, kind: 'chronicle', body: 'A guerra culmina no Campo do Capim Vermelho; Daemon Blackfyre é morto e a pretensão é rechaçada.', tags: ['war', 'blackfyre', 'canon'] },
  { title: 'Torneio de Ashford', id: '209_ashford_tourney', year: 209, turn: 6, kind: 'tournament', body: 'Um grande torneio ocorre em Ashford.', tags: ['tournament', 'canon'], tournament: { locationId: 'highgarden', hostHouseId: 'targaryen_throne', label: 'Torneio de Ashford (canônico)' } },
  { title: 'Morte de Baelor Breakspear', id: '209_baelor_breakspear_death', year: 209, turn: 6, kind: 'chronicle', body: 'Baelor Breakspear morre após um acidente no torneio de Ashford.', tags: ['death', 'canon', 'targaryen'], personCanonId: 'baelor_breakspear' },
  { title: 'A Grande Doença da Primavera', id: '209_great_spring_sickness', year: 209, turn: 12, kind: 'chronicle', body: 'A epidemia começa e se espalha pelo reino, ceifando dezenas de milhares.', tags: ['plague', 'canon'] },
  { title: 'Morte de Daeron II', id: '209_daeron_ii_death', year: 209, turn: 18, kind: 'chronicle', body: 'Daeron II morre durante a Grande Doença da Primavera.', tags: ['death', 'canon', 'throne'], personCanonId: 'daeron_ii' },
  { title: 'Aerys I é coroado', id: '209_aerys_i_crowned', year: 209, turn: 18, kind: 'succession', body: 'Com a morte de Daeron II e de herdeiros diretos, Aerys I assume o Trono.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'aerys_i' },
  { title: 'Bloodraven torna-se Mão', id: '209_bloodraven_hand', year: 209, turn: 19, kind: 'chronicle', body: 'Brynden Rivers é nomeado Mão do Rei.', tags: ['politics', 'canon'] },
  { title: 'Seca e saques', id: '211_drought_raids', year: 211, turn: 10, kind: 'chronicle', body: 'Um verão de seca castiga o reino; Dagon Greyjoy intensifica seus ataques.', tags: ['iron_islands', 'canon'] },
  { title: 'Torneio de casamento em Whitewalls', id: '212_whitewalls_wedding_tourney', year: 212, turn: 8, kind: 'tournament', body: 'Um torneio de casamento serve de palco para uma conspiração Blackfyre.', tags: ['tournament', 'blackfyre', 'canon'], tournament: { locationId: 'riverrun', hostHouseId: 'targaryen_throne', label: 'Torneio de Whitewalls (canônico)' } },
  { title: 'Segunda Rebelião Blackfyre', id: '212_second_blackfyre', year: 212, turn: 10, kind: 'chronicle', body: 'A tentativa de levante em Whitewalls é esmagada por Bloodraven.', tags: ['war', 'blackfyre', 'canon'] },
  { title: 'Terceira Rebelião Blackfyre', id: '219_third_blackfyre', year: 219, turn: 16, kind: 'chronicle', body: 'Bittersteel retorna com Haegon Blackfyre; a invasão falha e o pretendente é morto.', tags: ['war', 'blackfyre', 'canon'] },  { title: 'Raymun Barba-Vermelha invade o Norte', id: '226_raymun_redbeard', year: 226, turn: 12, kind: 'chronicle', body: 'O rei-para-lá-da-muralha Raymun Barba-Vermelha atravessa a Muralha e invade o Norte; os Stark o detêm na Batalha do Lago Longo.', tags: ['canon', 'north', 'wildlings', 'war'] },

  { title: 'Levante Peake', id: '233_peake_uprising', year: 233, turn: 6, kind: 'chronicle', body: 'A Casa Peake se rebela; o conflito custa a vida do rei Maekar.', tags: ['war', 'canon'] },
  { title: 'Morte de Maekar I', id: '233_maekar_death', year: 233, turn: 6, kind: 'chronicle', body: 'Maekar I morre no cerco de Starpike durante o Levante Peake.', tags: ['death', 'canon', 'throne'], personCanonId: 'maekar_i' },
  { title: 'Grande Conselho', id: '233_great_council', year: 233, turn: 12, kind: 'chronicle', body: 'Um Grande Conselho é convocado; Aegon é escolhido rei.', tags: ['politics', 'canon'] },
  { title: 'Aegon V é coroado', id: '233_aegon_v_crowned', year: 233, turn: 12, kind: 'succession', body: 'Aegon V assume o Trono de Ferro.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'aegon_v' },
  { title: 'Bloodraven ao Muralha', id: '233_bloodraven_watch', year: 233, turn: 14, kind: 'chronicle', body: 'Brynden Rivers e Maester Aemon seguem para a Patrulha da Noite.', tags: ['canon', 'night_watch'] },
  { title: 'Quarta Rebelião Blackfyre', id: '236_fourth_blackfyre', year: 236, turn: 10, kind: 'chronicle', body: 'Daemon III Blackfyre invade; é derrotado na Ponte do Wendwater por Ser Duncan.', tags: ['war', 'blackfyre', 'canon'] },
  { title: 'Renúncia de Duncan', id: '239_duncan_renounces', year: 239, turn: 10, kind: 'chronicle', body: 'O príncipe Duncan renuncia aos direitos ao trono por amor, gerando tensão na sucessão.', tags: ['canon', 'targaryen', 'politics'] },
  { title: 'Casamento secreto', id: '240_jaehaerys_shaera', year: 240, turn: 10, kind: 'chronicle', body: 'Jaehaerys e Shaera se casam em segredo, desafiando planos de alianças externas.', tags: ['canon', 'targaryen', 'marriage'] },
  { title: 'Casamento Ormund e Rhaelle', id: '245_ormund_rhaelle', year: 245, turn: 10, kind: 'chronicle', body: 'Ormund Baratheon casa-se com Rhaelle Targaryen, ligando Tempestade e Dragões.', tags: ['canon', 'baratheon', 'targaryen', 'marriage'] },
  { title: 'Nascimento de Steffon', id: '246_steffon_birth', year: 246, turn: 10, kind: 'chronicle', body: 'Nasce Steffon Baratheon, filho de Ormund e Rhaelle.', tags: ['birth', 'canon', 'baratheon'], personCanonId: 'steffon_baratheon' },
  { title: 'Morte de Daeron (filho de Aegon V)', id: '251_daeron_aegon_v_death', year: 251, turn: 10, kind: 'chronicle', body: 'Daeron, filho de Aegon V, morre precocemente.', tags: ['death', 'canon', 'targaryen'], personCanonId: 'daeron_son_aegon_v' },
  { title: 'Tragédia de Summerhall', id: '259_summerhall', year: 259, turn: 10, kind: 'chronicle', body: 'A tentativa de chocar dragões termina em incêndio e mortes, incluindo Aegon V e Ser Duncan.', tags: ['canon', 'tragedy'] },
  { title: 'Nascimento de Rhaegar', id: '259_rhaegar_birth', year: 259, turn: 10, kind: 'chronicle', body: 'Rhaegar nasce durante a Tragédia de Summerhall.', tags: ['birth', 'canon', 'targaryen'], personCanonId: 'rhaegar' },
  { title: 'Jaehaerys II é coroado', id: '259_jaehaerys_ii_crowned', year: 259, turn: 12, kind: 'succession', body: 'Após Summerhall, Jaehaerys II assume o Trono de Ferro.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'jaehaerys_ii' },
  { title: 'Guerra dos Reis de Nove Moedas', id: '260_ninepenny', year: 260, turn: 8, kind: 'chronicle', body: 'Westeros combate a Bando dos Nove nos Degraus; Maelys é morto por Barristan.', tags: ['war', 'canon'] },
  { title: 'Morte de Ormund Baratheon', id: '260_ormund_death', year: 260, turn: 10, kind: 'chronicle', body: 'Ormund Baratheon cai durante a campanha dos Degraus.', tags: ['death', 'canon', 'baratheon'], personCanonId: 'ormund_baratheon' },
  { title: 'Morte de Maelys Blackfyre', id: '260_maelys_death', year: 260, turn: 10, kind: 'chronicle', body: 'Maelys Blackfyre é morto nos Degraus, encerrando a linha de pretendentes presentes.', tags: ['death', 'canon', 'blackfyre'], personCanonId: 'maelys_blackfyre' },
  { title: 'Tywin é armado cavaleiro', id: '260_tywin_knighted', year: 260, turn: 12, kind: 'chronicle', body: 'Tywin Lannister é armado cavaleiro durante/apos a campanha.', tags: ['canon', 'lannister'] },
  { title: 'Revolta Reyne–Tarbeck', id: '261_reyne_tarbeck', year: 261, turn: 10, kind: 'chronicle', body: 'Tywin reage com brutalidade à revolta das Casas Reyne e Tarbeck.', tags: ['war', 'canon', 'lannister'] },
  { title: 'Morte de Jaehaerys II', id: '262_jaehaerys_ii_death', year: 262, turn: 10, kind: 'chronicle', body: 'Jaehaerys II morre de doença.', tags: ['death', 'canon', 'throne'], personCanonId: 'jaehaerys_ii' },
  { title: 'Aerys II é coroado', id: '262_aerys_ii_crowned', year: 262, turn: 10, kind: 'succession', body: 'Aerys II assume e nomeia Tywin Lannister como Mão.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'aerys_ii' },
  { title: 'Tywin torna-se Mão do Rei', id: '262_tywin_hand', year: 262, turn: 10, kind: 'chronicle', body: 'Tywin é nomeado Mão do Rei no início do reinado de Aerys II.', tags: ['politics', 'canon', 'lannister'] },
  { title: 'Nascimento de Robert Baratheon', id: '262_robert_birth', year: 262, turn: 12, kind: 'chronicle', body: 'Nasce Robert Baratheon.', tags: ['birth', 'canon', 'baratheon'], personCanonId: 'robert' },
  { title: 'Nascimento de Brandon Stark', id: '262_brandon_birth', year: 262, turn: 12, kind: 'chronicle', body: 'Nasce Brandon Stark.', tags: ['birth', 'canon', 'stark'], personCanonId: 'brandon_stark' },  { title: 'Desafio de Duskendale', id: '277_defiance_duskendale', year: 277, turn: 10, kind: 'chronicle', body: 'Denys Darklyn captura Aerys II em Duskendale; após meses de cerco, Barristan Selmy resgata o rei. As Casas Darklyn e Hollard são extintas.', tags: ['canon', 'throne', 'war'] },

  { title: 'Morte de Steffon Baratheon', id: '278_steffon_death', year: 278, turn: 10, kind: 'chronicle', body: 'Steffon Baratheon morre em naufrágio ao retornar de Essos.', tags: ['death', 'canon', 'baratheon'], personCanonId: 'steffon_baratheon' },

  { title: 'Casamento de Rhaegar e Elia', id: '280_rhaegar_elia', year: 280, turn: 10, kind: 'chronicle', body: 'Rhaegar casa-se com Elia Martell em Porto Real.', tags: ['marriage', 'canon'] },
  { title: 'Nascimento de Rhaenys', id: '280_rhaenys_birth', year: 280, turn: 10, kind: 'chronicle', body: 'Nasce a princesa Rhaenys.', tags: ['birth', 'canon'], personCanonId: 'rhaenys_child' },  { title: 'Fim da Irmandade da Floresta do Rei', id: '281_kingswood_brotherhood', year: 281, turn: 6, kind: 'chronicle', body: 'A Irmandade da Floresta do Rei é derrotada por forças reais; Jaime Lannister é armado cavaleiro por Arthur Dayne e passa a ganhar fama.', tags: ['canon', 'kingsguard', 'lannister'] },

  { title: 'Torneio de Harrenhal', id: '281_harrenhal_tourney', year: 281, turn: 10, kind: 'tournament', body: 'O grande torneio de Harrenhal reúne as principais casas.', tags: ['tournament', 'canon'], tournament: { locationId: 'harrenhal', hostHouseId: 'whent', label: 'Torneio de Harrenhal (canônico)' } },
  { title: 'Desaparecimento de Lyanna', id: '282_lyanna_disappears', year: 282, turn: 8, kind: 'chronicle', body: 'Lyanna Stark desaparece; o ato é atribuído a Rhaegar.', tags: ['canon', 'stark', 'targaryen'] },
  { title: 'Mortes em Porto Real', id: '282_brandon_rickard_deaths', year: 282, turn: 10, kind: 'chronicle', body: 'Brandon e Rickard Stark são mortos após confrontarem a coroa.', tags: ['death', 'canon', 'stark'] },
  { title: 'Início da Rebelião', id: '282_rebellion_begins', year: 282, turn: 12, kind: 'chronicle', body: 'Jon Arryn se recusa a entregar seus pupilos; começa a Rebelião de Robert.', tags: ['war', 'canon'] },
  { title: 'Batalha dos Sinos', id: '283_battle_of_bells', year: 283, turn: 6, kind: 'chronicle', body: 'Batalha nos campos do Vale do Tridente; os rebeldes vencem.', tags: ['war', 'canon'] },
  { title: 'Casamentos políticos', id: '283_weddings', year: 283, turn: 8, kind: 'chronicle', body: 'Eddard Stark casa-se com Catelyn Tully; Jon Arryn com Lysa Tully.', tags: ['marriage', 'canon'] },
  { title: 'Batalha do Tridente', id: '283_trident', year: 283, turn: 14, kind: 'chronicle', body: 'Rhaegar é morto por Robert no Tridente.', tags: ['war', 'canon', 'death'], personCanonId: 'rhaegar' },
  { title: 'Saque de Porto Real', id: '283_sack_kings_landing', year: 283, turn: 15, kind: 'chronicle', body: 'Porto Real é saqueada; Aerys II e os filhos de Rhaegar morrem.', tags: ['war', 'canon'] },
  { title: 'Morte de Aerys II', id: '283_aerys_death', year: 283, turn: 15, kind: 'chronicle', body: 'Aerys II é morto durante o saque de Porto Real.', tags: ['death', 'canon', 'throne'], personCanonId: 'aerys_ii' },
  { title: 'Robert é coroado', id: '283_robert_crowned', year: 283, turn: 18, kind: 'dynasty_shift', body: 'A dinastia no Trono de Ferro muda após a rebelião.', tags: ['succession', 'throne', 'canon'], dynasty: { ironThroneHouseName: 'Casa Baratheon' } },
  { title: 'Robert assume o Trono', id: '283_robert_throne', year: 283, turn: 18, kind: 'succession', body: 'Robert I governa os Sete Reinos.', tags: ['succession', 'throne', 'canon'], houseId: 'targaryen_throne', newLeaderCanonId: 'robert' },
  { title: 'Morte de Lyanna', id: '283_lyanna_death', year: 283, turn: 20, kind: 'chronicle', body: 'Lyanna Stark morre na Torre da Alegria.', tags: ['death', 'canon', 'stark'], personCanonId: 'lyanna_stark' },
  { title: 'Tempestade e nascimento de Daenerys', id: '284_storm_birth_dany', year: 284, turn: 18, kind: 'chronicle', body: 'Durante uma grande tempestade, Daenerys nasce em Pedra do Dragão; Rhaella morre no parto.', tags: ['birth', 'death', 'canon'], personCanonId: 'daenerys' },
  { title: 'Queda de Pedra do Dragão', id: '284_stannis_takes_dragonstone', year: 284, turn: 20, kind: 'chronicle', body: 'Stannis toma Pedra do Dragão após a fuga dos últimos Targaryen.', tags: ['war', 'canon'] },
  { title: 'Casamento do rei', id: '284_robert_marries_cersei', year: 284, turn: 20, kind: 'chronicle', body: 'Robert casa-se com Cersei Lannister.', tags: ['marriage', 'canon'] },
  { title: 'Concepção de Joffrey', id: '285_joffrey_conceived', year: 285, turn: 10, kind: 'chronicle', body: 'Robert e Cersei visitam Estermont; Joffrey é concebido.', tags: ['canon'] },
  { title: 'Rebelião Greyjoy', id: '289_greyjoy_rebellion', year: 289, turn: 10, kind: 'chronicle', body: 'Balon se declara rei das Ilhas; Robert e aliados esmagam a rebelião.', tags: ['war', 'canon', 'iron_islands'] },
  { title: 'Theon torna-se refém', id: '289_theon_ward', year: 289, turn: 12, kind: 'chronicle', body: 'Theon Greyjoy torna-se pupilo/refém de Eddard Stark para garantir a lealdade de Balon.', tags: ['canon', 'stark', 'greyjoy'] },
  { title: 'Torneio em Lannisport', id: '289_lannisport_tourney', year: 289, turn: 16, kind: 'tournament', body: 'Um torneio celebra a vitória do rei sobre os Greyjoy.', tags: ['tournament', 'canon'], tournament: { locationId: 'lannisport', hostHouseId: 'lannister', label: 'Torneio de Lannisport (canônico)' } },
  { title: 'Paz após a Rebelião', id: '290_peace', year: 290, turn: 10, kind: 'chronicle', body: 'O reino retorna à paz após a Rebelião Greyjoy.', tags: ['canon'] },
  { title: 'Nascimento de Bran Stark', id: '290_bran_birth', year: 290, turn: 12, kind: 'chronicle', body: 'Nasce Bran Stark.', tags: ['birth', 'canon', 'stark'], personCanonId: 'bran' },
  { title: 'Torneio em Casterly Rock', id: '295_casterly_tourney', year: 295, turn: 10, kind: 'tournament', body: 'Tywin promove um torneio em Casterly Rock.', tags: ['tournament', 'canon'], tournament: { locationId: 'casterly_rock', hostHouseId: 'lannister', label: 'Torneio de Casterly Rock (canônico)' } },
  { title: 'Nascimento de Rickon Stark', id: '295_rickon_birth', year: 295, turn: 12, kind: 'chronicle', body: 'Nasce Rickon Stark.', tags: ['birth', 'canon', 'stark'], personCanonId: 'rickon' },
  { title: 'Retorno dos Outros', id: '297_others_return', year: 297, turn: 6, kind: 'chronicle', body: 'Surgem relatos do retorno dos Outros e desaparecimentos de patrulheiros.', tags: ['canon', 'north'] },
  { title: 'Exílio de Euron', id: '297_euron_exiled', year: 297, turn: 8, kind: 'chronicle', body: 'Euron é exilado por Balon após escândalo familiar.', tags: ['canon', 'greyjoy'] },
  { title: 'Proteção em Pentos', id: '297_targaryen_pentos', year: 297, turn: 12, kind: 'chronicle', body: 'Viserys e Daenerys passam a receber proteção de um magíster em Essos.', tags: ['canon', 'targaryen'] },  { title: 'Illyrio acolhe os últimos Targaryen', id: '297_illyrio_hosts', year: 297, turn: 12, kind: 'chronicle', body: 'Illyrio Mopatis acolhe Viserys e Daenerys em Pentos e passa a prometer apoio para recuperar o Trono de Ferro.', tags: ['canon', 'essos', 'targaryen'] },

  { title: 'Sincronização de líderes', id: '298_sync_great_houses', year: 298, turn: 1, kind: 'chronicle', body: 'As grandes casas passam a seguir seus senhores canônicos (quando conhecido), mantendo a simulação para lacunas.', tags: ['canon', 'system'] },
  { title: 'Lorde canônico: stark', id: '298_leader_stark', year: 298, turn: 1, kind: 'succession', body: 'Eddard assume Winterfell', tags: ['canon', 'leaders'], houseId: 'stark', newLeaderCanonId: 'eddard' },
  { title: 'Lorde canônico: lannister', id: '298_leader_lannister', year: 298, turn: 1, kind: 'succession', body: 'Tywin confirma Casterly Rock', tags: ['canon', 'leaders'], houseId: 'lannister', newLeaderCanonId: 'tywin' },
  { title: 'Lorde canônico: arryn', id: '298_leader_arryn', year: 298, turn: 1, kind: 'succession', body: 'Jon Arryn lidera o Vale', tags: ['canon', 'leaders'], houseId: 'arryn', newLeaderCanonId: 'jon_arryn' },
  { title: 'Lorde canônico: tully', id: '298_leader_tully', year: 298, turn: 1, kind: 'succession', body: 'Hoster lidera o Tridente', tags: ['canon', 'leaders'], houseId: 'tully', newLeaderCanonId: 'hoster' },
  { title: 'Lorde canônico: greyjoy', id: '298_leader_greyjoy', year: 298, turn: 1, kind: 'succession', body: 'Balon lidera as Ilhas de Ferro', tags: ['canon', 'leaders'], houseId: 'greyjoy', newLeaderCanonId: 'balon' },
  { title: 'Lorde canônico: tyrell', id: '298_leader_tyrell', year: 298, turn: 1, kind: 'succession', body: 'Mace lidera o Jardim de Cima', tags: ['canon', 'leaders'], houseId: 'tyrell', newLeaderCanonId: 'mace' },
  { title: 'Lorde canônico: martell', id: '298_leader_martell', year: 298, turn: 1, kind: 'succession', body: 'Doran lidera Dorne', tags: ['canon', 'leaders'], houseId: 'martell', newLeaderCanonId: 'doran' },
  { title: 'Lorde canônico: baratheon', id: '298_leader_baratheon', year: 298, turn: 1, kind: 'succession', body: 'Robert lidera os Baratheon', tags: ['canon', 'leaders'], houseId: 'baratheon', newLeaderCanonId: 'robert' },
  { title: 'Morte de Jon Arryn', id: '298_jon_arryn_death', year: 298, turn: 5, kind: 'chronicle', body: 'Jon Arryn morre envenenado; Eddard é chamado para ser Mão do Rei.', tags: ['death', 'canon'], personCanonId: 'jon_arryn' },
  { title: 'Torneio da Mão', id: '298_hands_tourney', year: 298, turn: 6, kind: 'tournament', body: 'Um torneio é realizado em honra da nomeação de Eddard Stark como Mão.', tags: ['tournament', 'canon'], tournament: { locationId: 'kings_landing', hostHouseId: 'baratheon', label: 'Torneio da Mão (canônico)' } },
  { title: 'Morte de Robert', id: '298_robert_death', year: 298, turn: 12, kind: 'chronicle', body: 'Robert é ferido por um javali durante a caçada e morre.', tags: ['death', 'canon', 'throne'], personCanonId: 'robert' },
  { title: 'Joffrey é coroado', id: '298_joffrey_crowned', year: 298, turn: 14, kind: 'dynasty_shift', body: 'Após a morte de Robert, Joffrey assume como rei (disputa sucessória).', tags: ['canon', 'throne'], dynasty: { ironThroneHouseName: 'Casa Baratheon' } },
  { title: 'Joffrey assume o Trono', id: '298_joffrey_throne', year: 298, turn: 14, kind: 'succession', body: 'Joffrey passa a governar a partir de Porto Real.', tags: ['succession', 'canon', 'throne'], houseId: 'targaryen_throne', newLeaderCanonId: 'joffrey' },
  { title: 'Morte de Viserys', id: '298_viserys_death', year: 298, turn: 8, kind: 'chronicle', body: 'Viserys Targaryen é morto por Khal Drogo com ouro derretido.', tags: ['death', 'canon', 'targaryen'], personCanonId: 'viserys_beggar' },
  { title: 'Novo Lorde do Vale', id: '298_arryn_robert', year: 298, turn: 16, kind: 'succession', body: 'Com a morte de Jon Arryn, Robert Arryn herda o Vale.', tags: ['succession', 'canon'], houseId: 'arryn', newLeaderCanonId: 'robert_arryn' },  { title: 'A Patrulha parte no Grande Patrulhamento', id: '299_great_ranging', year: 299, turn: 3, kind: 'chronicle', body: 'Com relatos inquietantes além da Muralha, a Patrulha da Noite parte em força em um grande patrulhamento rumo ao norte.', tags: ['canon', 'north', 'nights_watch'] },

  { title: 'Guerra dos Cinco Reis', id: '299_wot5k', year: 299, turn: 2, kind: 'chronicle', body: 'A guerra se espalha: múltiplos pretendentes eclodem em conflito aberto.', tags: ['war', 'canon'] },
  { title: 'Execução de Eddard', id: '299_eddard_death', year: 299, turn: 10, kind: 'chronicle', body: 'Eddard Stark é decapitado por ordem de Joffrey.', tags: ['death', 'canon', 'stark'], personCanonId: 'eddard' },
  { title: 'Robb assume como Lorde Stark', id: '299_stark_robbs', year: 299, turn: 10, kind: 'succession', body: 'Após a morte de Eddard, Robb lidera a Casa Stark.', tags: ['succession', 'canon'], houseId: 'stark', newLeaderCanonId: 'rob_stark' },
  { title: 'Batalha da Água Negra', id: '299_blackwater', year: 299, turn: 12, kind: 'chronicle', body: 'Stannis é derrotado na Batalha da Água Negra; a aliança Lannister–Tyrell prevalece.', tags: ['war', 'canon'] },
  { title: 'Morte de Renly', id: '299_renly_death', year: 299, turn: 7, kind: 'chronicle', body: 'Renly Baratheon é morto em seu acampamento por um assassino sombrio.', tags: ['death', 'canon', 'baratheon'], personCanonId: 'renly' },
  { title: 'Morte de Balon', id: '299_balon_death', year: 299, turn: 12, kind: 'chronicle', body: 'Balon Greyjoy cai de uma ponte em Pyke e morre.', tags: ['death', 'canon', 'greyjoy'], personCanonId: 'balon' },
  { title: 'Euron assume Pyke', id: '299_greyjoy_euron', year: 299, turn: 13, kind: 'succession', body: 'Após a morte de Balon, Euron move-se para tomar o controle das Ilhas.', tags: ['succession', 'canon'], houseId: 'greyjoy', newLeaderCanonId: 'euron' },
  { title: 'Casamento Vermelho', id: '299_red_wedding', year: 299, turn: 18, kind: 'chronicle', body: 'Robb e Catelyn Stark são mortos no Casamento Vermelho.', tags: ['war', 'canon', 'death'], personCanonId: 'rob_stark' },
  { title: 'Morte de Catelyn', id: '299_catelyn_death', year: 299, turn: 18, kind: 'chronicle', body: 'Catelyn Stark morre no Casamento Vermelho.', tags: ['death', 'canon', 'stark'], personCanonId: 'catelyn' },
  { title: 'Morte de Hoster Tully', id: '299_hoster_death', year: 299, turn: 16, kind: 'chronicle', body: 'Hoster Tully morre em Riverrun.', tags: ['death', 'canon', 'tully'], personCanonId: 'hoster' },
  { title: 'Edmure herda Riverrun', id: '299_tully_edmure', year: 299, turn: 18, kind: 'succession', body: 'Edmure assume como Lorde de Riverrun.', tags: ['succession', 'canon'], houseId: 'tully', newLeaderCanonId: 'edmure' },
  { title: 'Casamento Púrpura', id: '300_purple_wedding', year: 300, turn: 1, kind: 'chronicle', body: 'O casamento e a morte de Joffrey ocorrem no primeiro dia do ano.', tags: ['death', 'canon', 'throne'], personCanonId: 'joffrey' },
  { title: 'Tommen é coroado', id: '300_tommen_crowned', year: 300, turn: 2, kind: 'succession', body: 'Tommen assume o Trono após Joffrey.', tags: ['succession', 'canon', 'throne'], houseId: 'targaryen_throne', newLeaderCanonId: 'tommen' },
  { title: 'Novo casamento real', id: '300_tommen_margaery', year: 300, turn: 4, kind: 'chronicle', body: 'Tommen casa-se com Margaery Tyrell, mantendo a aliança Lannister–Tyrell.', tags: ['marriage', 'canon'] },
  { title: 'Renascimento da Fé Militante', id: '300_faith_militant', year: 300, turn: 8, kind: 'chronicle', body: 'A Fé Militante é restaurada e cresce rapidamente em poder.', tags: ['religion', 'canon'] },
  { title: 'Morte de Tywin', id: '300_tywin_death', year: 300, turn: 18, kind: 'chronicle', body: 'Tywin Lannister é morto por Tyrion com uma besta.', tags: ['death', 'canon', 'lannister'], personCanonId: 'tywin' },
  { title: 'Morte de Kevan', id: '300_kevan_death', year: 300, turn: 18, kind: 'chronicle', body: 'Kevan Lannister é morto por Varys em Porto Real.', tags: ['death', 'canon', 'lannister'], personCanonId: 'kevan' },
  { title: 'Cersei assume Casterly Rock', id: '300_lannister_cersei', year: 300, turn: 19, kind: 'succession', body: 'Com a morte de Tywin, a liderança Lannister recai em Cersei (na ausência de Tywin).', tags: ['succession', 'canon'], houseId: 'lannister', newLeaderCanonId: 'cersei' },
  { title: 'A Companhia Dourada aporta', id: '300_golden_company_lands', year: 300, turn: 12, kind: 'chronicle', body: 'A Companhia Dourada desembarca nos Terras da Tempestade.', tags: ['war', 'canon'] },
  { title: 'Batalha da Muralha', id: '300_wildlings_wall', year: 300, turn: 6, kind: 'chronicle', body: 'Selvagens atacam Castelo Negro; Stannis chega e os derrota.', tags: ['war', 'canon', 'north'] },
  { title: 'Conspiração em Dorne', id: '300_dorne_arianne_plot', year: 300, turn: 10, kind: 'chronicle', body: 'Arianne Martell trama coroar Myrcella em Dorne, elevando a tensão com Porto Real.', tags: ['canon', 'dorne', 'politics'] },
  { title: 'Batalha de Gelo', id: '301_battle_ice', year: 301, turn: 4, kind: 'chronicle', body: 'Stannis enfrenta forças Bolton e Frey no Norte em meio ao inverno brutal.', tags: ['war', 'canon', 'north'] },
  { title: 'Cerco de Meereen', id: '301_meereen_siege', year: 301, turn: 6, kind: 'chronicle', body: 'A guerra de Daenerys em Meereen atinge seu auge entre doenças, traições e batalha aberta.', tags: ['war', 'canon', 'essos'] },
  { title: 'Vitória naval de Euron', id: '301_euron_victories', year: 301, turn: 8, kind: 'chronicle', body: 'Euron amplia seu domínio marítimo e projeta guerra contra a Campina.', tags: ['war', 'canon', 'iron_islands'] },
  { title: 'Queda de Winterfell para os Stark', id: '302_starks_retake_winterfell', year: 302, turn: 6, kind: 'chronicle', body: 'As forças Stark recuperam Winterfell após derrotarem os Bolton.', tags: ['war', 'canon', 'north'] },
  { title: 'Rei no Norte', id: '302_jon_king_north', year: 302, turn: 8, kind: 'chronicle', body: 'Jon Snow é aclamado Rei no Norte por lordes e casas vassalas.', tags: ['canon', 'north', 'succession'] },
  { title: 'Cersei consolida o poder', id: '302_cersei_rule_kl', year: 302, turn: 9, kind: 'chronicle', body: 'Após destruição no Septo de Baelor, Cersei concentra o poder da Coroa em Porto Real.', tags: ['canon', 'throne', 'kings_landing'] },
  { title: 'Daenerys ruma a Westeros', id: '302_dany_sails_westeros', year: 302, turn: 12, kind: 'chronicle', body: 'Daenerys deixa Meereen e parte para Pedra do Dragão com aliados e frota.', tags: ['canon', 'targaryen', 'war'] },
  { title: 'Daenerys desembarca em Pedra do Dragão', id: '303_dany_arrives_dragonstone', year: 303, turn: 2, kind: 'chronicle', body: 'Daenerys Targaryen estabelece sua base em Pedra do Dragão para iniciar a campanha em Westeros.', tags: ['canon', 'targaryen', 'throne'] },
  { title: 'Aliança do Norte com Daenerys', id: '303_jon_dany_alliance', year: 303, turn: 8, kind: 'chronicle', body: 'Jon e Daenerys firmam cooperação diante da ameaça dos mortos.', tags: ['canon', 'north', 'targaryen'] },
  { title: 'Conspiração e queda em Porto Real', id: '304_kl_upheaval', year: 304, turn: 6, kind: 'chronicle', body: 'Conflitos de corte e campanha militar enfraquecem o domínio de Cersei em Porto Real.', tags: ['canon', 'kings_landing', 'war'] },
  { title: 'A Muralha é rompida', id: '304_wall_breached', year: 304, turn: 20, kind: 'chronicle', body: 'A Muralha é rompida e o Exército dos Mortos avança para o Norte.', tags: ['canon', 'north', 'endgame', 'anchor'] },
  { title: 'Batalha de Winterfell', id: '305_battle_winterfell', year: 305, turn: 2, kind: 'chronicle', body: 'As forças dos vivos enfrentam os mortos em Winterfell e sobrevivem por pouco.', tags: ['canon', 'north', 'war', 'endgame', 'anchor'] },
  { title: 'Queda de Porto Real', id: '305_fall_kings_landing', year: 305, turn: 12, kind: 'chronicle', body: 'A campanha final por Porto Real culmina em incêndio massivo e ruptura do reino.', tags: ['canon', 'kings_landing', 'war', 'endgame', 'anchor'] },
  { title: 'Grande Conselho e novo rei', id: '305_great_council_new_king', year: 305, turn: 18, kind: 'chronicle', body: 'Um grande conselho redefine a sucessão e estabelece uma nova ordem política.', tags: ['canon', 'throne', 'politics', 'endgame', 'anchor'] }
];

// -----------------------------
// Camadas: liderança canônica
// -----------------------------

export const CANON_LEADER_MANDATES: CanonLeaderMandate[] = [
  // --- Trono de Ferro (150–305) ---
  { id: '150_throne_aegon_iii', houseId: 'targaryen_throne', leaderCanonId: 'aegon_iii', fromYear: 150, fromTurn: 1, toYear: 157, toTurn: 10 },
  { id: '157_throne_daeron_i', houseId: 'targaryen_throne', leaderCanonId: 'daeron_i', fromYear: 157, fromTurn: 10, toYear: 161, toTurn: 12 },
  { id: '161_throne_baelor_i', houseId: 'targaryen_throne', leaderCanonId: 'baelor_i', fromYear: 161, fromTurn: 12, toYear: 171, toTurn: 10 },
  { id: '171_throne_viserys_ii', houseId: 'targaryen_throne', leaderCanonId: 'viserys_ii', fromYear: 171, fromTurn: 10, toYear: 172, toTurn: 10 },
  { id: '172_throne_aegon_iv', houseId: 'targaryen_throne', leaderCanonId: 'aegon_iv', fromYear: 172, fromTurn: 10, toYear: 184, toTurn: 10 },
  { id: '184_throne_daeron_ii', houseId: 'targaryen_throne', leaderCanonId: 'daeron_ii', fromYear: 184, fromTurn: 10, toYear: 209, toTurn: 10 },
  { id: '209_throne_aerys_i', houseId: 'targaryen_throne', leaderCanonId: 'aerys_i', fromYear: 209, fromTurn: 10, toYear: 221, toTurn: 10 },
  { id: '221_throne_maekar_i', houseId: 'targaryen_throne', leaderCanonId: 'maekar_i', fromYear: 221, fromTurn: 10, toYear: 233, toTurn: 10 },
  { id: '233_throne_aegon_v', houseId: 'targaryen_throne', leaderCanonId: 'aegon_v', fromYear: 233, fromTurn: 10, toYear: 259, toTurn: 10 },
  { id: '259_throne_jaehaerys_ii', houseId: 'targaryen_throne', leaderCanonId: 'jaehaerys_ii', fromYear: 259, fromTurn: 10, toYear: 262, toTurn: 10 },
  { id: '262_throne_aerys_ii', houseId: 'targaryen_throne', leaderCanonId: 'aerys_ii', fromYear: 262, fromTurn: 10, toYear: 283, toTurn: 16 },
  { id: '283_throne_robert', houseId: 'targaryen_throne', leaderCanonId: 'robert', fromYear: 283, fromTurn: 16, toYear: 298, toTurn: 14 },

  // --- Grandes Casas (âncoras) ---
  { id: '150_stark_cregan', houseId: 'stark', leaderCanonId: 'cregan_stark', fromYear: 150, fromTurn: 1 },
  { id: '150_tyrell_lyonel', houseId: 'tyrell', leaderCanonId: 'lyonel_tyrell', fromYear: 150, fromTurn: 1, toYear: 161, toTurn: 12 },
  { id: '267_lannister_tywin', houseId: 'lannister', leaderCanonId: 'tywin', fromYear: 267, fromTurn: 10, toYear: 300, toTurn: 18 },
  { id: '282_stark_eddard', houseId: 'stark', leaderCanonId: 'eddard', fromYear: 282, fromTurn: 2, toYear: 299, toTurn: 10 },

  // Baratheon (camadas históricas: Ormund -> Steffon -> Robert)
  { id: '239_baratheon_ormund', houseId: 'baratheon', leaderCanonId: 'ormund_baratheon', fromYear: 239, fromTurn: 1, toYear: 260, toTurn: 10 },
  { id: '260_baratheon_steffon', houseId: 'baratheon', leaderCanonId: 'steffon_baratheon', fromYear: 260, fromTurn: 11, toYear: 278, toTurn: 10 },
  { id: '278_baratheon_robert', houseId: 'baratheon', leaderCanonId: 'robert', fromYear: 278, fromTurn: 11, toYear: 298, toTurn: 12 },

  // Re-sincronização no período da série (quando temos registros bem precisos)
  { id: '298_throne_joffrey', houseId: 'targaryen_throne', leaderCanonId: 'joffrey', fromYear: 298, fromTurn: 14, toYear: 300, toTurn: 1 },
  { id: '300_throne_tommen', houseId: 'targaryen_throne', leaderCanonId: 'tommen', fromYear: 300, fromTurn: 2 },
];
export const CANON_WARS: CanonWarDef[] = [
  {
    id: 'war_dorne_conquest',
    name: 'Conquista de Dorne (Daeron I)',
    fromYear: 157,
    fromTurn: 12,
    toYear: 161,
    toTurn: 14,
    sideAHouseIds: ['targaryen_throne', 'tyrell', 'baratheon'],
    sideBHouseIds: ['martell', 'yronwood', 'dayne'],
    intensity: 'high',
    tags: ['dorne'],
  },
  {
    id: 'war_blackfyre_1',
    name: 'Primeira Rebelião Blackfyre',
    fromYear: 196,
    fromTurn: 4,
    toYear: 196,
    toTurn: 18,
    sideAHouseIds: ['targaryen_throne', 'stark', 'lannister', 'tully', 'arryn'],
    sideBHouseIds: ['blackfyre', 'bracken'],
    intensity: 'medium',
    tags: ['blackfyre'],
  },
  {
    id: 'war_blackfyre_2',
    name: 'Segunda Rebelião Blackfyre',
    fromYear: 212,
    fromTurn: 8,
    toYear: 212,
    toTurn: 12,
    sideAHouseIds: ['targaryen_throne', 'tully'],
    sideBHouseIds: ['blackfyre'],
    intensity: 'low',
    tags: ['blackfyre'],
  },
  {
    id: 'war_blackfyre_3',
    name: 'Terceira Rebelião Blackfyre',
    fromYear: 219,
    fromTurn: 10,
    toYear: 219,
    toTurn: 18,
    sideAHouseIds: ['targaryen_throne'],
    sideBHouseIds: ['blackfyre'],
    intensity: 'low',
    tags: ['blackfyre'],
  },
  {
    id: 'war_blackfyre_4',
    name: 'Quarta Rebelião Blackfyre',
    fromYear: 236,
    fromTurn: 6,
    toYear: 236,
    toTurn: 12,
    sideAHouseIds: ['targaryen_throne'],
    sideBHouseIds: ['blackfyre'],
    intensity: 'low',
    tags: ['blackfyre'],
  },
  {
    id: 'war_ninepenny_kings',
    name: 'Guerra dos Reis de Nove Moedas',
    fromYear: 260,
    fromTurn: 4,
    toYear: 260,
    toTurn: 14,
    sideAHouseIds: ['targaryen_throne', 'baratheon', 'lannister', 'tyrell'],
    sideBHouseIds: ['blackfyre'],
    intensity: 'medium',
    tags: ['stepstones'],
  },
  {
    id: 'war_roberts_rebellion',
    name: 'Rebelião de Robert',
    fromYear: 282,
    fromTurn: 6,
    toYear: 283,
    toTurn: 18,
    sideAHouseIds: ['baratheon', 'stark', 'arryn', 'tully'],
    sideBHouseIds: ['targaryen_throne', 'martell', 'tyrell'],
    intensity: 'high',
    tags: ['civil_war'],
  },
  {
    id: 'war_greyjoy_rebellion',
    name: 'Rebelião Greyjoy',
    fromYear: 289,
    fromTurn: 4,
    toYear: 289,
    toTurn: 18,
    sideAHouseIds: ['baratheon', 'stark', 'lannister', 'tully', 'arryn', 'tyrell'],
    sideBHouseIds: ['greyjoy', 'harlaw', 'goodbrother', 'drumm'],
    intensity: 'medium',
    tags: ['iron_islands'],
  },
  {
    id: 'war_five_kings',
    name: 'Guerra dos Cinco Reis',
    fromYear: 299,
    fromTurn: 2,
    toYear: 300,
    toTurn: 20,
    sideAHouseIds: ['stark', 'tully', 'baratheon'],
    sideBHouseIds: ['lannister', 'tyrell', 'greyjoy'],
    intensity: 'high',
    tags: ['wot5k'],
  },
];
