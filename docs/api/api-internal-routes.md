# Internal API Routes

Purpose: document the first-party Next.js API surface in `frontend/pages/api/` (auth boundaries, route families, and operational ownership).

## Auth boundary model
- Global API auth gate: `frontend/proxy.ts` protects `/api/fal/*`, `/api/ai/*`, `/api/media/*`, `/api/log/*`, uploads, admin APIs, and billing checkout/portal routes by requiring a Supabase bearer token.
- Route-level auth: handlers call `requireApiUser`/`requireAdminUser` in `frontend/lib/server/api/auth.ts`; route-level auth is token-first and fail-closed (proxy headers are metadata only after verification).
- Webhook exceptions: `/api/billing/stripe/webhook` and `/api/fal/webhook` are intentionally unauthenticated and protected by provider signature verification.

## Route families
| Route family | Methods | Auth | Purpose | Source of truth |
| --- | --- | --- | --- | --- |
| `/api/ai/generate-prompt` | `POST` | Bearer (proxy) | Refine prompts with OpenAI chat completions. | `frontend/pages/api/ai/generate-prompt.ts`, `docs/sops/sop_text_generation.md` |
| `/api/ai/describe-image` | `POST` | Bearer (proxy) | Describe reference images with OpenAI vision. | `frontend/pages/api/ai/describe-image.ts`, `docs/sops/sop_text_generation.md` |
| `/api/ai/studio-agent` | `POST` | Bearer (proxy) | AI Studio chat agent orchestration with flow-aware routing, server vision summaries, and structured actions (`applyPrompt`, `variations`, `describeTargets`, `referenceCard`; no question actions). | `frontend/pages/api/ai/studio-agent.ts`, `docs/sops/sop_ai_studio_agent.md`, `docs/sops/sop_ai_studio_agent_chat_ops.md` |
| `/api/upload-image` | `POST` multipart | Bearer (proxy + route) | Upload images to private `media_library`; return signed URLs. | `frontend/pages/api/upload-image.ts` |
| `/api/upload-video` | `POST` multipart | Bearer (proxy + route) | Upload motion-control videos to private `media_library`; return signed URLs. | `frontend/pages/api/upload-video.ts` |
| `/api/media/sign-batch` | `POST` | Bearer (proxy + route) | Batch-sign user-scoped media paths for list/grid previews. | `frontend/pages/api/media/sign-batch.ts` |
| `/api/media/move` | `POST` | Bearer (proxy + route) | Move a media file between tabs by updating storage path + `media_files` source/path (used by modal move and gallery bulk-move loops). | `frontend/pages/api/media/move.ts` |
| `/api/media/move-batch` | `POST` | Bearer (proxy + route) | Move multiple media files in one request with per-file success/failure summary. | `frontend/pages/api/media/move-batch.ts` |
| `/api/media/resolve-previews` | `POST` | Bearer (proxy + route) | Resolve media preview URLs in bulk (signed-url hydration + user-scoped URL fallback for legacy records). | `frontend/pages/api/media/resolve-previews.ts`, `frontend/lib/mediaPreviewPath.ts` |
| `/api/fal/*` | `POST`, `GET` | Bearer (proxy; some routes also verify user in handler) | Submit/poll Fal generations with server-side key handling and credit reservation/capture/refund logic, including queue handoff polling at `/api/fal/queue-status`. | `frontend/pages/api/fal/*.ts`, `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/falStatusProxy.ts`, `frontend/lib/server/api/generationQueue/*.ts`, model docs in `docs/api/api-fal-*.md` |
| `/api/fal/webhook` | `POST` raw body | Fal signature | Webhook-first Fal lifecycle ingestion; verifies Fal webhook signatures (JWKS/Ed25519 with dual-mode fallback), writes durable webhook inbox records, and executes shared recovery/persistence/settlement path idempotently. | `frontend/pages/api/fal/webhook.ts`, `frontend/lib/server/api/falWebhook.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts` |
| `/api/billing/credit-packages` | `GET` | Bearer (proxy + route) | List active top-up packages for billing UI. | `frontend/pages/api/billing/credit-packages.ts` |
| `/api/credits/snapshot` | `GET` | Bearer (proxy + route) | Return user credit snapshot (`availableCents`, `reservedCents`, `spendableCents`) for responsive balance/hold UX. | `frontend/pages/api/credits/snapshot.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/billing/stripe/checkout` | `POST` | Bearer (proxy + route) | Create Stripe checkout sessions for credit packages. | `frontend/pages/api/billing/stripe/checkout.ts` |
| `/api/billing/stripe/portal` | `POST` | Bearer (proxy + route) | Create Stripe billing portal sessions. | `frontend/pages/api/billing/stripe/portal.ts` |
| `/api/billing/stripe/webhook` | `POST` raw body | Stripe signature | Apply Stripe events idempotently (`stripe_event_log`) and credit/profile updates. | `frontend/pages/api/billing/stripe/webhook.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/users` | `GET` | Admin bearer | List users + plan/credit snapshots with pagination/search. Returns spendable credits (`available - reserved`) plus available/reserved fields so Admin matches AI Studio credit math. | `frontend/pages/api/admin/users.ts` |
| `/api/admin/credits/adjust` | `POST` | Admin bearer | Manual credit adjustments (bounded, audited). | `frontend/pages/api/admin/credits/adjust.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/credits/ledger` | `GET` | Admin bearer | Fetch recent credit ledger transactions for one user, including generation pricing breakdown metadata (`raw` vs `billed`) when present. Supports optional `source` filter (example: `source=generation_charge`). | `frontend/pages/api/admin/credits/ledger.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/errors` | `GET` | Admin bearer | Incident feed with filters (status/severity/source/scope/search), summary stats, and pagination. Returns `health.degraded=true` (while still `200`) if non-core summary/pagination count queries fail so the incident list can remain available. | `frontend/pages/api/admin/errors.ts`, `docs/monitoring.md` |
| `/api/admin/error-events` | `GET` | Admin bearer | Raw per-occurrence event stream with scope/severity/source/search/synthetic plus `signal` filters, pagination, linked incident status enrichment, and 15-minute threshold summaries (computed from real failure traffic; excludes synthetic + `telemetry.*` sources). Includes Character Mode counters (`reference_refresh_empty`, `bundle_unavailable` fallback) plus non-breach informational admission-deny telemetry (`admissionDeniedTelemetry` by tier/reason for 15m/1h/24h). Returns `health.degraded=true` when `app_error_events` is unavailable or when non-core summary/enrichment queries fail so the event list can fail soft for operators. | `frontend/pages/api/admin/error-events.ts`, `docs/monitoring.md` |
| `/api/admin/errors-status` | `POST` | Admin bearer | Update status (`open`/`resolved`/`ignored`) for an incident (`errorId`) or promote/link an unlinked event (`eventId`) and apply status with metadata history. | `frontend/pages/api/admin/errors-status.ts` |
| `/api/admin/errors-test` | `POST` | Admin bearer | Create a synthetic app or generation incident for operator smoke tests of telemetry ingestion/UI. | `frontend/pages/api/admin/errors-test.ts`, `docs/monitoring.md` |
| `/api/admin/access` | `GET` | Bearer (route-level) | Lightweight admin access check for UI gating (`role` or allowlist) without coupling page access to `/api/admin/users` fetch health. | `frontend/pages/api/admin/access.ts`, `frontend/features/admin/logic/useAdminAccess.ts` |
| `/api/admin/generation-trace` | `GET` | Admin bearer | Return stitched generation timeline by `generationId`, `requestId`, or trace id across `ai_generations`, `media_events`, `media_files`, reservations, ledger entries, and app error events. Intended for operator debugging and S0 traceability baselines. | `frontend/pages/api/admin/generation-trace.ts`, `docs/planning/ai-studio-generation-runtime-stabilization.md` |
| `/api/admin/generation-recovery/replay` | `POST` | Admin bearer | Replay stalled generation recovery by `generationId` or `requestId` (Fal only) using the shared runtime execution engine (provider probe -> persist -> settle -> transition). | `frontend/pages/api/admin/generation-recovery/replay.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts` |
| `/api/internal/generation-recovery/run` | `POST`, `GET` | `x-shortpulse-cron-secret` or `Authorization: Bearer <reconciler-secret>` | Trigger queue dispatch + lease-based reconciler claims and execute shared runtime recovery for each claimed generation; returns recovery stage metrics (`claimed`, `processed`, `recovered`, `requeued`, `exhausted`, `duplicates`, `errors`, `skipped`), reservation cleanup metrics (`reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`), and queue dispatch metrics (`queueClaimed`, `queueSubmitted`, `queueRetried`, `queueRequeuedNoCapacity`, `queueExhausted`, `queueSkipped`, `queueDispatchErrors`). Intended for external scheduler invocation (Supabase Cron recommended) and guarded manual replay. | `frontend/pages/api/internal/generation-recovery/run.ts`, `frontend/lib/server/api/generationQueue/dispatch.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts`, `docs/sops/sop_provider_incident_response.md`, `sql/configure_generation_recovery_scheduler_supabase.sql` |
| `/api/log/client-error` | `POST` | Bearer (proxy + route) | Ingest authenticated client/runtime and generation workflow failures into `app_error_logs` and `app_error_events`. | `frontend/pages/api/log/client-error.ts`, `frontend/lib/server/api/appErrorLogs.ts` |

