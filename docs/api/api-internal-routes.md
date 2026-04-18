# Internal API Routes

Purpose: document the first-party Next.js API surface in `frontend/pages/api/` (auth boundaries, route families, and operational ownership).

## Auth boundary model
- Global API auth gate: `frontend/proxy.ts` protects `/api/announcements/*`, `/api/fal/*`, `/api/ai/*`, `/api/media/*`, `/api/log/*`, uploads, admin APIs, and billing checkout/portal routes by requiring a Supabase bearer token.
- Route-level auth: handlers call `requireApiUser`/`requireAdminUser` in `frontend/lib/server/api/auth.ts`; route-level auth is token-first and fail-closed (proxy headers are metadata only after verification).
- Webhook exceptions: `/api/billing/stripe/webhook` and `/api/fal/webhook` are intentionally unauthenticated and protected by provider signature verification.

## Route families
| Route family | Methods | Auth | Purpose | Source of truth |
| --- | --- | --- | --- | --- |
| `/api/ai/extract-style` | `POST` | Bearer (proxy) | Extract reusable visual style descriptors plus a normalized creative style title from a reference image for Styles Library create flows. Reuses trusted-host URL preflight and OpenAI vision retry/fallback model handling. | `frontend/pages/api/ai/extract-style.ts`, `docs/sops/sop_text_generation.md` |
| `/api/ai/studio-agent` | `POST` | Bearer (proxy) | AI Studio agent route for direct OpenAI-backed prompt refinement and multimodal prompt-building. Returns canonical `message` plus optional `actions.applyPrompt`, includes server-authoritative input safety precheck before provider calls (rewrite/refuse), and supports configurable output post-process mode (`enforce|shadow|off`). | `frontend/pages/api/ai/studio-agent.ts`, `docs/sops/sop_ai_studio_agent.md`, `docs/sops/sop_ai_studio_agent_chat_ops.md` |
| `/api/ai/sessions/save` | `POST` | Bearer (proxy + route) | Save one AI Studio session snapshot (`sid` + schema-versioned payload) for the authenticated user. | `frontend/pages/api/ai/sessions/save.ts`, `frontend/lib/server/api/aiStudioSessions.ts` |
| `/api/ai/sessions/:sid` | `GET` | Bearer (proxy + route) | Return one persisted AI Studio session snapshot by `sid` for the authenticated user. | `frontend/pages/api/ai/sessions/[sid].ts`, `frontend/lib/server/api/aiStudioSessions.ts` |
| `/api/ai/sessions` | `GET` | Bearer (proxy + route) | List persisted AI Studio sessions with `limit` + `cursor` pagination for the authenticated user. | `frontend/pages/api/ai/sessions/index.ts`, `frontend/lib/server/api/aiStudioSessions.ts` |
| `/api/ai/media-folder-canvas/:folderId` | `GET` | Bearer (proxy + route) | Load one user-owned custom-folder canvas snapshot for AI Studio Media Library folder canvases; rejects virtual root `all_items`. | `frontend/pages/api/ai/media-folder-canvas/[folderId].ts`, `frontend/lib/server/mediaFolderCanvasService.ts` |
| `/api/ai/media-folder-canvas/save` | `POST` | Bearer (proxy + route) | Save one user-owned custom-folder canvas snapshot (`schemaVersion` + object snapshot payload); rejects virtual root `all_items` and cross-user folders. | `frontend/pages/api/ai/media-folder-canvas/save.ts`, `frontend/lib/server/mediaFolderCanvasService.ts` |
| `/api/upload-image` | `POST` multipart | Bearer (proxy + route) | Compatibility adapter for transient AI Studio image-reference uploads. Reuses shared server-authoritative validation/storage logic, preserves legacy `{ url, path, size }` response shape, and emits success-path usage telemetry for sunset review. | `frontend/pages/api/upload-image.ts`, `frontend/lib/server/mediaUploadAdapterTelemetry.ts` |
| `/api/upload-video` | `POST` multipart | Bearer (proxy + route) | Compatibility adapter for transient AI Studio motion-reference uploads. Reuses shared server-authoritative validation/storage logic, preserves legacy `{ url, path, size }` response shape, and emits success-path usage telemetry for sunset review. | `frontend/pages/api/upload-video.ts`, `frontend/lib/server/mediaUploadAdapterTelemetry.ts` |
| `/api/kie/upload-url` | `POST` | Bearer (proxy + route) | Kie upload helper for moving a trusted external file URL into Kie-managed storage before provider submit. Validates `http(s)` URLs, rejects local/private-network hosts, chooses file-url vs stream upload path, and returns the uploaded Kie URL plus optional file metadata. | `frontend/pages/api/kie/upload-url.ts` |
| `/api/media/sign-batch` | `POST` | Bearer (proxy + route) | Batch-sign user-scoped authoritative preview paths for list/grid previews. Returns surface-aware preview-profile telemetry headers (`x-shortpulse-media-sign-*`). Transform-backed delivery is compatibility-only and disabled by default. | `frontend/pages/api/media/sign-batch.ts` |
| `/api/media/list` | `POST` | Bearer (proxy + route) | Server-authoritative media listing with tab or media-kind filtering, optional folder filter (`all_items` virtual root or custom-folder membership scope), keyset pagination, optional first-slice signed-preview hydration, and explicit `profile=minimal|expanded` response shaping (`minimal` default). `all_items` is the All Media master list; completeness for legacy missing durable rows is converged via diagnostics/backfill SQL (`sql/check_media_all_media_completeness_drift.sql`, `sql/migrations/064_backfill_media_files_from_storage_objects.sql`). | `frontend/pages/api/media/list.ts`, `frontend/features/media-library/logic/mediaQueryModel.ts`, `frontend/lib/mediaListProfile.ts` |
| `/api/media/prompts/list` | `POST` | Bearer (proxy + route) | Server-authoritative prompt listing for AI Studio Media Library panel with folder-aware keyset pagination and search. | `frontend/pages/api/media/prompts/list.ts` |
| `/api/media/folders/list` | `GET` | Bearer (proxy + route) | List authenticated user custom Media Library folders with explicit `parentFolderId` ancestry references. | `frontend/pages/api/media/folders/list.ts`, `frontend/lib/server/mediaFoldersService.ts` |
| `/api/media/folders/create` | `POST` | Bearer (proxy + route) | Create a custom Media Library folder (trimmed, bounded name validation, optional `parentFolderId`, sibling-scoped uniqueness, same-user parent validation). | `frontend/pages/api/media/folders/create.ts`, `frontend/lib/server/mediaFoldersService.ts` |
| `/api/media/folders/move` | `POST` | Bearer (proxy + route) | Reparent a user-owned custom Media Library folder to a new optional `parentFolderId` (`null` = root), with same-user parent validation, sibling-scoped uniqueness, and hierarchy conflict rejection (self-parent/cycle). | `frontend/pages/api/media/folders/move.ts`, `frontend/lib/server/mediaFoldersService.ts` |
| `/api/media/folders/rename` | `POST` | Bearer (proxy + route) | Rename a user-owned custom Media Library folder under sibling-scoped uniqueness; response carries `parentFolderId`. | `frontend/pages/api/media/folders/rename.ts`, `frontend/lib/server/mediaFoldersService.ts` |
| `/api/media/folders/delete` | `POST` | Bearer (proxy + route) | Delete a user-owned custom Media Library folder; nested descendants cascade with the folder row, and media/prompt memberships are removed while master media rows remain intact. | `frontend/pages/api/media/folders/delete.ts`, `frontend/lib/server/mediaFoldersService.ts` |
| `/api/media/folders/membership-batch` | `POST` | Bearer (proxy + route) | Batch `assign`/`unassign`/`move` membership operations for user-owned media/prompt ids across custom folders; rejects `all_items` as mutation target and rejects cross-user ids. | `frontend/pages/api/media/folders/membership-batch.ts`, `frontend/lib/server/mediaFoldersService.ts` |
| `/api/media/upload` | `POST` multipart/raw | Bearer (proxy + route) | Server-authoritative Media Library upload path. Validates destination + file signature, stores scoped object, inserts `media_files`, and returns signed preview metadata. | `frontend/pages/api/media/upload.ts`, `frontend/lib/server/mediaUploadService.ts` |
| `/api/media/copy-from-url` | `POST` | Bearer (proxy + route) | Server-authoritative trusted-host URL copy fallback for Media Library persistence when browser-side fetch/download is blocked; stores user-scoped object and persists `media_files` metadata. | `frontend/pages/api/media/copy-from-url.ts`, `frontend/lib/mediaPreviewTrustPolicy.ts`, `frontend/lib/mediaStoragePath.ts` |
| `/api/media/move` | `POST` | Bearer (proxy + route) | Move a media file between tabs by updating storage path + `media_files` source/path (used by modal move and gallery bulk-move loops). | `frontend/pages/api/media/move.ts` |
| `/api/media/move-batch` | `POST` | Bearer (proxy + route) | Move multiple media files in one request with per-file success/failure summary. | `frontend/pages/api/media/move-batch.ts` |
| `/api/media/resolve-previews` | `POST` | Bearer (proxy + route) | Resolve media preview URLs in bulk using derivative-first candidate selection (`thumb`/`poster`/`preview` variants before original storage path), plus trusted-host direct URL fallback for legacy records, with preview-profile response headers (`x-shortpulse-media-resolve-*`). | `frontend/pages/api/media/resolve-previews.ts`, `frontend/lib/mediaPreviewPath.ts`, `frontend/lib/mediaPreviewTrustPolicy.ts` |
| `/api/fal/*` | `POST`, `GET` | Bearer (proxy; some routes also verify user in handler) | Submit/poll provider generations with server-side key handling. Standard Fal image/edit and Kie submits now go directly to provider async APIs; submit routes own credit reservation/capture/refund flow, while status routes are observational provider polling plus compatibility queue-status reads at `/api/fal/queue-status` for historical queued rows. Includes Fal model routes (including FLUX Fill inpaint endpoints `/api/fal/flux-pro-fill-submit` + `/api/fal/flux-pro-fill-status` and Bria remove-background endpoints `/api/fal/bria-background-remove-submit` + `/api/fal/bria-background-remove-status`) plus Kie routes (`/api/fal/kie-veo-submit`, `/api/fal/kie-veo-status`, `/api/fal/kie-kling-submit`, `/api/fal/kie-kling-status`) behind Kie runtime flags/allowlist. | `frontend/pages/api/fal/*.ts`, `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/falStatusProxy.ts`, `frontend/lib/server/api/generationQueue/*.ts`, model docs in `docs/api/api-fal-*.md` and `docs/api/api-kie-*.md` |
| `/api/fal/webhook` | `POST` raw body | Fal signature | Webhook-first Fal lifecycle ingestion; verifies Fal webhook signatures (JWKS/Ed25519 with dual-mode fallback), enforces raw-body size caps (`413` on breach), writes durable webhook inbox records, and executes shared recovery/persistence/settlement path idempotently with sanitized `500` error responses. | `frontend/pages/api/fal/webhook.ts`, `frontend/lib/server/api/falWebhook.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts` |
| `/api/billing/credit-packages` | `GET` | Bearer (proxy + route) | List active top-up packages for billing UI. | `frontend/pages/api/billing/credit-packages.ts` |
| `/api/credits/snapshot` | `GET` | Bearer (proxy + route) | Return user credit snapshot (`availableCents`, `reservedCents`, `spendableCents`) for responsive balance/hold UX. | `frontend/pages/api/credits/snapshot.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/announcements/active` | `GET` | Bearer (proxy + route) | Return the currently active global dashboard announcement for authenticated users, or `null` when none is active. | `frontend/pages/api/announcements/active.ts`, `frontend/lib/server/api/dashboardAnnouncements.ts` |
| `/api/billing/stripe/checkout` | `POST` | Bearer (proxy + route) | Create Stripe checkout sessions for credit packages. | `frontend/pages/api/billing/stripe/checkout.ts` |
| `/api/billing/stripe/portal` | `POST` | Bearer (proxy + route) | Create Stripe billing portal sessions. | `frontend/pages/api/billing/stripe/portal.ts` |
| `/api/billing/stripe/webhook` | `POST` raw body | Stripe signature | Apply Stripe events idempotently (`stripe_event_log`) and credit/profile updates, with bounded raw-body reads (`413` on breach) and sanitized `500` responses for internal failures. | `frontend/pages/api/billing/stripe/webhook.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/users` | `GET` | Admin bearer | List users + plan/credit snapshots with pagination/search. Returns spendable credits (`available - reserved`) plus available/reserved fields so Admin matches AI Studio credit math. | `frontend/pages/api/admin/users.ts` |
| `/api/admin/credits/adjust` | `POST` | Admin bearer | Manual credit adjustments (bounded, audited). | `frontend/pages/api/admin/credits/adjust.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/credits/ledger` | `GET` | Admin bearer | Fetch recent credit ledger transactions for one user, including generation pricing breakdown metadata (`raw` vs `billed`) when present. Supports optional `source` filter (example: `source=generation_charge`). | `frontend/pages/api/admin/credits/ledger.ts`, `docs/sops/sop_billing_credits_operations.md` |
| `/api/admin/user-health` | `POST` | Admin bearer | Run a user-level generation/queue/reservation/ledger health report by `lookup` (email or user id) with findings and recommended next actions. Canonical `generation_attempts` and `ai_generation_outputs` are used where they materially improve provider-linkage and persisted-success diagnosis. | `frontend/pages/api/admin/user-health.ts`, `docs/sops/sop_billing_credits_operations.md`, `docs/sops/sop_generation_recovery_diagnostics.md` |
| `/api/admin/user-health-fleet` | `GET` | Admin bearer | Return latest (or selected `runId`) fleet health run summary with paginated per-user snapshots/findings and server-side filters (`severity`, `riskBand`, `findingCode`, `search`). Run payload includes `drainage` metrics and latest-run-only `drainageTrend` deltas (`previousRunId`, `scannedDelta`, `releasedDelta`, `errorsDelta`). | `frontend/pages/api/admin/user-health-fleet.ts`, `frontend/lib/server/adminUserHealth/fleet.ts`, `docs/sops/sop_admin_user_health_fleet_operations.md` |
| `/api/admin/announcements/current` | `GET` | Admin bearer | Return the currently active dashboard announcement (`announcement` object or `null`) for admin workspace controls. | `frontend/pages/api/admin/announcements/current.ts`, `frontend/lib/server/api/dashboardAnnouncements.ts` |
| `/api/admin/announcements/publish` | `POST` | Admin bearer | Publish/activate a dashboard announcement with validated `title` + `message`; previous active row is superseded. | `frontend/pages/api/admin/announcements/publish.ts`, `frontend/lib/server/api/dashboardAnnouncements.ts` |
| `/api/admin/announcements/clear` | `POST` | Admin bearer | Clear/deactivate the currently active dashboard announcement. | `frontend/pages/api/admin/announcements/clear.ts`, `frontend/lib/server/api/dashboardAnnouncements.ts` |
| `/api/admin/errors` | `GET` | Admin bearer | Incident feed with filters (status/severity/source/scope/search), summary stats, and pagination. Returns `health.degraded=true` (while still `200`) if non-core summary/pagination count queries fail so the incident list can remain available. | `frontend/pages/api/admin/errors.ts`, `docs/monitoring.md` |
| `/api/admin/error-events` | `GET` | Admin bearer | Raw per-occurrence event stream with scope/severity/source/search/synthetic plus `signal` filters, pagination, linked incident status enrichment, and 15-minute threshold summaries (computed from real failure traffic; excludes synthetic + `telemetry.*` sources). Includes Character Mode counters (`reference_refresh_empty`, `bundle_unavailable` fallback) plus non-breach informational admission-deny telemetry (`admissionDeniedTelemetry` by tier/reason for 15m/1h/24h). `incident=actionable` uses a bounded server-side merge (`unlinked OR linked-open`) after enrichment to avoid relation logic parser failures; route reports degraded health guidance if bounded mode is active or truncated. Returns `health.degraded=true` when `app_error_events` is unavailable or when non-core summary/enrichment queries fail so the event list can fail soft for operators. | `frontend/pages/api/admin/error-events.ts`, `docs/monitoring.md` |
| `/api/admin/errors-status` | `POST` | Admin bearer | Update status (`open`/`resolved`/`ignored`) for an incident (`errorId`) or promote/link an unlinked event (`eventId`) using atomic RPC execution. Status transitions stamp action-time metadata (`status_updated_at`) and promotion preserves event-origin time (`promoted_event_occurred_at`) in incident metadata. | `frontend/pages/api/admin/errors-status.ts`, `sql/migrations/039_admin_error_status_atomic_update.sql` |
| `/api/admin/errors-status-bulk` | `POST` | Admin bearer | Bulk update listed incident statuses (`open`/`resolved`/`ignored`) by `errorIds[]` using the same atomic RPC per incident under bounded concurrency; returns per-request updated/failed summary for operator batch triage actions. | `frontend/pages/api/admin/errors-status-bulk.ts`, `sql/migrations/039_admin_error_status_atomic_update.sql` |
| `/api/admin/errors-test` | `POST` | Admin bearer | Create a synthetic app or generation incident for operator smoke tests of telemetry ingestion/UI. | `frontend/pages/api/admin/errors-test.ts`, `docs/monitoring.md` |
| `/api/admin/access` | `GET` | Bearer (route-level) | Lightweight admin access check for UI gating (`role` or allowlist) without coupling page access to `/api/admin/users` fetch health. | `frontend/pages/api/admin/access.ts`, `frontend/features/admin/logic/useAdminAccess.ts` |
| `/api/admin/agent-safety-policy/active` | `GET` | Admin bearer | Return active AI Studio safety control-plane runtime snapshot (active profile/version, last-known-safe profile/version, cooldown metadata). | `frontend/pages/api/admin/agent-safety-policy/active.ts`, `sql/migrations/047_add_agent_safety_policy_control_plane.sql` |
| `/api/admin/agent-safety-policy/activate` | `POST` | Admin bearer | Activate a requested safety profile (`prod_safe_v1`, `staging_lenient`, `dev_absolute_zero`) with required `singleReviewerAck`; respects cooldown lock windows and writes audit events. | `frontend/pages/api/admin/agent-safety-policy/activate.ts`, `sql/migrations/047_add_agent_safety_policy_control_plane.sql` |
| `/api/admin/agent-safety-policy/rollback` | `POST` | Admin bearer | Roll back to last-known-safe safety profile/version and apply cooldown lock (`STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS`, bounded). | `frontend/pages/api/admin/agent-safety-policy/rollback.ts`, `sql/migrations/047_add_agent_safety_policy_control_plane.sql` |
| `/api/admin/agent-safety-policy/version` | `POST` | Admin bearer | Create a new safety policy document version for a profile (`prod_safe_v1`, `staging_lenient`, `dev_absolute_zero`) with validation and audit attribution. | `frontend/pages/api/admin/agent-safety-policy/version.ts`, `frontend/features/agent-runtime/safetyPolicy/policyDocument.ts` |
| `/api/admin/generation-trace` | `GET` | Admin bearer | Return stitched generation timeline by `generationId`, `requestId`, or trace id across `ai_generations`, canonical `generation_attempts`, canonical `ai_generation_outputs`, `media_events`, `media_files`, reservations, ledger entries, and app error events. Intended for operator debugging and runtime-v2 traceability baselines. | `frontend/pages/api/admin/generation-trace.ts`, `docs/planning/ai-studio-generation-runtime-v2-locked-execution.md` |
| `/api/admin/generation-recovery/replay` | `POST` | Admin bearer | Replay stalled generation recovery by `generationId` or `requestId` (provider-family aware for Fal/Kie) using the shared runtime execution engine (provider probe -> persist -> settle -> transition). | `frontend/pages/api/admin/generation-recovery/replay.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts` |
| `/api/internal/admin-user-health-fleet/run` | `POST` | `x-shortpulse-cron-secret` or `Authorization: Bearer <fleet-secret>` | Run one bounded active-user fleet health scan. Persists run/snapshot/finding records, marks partial runs when time-budget or compatibility limits are hit, prunes retention history, and returns run metrics (`targeted`, `processed`, `failed`, `partial`, `drainage`, `durationMs`, `errors`). Defaults authenticated runs to `scheduled`; operator-triggered replays may set `x-shortpulse-trigger-source: manual` to label the run explicitly. | `frontend/pages/api/internal/admin-user-health-fleet/run.ts`, `frontend/lib/server/adminUserHealth/fleet.ts`, `sql/configure_admin_user_health_fleet_scheduler_supabase.sql` |
| `/api/internal/generation-recovery/run` | `POST` | `x-shortpulse-cron-secret` or `Authorization: Bearer <reconciler-secret>` | Trigger lease-based reconciler claims and execute shared runtime recovery for accepted generations, along with reservation cleanup and inbox observation processing. Response includes recovery stage metrics (`claimed`, `processed`, `recovered`, `requeued`, `exhausted`, `duplicates`, `errors`, `skipped`), reservation cleanup metrics (`reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`), compatibility queue metric fields (`queueClaimed`, `queueSubmitted`, `queueRetried`, `queueRequeuedNoCapacity`, `queueExhausted`, `queueSkipped`, `queueDispatchErrors`, expected to remain zero in the lean standard path), and per-stage control-plane timings under `stageTimings` (`queueDispatch`, `reservationCleanup`, `providerAttachedReservationCleanup`, `observationInboxProcessing`, `requestIdRepair`, `recoveryClaim`, `recoveryExecution`, each with `durationMs`). Intended for external scheduler invocation (Supabase Cron recommended) and guarded manual replay. | `frontend/pages/api/internal/generation-recovery/run.ts`, `frontend/lib/server/api/generationQueue/dispatch.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts`, `docs/sops/sop_provider_incident_response.md`, `sql/configure_generation_recovery_scheduler_supabase.sql` |
| `/api/internal/media-derivatives/run` | `POST`, `GET` | `x-shortpulse-cron-secret` or `Authorization: Bearer <derivative-secret>` | Trigger lease-based media derivative claims for image rows and process local `sharp` thumb generation (`thumb_240`, `thumb_480`) into `media_asset_variants`, then mark rows `ready` or `failed` with bounded retry scheduling. Returns worker metrics (`claimed`, `processed`, `ready`, `failed`, `exhausted`, `variantRowsUpserted`, `errors`). Intended for scheduler invocation and guarded manual replay while derivative rollout is enabled. | `frontend/pages/api/internal/media-derivatives/run.ts`, `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts`, `sql/migrations/065_add_media_derivative_processing_fields.sql`, `sql/migrations/066_add_media_derivative_processing_rpcs.sql`, `sql/configure_media_derivative_scheduler_supabase.sql` |
| `/api/log/client-error` | `POST` | Bearer (proxy + route) | Ingest authenticated client/runtime and generation workflow failures into `app_error_logs` and `app_error_events`. | `frontend/pages/api/log/client-error.ts`, `frontend/lib/server/api/appErrorLogs.ts` |

