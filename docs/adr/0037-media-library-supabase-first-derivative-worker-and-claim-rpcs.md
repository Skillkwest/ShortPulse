# ADR 0037: Media Library Supabase-First Derivative Worker And Claim RPCs

## Status
Accepted

## Context
Media Library image-card performance depends on fast preview delivery. We already stabilized card delivery by keeping Supabase signed URLs out of Next optimizer wrapping on media-library surfaces, but many image rows still lacked durable thumb variants. We needed a low-risk path to generate and persist thumbnail derivatives without introducing a new external media-processing stack.

Constraints:
- Keep Supabase as the only media backend.
- Keep user-scoped storage and RLS boundaries intact.
- Use service-role-only claim/update execution for worker safety.
- Preserve no-regression behavior for existing list/sign/preview flows.

## Decision
1. Extend `media_files` with derivative-processing control fields (`processing_attempts`, `processing_next_retry_at`, `processing_last_error`, `processing_updated_at`) and image-claim indexes (`065_*`).
2. Add service-role-only derivative claim/update RPCs (`066_*`):
   - `claim_media_derivative_batch(...)` using `FOR UPDATE SKIP LOCKED`.
   - `mark_media_derivative_ready(...)`.
   - `mark_media_derivative_failed(...)`.
3. Add internal worker route `POST /api/internal/media-derivatives/run` (also `GET` for scheduler compatibility) with cron-secret/bearer auth and fail-closed flag gate.
4. Implement derivative generation as Supabase-first transformed-source fetch + upload:
   - Sign transformed source URLs from canonical storage paths.
   - Fetch transformed payloads server-side.
   - Upload `thumb_240` and `thumb_480` under user-scoped variant paths.
   - Upsert `media_asset_variants` rows and promote `media_files.thumb_variant_path`.

## Consequences
- Positive:
  - Keeps the architecture Supabase-native and avoids external queue/processor dependencies.
  - Worker claims are deterministic and concurrency-safe via `SKIP LOCKED` + leases.
  - Media Library can progressively move to variant-first card rendering while retaining transformed signed fallback.
- Negative:
  - Adds operational scheduling responsibility for `/api/internal/media-derivatives/run`.
  - Retry/backoff tuning is now an additional runtime concern.
- Follow-ups:
  - Add scheduled invocation/runbook automation where needed.
  - Monitor variant coverage and backlog/error metrics to tune retry/batch defaults.

## Alternatives considered
- Option A: Keep transformed signed URL fallback only (no durable derivative worker).
  - Rejected for long-term scale: repeated transform fetches increase recurring latency/cost under heavy libraries.
- Option B: Introduce external media-processing pipeline now.
  - Rejected for this phase due to migration/ops complexity and regression risk.
