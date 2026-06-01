# Verdify

Ordinance-native compliance platform for Los Angeles' **Existing Buildings Energy & Water Efficiency (EBEWE)** Ordinance. It collapses the workflow fragmented across LADBS, LADWP, and EPA ENERGY STAR Portfolio Manager into one environment for building owners, property managers, and energy consultants.

This is the **Phase 1 prototype** — the five user-facing screens on the production stack (Next.js + Supabase), with the compliance core encoded verbatim from LAMC.

## Stack

- **Next.js 16** (App Router, RSC) + TypeScript + Tailwind v4
- **Supabase** (Postgres + Auth + Storage) — Row-Level Security on every customer table
- **Vitest** for the deterministic rules engine; **Playwright** for UI smoke tests

## Run it locally

Requires Node, pnpm, and Docker (for local Supabase).

```bash
pnpm install
pnpm db:start          # local Supabase (Docker)
pnpm db:reset          # apply migrations
pnpm seed              # demo orgs/users/buildings
pnpm dev               # http://localhost:3000
```

Demo accounts (password `verdify-demo`):

| Role | Email |
| --- | --- |
| Property manager (12 buildings) | `manager@sunsetpm.test` |
| Energy consultant — Pegasus (3 client orgs, 40 buildings) | `consultant@pegasus.test` |
| Energy consultant — Hillmann (isolation counterpart) | `consultant@hillmann.test` |
| Building owner (single asset) | `owner@independent.test` |

## The five screens

1. **Building Onboarding** (`/buildings/new`) — enter a LADBS BIN; Verdify looks it up in LA Open Data and derives the full compliance schedule (incl. the 5-year A/RCx cycle keyed to the BIN's last digit). Manual entry always works.
2. **Portfolio Dashboard** (`/dashboard`) — every covered building as a status tile with a live, compounding fine-exposure counter.
3. **Deadline Engine** (`/deadlines`) — countdown timers + 90/30/7-day multi-channel alerts.
4. **Alert Simulator** (`/simulator`) — models a missed deadline including the full LAMC 98.0411(c) escalation.
5. **Document Vault** (per building) — benchmarking submissions, A/RCx reports, and on-demand lender-ready packets.

## Architecture

- `src/lib/compliance/` — **deterministic rules engine**: pure functions over hard-coded LAMC constants (coverage thresholds, A/RCx Table 9708.2, fine escalation). No I/O, no LLM. This is the moat and the insurable core. `pnpm test` is its audit evidence.
- `src/lib/data-sources/` — open-data lookup (LA Open Data EBEWE dataset `9yda-i4ya`) with an always-works manual fallback.
- `src/lib/db/` — RLS-scoped queries; `portfolio.ts` derives each building's schedule/fine/status.
- `supabase/migrations/` — schema; **all RLS policies in `0007_rls_policies.sql`** (the white-label isolation guarantee).
- `src/app/api/cron/generate-alerts/` — idempotent scheduled worker (Vercel cron in `vercel.json`).

## Verify

```bash
pnpm test             # 48 unit tests — fine math + A/RCx schedule vs. statute
pnpm verify:rls       # consultant isolation (Pegasus never sees Hillmann)
pnpm verify:storage   # vault Storage-RLS double-gating
pnpm smoke            # Playwright walkthrough of all five screens (needs `pnpm dev`)
```

## Out of scope (Phase 2+)

Compliance Assistant (bounded RAG), Stripe billing, LADWP utility sync, EPA Portfolio Manager submission API — interface seams are left in place.
