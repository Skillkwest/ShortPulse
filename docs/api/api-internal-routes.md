# Internal API Routes

Purpose: document the first-party Next.js API surface in `frontend/pages/api/` (auth boundaries, route families, and operational ownership).

## Auth boundary model
- Global API auth gate: `frontend/proxy.ts` protects `/api/fal/*`, `/api/kei/*`, `/api/ai/*`, `/api/media/*`, uploads, admin APIs, and billing checkout/portal routes by requiring a Supabase bearer token.
- KEI routes are currently hard-disabled for MVP and return `410` from route handlers.
- Route-level auth: several handlers still call `requireApiUser`/`requireAdminUser` in `frontend/lib/server/api/auth.ts` for direct enforcement and user context.
- Webhook exception: `/api/billing/stripe/webhook` is intentionally unauthenticated and protected by Stripe signature verification.

## Route families
| Route family | Methods | Auth | Purpose | Source of truth |
| --- | --- | --- | --- | --- |
| `/api/ai/generate-prompt` | `POST` | Bearer (proxy) | Refine prompts with OpenAI chat completions. | `frontend/pages/api/ai/generate-prompt.ts`, `docs/sops/sop_text_generation.md` |
| `/api/ai/describe-image` | `POST` | Bearer (proxy) | Describe reference images with OpenAI vision. | `frontend/pages/api/ai/describe-image.ts`, `docs/sops/sop_text_generation.md` |
| `/api/ai/studio-agent` | `POST` | Bearer (proxy) | AI Studio chat agent orchestration with structured actions. | `frontend/pages/api/ai/studio-agent.ts`, `docs/sops/sop_ai_studio_agent.md`, `docs/sops/sop_ai_studio_agent_chat_ops.md` |
| `/api/upload-image` | `POST` multipart | Bearer (proxy + route) | Upload images to private `media_library`; return signed URLs. | `frontend/pages/api/upload-image.ts` |
| `/api/upload-video` | `POST` multipart | Bearer (proxy + route) | Upload motion-control videos to private `media_library`; return signed URLs. | `frontend/pages/api/upload-video.ts` |
| `/api/media/sign-batch` | `POST` | Bearer (proxy + route) | Batch-sign user-scoped media paths for list/grid previews. | `frontend/pages/api/media/sign-batch.ts` |
| `/api/media/move` | `POST` | Bearer (proxy + route) | Move a media file between tabs by updating storage path + `media_files` source/path (used by modal move and gallery bulk-move loops). | `frontend/pages/api/media/move.ts` |
| `/api/media/move-batch` | `POST` | Bearer (proxy + route) | Move multiple media files in one request with per-file success/failure summary. | `frontend/pages/api/media/move-batch.ts` |
| `/api/media/resolve-previews` | `POST` | Bearer (proxy + route) | Resolve media preview URLs in bulk (signed-url hydration + user-scoped URL fallback for legacy records). | `frontend/pages/api/media/resolve-previews.ts`, `frontend/lib/mediaPreviewPath.ts` |
| `/api/fal/*` | `POST` | Bearer (proxy; some routes also verify user in handler) | Submit/poll Fal generations with server-side key handling and credit reservation/capture/refund logic. | `frontend/pages/api/fal/*.ts`, `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/falStatusProxy.ts`, model docs in `docs/api/api-fal-*.md` |
| `/api/kei/create-task`, `/api/kei/task-status`, `/api/kei/status`, `/api/kei/gpt4o-generate` | `POST` | Bearer (proxy) | KEI routes are disabled for MVP and return `410` (`KEI_DISABLED_FOR_MVP`). | `frontend/pages/api/kei/*.ts` |
| `/api/billing/credit-packages` | `GET` | Bearer (proxy + route) | List active top-up packages for billing UI. | `frontend/pages/api/billing/credit-packages.ts` |
| `/api/credits/snapshot` | `GET` | Bearer (proxy + route) | Return user credit snapshot (`availableCents`, `reservedCents`, `spendableCents`) for responsive balance/hold UX. | `frontend/pages/api/credits/snapshot.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/billing/stripe/checkout` | `POST` | Bearer (proxy + route) | Create Stripe checkout sessions for credit packages. | `frontend/pages/api/billing/stripe/checkout.ts` |
| `/api/billing/stripe/portal` | `POST` | Bearer (proxy + route) | Create Stripe billing portal sessions. | `frontend/pages/api/billing/stripe/portal.ts` |
| `/api/billing/stripe/webhook` | `POST` raw body | Stripe signature | Apply Stripe events idempotently (`stripe_event_log`) and credit/profile updates. | `frontend/pages/api/billing/stripe/webhook.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/users` | `GET` | Admin bearer | List users + plan/credit snapshots with pagination/search. | `frontend/pages/api/admin/users.ts` |
| `/api/admin/credits/adjust` | `POST` | Admin bearer | Manual credit adjustments (bounded, audited). | `frontend/pages/api/admin/credits/adjust.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/credits/ledger` | `GET` | Admin bearer | Fetch recent credit ledger transactions for one user, including generation pricing breakdown metadata (`raw` vs `billed`) when present. Supports optional `source` filter (example: `source=generation_charge`). | `frontend/pages/api/admin/credits/ledger.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/errors` | `GET` | Admin bearer | Incident feed with filters (status/severity/source/scope/search), summary stats, and pagination. Returns `health.degraded=true` (while still `200`) if non-core summary/pagination count queries fail so the incident list can remain available. | `frontend/pages/api/admin/errors.ts`, `docs/monitoring.md` |
| `/api/admin/error-events` | `GET` | Admin bearer | Raw per-occurrence event stream with scope/severity/source/search/synthetic plus `signal` filters, pagination, linked incident status enrichment, and 15-minute threshold summaries (computed from real failure traffic; excludes synthetic + `telemetry.*` sources). Includes Character Mode counters (`reference_refresh_empty`, `bundle_unavailable` fallback) and returns `health.degraded=true` when `app_error_events` is unavailable or when non-core summary/enrichment queries fail so the event list can fail soft for operators. | `frontend/pages/api/admin/error-events.ts`, `docs/monitoring.md` |
| `/api/admin/errors-status` | `POST` | Admin bearer | Update incident status (`open`/`resolved`/`ignored`) with metadata history. | `frontend/pages/api/admin/errors-status.ts` |
| `/api/admin/errors-test` | `POST` | Admin bearer | Create a synthetic app or generation incident for operator smoke tests of telemetry ingestion/UI. | `frontend/pages/api/admin/errors-test.ts`, `docs/monitoring.md` |
| `/api/log/client-error` | `POST` | Bearer (route-level) | Ingest authenticated client/runtime and generation workflow failures into `app_error_logs` and `app_error_events`. | `frontend/pages/api/log/client-error.ts`, `frontend/lib/server/api/appErrorLogs.ts` |

## Shared runtime contracts
- Credit lifecycle for generation:
  - Submit path: reserve credits (`reserve_generation_credits`).
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
- OpenAI: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_API_BASE`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Admin allowlist (optional): `SHORTPULSE_ADMIN_EMAILS`.
- Admin event alert thresholds (optional): `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, `SHORTPULSE_ADMIN_ALERT_GENERATION_15M`.

## Maintenance checklist
1. When adding or renaming an API route, update this file and any impacted SOP/API docs.
2. If route auth changes, update `frontend/proxy.ts`, this file, and `docs/security-checklist.md` together.
3. If billing settlement behavior changes, update `docs/sops/sop_billing_credits_operations.md` and `docs/data-dictionary.md`.
4. Run `npm -C frontend run docs:check` after doc updates.