## Shared runtime contracts
- Credit lifecycle for generation:
  - Submit path: reserve credits (`reserve_generation_credits`).
    - Optional flagged path: atomic admission+reserve (`admit_and_reserve_generation_credits`).
  - Submit admission control (`off|shadow|enforce`) can reject over-limit starts with `429` + `Retry-After` and payload:
    - `code: GENERATION_ADMISSION_LIMIT`
    - `retryAfterSeconds`
    - `admissionScope: per_user | shared_provider`
    - `admissionReason: global_limit | tier_limit | global_and_tier_limit | admission_limited`
    - `limits: { globalMax, globalActive, tier, tierMax, tierActive }`
  - In `enforce` mode, if reservation billing mode is unavailable and submit would fall back to direct debit, submit fails closed with:
    - `503`
    - `code: GENERATION_ADMISSION_UNAVAILABLE`
    - `retryAfterSeconds` + `Retry-After` header.
  - Admission deny path immediately releases reservation (`release_generation_reservation_by_source_ref`).
  - Standard Fal/Kie submit paths no longer enter a ShortPulse pre-provider queue lane.
  - Compatibility queue-status contract (`GET /api/fal/queue-status`) remains available for historical queued rows and returns `queued | dispatched | failed | not_found`.
  - `dispatched` queue-status responses include `provider` and may include optional `modelId` for provider/model-aware client polling route resolution.
  - `GET /api/fal/queue-status` is read-only.
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
- Fal/Kie provider keys: `FAL_KEY`, and `KIE_API_KEY` (or `SHORTPULSE_KIE_API_KEY`) for Kie routes.
- OpenAI: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_VISION_FALLBACK_MODEL`, `OPENAI_API_BASE`, `OPENAI_DESCRIBE_ALLOWED_HOSTS` (trusted-host allowlist for server-side image URL probing on retained image-analysis lanes; external hosts fail closed by default).
- AI Studio safety control-plane runtime flags:
  - `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (`prod_safe_v1` default).
  - `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (`true` default; server pre-provider safety gate for `/api/ai/studio-agent`).
  - `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (`true` default; server pre-provider prompt gate for Fal submit routes).
  - `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (`true` default; local image safety preflight for retained image-analysis routes such as `/api/ai/extract-style`).
  - `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (`prod_closed_nonprod_open` default; optional `always_closed` or `always_open`).
  - `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` (`false` default; non-production-only bypass control).
  - `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (`enforce` default; optional `shadow` or `off`).
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` (`production_normalized` default; optional `development_verbatim`).
  - `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` (`false` default; enables production hard-floor incident policy rollback path).
  - `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` (`24` default; bounded `1..168` for rollback cooldown lock).
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` (`true` default; when `true`, runtime profile selection prefers control-plane active profile and falls back to env/default).
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` (`5000` default; bounded `1000..60000` for runtime active-policy cache TTL).
  - `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (`true` default; client pre-send mirror gate in studio-agent chat path).
- AI Studio sessions API flag:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED` (`false` by default; master opt-in for the AI Studio client session save/restore system. When `false`, the client keeps `sid` for runtime identity but does not save or restore client session snapshots.)
  - `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` (`true` by default; disables `/api/ai/sessions/*` when `false`).
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED` (`true` by default once persistence is enabled; when `false`, remote mirror to `/api/ai/sessions/save` is disabled and local shadow remains active).
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED` (`true` by default once persistence is enabled; when `false`, restore-candidate loading by `sid` is disabled).
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED` (`true` by default once persistence is enabled; when `false`, loaded restore candidates are not hydrated into UI state).
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` (`true` by default once persistence is enabled; when `false`, one-shot restore apply hydrates workspace/output state but skips agent transcript/input hydration).
- Media preview trust policy:
  - `SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS` (server-side comma-separated trusted hosts; extends built-in trusted provider result hosts such as `tempfile.aiquickdraw.com`)
  - `SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS` (`false` by default; when `true`, allowlisted external direct preview hosts are allowed)
  - `NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS` (client-side trusted hosts for optimizer decisions)
  - `NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS` (`false` by default; mirror server value)
