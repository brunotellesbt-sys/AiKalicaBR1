# Westeros Chronicles (Angular)

Fan-game **não oficial** (sem afiliação com HBO/George R.R. Martin).  
Interface: **janelas de chat + painel de mapa**, sem imagens de personagens.

## Requisitos
- Node 20+
- npm 9+
- Angular CLI (opcional) – o workflow do GitHub instala via dependência

## Rodar local
```bash
npm install
npm start
```

## Deploy no GitHub Pages (Actions)
O repositório já vem com workflow em `.github/workflows/deploy.yml`.

1. Suba o projeto para um repositório no GitHub
2. Em **Settings → Pages**, selecione **Source: GitHub Actions**
3. Faça push na branch `main`

O workflow usa automaticamente:
- `--base-href "/<nome-do-repo>/"`

## Onde editar conteúdo do mundo
- Casas: `src/app/core/data/houses.ts`
- Regiões, locais e rotas: `src/app/core/data/regions.ts`
- Eventos agendados (rumores / fatos): `src/app/core/data/timeline.ts`

## Notas de design (como seu prompt pediu)
- Turno = 1/20 de ano (20 turnos por ano)
- Relações entre casas: 0..100
  - 0 = guerra
  - 50 = pode fazer aliança
  - 80+ = aliança forte
- Prestígio: 1..100 (Trono de Ferro ~98)
- Produção/consumo de comida e ouro por turno
- Viagens consomem comida e têm risco de emboscada
- Banco de Ferro: empréstimo com cobrança periódica e punições por inadimplência
- 3 slots de save (localStorage)

> Este projeto é um **alicerce jogável** com as mecânicas centrais, pronto para você aprofundar
> com mais casas, eventos e decisões.