## Shared runtime contracts
- Credit lifecycle for generation:
  - Submit path: reserve credits (`reserve_generation_credits`).
    - Optional flagged path: atomic admission+reserve (`admit_and_reserve_generation_credits`).
  - Submit admission control (`off|shadow|enforce`) can reject over-limit starts with `429` + `Retry-After` and payload:
    - `code: GENERATION_ADMISSION_LIMIT`
    - `retryAfterSeconds`
    - `limits: { globalMax, globalActive, tier, tierMax, tierActive }`
  - In `enforce` mode, if reservation billing mode is unavailable and submit would fall back to direct debit, submit fails closed with:
    - `503`
    - `code: GENERATION_ADMISSION_UNAVAILABLE`
    - `retryAfterSeconds` + `Retry-After` header.
  - Admission deny path immediately releases reservation (`release_generation_reservation_by_source_ref`).
  - Queue-enabled over-cap path accepts submit as queued (`202`, `code: GENERATION_QUEUED`) and defers provider submit to server dispatcher.
  - Queue handoff polling contract (`GET /api/fal/queue-status`) returns `queued | dispatched | failed | not_found`.
  - Submit proxy sends `X-Fal-Request-Timeout` to queue endpoints to bound pre-start latency at provider edge.
  - Provider request accepted: attach provider request ID to reservation.
  - Success path: capture reservation to ledger debit.
  - Failure path: release reservation (no debit).
