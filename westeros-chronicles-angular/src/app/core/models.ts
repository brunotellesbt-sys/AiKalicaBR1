export type Gender = 'M' | 'F';

export type RelationshipKind = 'hostil' | 'neutro' | 'amigavel' | 'aliado' | 'aliança';

export interface GameDate {
  year: number;          // "Depois da Conquista" (DC)
  turn: number;          // 1..20  (1 turno = 1/20 de ano)
  absoluteTurn: number;  // contador global
}

export interface Resources {
  gold: number;
  food: number;
  goods?: number; // recursos/mercadorias (tributos e presentes)
}

export type UnitTier = 'levies' | 'menAtArms' | 'squires' | 'knights';

export interface Army {
  levies: number;
  menAtArms: number;
  squires: number;
  knights: number;
  /**
   * Dragões não são uma mecânica "jogável" no protótipo.
   * Quando presentes (ex.: Daenerys), contam como equivalentes a 10.000 cavaleiros por dragão.
   */
  dragons: number;
  stationedRatio: number; // 0..1 (parte que fica na cidade)
}

export interface HouseEconomy {
  peasants: number;
  soldiers: number; // cidadãos armados (base)
  farms: number;
  trainingGrounds: number;
  walls: number;
  tradeLastDelegationTurn: number;
  tradePartners: string[];
  taxRate: number; // 0..1 (tributo em 'recursos/goods' para o suserano)
}

export interface HouseDef {
  id: string;
  name: string;
  regionId: string;
  seatLocationId: string;
  prestigeBase: number;
  suzerainId?: string; // casa suserana imediata (geralmente a Grande Casa da região)
  isIronThrone?: boolean;
}

export interface HouseState extends HouseDef {
  prestige: number;          // 1..100
  relations: Record<string, number>; // 0..100 (com outras casas)
  leaderId: string;
  economy: HouseEconomy;
  resources: Resources;
  army: Army;
}

export type Fertility = 'fertile' | 'sterile';

export type MaritalStatus = 'single' | 'married' | 'widowed';



export interface Pregnancy {
  fatherId: string;
  conceivedTurn: number;
  turnsLeft: number; // gravidez dura 15 turnos
  isBastard: boolean;
}

export interface Character {
  id: string;
  name: string;
  gender: Gender;
  ageYears: number;
  alive: boolean;

  birthHouseId: string;
  currentHouseId: string;

  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  maritalStatus: MaritalStatus;
  keepsBirthName: boolean; // usado principalmente para mulheres líderes que decidem manter o sobrenome

  locationId: string;

  // Progressão e atributos
  martial: number;   // 0..100
  charm: number;     // 0..100
  beauty: number;    // 0..100  (homens: aparência + renome; mulheres: apresentação/roupas)
  renownTier: RenownTier;

  fertility: Fertility;

  pregnancy?: Pregnancy;
  isBastard?: boolean;
  wellLiked: number; // 0..100 (ser \"bem quisto\" em geral)

  // Prestígio pessoal (separado do prestígio da Casa)
  personalPrestige: number; // 0..100

  // ferimentos (ex.: torneios). Se definido, penaliza ações até este turno
  injuredUntilTurn?: number;

  // relações pessoais com o jogador
  knownToPlayer: boolean;
  relationshipToPlayer: number; // 0..100

  personalGold?: number; // ouro pessoal (separado do ouro da Casa)
  kissedIds?: string[]; // ids de pessoas que já foram beijadas

  title?: string;

  /**
   * Personagens canônicos ("história real" de Westeros).
   * - Quando canonDeathAbsTurn existir, o simulador evita mortes aleatórias antes desse turno.
   */
  isCanonical?: boolean;
  canonId?: string; // id estável no pacote canônico
  canonBirthYear?: number;
  canonDeathYear?: number;
  canonDeathAbsTurn?: number;
}

export type RenownTier = 'comum' | 'forte' | 'reconhecido' | 'imponente' | 'renomado';

export interface Location {
  id: string;
  name: string;
  regionId: string;
  kind: 'seat' | 'town' | 'fortress' | 'port';
}

export interface Region {
  id: string;
  name: string;
  capitalLocationId: string;
}

export interface TravelOption {
  toLocationId: string;
  distance: number;      // abstrato
}

export interface ChronicleEntry {
  turn: number;
  title: string;
  body: string;
  tags: string[];
}


export type TournamentSize = 'menor' | 'medio' | 'importante';

export type TournamentReason = 'maioridade' | 'casamento' | 'vitoria' | 'colheita' | 'outro';

export interface Tournament {
  id: string;
  hostHouseId: string;
  locationId: string;
  size: TournamentSize;
  reason: TournamentReason;
  announcedTurn: number;
  status: 'anunciado' | 'encerrado';
  categories: RenownTier[];
}


export type Speaker = 'sistema' | 'narrador' | 'npc';