- Media upload rollout flags:
  - `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED` (`true` by default; disables `/api/media/upload` when `false`)
  - `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED` (client migration gate for `useMediaUploadController` rollout)
- Media list/runtime rollout flags:
  - `SHORTPULSE_MEDIA_LIST_API_ENABLED` (`true` by default; disables `/api/media/list` when `false`)
  - `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED` (client migration gate for route/modal list API usage)
  - `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED` (`true` by default; set `false` to fallback AI Studio media-library opens to the legacy modal path instead of the left-panel tool)
  - `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED` (`false` by default; enables panel drag ghost + root right-click ingest + root delete behavior)
  - Custom-folder canvas surfaces are always enabled for user-created folders and persist via `/api/ai/media-folder-canvas/[folderId]` + `/api/ai/media-folder-canvas/save`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIRTUALIZATION_ENABLED` (client virtualization gate for route/modal media grids)
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED` (client autoplay budget gate for route/modal media grids)
  - `NEXT_PUBLIC_MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED` (client sign-prefetch gate for route/modal signing passes)
- Media derivative worker flags:
  - `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED` (`false` by default; disables `/api/internal/media-derivatives/run` when `false`)
  - `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET` (primary cron/bearer secret for derivative route auth)
  - `CRON_SECRET` (optional fallback bearer secret)
  - `SHORTPULSE_MEDIA_DERIVATIVES_BATCH_SIZE`
  - `SHORTPULSE_MEDIA_DERIVATIVES_MAX_ATTEMPTS`
  - `SHORTPULSE_MEDIA_DERIVATIVES_LEASE_SECONDS`
  - `SHORTPULSE_MEDIA_DERIVATIVES_RETRY_BASE_SECONDS`
  - `SHORTPULSE_MEDIA_DERIVATIVES_RETRY_MAX_SECONDS`
  - `SHORTPULSE_MEDIA_DERIVATIVES_THUMB_240_QUALITY`
  - `SHORTPULSE_MEDIA_DERIVATIVES_THUMB_480_QUALITY`
