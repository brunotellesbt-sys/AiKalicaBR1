/**
 * Heráldica original, gerada e determinística.
 *
 * Por que existe: o jogo tem 73+ Casas e nenhuma tinha brasão. Desenhar 73 à
 * mão não escala, e copiar os brasões oficiais da HBO/GRRM não é uma opção —
 * aquela arte é protegida.
 *
 * A saída legal disso é precisa e vale entender, porque ela define o desenho
 * deste arquivo: o *brasão descrito* ("um lobo gigante cinzento em campo
 * branco") é fato do mundo ficcional, e a linguagem heráldica — leão rampante,
 * mullet, chevron, as sete tinturas — é vocabulário público com séculos de uso.
 * O que é protegido é o *desenho específico* de cada estúdio. Então: as
 * descrições podem seguir os livros, os traços têm de ser nossos. Todo path
 * aqui foi escrito à mão para este projeto.
 *
 * Três coisas fazem heráldica parecer heráldica, e as três estão impostas
 * abaixo. Sem elas o resultado vira clip-art:
 *
 *  1. A regra da tintura: nunca cor sobre cor, nunca metal sobre metal. É o que
 *     garante contraste em qualquer tamanho — a razão de a regra existir é que
 *     um brasão precisava ser lido do outro lado do campo de batalha.
 *  2. Silhueta cheia e sólida. Sem gradiente, sem sombra, sem contorno fino.
 *  3. A carga ocupa o campo com generosidade (~70% da altura). Carga pequena
 *     em campo grande lê como erro.
 *
 * Uso:
 *   import { sigilSvg } from './heraldry';
 *   const svg = sigilSvg('manderly');          // determinístico pelo id
 *   const svg = sigilSvg('stark', { size: 240 });
 */

// ---------------------------------------------------------------------------
// Determinismo
// ---------------------------------------------------------------------------

/**
 * FNV-1a. Precisa ser estável entre sessões e plataformas: o brasão da Casa
 * Manderly tem de ser o mesmo hoje, amanhã e na máquina de outra pessoa.
 * `Math.random()` e `hashCode` de runtime não servem.
 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Sequência determinística derivada do hash — um "dado" por decisão. */
function picker(seed: number) {
  let state = seed || 1;
  return {
    next(): number {
      state ^= state << 13; state >>>= 0;
      state ^= state >> 17;
      state ^= state << 5;  state >>>= 0;
      return state / 0xffffffff;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length) % arr.length];
    },
  };
}

// ---------------------------------------------------------------------------
// Tinturas
// ---------------------------------------------------------------------------

/**
 * As sete tinturas clássicas, em valores escolhidos para tela e não para
 * pigmento: o ouro puxa para o mel (amarelo puro vibra feio no escuro) e o
 * argênteo não é branco absoluto (branco puro brilha demais num tema noturno).
 */
export const TINCTURES = {
  // metais
  or:      '#d9a441',
  argent:  '#e8e6df',
  // cores
  gules:   '#a32638',
  azure:   '#2a4b8d',
  sable:   '#1b1b1f',
  vert:    '#2f6b45',
  purpure: '#6b3a7a',
  // pele (usada só em cargas, nunca em campo)
  tenne:   '#8a4b26',
} as const;

export type Tincture = keyof typeof TINCTURES;

const METALS: readonly Tincture[] = ['or', 'argent'];
const COLOURS: readonly Tincture[] = ['gules', 'azure', 'sable', 'vert', 'purpure'];

/**
 * A regra da tintura, que é o coração da legibilidade: metal sobre cor ou cor
 * sobre metal, nunca o mesmo tipo nos dois. Um leão dourado em campo branco
 * some; em campo vermelho, salta.
 */
function contrasting(t: Tincture, p: ReturnType<typeof picker>): Tincture {
  const isMetal = (METALS as readonly string[]).includes(t);
  return p.pick(isMetal ? COLOURS : METALS);
}

function isMetal(t: Tincture): boolean {
  return (METALS as readonly string[]).includes(t);
}

