# Direção de arte

Tudo é vetor gerado ou escrito à mão. `src/assets/` está vazio de propósito: sem
imagens externas, sem fontes baixadas, sem texturas. Isso mantém o build leve, o
visual coerente e o projeto longe de material protegido.

## O estado atual, sem eufemismo

O tema é um dashboard escuro genérico — `--bg:#070b14`, acento `#3b82f6`, fonte
`system-ui`. Funciona, mas não tem nada de medieval. São 535 linhas de CSS em 12
painéis. É o maior espaço livre do projeto e o lugar onde pouco trabalho rende
muito.

## Paleta

A atual, em `src/styles.css`, é azul-de-produto. Uma direção mais própria do
mundo mantém a mesma estrutura de variáveis (não quebra nada) e troca os
valores por pergaminho, tinta e ferro:

```css
:root{
  --bg:#12100c;        /* tinta quase preta, quente */
  --panel:#1b1712;
  --panel2:#241e17;
  --line:#3a2f24;      /* couro */
  --text:#e8ded0;      /* pergaminho */
  --muted:#9c8d78;
  --good:#5c8a4a;      /* verde-folha, não neon */
  --warn:#c89432;      /* âmbar de vela */
  --bad:#9e3b32;       /* vermelho-tijolo */
  --accent:#b08d4d;    /* ouro fosco */
  --card:#1f1a14;
}
```

O princípio: **nada saturado.** Cores puras de tela (`#ff0000`, `#00ff00`) tiram
o mundo do lugar imediatamente. Toda cor puxa para terra.

As regiões já têm cor própria em `map-geo.ts` (`REGION_COLORS`) — use-as como
acento contextual: o painel muda de tom conforme onde o jogador está. É barato e
dá sensação de lugar.

## Heráldica

O gerador está em `scripts/heraldry.ts` (copie para
`src/app/core/engine/` ao integrar). Determinístico pelo id da Casa.

Integração natural: brasão de 28px na lista de Casas e nas linhas de diplomacia,
de 96px no cabeçalho, de 240px no painel da Casa. Como é SVG inline ou data-URI,
não há requisição de rede nem arquivo a versionar.

### Vocabulário

- **Tinturas**: metais (`or`, `argent`) e cores (`gules`, `azure`, `sable`,
  `vert`, `purpure`). Os valores são calibrados para tela — o ouro puxa para o
  mel porque amarelo puro vibra feio no escuro; o argênteo não é branco absoluto
  porque branco puro brilha demais num tema noturno.
- **Divisões**: `plain` (maioria, de propósito), `per-pale`, `per-fess`,
  `per-bend`, `quarterly`, `per-chevron`.
- **Cargas**: 23 desenhadas, 17 no sorteio.

### Regras que não podem cair

1. **Regra da tintura** — nunca cor sobre cor, nem metal sobre metal. Quando o
   cânone exige a quebra, aplica-se **fimbriação** (fio de metal contornando a
   carga), não troca de cor.
2. **As duas metades de um campo dividido são da mesma classe.** Heraldicamente
   é pouco ortodoxo, mas garante que a carga contraste com as duas. A versão
   ortodoxa deixou seis escudos literalmente vazios.
3. **`fill-rule="evenodd"`** — o miolo da rosa, o olho do peixe, o anel da chave,
   a janela da torre e a barriga da lua são furos feitos por subpath. Na regra
   padrão (nonzero) eles preenchem sólido.
4. **Nada de arco oposto para fazer furo.** O crescente construído como dois
   arcos de sentido contrário desenha certo em nonzero e **desaparece por
   completo** em evenodd. Furo se faz por subtração de formas fechadas.

### Cargas fracas

`lion`, `raven`, `boar`, `garb`, `hammer` e `ship` estão fora do sorteio. Path
data escrito à mão converge para geometria e falha para figura representativa —
o leão virou bola espinhosa em três tentativas, o martelo leu como "T" em todas.
Continuam disponíveis por override, porque uma Casa cujo cânone pede leão precisa
de um leão. Para substituí-las de verdade: desenhe num editor vetorial, exporte,
cole o path. Não tente mais uma rodada de coordenadas à mão.

## Arte gerada exige asserção sobre pixels

Duas verificações sobre o modelo passaram limpas enquanto seis escudos saíam
vazios. Estrutura válida não é imagem visível. O teste que pega rasteriza:

```js
import { chromium } from 'playwright';
import { CHARGES } from './heraldry.js';

const b = await chromium.launch({
  headless: false, args: ['--headless=new', '--no-sandbox'],
  executablePath: '/opt/pw-browsers/chromium',
});
const p = await b.newPage({ viewport: { width: 200, height: 200 } });

for (const [nome, d] of Object.entries(CHARGES)) {
  const cobertura = await p.evaluate(async ({ d }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" `
      + `width="100" height="100"><path d="${d}" fill="#000" fill-rule="evenodd"/></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 100;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, 100, 100).data;
    let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 128) n++;
    return n / 10000;
  }, { d });
  // Abaixo de 6% some no escudo; acima de 75% vira mancha.
  if (cobertura < 0.06 || cobertura > 0.75) console.log('FORA DA FAIXA:', nome, cobertura);
}
await b.close();
```

## Sempre olhe a folha de contato

Números não dizem se está bonito. Gere as 73 numa grade única, rasterize e
**olhe**. Foi assim que apareceram, um round por vez: o martelo que era um "T",
a rosa sem miolo, o leão-sol, e por fim a lua invisível. Cada um passava em todas
as asserções da rodada anterior.

O script de folha de contato monta uma grade de 10 colunas e escreve
`contact-sheet.svg`; embrulhe em HTML e capture com Playwright para ver como PNG
(navegar direto ao `.svg` costuma dar timeout na captura).

## Mapa

`map-geo.ts` já traz o litoral, as nove regiões recortadas por `clipPath`, ilhas,
rios e os 295 locais posicionados. Ganhos possíveis, em ordem de retorno:

1. **Relevo** — glifos de montanha, floresta e pântano, repetidos por região.
   Barato e muda tudo na leitura.
2. **Estação** — a paleta desloca com o ciclo de estações do jogo. Inverno
   dessatura e embranquece o norte.
3. **Estradas** — o Caminho do Rei e as rotas principais como linhas finas; hoje
   `TRAVEL_GRAPH` existe mas não se vê.
4. **Fronteiras vivas** — quando um assento é ocupado ou uma Casa jura a outra, a
   cor da região devia acompanhar.

Regra de sempre: geometria própria. Se precisar de referência geográfica, use
descrição textual das fontes, nunca traço por cima de mapa alheio.
