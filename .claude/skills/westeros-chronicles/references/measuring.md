# Medindo o mundo

Esqueleto pronto do script descartável. Ele não vai para o repositório — vive no
scratchpad, roda, imprime o número, e some.

## Por que existe

Uma mecânica pode compilar, passar nos testes e nunca acontecer numa campanha de
155 anos. Aconteceu três vezes nesta base (a deriva de relações, o termo de
refém, a agressão da IA). Nenhuma revisão de código pega; só contar pega.

## O script

Salve como `medir.ts` dentro do projeto (`westeros-chronicles-angular/tests/`),
rode, e apague depois — o `tsconfig.test.json` já inclui `tests/**/*.ts`.

```ts
import { GameState, HouseState } from '../src/app/core/models';
import { REGIONS, LOCATIONS, TRAVEL_GRAPH } from '../src/app/core/data/regions';
import { HOUSES } from '../src/app/core/data/houses';
import { Rng } from '../src/app/core/engine/rng';
import { buildInitialState, advanceTurn } from '../src/app/core/engine/sim';

function toMap<T extends { id: string }>(a: T[]): Record<string, T> {
  return a.reduce((m, x) => { m[x.id] = x; return m; }, {} as Record<string, T>);
}

function baseHouses(): Record<string, HouseState> {
  const m: Record<string, HouseState> = {};
  for (const h of HOUSES) {
    m[h.id] = {
      ...h, prestige: h.prestigeBase, relations: {}, leaderId: '',
      economy: {
        peasants: 0, soldiers: 0, farms: 0, trainingGrounds: 0, walls: 0,
        tradeLastDelegationTurn: 0, tradePartners: [],
        taxRate: h.suzerainId ? 0.15 : 0.0,
      },
      resources: { gold: 0, food: 0, goods: 0 },
      army: { levies: 0, menAtArms: 0, squires: 0, knights: 0, dragons: 0, stationedRatio: 0.7 },
    };
  }
  return m;
}

function novoJogo(seed: number, houseId = 'manderly') {
  const rng = new Rng(seed);
  const state = buildInitialState(seed, { playerHouseId: houseId, gender: 'M' }, {
    locations: toMap(LOCATIONS), regions: toMap(REGIONS),
    travelGraph: TRAVEL_GRAPH, houses: baseHouses(), characters: {},
  });
  return { state, rng };
}

// Roda o MUNDO até o ano alvo, independentemente de o jogador sobreviver.
// A linhagem pode se extinguir antes de 305 — é desfecho legítimo do jogo, mas
// aqui interessa o mundo, então `game.over` é reposto a cada turno.
function rodarMundo(state: GameState, rng: Rng, ano: number): void {
  let guard = 0;
  while (guard++ < 40000) {
    if (state.date.year >= ano) break;
    state.game.over = false;
    advanceTurn(state, rng, { silent: true });
  }
}

for (const seed of [11, 42, 777]) {
  const { state, rng } = novoJogo(seed);
  rodarMundo(state, rng, 305);

  // ——— troque daqui para baixo pelo que você quer contar ———
  let hostis = 0;
  for (const h of Object.values(state.houses)) {
    for (const v of Object.values(h.relations)) if (v <= 20) hostis++;
  }
  const guerras = state.chronicle.filter(e => e.title.startsWith('Guerra declarada')).length;
  console.log(`seed ${seed}: pares hostis=${hostis} guerras=${guerras}`);
}
```

Rode com:

```bash
npx tsc -p tsconfig.test.json && node .test-build/tests/medir.js
```

Uma campanha completa leva ~16–20 s, então três seeds são cerca de um minuto.
Vale sempre.

## Onde ler o resultado

**A crônica é o registro permanente.** `state.wars` é podado (guerras encerradas
há mais de 400 turnos somem), então contar por lá subconta. Um teste já falhou
por isso. Para qualquer coisa histórica, filtre `state.chronicle` por título ou
tag.

## Medir ao longo do tempo, não só no fim

Um número no ano 305 esconde a forma da curva. Para saber se algo cresce, satura
ou explode, amostre em pontos:

```ts
const marcos = [180, 240, 305];
for (const ano of marcos) {
  rodarMundo(state, rng, ano);
  console.log(ano, contarOQueImporta(state));
}
```

Foi assim que a economia se revelou acumulação pura (ouro ×5.285 ao longo da
campanha) e que as rixas se mostraram crescendo de forma saudável (17 → 40 → 66)
em vez de virarem guerra civil permanente.

## Distribuição, não só total

Duas perguntas quase sempre valem juntas:

- **Aconteceu?** — a contagem.
- **Ficou saudável?** — a mediana, ou o mínimo e o máximo.

As rixas passaram nas duas: pares hostis subiram de 24 para 66 **e** a mediana
das relações ficou intacta em 45. Se a mediana tivesse desabado, o mundo teria
virado inimigo de todos — número bom, jogo pior.