/**
 * Segunda tintura de um campo dividido, da mesma classe da primeira.
 *
 * Custou um bug para chegar aqui. A versão anterior sorteava a segunda metade
 * por contraste com a primeira — heraldicamente ortodoxo (metade metal,
 * metade cor) — mas a carga é escolhida contra o campo *inteiro*, então numa
 * das metades ela podia cair exatamente sobre a própria cor e sumir. Seis dos
 * 73 escudos saíram literalmente vazios, e a checagem não viu porque só
 * comparava campo × carga.
 *
 * Mantendo as duas metades na mesma classe (dois metais, ou duas cores), a
 * carga contrasta com as duas por construção. Perde-se um pouco de ortodoxia
 * e ganha-se a garantia de que nenhum brasão sai em branco.
 */
function sameClassAs(t: Tincture, p: ReturnType<typeof picker>): Tincture {
  const pool = (isMetal(t) ? METALS : COLOURS).filter(x => x !== t);
  return pool.length ? p.pick(pool) : t;
}

/**
 * Quebra da regra da tintura — cor sobre cor, ou metal sobre metal.
 *
 * As armas sorteadas nunca caem nisso, porque `contrasting()` não deixa. Mas
 * as canônicas caem: o dragão vermelho em campo negro dos Targaryen e o urso
 * negro em campo verde dos Mormont são cor sobre cor, e não são erro — armas
 * reais quebram a regra o tempo todo (as de Jerusalém são o caso célebre).
 *
 * Seguir o cânone e ficar ilegível a 28px seriam as duas opções ruins. A
 * heráldica já resolveu isso séculos atrás com fimbriação: um fio de metal
 * contornando a carga, que devolve o contraste sem trocar nenhuma cor.
 */
export function breaksTinctureRule(field: Tincture, charged: Tincture): boolean {
  return isMetal(field) === isMetal(charged);
}

// ---------------------------------------------------------------------------
// Cargas
// ---------------------------------------------------------------------------

/**
 * Cada carga é um path em caixa 0 0 100 100, desenhado para ler bem tanto a
 * 28px (linha de lista) quanto a 240px (painel da Casa). São silhuetas
 * angulares e cheias de propósito: detalhe fino desaparece no tamanho pequeno,
 * que é onde o brasão mais aparece no jogo.
 */