- Incident logging:
  - API catch blocks should call `logApiRouteException`.
  - Client/runtime and generation workflow incidents should be sent to `/api/log/client-error`.
- Request correlation:
  - `x-shortpulse-request-id` is used where present for traceability and ledger/source references.

## Required server environment
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Fal: `FAL_KEY`.
- OpenAI: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_VISION_FALLBACK_MODEL`, `OPENAI_API_BASE`, `OPENAI_DESCRIBE_ALLOWED_HOSTS`, `OPENAI_DESCRIBE_REQUIRE_ALLOWED_HOSTS`.
- OpenAI runtime mode flags:
  - `SHORTPULSE_OPENAI_RESPONSES_ENABLED`
  - `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Admin allowlist (optional): `SHORTPULSE_ADMIN_EMAILS`.
- Emergency auth fallback (default `false`): `SHORTPULSE_TRUST_PROXY_AUTH_HEADERS`.
- Admin event alert thresholds (optional): `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, `SHORTPULSE_ADMIN_ALERT_GENERATION_15M`.
- Fal reliability rollout flags (feature-gated):
  - `SHORTPULSE_FAL_INTEGRATION_MODE`
  - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
  - `SHORTPULSE_FAL_WEBHOOK_ENABLED`
  - `SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE` (`dual|fal_only|hmac_only`)
  - `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`
  - `SHORTPULSE_FAL_WEBHOOK_SECRET`
  - `SHORTPULSE_FAL_WEBHOOK_TOLERANCE_SECONDS`
  - `SHORTPULSE_PUBLIC_API_BASE_URL` (or `APP_BASE_URL` fallback for Fal webhook callback registration)
  - `SHORTPULSE_FAL_RECONCILER_ENABLED`
  - `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
  - `CRON_SECRET` (optional manual/fallback bearer secret; should match reconciler secret when set)
  - `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE`
  - `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS`
  - `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M`
  - `SHORTPULSE_FAL_ADMISSION_MODE` (`off|shadow|enforce`)
  - `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX`
  - `SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON`
  - `SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS`
  - `SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED`
  - `SHORTPULSE_FAL_QUEUE_ENABLED`
  - `SHORTPULSE_FAL_QUEUE_MAX_PER_USER`
  - `SHORTPULSE_FAL_QUEUE_DISPATCH_BATCH_SIZE`
  - `SHORTPULSE_FAL_QUEUE_LEASE_SECONDS`
  - `SHORTPULSE_FAL_QUEUE_MAX_ATTEMPTS`
  - `SHORTPULSE_FAL_QUEUE_BASE_BACKOFF_SECONDS`
  - `SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE`

## Maintenance checklist
1. When adding or renaming an API route, update this file and any impacted SOP/API docs.
2. If route auth changes, update `frontend/proxy.ts`, this file, and `docs/security-checklist.md` together.
3. If billing settlement behavior changes, update `docs/sops/sop_billing_credits_operations.md` and `docs/data-dictionary.md`.
4. Run `npm -C frontend run docs:check` after doc updates.
