# O motor por dentro

Detalhes que economizam horas quando se mexe na simulação.

## Tempo

- 1 turno = 1/20 de ano. 20 turnos por ano.
- Campanha: 150 a 305 DC.
- `absTurn = (year - 150) * 20 + turn` — sempre use `state.date.absoluteTurn`,
  nunca recalcule à mão.

## A ordem dentro do turno importa

Está em `advanceTurn()` (`sim.ts`) e a sequência foi conquistada corrigindo
bugs, não escolhida no papel. Mexer nela quebra coisas distantes.

A ordem em `applyCanonEventsForTurn`:

1. Nascimentos pendentes e eventos explícitos de nascimento/morte
2. Pessoas automáticas
3. Mandatos e guerras
4. Crises sucessórias
5. Eventos restantes

**Por que mortes vêm antes de mandatos.** `survivedOwnCanonDeath()` responde "esta
pessoa escapou da própria morte registrada?". Se os mandatos rodassem primeiro, a
resposta seria verdadeira no próprio turno da morte — a pessoa ainda não morreu,
mas o marco já passou. Duas correções foram necessárias juntas: trocar `>=` por
`>` **e** reordenar o turno. Só uma das duas não resolvia.

**Mortes passam sempre por `handleDeathImmediate()`.** Marcar `alive = false` na
mão deixa assento, viuvez e sucessão inconsistentes. Já aconteceu em
`resolveSuccessionCrisis` e `finalizeEndedCanonWar`.

**Ninguém morto lidera.** Eventos de sucessão instalavam cadáveres como líderes.
Ao escrever qualquer coisa que atribua `leaderId`, cheque `alive`.

## Sem ciclos de import

A ordem de dependência está na tabela do SKILL.md. `narration.ts` é a folha —
todo mundo escreve nele e ele não conhece ninguém. `sim.ts` é o topo.

Um módulo novo entre `succession` e `warfare` pode importar de `narration`,
`rules`, `claims`, `canon-divergence`, `succession` e `lifecycle`. Foi assim que
`hostages.ts` entrou: importa `succession` (para `handleDeathImmediate`) e
`lifecycle` (para `applyMarriage`), e é importado por `warfare`.

## Divergência canônica

Cada figura histórica acumula um placar de interferência por categoria, com
teto por categoria e decaimento:

| Categoria | Ações | Peso | Teto |
|---|---|---|---|
| social | conversar, beber, caçar, flores | 1 | 2 |
| corte | presentear | 2 | 2 |
| íntimo | beijar | 2 | 4 |
| vínculo | relações, apoiar guerra | 3 / 2 | 6 |
| voto | casar, apoiar pretendente | 6 | — |

Limiar: **5**. Social + corte saturam em 4 — de propósito, para que gentilezas
repetidas nunca tirem alguém do próprio destino por acidente (o bug original:
cinco cliques em "Conversar" bastavam). Laços fracos decaem ~1 ponto/ano; votos
não decaem.

Eventos e guerras declaram pré-condições (`requires: { aliveCanonIds,
deadCanonIds, leaderOf }`, `instigatorCanonId`). Quando falham, publica-se a
variante alternativa (`altBody`) e a linha do tempo segue divergente.

**O assento do jogador é sempre contestado, nunca reatribuído.** A rajada de
sincronização de 298 instalava os senhores canônicos de oito Casas de uma vez e
atropelava até 148 anos de campanha sem aviso. `seatIsContested()` protege isso:
o cânone pode retomar o assento, mas só vencendo a disputa.

## Ids não são reproduzíveis

`uid()` deriva de `Math.random()`/`Date.now()`. Toda decisão da simulação vem do
`Rng` semeado e é reproduzível, mas **os ids das entidades não são**.

Consequência prática para testes: compare estado **por valor**. `worldSignature()`
em `tests/engine.test.ts` mostra o padrão — nomes, contagens, números, nunca ids.

## Playwright neste ambiente

O Chromium instalado não aceita `--headless=old`, que é o que o Playwright passa
por padrão no modo headless. A invocação que funciona:

```js
const browser = await chromium.launch({
  headless: false,
  args: ['--headless=new', '--no-sandbox'],
  executablePath: '/opt/pw-browsers/chromium',
});
```

E não instale browsers: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` já está
configurado.

Para rodar a suíte de UI, o servidor precisa estar de pé **antes**; o runner só
se conecta. Subir e matar o servidor de dentro do runner mata o próprio runner
junto (`process.kill(-pid)` alcança o grupo inteiro).

## Onde editar conteúdo do mundo

- Casas: `src/app/core/data/houses.ts` e `expanded.ts`
- Regiões, locais, rotas: `src/app/core/data/regions.ts`
- Geografia do mapa: `src/app/core/data/map-geo.ts`
- Cânone (pessoas, eventos, guerras, mandatos): `src/app/core/data/canon.ts`
- Eventos agendados: `src/app/core/data/timeline.ts`
