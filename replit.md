# Loto-Shark Workspace

## Overview

pnpm workspace monorepo usando TypeScript. O projeto principal é o **Loto-Shark** — uma plataforma de análise de loterias brasileiras com IA integrada.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS (artifacts/loto-shark)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **UI**: shadcn/ui + framer-motion (design futurista/cyberpunk)

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

## Database — Neon PostgreSQL

O projeto usa **Neon** como banco de dados principal. A URL é lida via `NEON_DATABASE_URL` (secret do Replit). O `DATABASE_URL` é usado como fallback.

### Tabela ai_providers

Armazena as chaves de API dos provedores de IA de forma persistente no banco:

- `id` — UUID text primary key
- `type` — tipo de provider (openai, anthropic, groq, etc.)
- `name` — nome exibido
- `api_key` — chave de API completa (armazenada no banco Neon, nunca exposta ao cliente)
- `model`, `base_url`, `enabled`, `priority` — configuração
- `success_rate`, `total_calls`, `success_calls`, `avg_latency_ms` — métricas de uso
- `last_used`, `last_error`, `created_at`, `updated_at`

Na inicialização, o servidor carrega os providers do banco. Se o banco estiver vazio, semeia a partir das variáveis de ambiente (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.) e persiste no banco. Após o primeiro boot, as env vars não são mais necessárias.

## Shark Engine v2

Motor de geração de jogos em `artifacts/api-server/src/core/sharkEngine.ts`:
- Classifica números como quentes (frequência recente, últimos 10 sorteios) e frios (atraso acumulado)
- 6 estratégias: impulso, compensacao, variacao_pura, peso, rep_alta, rep_baixa
- Desdobramento interno automático
- Sistema de pontuação com bônus de variação

## Correções Realizadas

- **Persistência de jogos**: O backend usa PostgreSQL. Os jogos gerados são salvos automaticamente no banco.
- **Persistência de providers de IA**: Chaves de API salvas no Neon — não precisam ser reconfiguradas após restart.
- **Conflito de portas**: Removido o workflow "Start application" redundante. Agora apenas os workflows individuais (`artifacts/api-server: API Server` na porta 8082 e `artifacts/loto-shark: web` na porta 23571) são usados.
- **Polling excessivo**: O hook `useNextDrawInfo` foi ajustado de 1s para 60s de intervalo de refetch. O countdown é calculado no frontend.
- **Bug duplicate key**: Corrigida entrada duplicada "lotofacil" em `routes/chat.ts`.
