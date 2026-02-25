# Análise Completa — Westeros Chronicles (Angular)

## 1) Visão geral do projeto
- Jogo fan-made de estratégia/narrativa em Westeros, em interface textual por chat + painéis, sem foco em sprites/imagens de personagem.
- Loop principal por turnos: **1 turno = 1/20 de ano**.
- Campanha começa no **ano 150 DC** e mistura:
  - simulação sistêmica (economia, relações, herança, guerras, viagens, missões),
  - camada narrativa (crônicas + chat),
  - camada canônica (linha histórica com modo strict/anchors).

## 2) Arquitetura técnica
- **Framework**: Angular 17 standalone components.
- **Estado**: `GameService` com `BehaviorSubject<GameState>`.
- **Motor de simulação**: arquivo central `sim.ts`.
- **Persistência**: localStorage (3 slots via `SaveService`).
- **Conteúdo de mundo**:
  - Casas: `houses.ts`
  - Regiões/locais/rotas: `regions.ts`
  - Eventos agendados simples: `timeline.ts`
  - Camada canônica extensa: `canon.ts`

## 3) O que o jogo simula (mecânicas)
### 3.1 Tempo e progressão
- Data com `year`, `turn (1..20)`, `absoluteTurn`.
- A cada `advanceTurn`:
  1. eventos canônicos,
  2. eventos agendados/rumores,
  3. economia global + tributos,
  4. idade/mortes,
  5. casamentos arranjados IA,
  6. concepção/gravidez/partos,
  7. missões,
  8. torneios,
  9. Banco de Ferro,
  10. avanço do calendário.

### 3.2 Casas, recursos e relações
- Cada Casa possui:
  - prestígio,
  - relações (0..100) com outras Casas,
  - economia (camponeses, fazendas, taxa de tributo, parceiros comerciais),
  - recursos (ouro, comida, goods/recursos),
  - exército em 4 tiers + dragões (abstração).
- Tributação feudal em `goods` para o suserano (`taxRate`, default 15% para vassalos).
- Comércio por delegação periódica gera bônus e melhora relações.

### 3.3 Exército e combate
- Poder militar calculado por pesos de unidades:
  - levies (1), men-at-arms (2), squires (3), knights (4),
  - dragões = equivalente de 10.000 cavaleiros por dragão.
- Emboscadas em viagem com chance por região + mitigação por tamanho de hoste/prestígio.

### 3.4 Viagem e mapa
- Grafo de viagens entre locais importantes.
- Distância influencia risco e custo estimado exibido (atualmente custo de comida está zerado por regra ativa).
- Ao chegar em um local, o jogador “conhece” personagens locais automaticamente.

### 3.5 Diplomacia
- Ações: conversar, presente, audiência, proposta de casamento/aliança, Banco de Ferro.
- Audiência considera gap de prestígio e relação prévia.
- Casamento diplomático entre Casas pode elevar prestígio/relações ou causar punição social se recusado.

### 3.6 Camada local/social (personagens no local)
- Interações: conversar, beber, caçar, flores, beijo, relações, casamento.
- Regras de bloqueio: parentesco direto, limiar de relação para beijo/relacionamento/casamento etc.
- Relações pessoais e de Casas são alteradas progressivamente.
- Gravidez: duração de 15 turnos.

### 3.7 Sucessão e morte do jogador
- Se o jogador morre, `handlePlayerDeath` tenta transferir controle para herdeiro elegível.
- Sem herdeiro: game over por extinção de linhagem.

### 3.8 Missões
- Geração procedural de missões locais (diplomacia, comércio, bandidos, selvagens).
- Missões feudais (suserano/vassalo) com requisitos de recursos/tropas e impacto político.
- Líder da Casa pode delegar missões marciais a membros aptos.

### 3.9 Torneios
- Participação com probabilidade fixa de resultados:
  - morte 10%,
  - derrota 30%,
  - ferimento 20%,
  - vitória 40%.
- Impacta prestígio pessoal, da Casa, ouro e estado de ferimentos.

### 3.10 Banco de Ferro
- Empréstimo com juros nominais (12% a.a.) e cobrança periódica.
- Falhas de pagamento acumulam atrasos e disparam sanções fortes.

## 4) Modo canônico (diferencial grande do projeto)
- Estado canônico guarda:
  - eventos já aplicados,
  - modo (`strict` / `anchors`),
  - divergência por interferência do jogador,
  - nascimentos pendentes,
  - guerras canônicas ativas e placar.
- Interferências do jogador acumulam score por personagem canônico (falar/presentear/beijar/casar etc.).
- Ao atingir limiar de divergência, mortes/forçamentos canônicos podem ser “bypass”.
- Existe painel dedicado para inspeção de:
  - próximas âncoras,
  - guerras ativas,
  - score de divergência,
  - nascimentos pendentes.

## 5) Escopo de conteúdo (volume atual)
- Casas base listadas: **73**.
- Regiões: **9**.
- Locais mapeados (base): **24**.
- Conexões de viagem base: **56**.
- Pessoas canônicas definidas: **96**.
- Eventos canônicos definidos em `CANON_EVENTS`: **130**.
- Guerras canônicas definidas em `CANON_WARS`: **9**.

## 6) Como jogar (fluxo real)
1. Iniciar campanha escolhendo Casa e gênero.
2. No menu por turno:
   - viajar / missões / local / torneios / diplomacia / treinar / gerenciar Casa / crônicas / encerrar turno.
3. Evoluir personagem (martial/beleza/prestígio pessoal),
4. manter economia da Casa estável,
5. administrar relações feudais,
6. navegar o cânone (ou divergir dele),
7. buscar condição de vitória (inclui condições especiais ligadas à Daenerys no late game não-canônico).

## 7) Condições de fim e vitória
- Game over por:
  - extinção da linhagem,
  - eventos de fim de era (no modo não-canônico),
  - derrota em eventos críticos (ex.: confronto com Daenerys).
- Vitória explícita prevista por:
  - casamento com Daenerys (exigências altas),
  - vitória militar improvável contra Daenerys.

## 8) GitHub Pages / Workflows
- O repositório já traz 2 workflows:
  - `deploy.yml`: build/deploy normal de projeto Angular no repo.
  - `deploy-from-zip.yml`: extrai zip, instala, builda e publica.
- Ambos já fazem:
  - setup de Pages,
  - `base-href` dinâmico com nome do repositório,
  - fallback SPA (`404.html` copiado de `index.html`),
  - `.nojekyll`.

## 9) Pontos fortes
- Base sistêmica grande para protótipo solo.
- Camada canônica com divergência é um diferencial raro.
- Integração de economia + política + social + herança está consistente para evolução futura.

## 10) Riscos/débitos técnicos (para próximos passos)
1. `sim.ts` está muito grande (manutenibilidade baixa).
2. Sem suíte de testes automatizados.
3. Balanceamento econômico/militar ainda manual.
4. Dependência de pacote npm bloqueada no ambiente atual (impediu build local nesta análise).

## 11) Prioridade recomendada para evolução
1. Modularizar `sim.ts` por domínios (`economy`, `diplomacy`, `canon`, `combat`, `social`).
2. Criar testes determinísticos com semente fixa de RNG.
3. Adicionar telemetria de balanceamento por 200+ turnos simulados.
4. Expandir UI de inspeção (tooltips de fórmula e log técnico por turno).
5. Harden de validações anti-estado inválido em ações (commands payload).

---
Se você quiser, no próximo passo eu já posso transformar essa análise em um **plano de implementação faseado** (MVP de melhorias + roadmap de 30/60/90 dias) e iniciar as correções/modularizações direto no código.
