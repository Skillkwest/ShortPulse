# ADR 0001: Client-only architecture and demo data strategy

## Status

Accepted; amended 2026-06-21 for Performance Analytics retirement; amended 2026-06-25 for Saved Creators retirement

## Context

- The repo previously included a FastAPI backend and ingestion pipeline but was removed on 2026-12-29.
- Current product requirements prioritize fast iteration on UI and Supabase auth/storage without managing server infra.
- Supabase is used client-side only (anon key) with RLS enforcing per-user isolation.
- The old in-browser Performance Analytics demo route was retired on 2026-06-21; this ADR no longer authorizes demo analytics routes, fixtures, or scoring UI.
- The Saved Creators route and direct `saved_creators` browser data path were retired on 2026-06-25; this ADR no longer authorizes that feature surface or table as active product scope.

## Decision

- Keep the app client-only using the Next.js pages router; do not introduce a backend service without a new ADR.
- Use Supabase client for auth and `media_library` storage only; no server-side service role usage under this ADR.
- Do not ship demo Performance Analytics data, refresh/rescore actions, or analytics scoring UI under this ADR.

## Consequences

- Positive:
  - Simplifies local setup (frontend only) and reduces operational surface area.
  - Preserves strong RLS boundaries by avoiding service-role exposure.
  - Faster UI iteration and lower hosting cost/complexity.
- Negative:
  - No server-side batching/ingestion; real-time/large-scale data requires a future backend decision.
  - Client performance limits for heavy datasets or long-running jobs.
- Follow-ups:
  - Add ADRs if reintroducing ingestion/backfill, webhooks, or server-rendered pages.
  - Document any new tables/policies in `docs/data-dictionary.md` and SOPs.

## Alternatives considered

- Reintroduce backend for ingestion/metrics: rejected for now to keep client-only simplicity.
- Hybrid approach with serverless functions for scoring: deferred until a clear product need exists.