export interface Choice {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface ChatMessage {
  id: string;
  speaker: Speaker;
  title?: string;
  text: string;
  tsTurn: number;
  choices?: Choice[];
  chosenId?: string;
}


// Missões
// - "suserano": pedidos individuais do seu suserano (você é vassalo)
// - "vassalo": pedidos individuais de um vassalo (você é suserano)
export type MissionKind = 'diplomacia' | 'bandidos' | 'selvagens' | 'comercio' | 'lider' | 'suserano' | 'vassalo' | 'coroa';

export type MissionStatus = 'aberta' | 'aceita' | 'delegada' | 'concluida' | 'falhou' | 'expirada';

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  regionId: string;
  targetLocationId: string;
  requiredMartial: number;  // requisito de força/combate (0..100)
  // Requisitos alternativos (usados em missões de suserania/vassalagem)
  requiredGold?: number;
  requiredGoods?: number;
  requiredFood?: number;
  requiredLevies?: number;

  rewardGold: number;       // recompensa em ouro pessoal
  rewardHouseGold?: number; // recompensa direta ao cofre da Casa
  rewardGoods?: number;     // recompensa em "recursos"
  rewardRelation?: number;  // ajuste de relação com a casa que pediu
  rewardPrestige?: number;  // prestígio da Casa do jogador

  requesterHouseId?: string; // quem pediu (suserano/vassalo)
  otherHouseId?: string;     // outra casa envolvida (ex.: alvo político)

  createdTurn: number;
  expiresTurn: number;
  status: MissionStatus;
  assignedToId?: string;    // jogador ou parente delegado
}

export interface GameState {
  version: number;
  date: GameDate;

  game: {
    over: boolean;
    victory: boolean;
    reason: string;
  };

  endgame: {
    wallBreached: boolean;
    danyArrived: boolean;
    danyHouseId?: string;
    danyLeaderId?: string;
    danyRelation: number; // relação pessoal com Daenerys (0..100)
    kingsLandingBurned: boolean;
  };

  playerId: string;
  playerHouseId: string;

  locations: Record<string, Location>;
  regions: Record<string, Region>;
  travelGraph: Record<string, TravelOption[]>;

  houses: Record<string, HouseState>;
  characters: Record<string, Character>;

  tournaments: Tournament[];

  chronicle: ChronicleEntry[];
  chat: ChatMessage[];

  missions?: Mission[];

  // Sistema de empréstimo com o Banco de Ferro
  ironBankDebt: {
    principal: number;
    interestRateYear: number; // ex: 0.12 = 12% a.a.
    nextPaymentTurn: number;
    minimumPayment: number;
    missedPayments: number;
  } | null;

  // UI
  ui: {
    activeTab: 'chat' | 'map' | 'local' | 'tournaments' | 'character' | 'house' | 'diplomacy' | 'canon' | 'chronicle' | 'saves';
    showSetup: boolean;
    pendingNameQueue?: string[]; // ids de bebês do jogador aguardando nome
  };

  /**
   * Modo canônico: injeta acontecimentos e personagens em datas fixas.
   * OBS: isso não impede o jogador de "desviar" o mundo — apenas garante
   * que os marcos históricos aconteçam na cronologia.
   */
  canon?: {
    enabled: boolean;
    mode: 'strict' | 'anchors';
    appliedEventIds: Record<string, boolean>;

    /**
     * Interferência do jogador em personagens canônicos.
     * - score: soma ponderada (ex.: falar=1, beijar=2, casar=5)
     * - reasons: rastreia os tipos de interação
     */
    playerTouchedCanonIds?: Record<string, number>;
    playerTouchedReasons?: Record<string, string[]>;

    /**
     * Quando um evento/morte canônica é "bypass" por divergência,
     * registramos aqui para impedir que outros sistemas tentem re-forçar.
     */
    bypassedDeathCanonIds?: Record<string, boolean>;

    /**
     * Nascimentos canônicos que não puderam ocorrer no turno exato.
     * O motor tenta novamente em uma janela limitada (padrão: até 5 anos).
     */
    pendingBirths?: Record<
      string,
      {
        desiredAbsTurn: number;
        expireAbsTurn: number;
        lastAttemptAbsTurn?: number;
      }
    >;

    /**
     * Datas canônicas com incerteza (ex.: "178–183") são resolvidas uma única vez
     * e persistidas aqui para manter consistência no save.
     * Chaves típicas: "birth:<canonId>", "death:<canonId>".
     */
    resolvedAbsTurns?: Record<string, number>;

    /** Lista de guerras canônicas ativas no turno atual (ids). */
    activeWarIds?: string[];

/**
 * Estado de simulação das guerras canônicas (pontuação e últimas batalhas).
 * Mantido aqui para permitir UI + finalização de guerras ao término do período.
 */
warStates?: Record<
  string,
  {
    scoreA: number;
    scoreB: number;
    lastBattleAbsTurn: number;
    recentBattles: Array<{ absTurn: number; summary: string }>;
  }
>;
  };
}
