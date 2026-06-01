# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Verdify

Verdify is an **ordinance-native compliance platform** for Los Angeles' Existing Buildings Energy & Water Efficiency (EBEWE) Ordinance. It collapses a workflow today fragmented across **LADBS**, **LADWP**, and **EPA ENERGY STAR Portfolio Manager** into one integrated environment for building owners, property managers, and energy consultants.

The single source of product truth is `Context/Verdify - Product description.docx`. Read it before making product-shape decisions. The prototype scope below is a faithful restatement; if it ever conflicts with the docx, the docx wins.

## Status

Greenfield. Only `Context/` exists in the repo today. The first build target is the **functional prototype** described in Section II of the product description: five user-facing screens validating UX + open-data integrations, deployed on the production stack (not throwaway code).

## Prototype Scope (Phase 1 MVP)

Build exactly these five screens — the product is structured around the property manager's workflow, not the city's bureaucratic structure:

1. **Building Onboarding** — accepts a LADBS Building Identification Number (BIN) and *automatically derives the building's complete compliance schedule*, including the five-year A/RCx cycle keyed to the **last digit of the BIN**.
2. **Portfolio Dashboard** — every covered building as a real-time status tile with a **compounding fine-exposure counter** (live dollar figure).
3. **Deadline Engine** — countdown timers with **90-, 30-, and 7-day multi-channel alerts**.
4. **Alert Simulator** — models the financial consequence of a missed deadline including the LAMC 98.0411(c) escalation.
5. **Document Vault** — stores every benchmarking submission, A/RCx report, and lender-ready compliance packet.

## Tech Stack (locked in by product spec)

- **Frontend**: Next.js on Vercel
- **Platform / DB / Auth / Storage**: Supabase
  - **Row Level Security is mandatory** — it is the mechanism that supports the white-label consultant tier (one consulting firm sees only its own client buildings). Every table touching customer data must ship with RLS policies, not bolt them on later.
- **Scheduled worker layer** for batch jobs: monthly LADWP benchmarking pulls, anomaly scans, deadline countdowns, Compliance Assistant audit-log exports.
- **AI**: exactly one narrowly scoped Compliance Assistant — retrieval-augmented over EBEWE ordinance text + LAMC enforcement provisions, **every response cites the relevant code section**, every interaction logged, ambiguous questions escalate to "consult your energy consultant" rather than guess.

This stack is not up for debate inside the prototype — it was chosen to hit target SaaS gross margins (72% Y1 → 80% Y3) at $400/building/year ARPU and to keep MVP delivery in weeks not quarters.

## Architectural Principles That Shape Every Decision

These are load-bearing — violating them breaks the product's value proposition or its insurability.

### 1. Deterministic by default, AI only where bounded
Three of the four intelligence-layer capabilities are **pure rule execution, not inference**:
- **Deadline Engine** computes A/RCx cycles from the BIN's last digit and ordinance rules. No model. It cannot hallucinate a wrong deadline.
- **Benchmarking Pipeline** ingests LADWP data and pre-fills the EPA Portfolio Manager submission. User audits before submission.
- **Utility Anomaly Monitor** ships rule-based (gap months, unit mismatches, implausible spikes). ML upgrade is a **Year 2** milestone — do not claim or build it earlier.
- **Compliance Assistant (the only AI component)** is RAG-bounded to EBEWE + LAMC text. Every answer carries a citation; every interaction is logged.

If you find yourself reaching for an LLM to compute a deadline, a fine amount, or a cycle year — stop. That is a determinism boundary violation.

### 2. Ordinance-native, not configurable
EBEWE rules are **hard-coded into the application layer**, not exposed as customer-configurable settings. This is the core moat (workflow depth + 18–24 month replication barrier for generalist competitors). Encode rules in code with explicit citations to the source statute in comments — that comment is one of the few that earns its keep, because it makes the rule auditable and updateable when LAMC changes.

### 3. Portfolio-first
Every screen must scale unchanged from 1 building to several hundred. A sole proprietor and a 200-building consulting firm see the same structure, different counts. No screen designed only for the single-building case.

### 4. Audit-readiness by default
Every action produces a timestamped, exportable artifact. Lender diligence packets are *generated on demand*, never *reconstructed* from email threads.

### 5. LADWP is the sharpest dependency — design for fragility
LADWP has **no production-grade third-party API**. Interim path: tenant-consented data exports the property manager initiates, plus credentialed pulls from the customer portal where supported. Either path can break with any unannounced LADWP UI/export change.

Requirements when touching the LADWP path:
- **Manual upload fallback must always work** as a graceful degradation, even when automation is healthy. It is not a "nice to have" — it is the contractual continuity guarantee.
- Monitor the consent workflow and export schema; treat schema drift as a P0 production signal.
- LADBS uses the **ATLAS** platform (migrated September 2024) — that is the integration target, not the legacy system.

## Critical Business Logic (Encode These Verbatim)

These numbers and rules drive the product. Bake them in with citations; do not paraphrase them into round numbers.

### Compliance Schedule
- **Annual benchmarking deadline**: June 1 each year.
- **Covered buildings**: privately owned > 20,000 sq ft; city-owned > 7,500 sq ft.
- **A/RCx (Audit & Retro-Commissioning) cycle**: 5 years, **compliance year derived from the last digit of the LADBS BIN**.