export const CHARGES: Record<string, string> = {
  // — geométricas —
  // As mais antigas e as que melhor sobrevivem à miniatura. Se estiver em
  // dúvida sobre uma carga nova, prefira este grupo: historicamente as casas
  // menores usavam justamente formas simples.
  mullet:
    'M50 8 L61 38 L93 38 L67 57 L77 88 L50 69 L23 88 L33 57 L7 38 L39 38 Z',
  roundel:
    'M50 14 A36 36 0 1 1 49.9 14 Z',
  lozenge:
    'M50 8 L88 50 L50 92 L12 50 Z',
  crescent:
    // Dois círculos inteiros, um furando o outro. A versão "dois arcos de
    // sentido oposto" desenha a mesma lua sob a regra nonzero e desaparece
    // por completo sob evenodd — os arcos se anulam. Como o furo das outras
    // cargas exige evenodd, a lua tem de ser construída por subtração.
    'M12 52 A38 38 0 1 1 88 52 A38 38 0 1 1 12 52 Z '
    + 'M33 46 A33 33 0 1 1 99 46 A33 33 0 1 1 33 46 Z',
  chevron:
    'M50 18 L92 62 L92 84 L50 40 L8 84 L8 62 Z',
  cross:
    'M40 8 H60 V40 H92 V60 H60 V92 H40 V60 H8 V40 H40 Z',
  pile:
    'M8 10 H92 L50 92 Z',

  // — natureza —
  sun:
    'M50 28 A22 22 0 1 1 49.9 28 Z '
    + 'M50 2 L56 20 H44 Z M50 98 L44 80 H56 Z M2 50 L20 44 V56 Z M98 50 L80 56 V44 Z '
    + 'M16 16 L31 26 L26 31 Z M84 84 L69 74 L74 69 Z M84 16 L74 31 L69 26 Z M16 84 L26 69 L31 74 Z',
  rose:
    // Roseta heráldica: cinco pétalas largas e um miolo vazado.
    'M50 12 C60 12 66 22 64 34 C76 30 86 36 88 46 C90 57 82 65 70 64 '
    + 'C76 74 72 85 62 88 C52 91 44 85 42 74 C34 82 23 81 17 72 '
    + 'C11 64 14 53 24 49 C13 44 10 33 17 25 C24 17 35 17 42 25 '
    + 'C43 17 46 12 50 12 Z '
    + 'M50 38 A11 11 0 1 0 50.1 38 Z',
  oakleaf:
    'M50 4 C57 16 66 20 64 30 C74 30 76 42 68 46 C78 50 76 62 66 62 '
    + 'C68 72 58 79 52 72 V94 H48 V72 C42 79 32 72 34 62 C24 62 22 50 32 46 '
    + 'C24 42 26 30 36 30 C34 20 43 16 50 4 Z',
  garb:
    // Feixe de trigo. A versão em cinco hastes finas lia como vaso de planta;
    // três hastes grossas e uma atadura larga resolvem — o feixe é uma forma
    // de ampulheta, não um buquê.
    'M50 2 C44 16 42 30 44 42 H56 C58 30 56 16 50 2 Z '
    + 'M20 12 C14 30 22 40 38 46 L42 38 C30 32 26 24 28 12 Z '
    + 'M80 12 C86 30 78 40 62 46 L58 38 C70 32 74 24 72 12 Z '
    + 'M24 50 H76 L82 64 H18 Z '
    + 'M30 68 C24 82 26 92 34 98 L40 92 C36 86 36 76 40 68 Z '
    + 'M70 68 C76 82 74 92 66 98 L60 92 C64 86 64 76 60 68 Z '
    + 'M44 68 H56 V98 H44 Z',
  flame:
    // Três línguas de fogo, a central mais alta.
    'M50 2 C56 20 66 28 68 42 C70 30 74 26 76 22 C82 36 84 46 82 56 '
    + 'C79 78 66 96 50 98 C34 96 21 78 18 56 C16 46 18 36 24 22 '
    + 'C26 26 30 30 32 42 C34 28 44 20 50 2 Z',

  // — bestas —
  // Desenhadas como CABEÇAS, viradas para a esquerda (dexter, a convenção
  // heráldica). Corpo inteiro exige detalhe que some a 28px; a cabeça carrega
  // o traço que identifica o bicho — orelha, chifre, juba, presa.
  wolf:
    'M14 42 L26 12 L40 32 H56 L70 12 L80 42 '
    + 'C86 52 84 66 74 74 L58 88 H42 L26 74 C16 66 12 52 14 42 Z '
    + 'M30 46 L42 52 L30 58 Z M70 46 L58 52 L70 58 Z '
    + 'M44 68 H56 L50 78 Z',
  lion:
    // Máscara de leão. A primeira versão tinha dezesseis pontas de juba e lia
    // como um sol — a lição é que juba são poucas mechas grossas, não muitos
    // espinhos finos. Oito mechas, e o focinho ocupa o centro para o olho
    // achar a cara antes da moldura.
    'M50 2 L64 14 L82 10 L80 28 L96 40 L82 50 L94 66 L76 68 L74 88 L58 80 '
    + 'L50 98 L42 80 L26 88 L24 68 L6 66 L18 50 L4 40 L20 28 L18 10 L36 14 Z '
    + 'M32 40 L44 47 L32 54 Z M68 40 L56 47 L68 54 Z '
    + 'M38 62 H62 L56 74 H44 Z',
  stag:
    // O que identifica o cervo é a galhada, então ela ocupa metade da altura.
    'M42 52 H58 L62 72 L50 92 L38 72 Z '
    + 'M42 52 L34 40 L18 34 L22 28 L10 22 L16 16 L8 8 L20 10 L24 2 L32 12 '
    + 'L40 8 L40 20 L46 34 Z '
    + 'M58 52 L66 40 L82 34 L78 28 L90 22 L84 16 L92 8 L80 10 L76 2 L68 12 '
    + 'L60 8 L60 20 L54 34 Z',
  raven:
    // Corvo pousado, em perfil. Contorno contínuo em vez de pontas soltas:
    // a versão anterior era um respingo. Bico e cauda dão a direção.
    'M4 30 L24 34 C26 22 36 16 46 18 C54 20 58 26 58 34 '
    + 'C74 40 86 52 88 70 L74 64 L78 84 L62 74 L58 92 L46 78 L34 90 L32 72 '
    + 'L16 78 L22 60 C16 52 12 42 4 30 Z '
    + 'M34 30 A4 4 0 1 0 34.1 30 Z',
  fish:
    'M10 50 C26 26 60 26 76 50 C60 74 26 74 10 50 Z '
    + 'M76 50 L96 30 V70 Z '
    + 'M42 30 L48 40 H36 Z '
    + 'M28 44 A4 4 0 1 0 28.1 44 Z',
  boar:
    // Cabeça de javali virada para a esquerda: focinho achatado à frente,
    // presa apontando para cima, orelha em cunha atrás. A silhueta só fecha
    // quando o focinho é reto e baixo — arredondado, vira porco doméstico.
    'M6 56 L20 48 L22 38 L34 44 C44 30 62 28 74 38 C86 48 88 66 78 78 '
    + 'C68 90 50 90 40 80 L22 84 L26 70 L8 68 Z '
    + 'M18 60 L4 44 L20 50 Z '
    + 'M60 50 A5 5 0 1 0 60.1 50 Z',

  // — obra humana —
  tower:
    // Torre ameada. Ocupa quase toda a caixa: torre pequena em campo grande
    // some. Três merlões bastam — cinco viram serrilha a 28px.
    'M16 30 H28 V18 H40 V30 H60 V18 H72 V30 H84 V96 H16 Z '
    + 'M40 52 H60 V78 H40 Z '
    + 'M28 44 H36 V52 H28 Z M64 44 H72 V52 H64 Z',
  key:
    'M50 6 A20 20 0 1 1 49.9 6 Z '
    + 'M50 18 A8 8 0 1 0 50.1 18 Z '
    + 'M45 46 H55 V94 H45 Z '
    + 'M55 62 H74 V72 H55 Z M55 78 H68 V88 H55 Z',
  anchor:
    'M45 4 H55 V22 H45 Z M28 22 H72 V32 H28 Z M45 32 H55 V80 H45 Z '
    + 'M10 50 C10 78 28 92 50 96 C72 92 90 78 90 50 H78 '
    + 'C78 70 66 82 50 86 C34 82 22 70 22 50 Z',
  hammer:
    // Martelo de guerra visto de lado. Cabeça simétrica sobre cabo centrado é
    // exatamente o desenho da letra T — foi o que aconteceu duas vezes. A
    // saída é assimetria: cabeça deslocada, com face reta de um lado e bico
    // do outro, e cabo passando por dentro dela.
    'M14 16 H62 L74 30 L62 44 H14 Z '
    + 'M62 22 L86 30 L62 38 Z '
    + 'M32 44 H48 V94 H32 Z '
    + 'M26 94 H54 V100 H26 Z',
  ship:
    // Nau vista de bordo. O casco tem de dominar: nas versões anteriores a
    // vela pesava mais e o conjunto lia como taça ou lampião.
    'M46 4 H54 V44 H46 Z '
    + 'M54 10 C70 16 78 26 80 38 H54 Z '
    + 'M46 10 C30 16 22 26 20 38 H46 Z '
    + 'M4 52 H96 C94 76 74 94 50 98 C26 94 6 76 4 52 Z '
    + 'M18 60 H82 L78 68 H22 Z',
};

