---
name: westeros-chronicles
description: >
  Evolui o Westeros Chronicles — o fan-game em Angular de simulação por turnos
  guiada por chat, mapa SVG e cânone de Game of Thrones que vive em
  westeros-chronicles-angular/. Use esta skill sempre que o pedido tocar neste
  jogo ou num jogo do mesmo feitio: adicionar ou rebalancear qualquer mecânica
  (guerra, casamento, sucessão, economia, diplomacia, rixas, reféns, cânone),
  mexer no mapa, criar ou melhorar arte e gráficos, gerar brasões e heráldica,
  ajustar paleta e identidade visual, escrever eventos históricos ou histórias
  de casas vassalas, investigar por que uma mecânica "não acontece" na prática,
  ou estender o motor de divergência canônica. Vale também quando o pedido vier
  solto — "melhore o jogo", "deixe mais bonito", "adicione profundidade", "isso
  está sem graça" — porque a skill traz o método de medição que separa melhoria
  real de mudança que só parece boa no código.
---

# Westeros Chronicles

Simulação de 155 anos (150–305 DC) em turnos de 1/20 de ano, onde a história
registrada de Westeros acontece sozinha mas responde às decisões do jogador.
Angular 17 standalone na interface; o motor é TypeScript puro, sem dependência
de Angular, em `src/app/core/engine/`.

## A regra que não se negocia

O material oficial de HBO e George R. R. Martin é protegido. **Nada de arte,
mapa, brasão, retrato, fonte ou textura oficial entra neste projeto** — nem
copiado, nem traçado por cima, nem "inspirado o bastante para ser reconhecível
como aquele desenho".

A linha é mais útil quando entendida do que decorada: **fatos do mundo ficcional
não são protegidos; desenhos específicos são.** Que os Stark tenham um lobo
gigante cinzento em campo branco é fato do cânone e pode guiar o que se desenha.
O lobo *daquela* produção é obra deles. Então o cânone dita a descrição, e o
traço tem de ser nosso — foi assim que o mapa vetorial e a heráldica deste
projeto nasceram, e é assim que continua.

Se alguém pedir "use o mapa real da HBO" ou "pega o brasão oficial", entregue a
versão original e diga por quê, em uma linha. Não é obstrução: é a única forma
de o projeto poder existir publicamente.

## Meça antes de mudar

Este é o hábito central da skill, e o que mais protege o projeto. Sem ele, é
fácil escrever uma mecânica correta, elegante e completamente inerte — e não
descobrir nunca, porque o código "funciona".

O ciclo é simples e barato:

1. **Escreva um script descartável** que roda a campanha inteira e imprime o
   número que interessa. Ele vive no scratchpad, não no repositório.
2. **Rode em pelo menos 3 seeds** até o ano 305. Uma seed mente.
3. **Só então mude.** Rode de novo. Compare.
4. **Escreva o número no commit e na documentação.** "Melhorei as relações" não
   informa nada; "24 → 66 pares hostis" informa.

O motor não depende de Angular, então o script compila e roda direto no Node —
veja `references/measuring.md` para o esqueleto pronto e o comando de compilação.

### Três vezes em que isto salvou o projeto

Não são hipóteses. São o histórico desta base, e cada uma teria virado bug
silencioso:

**A deriva de relações que piorou tudo.** As Casas quase nunca se odiavam o
bastante para o casus belli de rixa (exige relação ≤ 20). A correção óbvia foi
atrito difuso sobre pares sorteados a cada turno. Medido: os pares hostis caíram
de 24 para **9**. A aritmética condenava a ideia desde o início — com 83.232
pares, cada um seria tocado meia vez numa campanha inteira. O modelo que
funcionou foi o oposto: poucas rixas com nome, causa declarada e aprofundamento
lento. Resultado 24 → **66**, com a mediana das relações intacta em 45.

**O termo de paz que nascia morto.** Reféns e casamentos entraram como termos
negociáveis, com preço em pontuação de guerra. Tudo compilava, os testes
passavam. Medido: **48% das mesas de paz podiam exigir um refém e nenhuma
exigia** — a IA leva sempre o termo mais caro que a pontuação sustenta, e com
placar 100 a vassalagem ganha. Só a medição revelou que a mecânica era
decorativa. A correção veio da própria história: em Westeros o refém não compete
com a vassalagem, ele a sela.

**A IA que nunca declarava guerra.** Duas causas, ambas invisíveis na leitura do
código: os limiares estavam calibrados para a economia anterior aos tetos
(exigiam `levies >= 80` quando o novo máximo virou 75), e o alvo era sorteado
*antes* de checar o casus belli, quando só ~5% dos vizinhos mais fracos dão um.
Hoje são 10 a 14 guerras por século.

O padrão que se repete: **a mecânica existe, compila, tem teste — e não
acontece.** Nenhuma revisão de código pega isso. Só contar pega.

## Onde o código vai

O motor está separado por domínio, sem ciclos. A ordem abaixo é a de
dependência: cada módulo só pode importar dos que estão acima dele.

| Módulo | O que faz |
|---|---|
| `narration.ts` | chat, crônica, fim de partida — folha da árvore, não conhece ninguém |
| `rules.ts` | tabelas puras (renome, títulos, mortalidade, tiers) |
| `claims.ts` | reivindicações e ocupação de assentos |
| `canon-divergence.ts` | placar de interferência, tetos, decaimento |
| `succession.ts` | herança, herdeiro do jogador, crises, `handleDeathImmediate` |
| `lifecycle.ts` | casamento, gestação, nascimento, idade, morte |
| `economy.ts` | produção, tributo, IA econômica, Banco de Ferro |
| `politics.ts` | rixas entre Casas, rancor de guerra, mediação |
| `hostages.ts` | reféns e casamentos impostos na paz |
| `warfare.ts` | casus belli, batalhas, termos de paz |
| `sim.ts` | estado inicial, motor canônico, ações do jogador, laço de turno |

