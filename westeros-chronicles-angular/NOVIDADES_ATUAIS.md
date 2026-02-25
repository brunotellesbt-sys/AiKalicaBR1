# O que foi completado / progredido agora

## 1) ✅ UI para acompanhar “Cânone vs Divergência”

- Nova aba **Cânone** no topo.
- Exibe:
  - **Guerras canônicas ativas** + **placar** + **últimas batalhas**
  - **Interferências em personagens canônicos** (score + motivos) e status de divergência
  - **Nascimentos pendentes** (adiados) + prazo de expiração
  - **Próximos eventos canônicos** com filtro de busca

## 2) ✅ Modo **Anchors** com comportamento real

- Agora há diferença funcional entre os modos:
  - **Strict:** aplica todos os marcos.
  - **Anchors:** foca em âncoras grandes (guerras/mandatos/marcos) e reduz forçamento de micro-eventos.
- Alternância feita pela aba **Cânone**, sem reiniciar campanha.

## 3) ✅ Guerra com batalhas, desgaste e finalização

Além do desgaste por turno, o motor agora inclui:

- **Batalhas periódicas** por guerra canônica.
- **Perdas reais de tropas** para vencedores/perdedores.
- **Sítios** com dano em muralhas/ouro/comida.
- **Placar persistente** em `canon.warStates`.
- **Finalização de guerra** ao final do período canônico.
- Registro em **Crônicas** e narração no chat quando relevante para a Casa do jogador.

## 4) ✅ Influência direta do jogador na guerra (quando líder)

Na gestão da Casa, se sua Casa estiver em guerra canônica ativa:

- ação **“Apoiar guerra: X”**
  - custo: **40 recursos + 80 levies**
  - efeito: **+1 progresso** no placar da sua facção

## 5) ✅ Mundo reagindo sozinho (casamentos IA + política leve)

- Casamentos automáticos periódicos para:
  - líderes solteiros/viúvos
  - herdeiros de casas grandes/médias
- Pareamento ponderado por **relações entre casas**.
- **Dote simples** (transferência de goods/ouro respeitando reserva por tier).
- Ajuste de relações entre casas após união.

Regra de linhagem aplicada:

- padrão: **patrilinear** (casa do homem)
- exceção: se a mulher for a **última viva da casa**, tende a preservar a casa dela (matrilinear)

## 6) ✅ Sucessão com reação política do suserano

Quando uma casa fica sem herdeiros vivos:

- o suserano pode **conceder o feudo** para um nomeado da própria estrutura política
- isso evita colapso precoce do mundo e gera crônicas de concessão

## 7) ✅ Sistema de rumores para preencher lacunas

- Rumores leves aparecem entre marcos maiores (casamentos, tensões, tributos, conspirações).
- O chat destaca mais quando envolve a Casa do jogador ou sua região.

---

## O que ainda falta

1. **Cânone 150–305 totalmente preenchido ano-a-ano**
   - O motor suporta, mas o dataset completo ainda precisa ser expandido.

2. **Política profunda de claims/ocupação territorial**
   - Já existe: guerras com placar, batalhas/sítios, apoio do jogador, sucessão com concessão.
   - Ainda faltam: claims formais, crises sucessórias com múltiplos pretendentes e ocupação de assentos no mapa.

## Próximo passo sugerido

- claims simples por casamento
- crises sucessórias com 2+ candidatos fortes
- ocupação temporária de assentos em guerra
