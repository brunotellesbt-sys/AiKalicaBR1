# O que mudou nesta rodada

## 1) Bugs corrigidos no motor canônico

| Problema | Efeito no jogo |
|---|---|
| `dynasty_shift` exigia `houseId` **e** `newLeaderCanonId`; nenhum dos 3 eventos declara esses campos | Os três eventos de mudança de dinastia nunca executavam — a Casa Baratheon jamais assumia o Trono de Ferro em 283 |
| Marcos de morte escritos como `kind: 'chronicle'` publicavam o texto sem consultar o resultado, e o aviso de divergência era suprimido | A crônica registrava "Morre Aegon III" com ele vivo no mapa |
| Sucessões e mandatos instalavam o herdeiro sem olhar o titular vivo | Salvar alguém da morte canônica o depunha em silêncio, sem consequência nenhuma |
| Eventos de sucessão coroavam personagens já mortos | Casas lideradas por cadáveres |
| `computeSuccessor` podia devolver `null` sem que o chamador tratasse | `leaderId` apontando para um morto |
| Liderança era resolvida antes das mortes dentro do turno | O rei salvo era substituído antes de o marco de morte rodar |
| `travelFoodCost` era calculado e o resultado descartado | Distância não tinha peso econômico |
| Painel Cânone tinha uma cópia própria da regra de âncora, já divergida do motor | Aba mostrava classificação diferente da real |

## 2) Divergência com peso real

Antes: soma bruta sem teto — **cinco cliques em "Conversar"** tiravam qualquer
figura histórica do próprio destino, por acidente.

Agora, por categoria e com teto:

| Categoria | Ações | Peso | Teto |
|---|---|---|---|
| social | conversar, beber, caçar, flores | 1 | 2 |
| corte | presentear | 2 | 2 |
| íntimo | beijar | 2 | 4 |
| vínculo | relações, apoiar guerra | 3 / 2 | 6 |
| voto | casar, apoiar pretendente | 6 | — |

Limiar: **5**. Social + corte saturam em 4, então gentilezas sozinhas nunca
divergem ninguém. Laços fracos decaem ~1 ponto/ano sem contato; votos não
decaem. Atravessar o limiar agora é anunciado no chat e na crônica.

## 3) Cascata

Eventos e guerras declaram pré-condições:

- `requires: { aliveCanonIds, deadCanonIds, leaderOf }` nos eventos
- `instigatorCanonId` / `instigatorHouseId` nas guerras

Quando falham, publica-se a variante alternativa e a linha do tempo segue
divergente. Cadeia anotada: Aegon III → Daeron I → Conquista de Dorne →
Baelor; e Aerys II → Robert.

## 4) Crises sucessórias

Quem sobrevive à própria morte registrada disputa o assento com o herdeiro do
cânone. As duas partes acumulam apoio por prestígio, marcialidade e carisma; a
Casa sangra ouro e prestígio enquanto durar. Resolve em até 3 anos, e o
perdedor raramente sobrevive. O jogador pode apoiar um lado por 60 recursos
(aba **Cânone**), ganhando relação com um lado e inimizade com o outro.

Enquanto um sobrevivente governa, os mandatos canônicos daquele assento ficam
suspensos — a história daquela cadeira sai do trilho até ele morrer.

## 5) Guerras com consequência

- Desfecho decisivo (margem ≥ 4) faz o principal derrotado **jurar** ao
  principal vencedor, com imposto mínimo de 20%
- Líderes do lado perdedor podem tombar (respeitando proteção canônica)
- Espólio e perdas em recursos
- Apoio do jogador em três escalas (destacamento / hoste / convocação geral),
  com retorno proporcional e relação com os aliados

## 6) Modo Anchors

Classificava 91% das pessoas como âncora — era quase idêntico ao strict. Agora
âncora é quem senta em um trono ou assento regional, e sucessões só contam
quando envolvem uma âncora de fato.

## 7) Mapa

Silhueta genérica de 3 KB com alfinetes em porcentagem → desenho vetorial
próprio com a geografia canônica, nove regiões clicáveis e os 295 locais
posicionados. Três bugs de interação corrigidos no caminho: `*ngFor` sem
`trackBy` destruindo os nós SVG antes do clique disparar, rótulo com
`pointer-events:none` deixando o clique atravessar até o mar, e a aba "Mapa"
que não abria mapa nenhum.

## 8) Testes

`npm test` — 11 testes determinísticos com RNG semeado, cobrindo determinismo,
tetos de divergência, a cascata canônica, a crise sucessória e invariantes de
mundo em 150 anos simulados. Foram eles que encontraram os bugs de líder morto
e de ordem dentro do turno.

## O que ainda falta

1. **Cânone 150–305 preenchido ano a ano** — o motor suporta; o dataset ainda
   tem lacunas grandes entre os marcos.
2. **Claims formais e ocupação territorial** — hoje a vassalagem muda por
   guerra decisiva, mas não há reivindicação por casamento nem ocupação de
   assentos durante o conflito.
3. **`sim.ts` continua grande** (~4.900 linhas). A separação natural seria
   `canon`, `economy`, `social`, `combat`, `missions`.
4. **Balanceamento da linhagem do jogador** — em Casas pequenas a extinção
   antes de 200 DC é comum, o que encerra a campanha cedo.
