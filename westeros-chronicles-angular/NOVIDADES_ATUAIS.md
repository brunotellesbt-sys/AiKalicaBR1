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

`npm test` — 23 testes determinísticos com RNG semeado, cobrindo determinismo,
tetos de divergência, a cascata canônica, a crise sucessória, guerras, rixas e
invariantes de mundo em 155 anos simulados. Foram eles que encontraram os bugs
de líder morto e de ordem dentro do turno.

## 9) Cânone preenchido ano a ano

De 47 anos com registro para **156 de 156** (258 eventos, contra 145). Marcos
reais adicionados em todos os reinados — de Baelor caminhando descalço pela
Estrada do Osso à fundação da Companhia Dourada, à morte de Aerys I em 221 (que
faltava por completo) e ao desaparecimento de Bloodraven além da Muralha.

Onde o material de origem é esparso, as entradas descrevem contexto de reino em
vez de inventar fatos nomeados, e levam a tag `contexto`.

## 10) Claims, pretendentes e ocupação

- Casamentos entre Casas registram direito recíproco sobre os assentos; os
  filhos herdam pelo sangue. `computeSuccessor` consulta os reivindicantes
  antes de recorrer ao suserano.
- Crises passam a ter **até quatro pretendentes**, cada um com a base do seu
  direito declarada (titular, herdeiro do cânone, reivindicação, parentesco).
- Sítios que derrubam muralhas **tomam o assento**: o ocupante cobra tributo, a
  guarnição se desgasta, e a paz devolve a praça — salvo vitória decisiva.

## 11) Linhagem do jogador

Medido: 30 de 30 campanhas com Casa Manderly terminavam antes de 305, mediana
no ano 214. A busca de herdeiro só olhava o sobrenome atual. Agora segue o
sangue (descendentes e parentes nascidos na Casa), e 13 de 30 alcançam o fim da
era, com mediana em 251.

## 12) Motor separado por domínio

`sim.ts` saiu de 5.714 para 4.260 linhas, com nove módulos extraídos:
`narration`, `rules`, `claims`, `canon-divergence`, `economy`, `lifecycle`,
`succession`, `warfare` e `politics`.

## 13) Guerras declaradas pelo jogador

Faltava um verbo inteiro: só dava para participar das guerras que a história
trazia pronta. Agora o líder da Casa declara guerra pela Diplomacia, e toda
guerra exige um motivo que o reino aceite — reivindicação, rixa de fronteira,
tributo negado, ou **conquista** (sem desculpa: −6 de prestígio e todas as
Casas se afastam de uma vez).

Aliados entram por relação, batalhas gastam hoste e reservas, muralhas caídas
permitem tomar o assento, e o placar vai a 100. Acima de 85 o derrotado jura ao
vencedor; abaixo, paga tributo. A paz é negociável, mas só é aceita por quem
não está claramente ganhando.

## 14) Teste de cânone tardio — e o que ele revelou

Medida da densidade: 298–305 tem **6,5 eventos/ano** contra 1,4 no resto da
campanha. A diferença é fiel às fontes (a série cobre esses anos em detalhe),
então não foi "corrigida".

O problema real estava noutro lugar: em 298.1 há uma rajada de **9 eventos de
sincronização** que instalam os senhores canônicos de oito Casas de uma vez —
e o motor os aplicava mesmo quando o assento era do **jogador**, sem crise, sem
aviso, desfazendo até 148 anos de campanha com um decreto.

Agora um assento ocupado pelo jogador é sempre contestado, nunca reatribuído:
o cânone pode retomá-lo, mas só vencendo a disputa. Verificado — onde antes
Eddard Stark simplesmente aparecia em Winterfell, agora abre-se
"Senhor do Norte vs Eddard Stark".

## 15) Testes de UI

`npm run test:ui` — 9 testes de navegador. Os três bugs mais caros desta base
foram de interface e nenhum apareceria em teste de motor, então a suíte cobre
exatamente esse território: início de campanha, as nove abas renderizando,
mapa desenhando regiões e Muralha, viagem por clique, seleção de reino, avanço
de turno, o menu de guerra com sua restrição de liderança, e ausência de erros
de console numa sessão típica.

## 16) Histórias de casas menores

