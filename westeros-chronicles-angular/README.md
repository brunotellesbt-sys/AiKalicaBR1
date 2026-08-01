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

> O mapa oficial da HBO/GRRM é material protegido por direitos autorais e não é
> redistribuído aqui; a geografia foi redesenhada em vetor para este projeto.

## Estrutura do motor

O motor não depende de Angular e está separado por domínio em
`src/app/core/engine/`:

| Módulo | O que faz |
|---|---|
| `narration.ts` | chat, crônica e fim de partida |
| `rules.ts` | tabelas puras (renome, títulos, mortalidade, tiers) |
| `claims.ts` | reivindicações e ocupação de assentos |
| `canon-divergence.ts` | placar de interferência, tetos e decaimento |
| `economy.ts` | produção, tributo, IA econômica, Banco de Ferro |
| `lifecycle.ts` | casamento, gestação, nascimento, idade e morte |
| `succession.ts` | ordem de herança, herdeiro do jogador, crises |
| `warfare.ts` | guerras declaradas em jogo: casus belli, batalhas, paz |
| `sim.ts` | estado inicial, motor canônico e ações do jogador |

## Testes

`npm test` compila o motor (que não depende de Angular) e roda 18 testes
determinísticos com RNG semeado: determinismo, tetos de divergência, a cascata
canônica, crises sucessórias, guerras e invariantes de mundo ao longo de 155
anos simulados.

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

O placar de guerra vai a 100. Acima de 85 o derrotado jura à Casa vencedora;
abaixo disso, paga tributo. Muralhas derrubadas permitem ocupar o assento, e a
paz devolve o que foi tomado — salvo vitória esmagadora.
