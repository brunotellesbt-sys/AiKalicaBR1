# Westeros Chronicles (Angular)

Fan-game **não oficial** (sem afiliação com HBO/George R.R. Martin).
Interface: **janelas de chat + mapa interativo**, sem imagens de personagens.

## Requisitos
- Node 20+
- npm 9+

## Rodar local
```bash
npm install
npm start     # http://localhost:4200
npm test      # suíte determinística do motor
npm run build # build de produção
```

## Deploy no GitHub Pages (Actions)
O repositório já vem com workflow em `.github/workflows/deploy.yml`.

1. Suba o projeto para um repositório no GitHub
2. Em **Settings → Pages**, selecione **Source: GitHub Actions**
3. Faça push na branch `main`

O workflow usa automaticamente `--base-href "/<nome-do-repo>/"`.

## Onde editar conteúdo do mundo
- Casas: `src/app/core/data/houses.ts`
- Regiões, locais e rotas: `src/app/core/data/regions.ts`
- Geografia do mapa (litoral, regiões, coordenadas): `src/app/core/data/map-geo.ts`
- Eventos agendados (rumores / fatos): `src/app/core/data/timeline.ts`
- Cânone (pessoas, eventos, guerras, mandatos): `src/app/core/data/canon.ts`

## Mecânicas centrais
- Turno = 1/20 de ano (20 turnos por ano); campanha começa em **150 DC**
- Você começa como o **último na linha de sucessão** — a gestão da Casa só abre
  quando você herda a liderança
- Relações entre casas: 0..100 (0 = guerra, 50 = aliança possível, 80+ = aliança forte)
- Prestígio: 1..100 (Trono de Ferro ~98)
- Produção/consumo de comida e ouro por turno; tributo feudal em recursos
- Viagens consomem turnos **e mantimentos**, proporcionais à distância e ao
  tamanho da comitiva, com risco de emboscada
- Banco de Ferro: empréstimo com cobrança periódica e punições por inadimplência
- 3 slots de save (localStorage)

## Cânone e divergência

O diferencial do projeto: a história registrada de Westeros acontece sozinha,
mas **responde às suas decisões**.

- Cada figura histórica acumula um score de interferência por categoria
  (social, corte, íntimo, vínculo, voto). Cada categoria **satura**, e só
  envolvimento real atravessa o limiar — gentilezas repetidas não bastam.
  Laços fracos **decaem** com o tempo; compromissos não.
- Ao divergir, o motor para de forçar o destino daquela pessoa: ela pode
  sobreviver à morte registrada.
- **Cascata**: eventos e guerras declaram pré-condições (`requires`,
  `instigatorCanonId`). Se o mundo não as comporta, o marco não acontece e uma
  variante alternativa é publicada. Salvar Aegon III impede a coroação de
  Daeron I, que por sua vez cancela a Conquista de Dorne.
- **Crises sucessórias**: quem sobrevive à própria morte não é deposto em
  silêncio. O herdeiro do cânone vira pretendente rival, as casas tomam
  partido e você pode apoiar um lado (aba **Cânone**) — ganhando um aliado e
  um inimigo permanente.
- Dois modos: **strict** (todos os marcos) e **anchors** (só as âncoras
  estruturais: guerras, tronos, fim de era).

## Mapa

Desenho vetorial **original** com a geografia canônica de Westeros — litoral,
Muralha, a Mordida, o Pescoço, o Braço Partido, as nove regiões clicáveis e as
ilhas. Cada um dos 295 locais tem posição no mapa: as referências conhecidas
com coordenada canônica, o resto distribuído deterministicamente dentro da
própria região.

O terreno aparece como relevo desenhado, não como mancha de cor: montanhas,
colinas, coníferas, juncos de pântano e dunas, distribuídos em campos nomeados
(Presas de Gelo, Bosque dos Lobos, Montanhas da Lua, o Pescoço, Bosque do Rei,
Bosque da Chuva, Montanhas Vermelhas, deserto de Dorne). Os glifos ficam numa
grade sacudida deterministicamente — grade pura lê como papel quadriculado,
posição aleatória amontoa e deixa buracos. Com o relevo, o mapa passa a explicar
sozinho por que atravessar o Pescoço decide guerras.

> O mapa oficial da HBO/GRRM é material protegido por direitos autorais e não é
> redistribuído aqui; a geografia foi redesenhada em vetor para este projeto.

### Usar a sua própria imagem de mapa

O mapa vetorial é desenhado à mão em coordenadas e nunca vai ter a fidelidade de
um mapa cartografado. Quem quiser um mapa fiel traz a própria imagem:

1. Ponha o arquivo em `src/assets/`.
2. Leia, em qualquer editor de imagem, a posição em pixels de **dois** locais
   conhecidos — Winterfell e Porto Real servem bem, por serem a diagonal mais
   longa.
3. Preencha `MAP_IMAGE` em `src/app/core/data/map-image.ts`.

Para o passo 2 há uma ferramenta: abra `tools/calibrar-mapa.html` no navegador,
escolha a imagem, clique nos dois locais e copie o bloco pronto. A imagem não sai
da sua máquina — o arquivo é lido localmente, sem upload e sem servidor.

