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

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/loto-shark run dev` — run frontend locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