O cânone cobria tronos e guerras grandes, mas as casas vassalas — a maioria das
73 jogáveis — não tinham história nenhuma. **50 eventos novos, 31 casas**, em
arcos que atravessam gerações: a rixa Bracken × Blackwood do moinho de 154 até
a Guerra dos Cinco Reis, o enriquecimento e o silêncio de Castamere, os três
cães dos Clegane e o fogo entre irmãos, a portagem das Gêmeas, o duelo desigual
de Baelish e sua alfândega em Vila Gaivota, e ainda Dayne, Mormont,
Osgrey/Webber, Whent, Umber, Karstark, Manderly, Hornwood, Hightower, Redwyne,
Tarly, Florent, Yronwood, Royce, Corbray, Harlaw, Drumm, Swann, Dondarrion e
Selmy.

**Notícia local**: despejar 50 histórias de famílias que o jogador nunca
encontrou viraria um mural. Eventos com a tag `local` só são narrados para quem
está por perto (mesma região, sua Casa, laço feudal, ou relação ≥ 62). Todos
continuam na crônica. Medido: 12% a 22% chegam ao chat conforme onde você
começa.

## 17) Economia com pressão real

Medida a campanha inteira, a economia era acumulação pura:

| grandeza   | ano 150 | ano 305 (antes) | fator   | ano 305 (agora) |
|------------|---------|-----------------|---------|-----------------|
| ouro       |     369 |       1.950.021 |  5.285x |           2.625 |
| comida     |   1.180 |       7.350.128 |  6.229x |           4.200 |
| recursos   |     384 |      23.794.624 | 61.965x |           4.187 |
| camponeses |   2.629 |          67.284 |     26x |           2.134 |

Uma fazenda custa 120 — no ano 200 toda Casa tinha 164 mil, e nenhum preço
importava mais. Quatro tetos resolvem: população logística com capacidade vinda
das fazendas, celeiros e armazéns com limite, hoste limitada a ~1 em 8
camponeses (com dispensa de baixo para cima), e cavalaria no máximo 8% da hoste
— era o soldo dos cavaleiros, que chegavam a 136 de 163 homens, que quebrava as
Casas. Some-se soldo e corte cobrados por turno e um teto de tesouro: ouro vira
vazão, não pilha.

## 18) Termos de paz e IA agressiva

A paz era binária. Agora o vencedor escolhe o que exigir, e cada termo custa
pontuação: tributo (25), cessão do assento ocupado (60), vassalagem (85).
Pedir além do conquistado é recusado.

E as Casas passam a declarar as próprias guerras — 10 a 14 por século, sempre
com motivo defensável. O jogador pode acordar em guerra sem ter feito nada.

## 19) Rixas nomeadas entre Casas

Fora das ações do jogador as relações eram inertes. Medido na campanha inteira:
de **83.232 pares de Casas, apenas 24** chegavam a 20 ou menos em 155 anos — e
todos por guerras já acontecidas. Isso matava o casus belli de rixa (exige ≤ 20),
que nunca era alcançável, e também as alianças fortes.

A primeira tentativa foi atrito difuso sobre pares sorteados. **Falhou pela
aritmética**: com dezenas de milhares de pares, cada um seria tocado meia vez
numa campanha inteira — e medido deu 24 → 9 pares hostis, pior que antes.

Westeros não funciona assim: tem feudos com nome. O modelo agora é um punhado de
rixas ativas (máx. 9), entre vizinhos da mesma região e de porte parecido, com
causa declarada — fronteira, primazia, insulto em banquete, casamento desfeito,
portagem, sangue numa caçada. Cada uma se aprofunda devagar (~8 anos até virar
inimizade pública), vira notícia regional ao romper, e esfria depois de ~45 anos
quando quem começou a briga já morreu. Guerras terminadas deixam rancor: a
recuperação é lenta e para em 40 — nunca volta à amizade.

| pares hostis (≤ 20) | ano 180 | ano 240 | ano 305 |
|---|---|---|---|
| antes | 0 | 6 | 24 |
| agora | 17 | 40 | 66 |

A mediana das relações fica intacta em 45: o mundo não ficou mais hostil no
geral, ele ficou hostil **onde tem motivo**.

**E o jogador pode intervir** (Diplomacia → *Rixas do reino*): mediar custa 45
recursos em presentes e banquetes, melhora a relação entre as duas Casas, ganha
+6 com ambas e +2 de prestígio, e freia a deterioração dali em diante; ou tomar
partido, ganhando +14/+10 com o aliado e −18/−12 com o rival. A escolha é
definitiva — voltar atrás custaria sua palavra.

## O que ainda falta

1. **Reféns e casamentos forçados na mesa de paz** — os termos hoje são
   tributo, assento e vassalagem; faltam os laços pessoais.
