/**
 * Modo de mapa por imagem.
 *
 * O mapa vetorial deste projeto é desenhado à mão em coordenadas, e por isso
 * nunca vai ter a fidelidade de um mapa cartografado de verdade. Quem quiser um
 * mapa fiel precisa trazer a própria imagem — e é isso que este arquivo
 * permite, sem obrigar a reposicionar os 295 locais na mão.
 *
 * ┌─ SOBRE DIREITOS AUTORAIS ─────────────────────────────────────────────┐
 * │ Este repositório NÃO acompanha imagem de mapa nenhuma, e não deve      │
 * │ passar a acompanhar. Os mapas oficiais (HBO, e os de Jonathan Roberts  │
 * │ nas edições dos livros) são obra protegida; mapas de fãs pertencem a   │
 * │ quem os desenhou, e continuam sendo obra derivada do mundo de GRRM.    │
 * │                                                                        │
 * │ Use este modo com uma imagem que VOCÊ tenha o direito de usar: uma que │
 * │ você mesmo desenhou, uma licenciada para o seu caso de uso, ou uma que │
 * │ fique apenas na sua cópia local e nunca seja publicada.                │
 * │                                                                        │
 * │ Se o jogo for publicado (GitHub Pages, por exemplo), a imagem vai      │
 * │ junto — e aí a licença dela precisa cobrir isso.                       │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * ## Como usar
 *
 * 1. Ponha o arquivo em `src/assets/` (ex.: `src/assets/westeros.jpg`).
 * 2. Descubra a posição de DOIS locais conhecidos na imagem, em pixels.
 *    Abra a imagem em qualquer editor e leia as coordenadas do cursor sobre
 *    Winterfell e sobre Porto Real. Dois bastam.
 * 3. Preencha `MAP_IMAGE` abaixo com o caminho, as dimensões e as duas
 *    âncoras. É só isso: os outros 293 locais se posicionam sozinhos.
 * 4. Para voltar ao mapa vetorial, ponha `MAP_IMAGE = null`.
 *
 * ## Por que duas âncoras bastam
 *
 * Um mapa de Westeros é sempre a mesma geografia em escala e enquadramento
 * diferentes — ninguém publica Westeros girado ou espelhado. Então a
 * transformação entre o espaço vetorial daqui e o espaço da sua imagem é uma
 * semelhança: uma escala e um deslocamento, sem rotação. Dois pontos definem
 * isso exatamente.
 *
 * Escolha âncoras BEM SEPARADAS. Duas cidades vizinhas dão uma base curta, e
 * qualquer erro de alguns pixels na leitura vira erro grande do outro lado do
 * mapa. Winterfell e Porto Real são a diagonal mais útil.
 */

export interface MapImageAnchor {
  /** Id do local, como em `regions.ts` (ex.: 'winterfell'). */
  locationId: string;
  /** Onde ele fica NA IMAGEM, em pixels, a partir do canto superior esquerdo. */
  x: number;
  y: number;
}

export interface MapImageConfig {
  /** Caminho servido pelo Angular, ex.: 'assets/westeros.jpg'. */
  src: string;
  /** Dimensões naturais da imagem, em pixels. */
  width: number;
  height: number;
  /** Dois locais conhecidos, quanto mais afastados melhor. */
  anchors: [MapImageAnchor, MapImageAnchor];
  /** Crédito exibido no rodapé do mapa. Obrigatório se a licença exigir. */
  attribution?: string;
}

/**
 * Nulo = mapa vetorial (o padrão, e o único que o repositório distribui).
 *
 * Exemplo de configuração preenchida:
 *
 *     {
 *       src: 'assets/westeros.jpg',
 *       width: 2000,
 *       height: 3000,
 *       anchors: [
 *         { locationId: 'winterfell',    x: 820,  y: 690 },
 *         { locationId: 'kings_landing', x: 1180, y: 1720 },
 *       ],
 *       attribution: 'Mapa por Fulano — CC BY-NC 4.0',
 *     }
 */
export const MAP_IMAGE: MapImageConfig | null = null;

export interface Similarity {
  scale: number;
  dx: number;
  dy: number;
}

/**
 * Calcula a semelhança que leva o espaço vetorial ao espaço da imagem.
 *
 * Devolve `null` quando as âncoras não servem — ids desconhecidos, ou os dois
 * pontos praticamente em cima um do outro, que daria uma escala instável ou
 * uma divisão por zero. Nesse caso o app cai de volta no mapa vetorial em vez
 * de desenhar tudo empilhado num canto.
 */
export function solveSimilarity(
  cfg: MapImageConfig,
  vectorPoints: Record<string, { x: number; y: number }>
): Similarity | null {
  const [a, b] = cfg.anchors;
  const va = vectorPoints[a.locationId];
  const vb = vectorPoints[b.locationId];
  if (!va || !vb) return null;

  const distVetor = Math.hypot(vb.x - va.x, vb.y - va.y);
  const distImagem = Math.hypot(b.x - a.x, b.y - a.y);
  if (distVetor < 1 || distImagem < 1) return null;

  const scale = distImagem / distVetor;
  return {
    scale,
    dx: a.x - va.x * scale,
    dy: a.y - va.y * scale,
  };
}

export function applySimilarity(p: { x: number; y: number }, s: Similarity): { x: number; y: number } {
  return { x: p.x * s.scale + s.dx, y: p.y * s.scale + s.dy };
}