- OpenAI runtime mode flags:
  - `SHORTPULSE_OPENAI_RESPONSES_ENABLED`
  - `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Admin allowlist (optional): `SHORTPULSE_ADMIN_EMAILS`.
- Emergency auth fallback (default `false`): `SHORTPULSE_TRUST_PROXY_AUTH_HEADERS`.
- Admin event alert thresholds (optional): `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, `SHORTPULSE_ADMIN_ALERT_GENERATION_15M`, `SHORTPULSE_ADMIN_ALERT_PROVIDER_RUNNING_TIMEOUT_15M`.
- Admin user-health fleet thresholds (optional): `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_CRITICAL_RISK`, `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_WARNING_COST_WITHOUT_SUCCESS_CENTS`.
- Admin user-health fleet runtime flags:
  - `SHORTPULSE_USER_HEALTH_FLEET_ENABLED` (`false` by default; disables `/api/internal/admin-user-health-fleet/run` when `false`)
  - `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET` (primary cron/bearer secret for fleet run route auth)
  - `CRON_SECRET` (optional fallback bearer secret)
  - `SHORTPULSE_USER_HEALTH_FLEET_LOOKBACK_DAYS`
  - `SHORTPULSE_USER_HEALTH_FLEET_ACTIVE_WINDOW_DAYS`
  - `SHORTPULSE_USER_HEALTH_FLEET_RETENTION_DAYS`
  - `SHORTPULSE_USER_HEALTH_FLEET_MAX_USERS_PER_RUN`
  - `SHORTPULSE_USER_HEALTH_FLEET_PAGE_SIZE`
  - `SHORTPULSE_USER_HEALTH_FLEET_TIME_BUDGET_MS`
  - `SHORTPULSE_USER_HEALTH_FLEET_INCIDENTS_ENABLED`
  - `SHORTPULSE_USER_HEALTH_FLEET_DRAINAGE_ENABLED` (default `false`)
  - `SHORTPULSE_USER_HEALTH_FLEET_DRAINAGE_MIN_AGE_SECONDS`
  - `SHORTPULSE_USER_HEALTH_FLEET_DRAINAGE_BATCH_SIZE`
  - `SHORTPULSE_USER_HEALTH_FLEET_DRAINAGE_PROVIDER_ATTACHED_ENABLED` (default `false`)
  - `SHORTPULSE_USER_HEALTH_FLEET_DRAINAGE_PROVIDER_ATTACHED_MIN_AGE_SECONDS`
  - `SHORTPULSE_USER_HEALTH_FLEET_DRAINAGE_PROVIDER_ATTACHED_ORPHAN_MIN_AGE_SECONDS`
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
  - `SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M`
  - `SHORTPULSE_FAL_ADMISSION_MODE` (`off|shadow|enforce`)
  - `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX`
  - `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED` (defaults to `false`; enables shared-provider admission alongside per-user caps)
  - `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX` (defaults to `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX`)
  - `SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON`
  - `SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS`
  - `SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED`
  - `SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS`
  - `SHORTPULSE_FAL_NO_MEDIA_EXHAUST_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE`

## Maintenance checklist
1. When adding or renaming an API route, update this file and any impacted SOP/API docs.
2. If route auth changes, update `frontend/proxy.ts`, this file, and `docs/security-checklist.md` together.
3. If billing settlement behavior changes, update `docs/sops/sop_billing_credits_operations.md` and `docs/data-dictionary.md`.
4. If operational route ownership/scheduler/runbook mappings change, update `docs/operator-map.md` in the same change.
5. Run `npm -C frontend run docs:check` after doc updates.

## Generation Pipeline Rebuild Runtime Notes
- Background generation recovery control plane is now staged:
  - `frontend/lib/server/generationControlPlane/runCycle.ts` orchestrates stage order and metrics
  - `frontend/lib/server/generationControlPlane/recoveryBatchAcquisition.ts` owns recovery-batch claim semantics
  - `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts` owns claimed-row execution, allowlist deferral, and error requeue
- Fal webhook ingress is now thin-route based:
  - `frontend/pages/api/fal/webhook.ts` handles verification/parsing
  - `frontend/lib/server/falIntegration/falWebhookIngress.ts` handles durable inbox insert, duplicate/ignore outcomes, and handoff to shared recovery execution
