# Loto-Shark Workspace

## Overview

<<<<<<< HEAD
pnpm workspace monorepo usando TypeScript. Projeto Loto Shark — aplicativo de análise e geração de jogos de loteria com IA.
=======
pnpm workspace monorepo usando TypeScript. O projeto principal é o **Loto-Shark** — uma plataforma de análise de loterias brasileiras com IA integrada.
>>>>>>> c6ac3722441b696c6a6918c654ae43efc7b10e24

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
<<<<<<< HEAD
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS
=======
- **Frontend**: React + Vite + TailwindCSS (artifacts/loto-shark)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
>>>>>>> c6ac3722441b696c6a6918c654ae43efc7b10e24
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **UI**: shadcn/ui + framer-motion (design futurista/cyberpunk)

## Artifacts

- `artifacts/loto-shark` — Frontend React/Vite (previewPath: `/`)
- `artifacts/api-server` — API Express 5 (previewPath: `/api`)

## Features do Loto-Shark

- Dashboard com todas as modalidades de loteria brasileira (Mega-Sena, Lotofácil, Quina, Lotomania, etc.)
- Gerador de jogos inteligente com estratégias (aleatório, quente, frio, balanceado, IA)
- Mapa de calor de frequências de números
- Análise com IA (múltiplos provedores configuráveis)
- Chat com assistente Shark (IA)
- Histórico de resultados
- Integração com API da CAIXA Econômica Federal
- Design futurista cyberpunk com animações

## Artifacts

- **loto-shark** (`artifacts/loto-shark`) — Frontend React + Vite na raiz `/`
- **api-server** (`artifacts/api-server`) — Backend Express em `/api`

## Database

A tabela `user_games` foi criada no PostgreSQL para persistir todos os jogos gerados. Os jogos são salvos automaticamente ao serem gerados — não se perdem ao reiniciar o servidor.

## Schema da tabela user_games

- `id` — serial primary key
- `lottery_id` — tipo de loteria (ex: megasena, lotofacil)
- `selected_numbers` — array de números sorteados (jsonb)
- `strategy` — estratégia usada
- `confidence`, `reasoning`, `data_source` — metadados da geração
- `shark_score`, `shark_origem`, `shark_contexto` — dados do Motor Shark
- `matches`, `prize_won` — resultado da conferência
- `status` — pending | won | lost
- `hits` — número de acertos
- `created_at` — data de criação

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/loto-shark run dev` — run frontend locally

## Correções Realizadas

- **Persistência de jogos**: O backend agora usa PostgreSQL ao invés de array em memória. Os jogos gerados são salvos automaticamente no banco e persistem entre reinicializações.
- Os endpoints `/api/games/generate` e `/api/user/games` agora usam o banco de dados.