### Fine Escalation (LAMC SEC. 91.9712 and 98.0411(c))
The Alert Simulator's math, the dashboard's "fine exposure counter," and any compliance-status display must use this schedule exactly:

| Days from invoice | Balance | Trigger |
| --- | --- | --- |
| Day 0 | $202 | Base violation notice (LAMC 91.9712) |
| Day 30 | $707 | 250% combined late charge + collection fee (LAMC 98.0411(c)) |
| Day 60 | $707 + 1%/mo compounding | Interest begins on full balance |
| Day 365 | ≈$780 | After ~10 months of compounding |

### Pricing Tiers (per building per year)
- **Starter** ($200) — 1–2 buildings, small independent owners.
- **Pro** ($400) — 3–10 buildings, mid-size owner-operators. Add-on: Lender Compliance Report at $50/report.
- **Portfolio / Consultant** ($300, volume discount) — 11+ buildings. White-label subdomain; lender reports included. **This tier is the GTM engine — make it work first.**

### Multi-Tenancy Model
Three role surfaces with different data scopes:
- **Building Owner** — sees their own buildings (typically small N).
- **Property Manager** — sees the portfolio they operate.
- **Energy Consultant** — sees a multi-client portfolio under a white-label subdomain; **must never see other consultants' clients**. This is the RLS test that matters most.

## Open Data Sources (Free, Public — Lead With These)
- **LA Open Data Portal**: citywide EBEWE compliance dataset (`data.lacity.org`). Every covered building is identifiable and prospectable from this source before becoming a customer — that's a structural GTM advantage, not just data.
- **LADBS ATLAS**: public building records (post-Sept 2024 migration).
- **EPA ENERGY STAR Portfolio Manager**: stable production API for benchmarking submissions.
- **LADWP**: utility data — see the dependency caveats above.

## Risks Already Known (Don't Re-Discover Them)

- **LADWP API absence** → manual upload fallback + pursue formal data-sharing agreement.
- **Tenant data privacy** → aggregate at building level, plain-language opt-in, terms-of-service no-resale clause.
- **Energy consultant displacement** → white-label tier reframes them as channel partners, not displaced.
- **Smaller-owner affordability** → free tier limited to deadline tracking + risk alerts.
- **Product-error → wrongful fine** → E&O insurance + audit trails + dispute resolution in ToS.
- **Competitive watch item**: **Measurabl launched a free California benchmarking tier with USGBC CA in October 2025** — the threat is the SMB segment, which Verdify must capture via workflow depth + consultant channel before this displaces it.

## Commands

The Phase 1 prototype is built (Next.js 16 App Router + local Supabase). Package manager is **pnpm**.

First-time setup: `pnpm install`, ensure Docker is running, then `pnpm db:start` (local Supabase), `pnpm db:reset` (apply migrations), `pnpm seed` (demo data). `.env.local` holds the local Supabase keys.

- `pnpm dev` — run the app on http://localhost:3000
- `pnpm build` — production build + full TypeScript typecheck
- `pnpm test` — Vitest unit suite for the deterministic compliance engine (`src/lib/compliance`); the audit evidence — keep it green
- `pnpm db:start` / `pnpm db:stop` — local Supabase stack (Docker)
- `pnpm db:reset` — drop + re-apply all migrations in `supabase/migrations` (also resets auth users)
- `pnpm seed` — seed demo orgs/users/buildings (4 role surfaces, 2 consultants for the isolation test). Demo password: `verdify-demo`
- `pnpm verify:rls` — executable white-label isolation acceptance test (Pegasus never sees Hillmann)
- `pnpm verify:storage` — vault Storage-RLS double-gating test
- `pnpm smoke` — Playwright authenticated walkthrough of all five screens (requires `pnpm dev` running)
- Scheduled worker: `GET /api/cron/generate-alerts?secret=$CRON_SECRET` (idempotent; Vercel cron config in `vercel.json`)

Architecture map: deterministic rules engine in `src/lib/compliance/` (pure, no I/O — the moat); open-data lookup + manual fallback in `src/lib/data-sources/`; RLS-scoped queries in `src/lib/db/`; all RLS policies in `supabase/migrations/0007_rls_policies.sql`; the five screens under `src/app/(app)/`.

## Working With This Repo

- The product spec is in a `.docx`. To re-read it cleanly: `python3 -c "import zipfile; from xml.etree import ElementTree as ET; ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'; z=zipfile.ZipFile('Context/Verdify - Product description.docx'); root=ET.fromstring(z.open('word/document.xml').read()); print('\n\n'.join(''.join(t.text or '' for t in p.iter(ns+'t')).strip() for p in root.iter(ns+'p') if any((t.text or '').strip() for t in p.iter(ns+'t'))))"`
- When implementing compliance math, cite the LAMC section in a comment next to the constant. That comment is one of the rare cases where the *why* is non-obvious and load-bearing for audits.
- When deciding scope tradeoffs, anchor to: **fine avoidance + audit-ready documentation + reproducible workflow that survives staff turnover.** Those three are the buyer's actual value proposition.