export type ChargeName = keyof typeof CHARGES;

/**
 * As cargas que o sorteio pode usar.
 *
 * Isto foi medido, não suposto. Cada carga foi renderizada nas 73 Casas numa
 * folha de contato e olhada a 100px e a 28px. Depois de três rodadas de
 * redesenho, o resultado se separou com nitidez:
 *
 *  - Formas geométricas e naturais convergem. `mullet`, `lozenge`, `cross`,
 *    `crescent`, `sun`, `rose`, `flame`, `fish`, `key`, `anchor` acertaram na
 *    primeira ou na segunda tentativa.
 *  - Figuras representativas não. `lion` virou bola espinhosa em três
 *    tentativas seguidas; `hammer` leu como a letra T em todas, mesmo com
 *    cabeça assimétrica e contrapeso; `ship` insiste em parecer taça.
 *
 * A conclusão prática é que path data escrito à mão tem um teto de
 * complexidade, e desenhar bicho por coordenada fica abaixo dele. Deixá-las
 * no sorteio contaminaria dezenas de Casas com brasão ruim, então elas saem —
 * mas continuam disponíveis por override, porque uma Casa cujo brasão o
 * cânone define como leão precisa de um leão, e um leão sofrível é melhor que
 * nenhum.
 *
 * Se for substituí-las, o caminho é arte vetorial desenhada de fato (num
 * editor, exportada e colada aqui como path), não mais uma rodada de
 * coordenadas escritas à mão. Estas seis são a fila de prioridade.
 */