Os outros 293 locais se posicionam sozinhos. Duas âncoras bastam porque nenhum
mapa de Westeros é publicado girado ou espelhado: a transformação entre os dois
espaços é só escala e deslocamento. Escolha âncoras bem afastadas — base curta
transforma erro de poucos pixels em erro grande do outro lado do mapa.

Configuração inválida (id errado, âncoras coladas) faz o app voltar ao mapa
vetorial em vez de desenhar tudo amontoado num canto.

> **O repositório não acompanha imagem de mapa nenhuma, e não deve passar a
> acompanhar.** Os mapas oficiais são obra protegida, e mapas de fãs pertencem a
> quem os desenhou. Use uma imagem que você tenha o direito de usar — e lembre
> que publicar o jogo publica a imagem junto.

## Estrutura do motor

O motor não depende de Angular e está separado por domínio em
`src/app/core/engine/`:

| Módulo | O que faz |
|---|---|
| `narration.ts` | chat, crônica e fim de partida |
| `rules.ts` | tabelas puras (renome, títulos, mortalidade, tiers) |
| `claims.ts` | reivindicações e ocupação de assentos |
| `canon-divergence.ts` | placar de interferência, tetos e decaimento |
| `politics.ts` | rixas entre Casas, rancor de guerra e mediação |
| `hostages.ts` | reféns e casamentos impostos na mesa de paz |
| `economy.ts` | produção, tributo, IA econômica, Banco de Ferro |
| `lifecycle.ts` | casamento, gestação, nascimento, idade e morte |
| `succession.ts` | ordem de herança, herdeiro do jogador, crises |
| `warfare.ts` | guerras declaradas em jogo: casus belli, batalhas, paz |
| `sim.ts` | estado inicial, motor canônico e ações do jogador |

## Testes

`npm test` compila o motor (que não depende de Angular) e roda 27 testes
determinísticos com RNG semeado: determinismo, tetos de divergência, a cascata
canônica, crises sucessórias, guerras, rixas e invariantes de mundo ao longo de
155 anos simulados.

`npm run test:ui` roda 9 testes de navegador (Playwright) sobre o app de pé:
abas, mapa, viagem por clique, avanço de turno e ausência de erros de console.

## Guerra

Como líder da Casa você declara guerra pela Diplomacia, e precisa de um motivo
que o reino aceite:

| Casus belli | Quando existe |
|---|---|
| reivindicação | alguém da sua Casa reivindica o assento do alvo |
| rixa de fronteira | relação ≤ 20 |
| tributo negado | um vassalo seu parou de pagar |
| conquista | sempre — mas custa 6 de prestígio e afasta todo o reino |

O placar de guerra vai a 100, e na mesa de paz cada exigência tem um preço:

| Termo | Custo em pontuação |
|---|---|
| paz branca | 0 |
| refém | 20 |
| tributo de guerra | 25 |
| casamento de paz | 35 |
| cessão do assento ocupado | 60 |
| vassalagem | 85 |

Pedir mais do que se conquistou é recusado, e nada é oferecido sem como
cumprir: sem criança elegível não há refém, sem par solteiro dos dois lados não
há casamento. As outras Casas também declaram guerras próprias (10 a 14 por
século), sempre com motivo defensável.

**Refém**: alguém de 5 a 24 anos do lado derrotado vai viver no assento do
vencedor por 10 a 20 anos. Enquanto durar, a IA não marcha contra quem guarda o
próprio sangue — e quem marcha mesmo assim perde o refém, executado. Devolvido
no prazo, o laço vale mais que o refém: +14 de relação.

**Casamento de paz**: reconcilia de imediato, mas registra direito de sangue
sobre os dois assentos, que pode voltar como reivindicação numa crise
sucessória décadas depois.

Toda paz imposta pode vir selada por um dos dois, mesmo quando o termo
principal foi outro — em Westeros o refém não substitui a vassalagem, ele a
garante.

## Rixas

O reino sustenta até nove rixas ativas ao mesmo tempo, entre vizinhos da mesma
região e de porte parecido, cada uma com causa declarada — uma fronteira que
ninguém cede, primazia regional, um insulto num banquete, um casamento desfeito,
portagens numa estrada, sangue numa caçada chamado de acidente.

Levam cerca de oito anos para virar inimizade pública (relação ≤ 20, que é
quando o casus belli de rixa abre), viram notícia regional ao romper, e esfriam
depois de umas quatro décadas, quando quem começou a briga já morreu. Guerras
terminadas deixam rancor: a relação se recupera devagar e para na desconfiança,
nunca volta à amizade.

Pela Diplomacia dá para **intervir numa rixa alheia**: mediar (45 recursos em
presentes e banquetes, +2 de prestígio, aproxima as duas Casas e freia a
deterioração) ou tomar partido, ganhando um aliado e um inimigo. A escolha é
definitiva.

## Economia

Fazendas são a alavanca de tudo: definem quanta gente a terra sustenta, quanto
cabe nos celeiros e armazéns, e quanto ouro o salão guarda. A hoste é limitada a
cerca de 1 em 8 camponeses, cavalaria a 8% da hoste, e soldo e corte são
cobrados todo turno — cofre vazio faz tropa desertar.
