# Codex Session Dashboard

React + TypeScript + Vite dashboard backed by a local Convex deployment.

The current build implements the dashboard mockup as a reactive Convex app with:
- session rail and search
- overview stat cards
- timeline filters and event feed
- selected-event detail panel
- provenance pulse and raw event JSON

## Run
```bash
pnpm install
pnpm dev
```

This starts:
- a local Convex deployment
- the Vite app at `http://localhost:5173`

The first local Convex setup writes `.env.local` with `VITE_CONVEX_URL`.

## Data Model

Demo dashboard data is seeded into Convex on first load from:
- [convex/seedData.ts](/Users/alex/Projects/codex-session-dashboard/convex/seedData.ts)

Core schema and queries live in:
- [convex/schema.ts](/Users/alex/Projects/codex-session-dashboard/convex/schema.ts)
- [convex/dashboard.ts](/Users/alex/Projects/codex-session-dashboard/convex/dashboard.ts)
- [convex/seed.ts](/Users/alex/Projects/codex-session-dashboard/convex/seed.ts)

## Validate
```bash
pnpm build
pnpm test
```