const WEAK_CHARGES: readonly ChargeName[] = ['lion', 'raven', 'boar', 'garb', 'hammer', 'ship'];

export const RELIABLE_CHARGES: readonly ChargeName[] =
  (Object.keys(CHARGES) as ChargeName[]).filter(c => !WEAK_CHARGES.includes(c));

// ---------------------------------------------------------------------------
// Divisões do campo
// ---------------------------------------------------------------------------

/**
 * A divisão vem antes da carga: é ela que dá "personalidade" ao brasão mesmo
 * quando duas Casas sorteiam a mesma besta. `plain` é maioria de propósito —
 * campo liso com uma carga forte é o padrão histórico, e campo dividido com
 * carga por cima satura rápido.
 */
const DIVISIONS = [
  'plain', 'plain', 'plain', 'plain',
  'per-pale', 'per-fess', 'per-bend', 'quarterly', 'per-chevron',
] as const;

type Division = typeof DIVISIONS[number];

function fieldPaths(div: Division, a: string, b: string): string {
  const bg = `<rect width="100" height="120" fill="${a}"/>`;
  switch (div) {
    case 'per-pale':    return bg + `<rect x="50" width="50" height="120" fill="${b}"/>`;
    case 'per-fess':    return bg + `<rect y="60" width="100" height="60" fill="${b}"/>`;
    case 'per-bend':    return bg + `<path d="M0 0 L100 0 L0 120 Z" fill="${b}"/>`;
    case 'quarterly':   return bg
      + `<rect x="50" width="50" height="60" fill="${b}"/>`
      + `<rect y="60" width="50" height="60" fill="${b}"/>`;
    case 'per-chevron': return bg + `<path d="M0 120 L50 46 L100 120 Z" fill="${b}"/>`;
    default:            return bg;
  }
}

// ---------------------------------------------------------------------------
// Brasões canônicos
// ---------------------------------------------------------------------------

/**
 * As Casas que os livros descrevem têm arma fixa; o resto é sorteado.
 *
 * Repare que isto é a *descrição* — qual besta, quais cores —, não o desenho.
 * A silhueta vem de `CHARGES`, escrita aqui. É essa separação que mantém o
 * projeto do lado certo da linha: seguir o cânone sem copiar a arte de
 * ninguém.
 */
export const CANON_ARMS: Record<string, { charge: ChargeName; field: Tincture; charged: Tincture; division?: Division }> = {
  targaryen_throne: { charge: 'flame',  field: 'sable',   charged: 'gules'  },
  stark:            { charge: 'wolf',   field: 'argent',  charged: 'sable'  },
  lannister:        { charge: 'lion',   field: 'gules',   charged: 'or'     },
  baratheon:        { charge: 'stag',   field: 'or',      charged: 'sable'  },
  arryn:            { charge: 'crescent', field: 'azure', charged: 'argent' },
  tully:            { charge: 'fish',   field: 'azure',   charged: 'argent', division: 'per-pale' },
  greyjoy:          { charge: 'ship',   field: 'sable',   charged: 'or'     },
  tyrell:           { charge: 'rose',   field: 'vert',    charged: 'or'     },
  martell:          { charge: 'sun',    field: 'or',      charged: 'gules'  },
  bolton:           { charge: 'lozenge', field: 'argent', charged: 'gules'  },
  manderly:         { charge: 'fish',   field: 'vert',    charged: 'argent' },
  mormont:          { charge: 'boar',   field: 'vert',    charged: 'sable'  },
  frey:             { charge: 'tower',  field: 'argent',  charged: 'azure'  },
  clegane:          { charge: 'wolf',   field: 'or',      charged: 'sable'  },
  baelish:          { charge: 'mullet', field: 'argent',  charged: 'vert'   },
};

