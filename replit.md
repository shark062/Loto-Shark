# Loto Shark - Análise Inteligente de Loterias Brasileiras

## Project Overview
Loto Shark is a Brazilian lottery analysis platform with a cyberpunk/neon visual design. It provides real-time lottery data, intelligent number generation, AI analysis, and heat map visualization for Brazilian lottery games from Caixa Econômica Federal.

## Architecture

### Monorepo Structure
- `artifacts/loto-shark/` — React + Vite frontend (port 23571, previewPath `/`)
- `artifacts/api-server/` — Express.js REST API backend (port 8080, previewPath `/api`)
- `artifacts/mockup-sandbox/` — Vite preview server for UI component prototyping

### Frontend (artifacts/loto-shark/)
- **Framework**: React 19 + Vite 7 + TypeScript
- **Styling**: Tailwind CSS v4 with cyberpunk neon theme (--neon-cyan, --neon-purple, --neon-gold)
- **State**: @tanstack/react-query with custom queryClient
- **Routing**: Wouter (SPA routing)
- **UI Components**: Radix UI primitives + custom shadcn/ui components
- **Export**: jsPDF for PDF export, canvas-confetti for celebrations

### Backend (artifacts/api-server/)
- **Framework**: Express.js + TypeScript (compiled with esbuild)
- **Real Data**: Fetches live lottery results from Caixa Econômica Federal API (`servicebus2.caixa.gov.br/portaldeloterias/api`)
- **Historical Data**: `artifacts/api-server/src/lib/lotteryData.ts` — fetches last 20 draws per lottery and caches for 2h
- **Smart Generation**: `POST /api/games/generate` uses real frequency data; strategies: hot/cold/mixed/ai (statistical analysis)
- **Desdobramento**: Client-side combination generator (getCombinations) — picks a pool, generates all C(n,k) combos ≤500

### Key Paths
- `artifacts/loto-shark/src/pages/` — 12 pages (Home, HeatMap, Generator, Results, AIAnalysis, AIMetrics, Information, AdvancedDashboard, Login, Register, AIProviders, Premium)
- `artifacts/loto-shark/src/components/` — Shared components (Navigation, AllLotteriesCard, HeatMapGrid, NumberBall, etc.)
- `artifacts/loto-shark/src/hooks/` — Data hooks (useLotteryData, useAuth, use-lottery)
- `artifacts/loto-shark/src/shared/` — Browser-safe shared code (routes.ts - no drizzle imports)
- `artifacts/loto-shark/src/types/` — TypeScript types (lottery.ts)
- `artifacts/loto-shark/src/assets/` — Static assets (logo images)
- `artifacts/api-server/src/routes/` — API routes (index.ts, lottery.ts, health.ts)

### Path Aliases
- `@/` → `artifacts/loto-shark/src/`
- `@shared/` → `artifacts/loto-shark/src/shared/`
- `@assets/` → `artifacts/loto-shark/src/assets/`

## API Endpoints
- `GET /api/lotteries` — All 8 lottery types
- `GET /api/lotteries/:id` — Single lottery info
- `GET /api/lotteries/:id/draws` — Latest draw results
- `GET /api/lotteries/:id/next-draw` — Next draw countdown + prize estimate
- `GET /api/lotteries/:id/frequency` — Number frequency analysis
- `POST /api/lotteries/:id/generate` — Generate smart numbers
- `GET /api/auth/user` — Current user (mock guest user)
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register
- `GET /api/users/stats` — User statistics
- `GET /api/user/games` — User saved games
- `POST /api/user/games` — Save a game
- `POST /api/user/games/check` — Check games against results

## Supported Lotteries
Mega-Sena, Lotofácil, Quina, Lotomania, Dupla Sena, Timemania, Dia de Sorte, Super Sete

## Important Notes
- `shared/routes.ts` is browser-safe (no drizzle-orm imports) — uses plain Zod schemas
- `shared/schema.ts` has drizzle imports and should NOT be imported in frontend code
- The frontend fetches live data via queryKey-based URLs joined with "/"
- User data is in-memory on the API server (no persistent database)
- CSS uses Tailwind v4 with `@theme inline` mapping to CSS variables