Uma mecânica nova quase sempre quer ser um módulo novo, não mais linhas em
`sim.ts` — que já encolheu de 5.714 para 4.260 linhas e não deve voltar a
crescer. O padrão é: exporte `tickX(state, rng)` e chame do laço em `sim.ts`,
mais os `applyXAction()` que a interface precisar.

Detalhes que economizam horas — ordem dentro do turno, por que mortes vêm antes
de mandatos, como não criar ciclo de import — estão em `references/engine.md`.

## Determinismo

Toda decisão da simulação sai do `Rng` semeado. `Math.random()` no motor quebra
a reprodutibilidade e o teste de determinismo acusa na hora.

A exceção que confunde: `uid()` usa `Math.random()`/`Date.now()`, então **os ids
das entidades não são reprodutíveis entre execuções**. Os testes por isso
comparam estado **por valor**, nunca por identidade. Ao escrever asserção nova,
compare nomes, contagens e números — não ids.

## Gráficos

O jogo é chat e mapa, sem retratos de personagens. `src/assets/` está vazio de
propósito: **tudo é vetor gerado ou escrito à mão**, o que mantém o build leve,
o visual coerente e o projeto longe de material protegido.

### Heráldica

`scripts/heraldry.ts` gera o brasão de qualquer Casa de forma determinística a
partir do id — mesma Casa, mesmo brasão, sempre. Copie-o para
`src/app/core/engine/` ao integrar.

```ts
import { sigilSvg, sigilDataUri } from './heraldry';
sigilSvg('manderly');                    // <svg>…</svg>
sigilSvg('stark', { size: 240 });        // painel da Casa
sigilSvg('frey', { shield: false });     // estandarte, sem recorte de escudo
sigilDataUri('bolton');                  // pronto para background-image
```

Três coisas fazem o resultado parecer heráldica de verdade, e as três estão
impostas no gerador. Se for estendê-lo, preserve-as:

- **Regra da tintura**: nunca cor sobre cor, nem metal sobre metal. Existe
  porque um brasão precisava ser lido do outro lado do campo. Quando o cânone
  exige a quebra (o dragão vermelho em campo negro), o gerador aplica
  **fimbriação** — um fio de metal contornando a carga — em vez de trocar a cor.
- **Silhueta cheia**, sem gradiente nem sombra.
- **Carga generosa**, ~70% da altura. Carga pequena em campo grande lê como erro.

### O que se aprendeu desenhando as cargas

Vale saber antes de tentar de novo, porque custou três rodadas: **path data
escrito à mão converge para formas geométricas e falha para figuras
representativas.** Estrela, losango, cruz, crescente, sol, rosa, chama, peixe,
chave e âncora acertaram na primeira ou segunda tentativa. O leão virou bola
espinhosa três vezes seguidas; o martelo leu como a letra "T" em todas as
versões, mesmo com cabeça assimétrica e contrapeso.

Por isso o sorteio usa só `RELIABLE_CHARGES`. As seis fracas (`lion`, `raven`,
`boar`, `garb`, `hammer`, `ship`) continuam disponíveis por override — uma Casa
cujo cânone pede leão precisa de um leão —, mas não contaminam dezenas de Casas.
Para substituí-las, o caminho é arte vetorial desenhada num editor e exportada,
não mais uma rodada de coordenadas à mão.

### Arte gerada exige asserção sobre pixels

A lição mais cara desta parte. Duas verificações sobre o *modelo* passaram
limpas enquanto **seis escudos saíam completamente vazios**:

1. A checagem de contraste comparava campo × carga, mas não a segunda metade de
   um campo dividido — a carga caía sobre a própria cor e sumia.
2. Depois de corrigir isso, `fill-rule="evenodd"` (necessário para abrir o miolo
   da rosa, o olho do peixe, o anel da chave) fez os dois arcos opostos do
   crescente se anularem. O path existia, era válido, e não pintava nada.

Nenhuma asserção sobre estrutura pega isso. A que pega **rasteriza e conta
pixels**: cada carga tem de cobrir entre 6% e 75% da caixa — abaixo some, acima
vira mancha. O script está em `references/visual.md`, junto com a paleta e o
resto da direção de arte.

## Portões de teste

Antes de dizer que terminou:

```bash
npm test          # 26 testes de motor, determinísticos
npm run test:ui   # 9 testes de navegador (Playwright)
npx ng build      # produção
```

Mecânica nova sem teste novo é mecânica que vai apodrecer em silêncio — foram os
testes que pegaram Casas lideradas por mortos e o suserano herdando como
"herdeiro do jogador". O teste bom aqui não verifica que a função retorna o
valor certo; verifica que **a coisa acontece na campanha**: rode até 305 e conte.

O Playwright neste ambiente precisa de invocação específica (`headless: false`
com `--headless=new`, mais `executablePath`) — está em `references/engine.md`.

## Escrevendo conteúdo

Eventos canônicos, histórias de casas vassalas e narração seguem o tom da base:
seco, concreto, sem adjetivo grandiloquente. Onde as fontes são esparsas,
descreva contexto de reino em vez de inventar fatos nomeados, e marque com a tag
`contexto`. Histórias de casas menores levam a tag `local` e só são narradas a
quem está por perto — todas continuam na crônica.

Português do Brasil na interface, na crônica e nos comentários de código.