// ---------------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------------

export interface SigilOptions {
  /** Lado do SVG em px. O escudo é mais alto que largo (proporção 5:6). */
  size?: number;
  /** Sobrepõe o sorteio — útil para dar arma a uma Casa nova sem editar o gerador. */
  arms?: { charge: ChargeName; field: Tincture; charged: Tincture; division?: Division };
  /** Recorta em formato de escudo. Desligue para brasão em bandeira/estandarte. */
  shield?: boolean;
}

interface Arms {
  charge: ChargeName;
  field: Tincture;
  charged: Tincture;
  division: Division;
  divisionTincture: Tincture;
}

/** Resolve as armas de uma Casa: canônicas se houver, sorteadas se não. */
export function armsFor(houseId: string, override?: SigilOptions['arms']): Arms {
  const p = picker(hash(houseId));
  const base = override ?? CANON_ARMS[houseId];

  if (base) {
    return {
      charge: base.charge,
      field: base.field,
      charged: base.charged,
      division: base.division ?? 'plain',
      divisionTincture: sameClassAs(base.field, p),
    };
  }

  const field = p.pick([...METALS, ...COLOURS, ...COLOURS] as Tincture[]);
  return {
    charge: p.pick(RELIABLE_CHARGES),
    field,
    charged: contrasting(field, p),
    division: p.pick(DIVISIONS),
    divisionTincture: sameClassAs(field, p),
  };
}

/**
 * Escudo em ponta ("heater shield"): ombros retos, base em ogiva. É a forma
 * que o olho lê como brasão sem precisar de moldura ou legenda.
 */
const SHIELD_PATH = 'M4 4 H96 V56 C96 88 74 106 50 116 C26 106 4 88 4 56 Z';

export function sigilSvg(houseId: string, opts: SigilOptions = {}): string {
  const size = opts.size ?? 96;
  const useShield = opts.shield !== false;
  const a = armsFor(houseId, opts.arms);

  const field = TINCTURES[a.field];
  const second = TINCTURES[a.divisionTincture];
  const charge = TINCTURES[a.charged];
  const clipId = `sh-${hash(houseId).toString(36)}`;

  // Fimbriação: só entra quando a regra da tintura é quebrada (armas canônicas
  // como o dragão em campo negro). O fio é do tipo oposto ao da carga, que é
  // exatamente o que devolve o contraste.
  const quebra = breaksTinctureRule(a.field, a.charged);
  const fio = quebra
    ? ` stroke="${isMetal(a.charged) ? TINCTURES.sable : TINCTURES.argent}" `
      + `stroke-width="3" stroke-linejoin="round" paint-order="stroke"`
    : '';

  // A carga é escalada para ~70% da largura e sobe um pouco: num escudo em
  // ponta o centro óptico fica acima do centro geométrico.
  // `fill-rule="evenodd"` não é detalhe: várias cargas criam o furo com um
  // subpath interno — o miolo vazado da rosa, o olho do peixe, o anel da
  // chave, a janela da torre, a barriga da lua. Na regra padrão (nonzero)
  // esses furos preenchem sólido e a carga vira um borrão.
  const inner = `<g transform="translate(50 52) scale(0.70) translate(-50 -50)">`
    + `<path d="${CHARGES[a.charge]}" fill="${charge}" fill-rule="evenodd"${fio}/></g>`;

  const body = fieldPaths(a.division, field, second) + inner;

  if (!useShield) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" `
      + `width="${Math.round(size * 100 / 120)}" height="${size}" role="img" `
      + `aria-label="Brasão de ${houseId}">${body}</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" `
    + `width="${Math.round(size * 100 / 120)}" height="${size}" role="img" `
    + `aria-label="Brasão de ${houseId}">`
    + `<defs><clipPath id="${clipId}"><path d="${SHIELD_PATH}"/></clipPath></defs>`
    + `<g clip-path="url(#${clipId})">${body}</g>`
    + `<path d="${SHIELD_PATH}" fill="none" stroke="#0d0f14" stroke-width="4"/>`
    + `</svg>`;
}

/** Data-URI pronto para `background-image` ou `<img src>`. */
export function sigilDataUri(houseId: string, opts: SigilOptions = {}): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(sigilSvg(houseId, opts));
}
