# Deploying Verdify to Vercel

Verdify is a Next.js 16 app backed by Supabase. Vercel hosts the app; a hosted
Supabase project provides the database, auth, and storage. Local development
uses a Docker Supabase (see `README` / `CLAUDE.md`); production must point at a
hosted Supabase project instead.

## Prerequisites

- A [Vercel](https://vercel.com) account, with this repo connected.
- A [Supabase](https://supabase.com) project (free tier is sufficient for a demo).
- The Supabase CLI installed locally (`supabase`), for pushing migrations.

## 1. Create the hosted Supabase project

In the Supabase dashboard, create a project and note (Project Settings → API):

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — keep secret)

## 2. Apply the database schema (migrations)

The schema, **including the RLS policies (`0007`) and the Storage vault bucket
(`0008`)**, must be applied to the hosted DB. RLS is what enforces white-label
consultant isolation, so this step is not optional.

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*.sql in order
```

Alternatively, paste each file in `supabase/migrations/` into the Supabase SQL
editor in numeric order.

## 3. Seed demo data (recommended for a demo)

So the deployed app has buildings, orgs, and login users to show. Run locally,
pointed at the **hosted** project (uses the service-role key):

```bash
# Use a shell env file with your hosted values (see .env.production.example):
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm seed
```

This creates the demo orgs/users (4 role surfaces, 2 consultants for the
isolation test). Demo password: `verdify-demo`. The seed creates users via the
admin API, so they are pre-confirmed.

> If you instead sign up users through the UI, disable email confirmation
> (Supabase → Authentication → Providers → Email) or configure SMTP.

## 4. Configure Vercel environment variables

In the Vercel project (Settings → Environment Variables), add the four vars from
[`.env.production.example`](./.env.production.example) for **Production** (and
**Preview** if you want preview deploys to work):

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | hosted project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only secret |
| `CRON_SECRET` | long random string |

## 5. Deploy

Push to the connected branch (or click **Deploy** in Vercel). Build command is
the default `next build`; no extra config needed. `vercel.json` already
registers the daily cron:

```
/api/cron/generate-alerts  →  0 13 * * *  (13:00 UTC daily)
```

Vercel automatically calls it with `Authorization: Bearer $CRON_SECRET`, which
the route validates. Daily cadence runs on all Vercel plans (incl. Hobby).

## Verify the deploy

- Visit the deployment URL → `/login` → sign in as `manager@sunsetpm.test`
  (password `verdify-demo`).
- Portfolio dashboard shows building tiles with the live fine counter.
- Open a building → the location map renders (OpenStreetMap tiles, green pin).
- `/buildings/new` → look up a BIN → map locates it, then either connects
  (serviceable) or explains why it's out of area; lookups alternate.
- Hit `/api/cron/generate-alerts` with the secret to confirm the worker:
  `curl "https://<deployment>/api/cron/generate-alerts?secret=$CRON_SECRET"`.

## Notes & caveats

- **Map tiles**: the map uses OpenStreetMap's public tile servers (no API key).
  Fine for a prototype/demo. For production traffic, switch the `TileLayer` URL
  in `src/components/map/BuildingMap.tsx` to a keyed provider (Mapbox, MapTiler,
  etc.) to respect tile-usage policies.
- **`.env.local`** holds the well-known *local* Supabase keys and is gitignored;
  never use it for a hosted environment.
- The `middleware → proxy` deprecation warning during build is non-blocking.
