# Troubleshooting

## Provider or webhook outages

For Fal/OpenAI/Stripe incident triage, use `docs/sops/sop_provider_incident_response.md`.

For AI Studio Fal polling, client status timeouts are intentionally higher than server status-route budgets.
If regressions reappear, check `app_error_logs` for `source='client.api_network'` with abort-like messages on `/api/fal/*-status` endpoints.

## Stuck on `Confirm media rights`

Symptoms:

- A protected route such as `/ai-studio` or `/profile` does not continue past the media-rights gate.
- The user sees `Unauthorized`, `Media agreement service is temporarily unavailable.`, or repeated retries with no progress.

Interpretation:

- `Unauthorized` on this surface is usually an auth recovery problem, not a true consent-content problem.
- `Media agreement service is temporarily unavailable.` indicates consent status could not be read or written because the backend verification/persistence surface is degraded.

Checklist:

- If the gate shows an auth-style failure, sign in again and confirm the route no longer re-enters the gate with the same stale session.
- Confirm `sql/migrations/104_add_user_media_compliance_acceptances.sql` is applied in the active environment.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is present for the active runtime.
- Confirm Supabase auth verification is healthy for protected API routes.
- Check `app_error_logs` for `/api/account/media-compliance` failures and distinguish:
  - `401` / auth recovery required
  - `503` / auth verification or media-compliance service unavailable
  - `500` / unexpected route failure

Mitigation:

- For auth recovery failures, re-authenticate and retry the protected route.
- For `503` failures, restore auth verification or consent persistence dependencies first; do not treat this as a user-consent-content issue.
- If migration `104` or service-role env is missing, restore them before expecting the gate to clear.

## AI Studio reference upload returns `413`

Symptoms:

- AI Studio shows `Reference upload failed` and the detail mentions `413`, `file too large`, or `Reference image is too large`.
- Nano Banana 2 / Nano Banana Pro rows fail before provider submit begins.

Checklist:

- AI Studio now auto-resizes local/blob/data reference images before upload when possible.
- The canonical server upload path now also auto-normalizes oversized still images before the final 25 MB image cap is enforced.
- Treat this as a reference-image upload size limit, not a model/reference token error.
- The Reference Grid `Add files` lane and AI Studio Media Library upload lane now use the canonical `POST /api/media/prepare-upload` -> browser direct storage upload -> `POST /api/media/finalize-upload` path.
- AI Studio local/blob/data still-image preflight now uses the staged `POST /api/media/prepare-reference-image-upload` -> browser direct upload -> `POST /api/media/stage-reference-image` contract before provider submit.
- Confirm the reference image is under the 25 MB image upload cap enforced by the canonical upload service.
- Oversized animated images are still not auto-resized server-side; export a smaller animated file or a static frame and try again.
- If the UI only shows `Unable to upload media.`, capture the failing upload response because that usually means the request was rejected before the app could return its normal structured JSON error.

Mitigation:

- Re-upload a smaller reference image and retry the generation.
- If the image is already small but still trips 413, capture the upload response and inspect `app_error_logs` for the active route (`media-upload` for Reference Grid / Media Library intake or `media-stage-reference-image` for staged local reference preflight).

## Kling Motion Control returns `File type not supported`

Symptoms:

- The Video panel is in Motion Control mode and a recorded/local motion clip appears in the Motion slot.
- Generate fails with a `Kling 3.0` banner or failure card that says `File type not supported`.
- A very large uploaded character image may appear related if the character slot did not finish the staged reference-image upload before generation.

Interpretation:

- Kie Kling 3.0 Motion Control accepts provider-facing MP4 or QuickTime/MOV videos only, with a 3-30 second duration window.
- User-selected or browser-recorded MP4, MOV, and WebM clips are ShortPulse intake formats only. Oversized local clips are browser-prestaged into a smaller upload candidate before the signed storage upload, then Motion Control staging normalizes every clip to canonical provider-facing MP4 so provider-hostile MP4 encodings do not reach Kie unchanged.
- Kie Motion Control character images are stricter than normal ShortPulse product images: provider-facing bytes must be JPEG/JPG/PNG, under 10 MB, at least 341 px on both sides, and within a 2:5 to 5:2 aspect ratio. Motion Control character-image upload to Kie now runs the explicit `kie_motion_control_character_image` admission profile before Kie temp upload.

Checklist:

- Confirm `POST /api/media/stage-motion-reference-video` returned a `mimeType` of `video/mp4` or `video/quicktime` and a final path ending in `.mp4` or `.mov`.
- If the browser shows `The object exceeded the maximum allowed size`, confirm the current client bundle includes Motion Control local pre-staging; oversized local source files should not be sent raw to Supabase signed upload.
- Confirm any local Motion Control character-image file completed the reference-image staging path (`POST /api/media/prepare-reference-image-upload` -> browser direct upload -> `POST /api/media/stage-reference-image`) and then Kie temp upload through `/api/kie/upload-url` with `admissionProfile="kie_motion_control_character_image"`, so product-valid WebP/AVIF or over-10 MB stills do not reach Kie unchanged.
- Confirm the recorder modal stopped the capture at 30 seconds or the uploaded clip is already between 3 and 30 seconds.
- Confirm Kie submit preflight rejects any remaining provider-facing `.webm` Motion Control URL before dispatch.

Mitigation:

- Re-record or reselect a clip of 3-30 seconds, then use the modal `Use clip` action or normal Motion slot upload so the normalized MP4 path is used.
- If an old signed URL is already in the Motion slot from before canonical normalization, remove it and re-add the clip through the current Motion Control upload path.

## Admin runtime/API error handoff workflow

Use the `/admin` Errors panel `Copy triage` buttons as the default handoff format.

Checklist:

- Prefer triage packets over manually copying full JSON rows.
- Include fresh events first (match `occurredAt` to current test run to avoid historical duplicates).
- If triage packet fields are insufficient for root cause, then include the raw `metadata` block from Event Detail as a second step.

## Admin incident triage: billing diagnostics + AI Studio runtime failures

Use this for the exact signatures you pasted from the admin `Errors` panel.

### `admin/billing-diagnostics` returns `500` with mode-mismatch customer error

Symptoms:

- `/admin` opens a user's billing diagnostics and request fails with `API 500` on:
  - `/api/admin/billing-diagnostics?userId=<uuid>`
- Incident stack includes `No such customer... a similar object exists in test mode, but a live mode key was used`.

Interpretation:

- This is usually a Stripe key-mode mismatch between stored customer IDs and the active key.
- For `contract_source = 'internal_comp'`, this is usually non-blocking for entitlement checks.
- For Stripe-owned subscriptions, treat this as a reconciliation issue.

Checklist:

- Confirm these DB values for the affected user:
  - `billing_subscription_contracts.contract_source`
  - `billing_subscription_contracts.stripe_subscription_id`
  - `billing_profiles.stripe_customer_id`
- Re-run `/api/admin/billing-diagnostics?userId=...` and check findings:
  - `stripe_customer_mode_mismatch` (warning)
  - `internal_comp_contract` (info) when exempt.
- If the account should be Stripe-paid, use `/api/admin/billing/customer-sync` and then rerun diagnostics in a Stripe-mode-matched environment.
- Validate consistency with `scripts/verify_billing_contracts_against_stripe.ts` when a paid subscription is expected.

### `/api/admin/pricing/state` or `/api/admin/stats/global` returns `500` with RPC permission denied

Symptoms:

- `/admin/pricing` shows `Pricing state is unavailable`.
- `/admin/stats` returns `500` instead of degrading gracefully.
- Event detail or API exception rows mention `permission denied for function ...` for admin stats or model-pricing RPCs.

Interpretation:

- This is usually hosted RPC ACL drift, not a missing-table problem.
- If the underlying tables exist but service-role API routes cannot execute the expected `SECURITY DEFINER` RPCs, operator pages can fail hard even while other SQL reads still work.

Checklist:

- Run `sql/check_runtime_sql_security_audit.sql` in the target environment and require `failing_checks = 0`.
- Compare the affected RPC execute posture against a known-good hosted environment.
- Confirm the expected RPCs still have:
  - `SECURITY DEFINER`
  - owner `postgres`
  - `service_role` execute granted
  - no `public` / `authenticated` / `anon` execute when the function is meant to be service-role-only
- For current admin pricing/stats incidents, inspect at minimum:
  - `get_active_model_pricing_policy()`
  - `apply_model_pricing_policy(jsonb, jsonb, text, text, uuid, text, text)`
  - `rollback_model_pricing_policy(text, uuid, text, text)`
  - `get_admin_global_stats_summary()`
  - `list_admin_model_usage_stats(integer)`
  - `get_admin_global_stats_v1()`
  - `get_admin_growth_stats_v1()`

Mitigation:

- Reapply the minimal hosted execute grants from the canonical migration source for the affected RPC family.
- Re-probe the repaired RPCs directly before assuming the page is fixed.
- After repair, confirm new `api.exception` and paired client `500` rows stop appearing for the affected endpoints.

### `client.route_change` shows `Failed to load script` / route change error

Symptoms:

- Console shows `Route change failed: Failed to load script: /_next/static/...`.
- UI may jump or fail on navigation.

Checklist:

- Confirm the active deployment includes the referenced chunk and the deployment alias is not stale.
- Run `node scripts/verify_deployment_route_parity.mjs --base-url <target-url>` from docs.
- Confirm no active caching policy is pinning an older build for that user.

Mitigation:

- Repoint affected traffic to a known-good deployment and rerun parity checks.
- Hard-refresh the browser after deploy/failover.

### `/api/elevenlabs/voices` shows repeated 503

Symptoms:

- AI Studio shows voice library/network failure around `/api/elevenlabs/voices`.
- Admin/client logs show `503` for this endpoint.

Interpretation:

- In the current API design, provider outages should usually produce a fallback `200` with a `source="fallback"` payload.
- A `503` indicates environment/proxy/deployment instability rather than expected business behavior.

Checklist:

- Confirm proxy/auth and route health in the target environment.
- Check `app_error_logs` for `scope='generation'` + `route_label='elevenlabs-voices'`.
- Validate ElevenLabs key routing and rate/security policy in that environment.
- Reproduce the call once in isolation to separate transient provider failure from app routing regression.

### `telemetry.ai_studio.failure_stack` visible failure cards

Symptoms:

- UI message says `N generation failure card(s) visible in UI.` with repeated attempts in adjacent events.

Interpretation:

- This source is a low-severity visible UI mirror and is suppressed in the browser before `/api/log/client-error`; it should not create `app_error_logs` incidents.
- Could be normal provider/transient failures when the user keeps retrying.
- Prioritize validating paired provider/status/submit telemetry before treating as a core UI bug.

Checklist:

- Link failure cards to timeline events by `requestId` and generation IDs.
- Check `/api/fal/*-status` responses and recent `media_perf` telemetry.
- Correlate with provider-facing errors (credits, prompts, source signing, preflight).
- If failures are user-impacting for all runs, escalate with route labels + request IDs and include a short reproducible sample.
- If this source appears in `app_error_logs`, treat that as telemetry-policy drift; expected actionable incidents should come from sources such as `generation.workflow_failure`, `fal_submit_not_started`, `fal_auth_session_timeout`, `generation_submit_lifecycle_contract`, or `client.ai_studio.media_library_save_failure`.

## `next build` / `next lint` prompts to “configure ESLint”

This happens when the repo has `eslint-config-next` installed but no ESLint config file exists.

Fix: ensure `frontend/eslint.config.mjs` is present and valid (flat ESLint config in this repo).

## `next dev` lock error (`.next/dev/lock`)

Symptoms:

- `Unable to acquire lock .../.next/dev/lock`
- Port conflict messages (`Port 3000 is in use ... using 3001`) followed by lock failure.
- Turbopack reports `Next.js package not found` while another local server is still running.

Checklist:

- Ensure only one dev server is running.
- Do not run `npm run dev` in multiple terminals for the same repo.
- Verify active listener:
  ```bash
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  ```

Mitigation:

- Stop duplicate Next dev processes, then start exactly one:
  ```bash
  cd frontend
  npm run dev
  ```

## Local dev worker cannot find `esbuild`

Symptoms:

- `npm run dev` exits after:
  - `Cannot find package 'esbuild' imported from .../frontend/scripts/run_generation_control_plane_worker.mjs`
- The wrapper logs `generation-worker stopped unexpectedly`, then shuts down Next.

Cause:

- The local generation worker bundles its TypeScript loop with `esbuild`; `frontend` dependencies are missing, stale, or out of sync with `package-lock.json`.

Checklist:

- Confirm the dependency resolves:
  ```bash
  cd frontend
  node -e "console.log(require.resolve('esbuild/package.json'))"
  ```
- If it does not resolve, run the one-time dependency setup:
  ```bash
  cd frontend
  npm install
  ```

## Next image host not configured (`images.pexels.com`)

Symptoms:

- Runtime error:
  - `Invalid src prop (...) hostname "images.pexels.com" is not configured under images in your next.config.js`

Checklist:

- Confirm `frontend/next.config.js` `images.remotePatterns` includes `images.pexels.com`.
- Restart `npm run dev` after any `next.config.js` updates.

Mitigation:

- Add `images.pexels.com` to trusted image hosts in `frontend/next.config.js` and restart dev server.

## Media Library card previews hit `/_next/image` `500` with Supabase signed URLs

Symptoms:

- Browser console shows repeated `GET /_next/image?... 500 (Internal Server Error)` for Supabase signed media URLs.
- Media cards stall/flash while retries continue.

Checklist:

- Confirm media-library card images are rendered from signed URLs directly (not `/_next/image?...` wrappers).
- Confirm transformed signing profile headers are present:
  - `/api/media/sign-batch` -> `x-shortpulse-media-sign-preview-profile`
  - `/api/media/resolve-previews` -> `x-shortpulse-media-resolve-preview-profile`
- Confirm no preview URL or network request resolves through Supabase `/storage/v1/render/image/`.
- Confirm hosted/runtime transform compatibility flags remain disabled:
  - `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED=false`
  - `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED=false`
- If temporary adaptive containment is in effect, confirm:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY=true`

Mitigation:

- Keep media-library preview delivery on Supabase signed URLs (do not re-wrap signed URLs through Next image optimizer).
- Treat any Supabase `/storage/v1/render/image/` preview usage as a regression to remove, not as an adaptive tuning choice.
- Hard-refresh/re-open the media surface to clear stale wrapped preview state from older sessions.

## Internal route returns `404` or `503` during hosted ops checks

Symptoms:

- Internal ops routes unexpectedly return `404` on staging/prod aliases (for example `/api/internal/generation-recovery/run` or `/api/internal/media-derivatives/run`).
- Internal ops routes return `503` after a freeze/unfreeze or env flip because their enabling flag or cron secret is missing.
- Vercel alias may also point to an older deployment that does not include the expected internal route inventory.

Checklist:

- Run deployment route parity gate:
  ```bash
  node scripts/verify_deployment_route_parity.mjs \
    --base-url https://<target-alias-or-url>
  ```
- Inspect resolved deployment details directly:
  ```bash
  vercel inspect https://<target-alias-or-url> --format=json
  ```
- Confirm required routes are present in build output:
  - `/api/internal/admin-user-health-fleet/run`
  - `/api/internal/billing-contract-renewals/run`
  - `/api/internal/generation-recovery/run`
  - `/api/internal/media-derivatives/run`
- Confirm hosted runtime flags and secrets are restored when the route should be available:
  - `SHORTPULSE_FAL_RECONCILER_ENABLED`
  - `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED`
  - `SHORTPULSE_USER_HEALTH_FLEET_ENABLED`
  - `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET` (or `CRON_SECRET`)

Mitigation:

- Do not run drain/recovery/derivative operations against aliases that fail route parity.
- Repoint alias or scheduler URLs to a deployment that passes the parity gate.
- If route parity passes but the route still returns `404` or `503`, restore the intended hosted flags/secrets and retry the probe.
- Re-run parity check and only proceed when it reports `PASS`.

## Media derivative worker backlog grows or image rows stay `pending`

Symptoms:

- New image rows in `media_files` remain `processing_status='pending'` for long periods.
- `thumb_variant_path` remains null for recently ingested image rows.

Checklist:

- Confirm worker route and auth:
  - `POST /api/internal/media-derivatives/run`
  - `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=true`
  - valid `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET` (or `CRON_SECRET`) provided.
- Confirm migrations are applied:
  - `sql/migrations/065_add_media_derivative_processing_fields.sql`
  - `sql/migrations/066_add_media_derivative_processing_rpcs.sql`
- Run derivative backlog diagnostics:
  - `sql/check_media_derivative_processing_backlog.sql`
- Run terminal derivative failure diagnostics:
  - `sql/check_media_derivative_terminal_failures.sql`
- Confirm runtime SQL security audit includes and passes derivative RPC checks:
  - `sql/check_runtime_sql_security_audit.sql`

Mitigation:

- Preferred guarded replay path:
  - `SHORTPULSE_MEDIA_DERIVATIVES_RUN_URL=<full-run-url> SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET=<secret> SUPABASE_DB_URL=<db-url> ./scripts/media_derivative_backlog_replay.sh`
  - Optional protected-deployment auth:
    - `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN=<bypass-token>`
  - The replay helper captures before/after backlog + terminal diagnostics when `SUPABASE_DB_URL` is set, logs per-cycle worker summaries (`triggerSource`, `durationMs`, `claimed`, `ready`, `failed`, `retryScheduled`, `exhausted`, `variantRowsUpserted`, `errors`), writes machine-readable artifacts at `/tmp/media_derivative_backlog_replay/final_summary.json` and `/tmp/media_derivative_backlog_replay/cycle_summaries.jsonl` by default, and exits non-zero if the bounded cycle cap is reached before claims drain.
- Trigger a guarded manual run:
  - `curl -X POST -H \"x-shortpulse-cron-secret: <secret>\" http://localhost:3000/api/internal/media-derivatives/run`
- Inspect response metrics (`triggerSource`, `durationMs`, `claimed`, `ready`, `failed`, `retryScheduled`, `exhausted`, `variantRowsUpserted`, `errors`).
- For exhausted rows, inspect `media_files.processing_last_error` and re-queue deliberately with:
  - `sql/repair_media_derivative_requeue_terminal_row.sql`

## Media panel image card stays blank even though the row is `ready`

Symptoms:

- AI Studio Media panel or character-adjacent media picker shows an image card shell, but the preview area stays blank or falls through to a dark placeholder.
- The affected `media_files` row has `file_type='image'`, `processing_status='ready'`, and a populated `thumb_variant_path`.
- Original object delivery still works, but the signed durable thumb URL returns `404`/`400`.

Checklist:

- Reproduce on production and capture the failing `media_files.id`, filename, and visible surface.
- Confirm the row still points at a thumb variant:
  - `storage_path`
  - `thumb_variant_path`
  - `processing_status`
- Run the production read-only audit:
  ```bash
  cd frontend
  npm run media:audit-stale-image-thumbs -- --media-file-id <media-file-id>
  ```
- For broader drift checks, scope by owner or inspect a bounded recent sample:
  ```bash
  cd frontend
  npm run media:audit-stale-image-thumbs -- --user-id <owner-user-id> --limit 30
  ```
- Treat rows as stale thumb drift when:
  - `thumbOk=false`
  - `originalOk=true`
  - `processingStatus='ready'`
- If the audit comes back clean for the affected rows, shift the investigation to client/runtime state:
  - stale signed URL state
  - failed image element recovery
  - panel/session cache that still points at an older broken preview URL

Mitigation:

- Do not assume SQL-only coverage checks are sufficient; this failure family requires signed delivery verification against the actual storage object.
- Use `--emit-requeue-sql` only to generate a manual operator review snippet. Review ids before any production repair.
- If production audit shows widespread `ready` rows with broken thumb delivery, prefer fixing preview recovery/runtime behavior first, then schedule a bounded operator repair for stale thumb paths.

## Media derivative row is terminal-failed with local-processing errors

Symptoms:

- Backlog query shows `processing_status='failed'`, `processing_attempts >= 5`, `processing_next_retry_at is null`.
- `processing_last_error` starts with one of:
  - `unsupported_input`
  - `decode_failed`
  - `upload_failed`
  - `variant_upsert_failed`

Checklist:

- Confirm queue health first:
  - `sql/check_media_derivative_processing_backlog.sql` should show `pending=0` and `processing=0`.
- Confirm terminal count is bounded:
  - `sql/check_media_derivative_terminal_failures.sql`
- Verify source object exists and is readable.
- For `decode_failed`, verify source bytes are a decodable image.
- For `upload_failed`, verify storage write health and bucket permissions.
- For `variant_upsert_failed`, verify DB relation health and grants.

Mitigation:

- Keep row terminal-failed (no retry churn) when failure is deterministic for that object.
- If business-critical, repair the source object (re-upload/regenerate) and then re-queue the row with:
  - `sql/repair_media_derivative_requeue_terminal_row.sql`
- Monitoring thresholds:
  - Warning: terminal failures > 3 or > 0.5% of image rows.
  - Critical: terminal failures > 20 or > 2% of image rows.

## Style prompt appears weak on some models (especially Nano Banana family edit lanes)

Symptoms:

- Style is selected, but outputs mostly follow reference structure with limited style transfer.
- Different model families show noticeably different style adherence for the same prompt + references.

Checklist:

- Confirm style prompt is actually selected and non-empty in the active Create/Edit workflow.
- Confirm style append path is active:
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`
  - `frontend/features/ai-studio/logic/stylePromptAdapter.ts`
  - expected appended line depends on model family:
    - Nano Banana: `Visual style reference (treatment only): ... Preserve subject identity and base composition.`
    - Seedream: `Visual style reference: ... Emphasize cohesive palette, lighting mood, and surface texture.`
    - Generic/adapter disabled: `Visual style reference: <style prompt>`
- Confirm adapter flag state:
  - `NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED` (enabled unless explicitly `false`).
- Confirm visible prompt differences are not mistaken for submit prompt differences:
  - display prompt intentionally does not include the appended style line.
- Compare behavior across at least one non-Google image model and one Nano Banana family model with identical inputs.
- Ensure prompt/reference constraints are not over-specifying geometry/identity in ways that suppress style transfer.

Mitigation:

- Rewrite style prompts with concrete visual directives (palette, lighting, texture, grade) instead of broad adjectives.
- For edit-heavy/fidelity-heavy runs, add explicit scoping:
  - `Treat style as visual treatment only; preserve identity and composition.`
- If style append is present in payload and behavior is consistently weaker only on one model family, treat as expected model characteristic.
- If style adherence regresses after enabling family adaptation, set `NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED=false` to force legacy phrasing and re-compare outputs.
- If style adherence regresses on a model family that previously performed well under unchanged setup, capture payload/output evidence and open a runtime regression investigation.

## Styles Library shows `AbortError` or style extraction timeout/fallback

Symptoms:

- Styles Library shows timeout/interrupted extraction guidance and still creates a fallback style card.
- Legacy runs previously surfaced raw `AbortError` strings in the red warning line.

Checklist:

- Confirm user-facing message is normalized and does not expose raw browser exception text.
- Confirm extraction telemetry records failure class and timing metadata:
  - `failure_class`, `attempt_count`, `probe_ms`, `openai_ms`, `total_ms`, `model_used`.
- Confirm route diagnostics headers are present on `/api/ai/extract-style` responses when available:
  - `x-shortpulse-style-attempt-count`
  - `x-shortpulse-style-probe-ms`
  - `x-shortpulse-style-openai-ms`
  - `x-shortpulse-style-total-ms`
  - `x-shortpulse-style-model-used`

Mitigation:

- Re-run with the same image and verify failure class:
  - `timeout`: increase timeout budget only if telemetry shows consistent near-cap completions.
  - `network_transient`: inspect browser/network instability and retry behavior.
  - `upstream_http`: inspect extraction-route payload detail and trusted-host validation.
- If failures cluster by one model, compare with an alternate vision model using the same input and prompt contract.

## Reference Grid -> Styles drop shows blocked-source guidance

Known major unresolved incident: see `docs/known-issues.md` (P0 Reference Grid -> Styles drop reliability, deferred March 13, 2026).

Symptoms:

- Styles Library shows: `This image source blocks browser access. Download the image and drop the file directly.`
- Internal Reference Grid image drag fails even when the card appears fresh.

Checklist:

- Confirm drag payload is internal (`text/reference-origin=ai-studio-reference-grid`) and includes `text/reference-output-id`.
- Confirm the same-document internal drag session token is present (`application/x-shortpulse-reference-drag-token` or `text/reference-drag-token`) when Character is expected to trust payload preview/render URLs or payload storage paths.
- Confirm Character intake accepts trusted internal preview/render URLs for session-backed internal drags even when the source card is not yet persisted into Media Library.
- Confirm style intake keeps same-origin `/_next/image` transfer URLs for internal drops (do not unwrap to upstream host before fetch).
- Confirm fallback persistence route is available:
  - `POST /api/media/copy-from-url`
- Confirm fallback lane toggle is enabled unless intentionally isolating happy-path behavior:
  - `NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED=true`
- Confirm trusted-host policy includes required media hosts (Supabase host and configured direct media allowlist as needed).
- Confirm `media_files` drift is remediated (run `sql/check_media_all_media_completeness_drift.sql`; apply `sql/migrations/064_backfill_media_files_from_storage_objects.sql` when needed).

Mitigation:

- Re-open/re-add the reference to refresh stale signed URLs.
- If browser fetch is blocked, rely on server copy fallback (`/api/media/copy-from-url`) instead of direct browser download.
- If trusted-host validation rejects the URL, add the host through the media direct-preview allowlist policy or use a user-uploaded source file.

## Expert Edit `@img` prompt references fail or look incorrect

Symptoms:

- Clicking Generate with prompt tokens (`@img1..@img10`) shows warning/error and submit does not start.
- Prompt token highlight appears misaligned or text appears visually duplicated/dim.
- Dragging a secondary image into the prompt does not insert token text.

Checklist:

- Confirm tokens are in supported range: `@img1` through `@img10`.
- Confirm referenced secondary slots are populated (for example, `@img2` requires slot 2 image present).
- Confirm the expected lane behavior:
  - Standard/Markup with linked `@imgN` tokens send only linked secondary refs.
  - Standard/Markup with no linked secondary token send all populated secondary refs.
  - Inpaint still requires explicit linked-token behavior for secondary references.
- Confirm behavior is in the canonical Expert Edit workflow (legacy Edit fallback has been removed).
- Verify prompt references use the Expert Edit token logic path:
  - `frontend/features/ai-studio/logic/expertEditPromptReferences.ts`
  - `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
  - `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
- Verify prompt mirror and textarea layering/styles in:
  - `frontend/styles/ai-studio-edit-expert.css`

Mitigation:

- Replace unsupported or incomplete tokens (`@img`, `@img11+`) with valid slot tokens.
- Populate missing secondary slots for referenced tokens.
- If token highlighting/caret alignment regresses, re-check prompt mirror invariants:
  - same typography and wrapping rules on textarea + mirror,
  - synced scroll offsets,
  - mirror highlight layer above textarea background,
  - transparent textarea text with visible caret.
- Re-run targeted tests:
  ```bash
  cd frontend
  npm run test -- expertEditPromptReferences.test.ts
  npm run test -- ExpertEditPanelView.test.tsx
  npm run test -- useAiStudioGenerationController.test.ts
  npm run test -- useAiStudioGenerationPromptComposer.test.ts
  ```

## Expert Edit inpaint is temporarily unavailable

Symptoms:

- A stale Expert Edit session or hidden test surface attempts to enter Inpaint mode.
- Generate fails immediately instead of starting a provider task.

Checklist:

- Confirm the current product state has inpaint disabled:
  - `frontend/features/ai-studio/logic/inpaintSubmission.ts`
  - `frontend/features/ai-studio/components/edit/expertEditSubmissionDispatch.ts`
  - `frontend/lib/model-runtime/modelCatalog.ts`
- Confirm no active Fal inpaint wrappers exist under `frontend/pages/api/fal/`.

Mitigation:

- Return to Standard Edit behavior instead of retrying Inpaint.
- If hidden or stale state still targets Inpaint, reset the Edit submit state and verify the temporary-unavailable guard is firing.
- Re-run targeted tests:
  ```bash
  cd frontend
  npx vitest run features/ai-studio/logic/__tests__/modelApiContracts.test.ts
  npx vitest run features/ai-studio/hooks/taskSubmission/__tests__/routing.test.ts
  npm run test -- ExpertEditPanelView.test.tsx
  npm run test -- useAiStudioGenerationController.test.ts
  ```

## Signed Supabase image requests fail with `ERR_QUIC_PROTOCOL_ERROR`

Symptoms:

- Browser console shows:
  - `net::ERR_QUIC_PROTOCOL_ERROR 200 (OK)`
- Media cards may remain blank despite successful sign telemetry.

Checklist:

- Verify sign telemetry is healthy first:
  - `window.__shortpulseMediaPerf?.signStats()` shows low/zero failure ratio.
- Confirm issue is transport/browser-lane (request returns `200` but fails at QUIC).

Mitigation (local debugging):

- Launch Chrome with QUIC disabled:
  ```bash
  open -na "Google Chrome" --args --disable-quic --disable-features=UseDnsHttpsSvcbAlpn
  ```
- Hard refresh and re-test.

## Supabase auth redirects not working

Checklist:

- `frontend/.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- You’re signed in and the session is persisted (see `frontend/lib/supabaseClient.ts`).
- Protected routes redirect to `/auth` when session is missing (see `frontend/lib/authGuard.ts`).

## Media Library operations fail (upload/list/delete)

Checklist:

- The `media_library` bucket is private and policies require user-scoped paths.
- RLS is enabled for `media_files` and policies enforce `user_id = auth.uid()`.
- You ran the bootstrap scripts in `sql/` (including `sql/create_media_library_tables.sql`) or `docs/supabase_full_schema.sql`.

## AI Studio All Media folder is missing expected legacy/private/generated assets

Checklist:

- Confirm listing route is healthy:
  - `POST /api/media/list` should return rows for `folderId=all_items` with `mediaKind=all`.
- Run completeness diagnostics:
  - `sql/check_media_all_media_completeness_drift.sql`
- Verify durable missing classes are expected (`private_images`, `uploads_images`, `uploads_videos`, `generations_images`, `generations_videos`) and transient/character/variant paths are excluded.

Mitigation:

- Apply migration `sql/migrations/064_backfill_media_files_from_storage_objects.sql` in staging first.
- Re-run `sql/check_media_all_media_completeness_drift.sql` and confirm missing counts converge.
- If rollback is required, run `sql/migrations/rollback/064_backfill_media_files_from_storage_objects_rollback.sql` (removes only migration-tagged rows).

## Private tab data looks wrong or empty

Checklist:

- Run `sql/migrations/003_add_private_media_source.sql`.
- Run `sql/migrations/004_add_private_media_integrity_checks.sql`.
- Validate row classification:
  ```sql
  select source, count(*) as rows
  from media_files
  group by source
  order by source;
  ```
- Validate private integrity:
  ```sql
  select id, user_id, source, file_type, storage_path
  from media_files
  where (source = 'private_upload' and (lower(coalesce(file_type, '')) <> 'image' or storage_path not like user_id::text || '/private/images/%'))
     or (storage_path like user_id::text || '/private/images/%' and source <> 'private_upload')
  limit 50;
  ```

## Private tab cards show blank placeholders

Checklist:

- Run `sql/migrations/009_repair_legacy_media_storage_paths.sql`.
- Validate remaining non-user-scoped paths:
  ```sql
  select id, user_id, source, storage_path, created_at
  from media_files
  where source = 'private_upload'
    and coalesce(storage_path, '') <> ''
    and storage_path !~* '^https?://'
    and storage_path not like user_id::text || '/%'
  order by created_at desc
  limit 100;
  ```
- Validate storage object existence for unresolved rows:
  ```sql
  select
    mf.id,
    mf.storage_path,
    (obj.name is not null) as object_exists
  from media_files mf
  left join storage.objects obj
    on obj.bucket_id = 'media_library'
   and obj.name = mf.storage_path
  where mf.source = 'private_upload'
  order by mf.created_at desc
  limit 100;
  ```

## Media storage path scope drift

Symptoms:

- Media preview signing returns unexpected `null` URLs for rows that should be accessible.
- Security audits identify `media_files.storage_path` values outside `<user_id>/...`.
- Canonical run order/remediation loop: `docs/sops/sop_sql_migration_operations.md`.

Checklist:

- Ensure `sql/migrations/016_harden_media_storage_path_scope.sql` has been applied.
- Ensure `sql/migrations/017_harden_media_storage_path_shape.sql` has been applied.
- Run diagnostics by executing `sql/check_media_storage_scope_drift.sql`.
- All `mismatch_count` values should be `0`.

Mitigation:

- Run `sql/migrations/009_repair_legacy_media_storage_paths.sql` (safe to re-run).
- Re-run `sql/check_media_storage_scope_drift.sql`.
- If mismatches remain, inspect unresolved rows directly:
  ```sql
  select id, user_id, source, storage_path, created_at
  from media_files
  where (
      coalesce(storage_path, '') = ''
      or storage_path like '/%'
      or
      storage_path not like user_id::text || '/%'
      or storage_path ~ '(^|/)\.\.(/|$)'
      or position(chr(92) in storage_path) > 0
    )
  order by created_at desc
  limit 200;
  ```
- Record persistent mismatches in `docs/change_log.md` and escalate before release.

## Variant hints or derivative rows are missing

Checklist:

- Run `sql/migrations/005_add_media_processing_and_variants.sql`.
- Run `sql/migrations/006_backfill_media_variant_hints.sql`.
- Validate media processing status:
  ```sql
  select processing_status, count(*) as rows
  from media_files
  group by processing_status
  order by processing_status;
  ```
- Validate variant row coverage:
  ```sql
  select variant_kind, status, count(*) as rows
  from media_asset_variants
  group by variant_kind, status
  order by variant_kind, status;
  ```
- Validate rows still missing variant hints:
  ```sql
  select id, file_type, processing_status, thumb_variant_path, poster_variant_path, preview_variant_path
  from media_files
  where (lower(coalesce(file_type, '')) like 'image%' and thumb_variant_path is null)
     or (lower(coalesce(file_type, '')) like 'video%' and (poster_variant_path is null or preview_variant_path is null))
  limit 50;
  ```

## Media library or reference grid feels slow

Checklist:

- Open DevTools Console and clear existing telemetry:
  ```js
  window.__shortpulseMediaPerf?.clear();
  ```
- Reproduce the flow (open Media Library/Modal, scroll, load more, interact with Reference Grid).
- Inspect percentile timing summaries:
  ```js
  window.__shortpulseMediaPerf?.durationStats();
  ```
- Inspect sign-batch reliability by surface/tab/query mode:
  ```js
  window.__shortpulseMediaPerf?.signStats();
  ```
- Inspect resolver fallback rate by surface:
  ```js
  window.__shortpulseMediaPerf?.resolveStats();
  ```
- Inspect storage-download fallback rate by surface:
  ```js
  window.__shortpulseMediaPerf?.fallbackStats();
  ```
- Inspect render/long-task/memory telemetry for the reference grid:
  ```js
  window.__shortpulseMediaPerf
    ?.snapshot()
    .filter((entry) =>
      [
        "media.grid.render.commit",
        "media.grid.longtask.sample",
        "media.grid.memory.sample",
        "media.grid.archive.transition",
      ].includes(entry.event),
    );
  ```
- If `failed_ratio` is elevated or `p95_duration_ms` is high, verify:
  - `/api/media/list` returns `200` for authenticated users,
  - `/api/media/sign-batch` returns `200` with a `urls` map for authenticated users,
  - `/api/media/resolve-previews` call rate and `failed_ratio` are not elevated for the active surface,
  - storage-download fallback rate is not elevated for the active surface,
  - signed URL requests are only for visible/buffered cards,
  - variant paths (`thumb_variant_path`, `poster_variant_path`, `preview_variant_path`) are populated,
  - device/network constraints are applying reduced sign/autoplay budgets.
- If AI Studio `All Media` is specifically slow for `generations_images`, run:
  - `sql/check_media_preview_variant_coverage_and_size.sql`
  - review `ai_studio` + `image` rows for:
    - low thumb/preview variant coverage
    - large `p50_bytes` / `p90_bytes`
  - verify the active panel/grid surfaces still resolve preview URLs as signed originals or durable variants and do not emit Supabase `/storage/v1/render/image/`
- Inspect open-to-first-media attribution events:
  - `media.modal.open_to_first_media`
- If media-library panel grids stutter at higher counts, verify the canonical Media Library runtime is intact:
  - Media Library panel surfaces are using the default virtualization, video-budget, and sign-prefetch behavior.
- If Reference Grid interactions degrade in long sessions, verify:
  - no Reference Grid preview path emits Supabase `/storage/v1/render/image/`
  - adaptive preview flags are only active when the runtime remains policy-compliant and transform-free:
    - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW`
    - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY`
  - use temporary containment when transform-capable adaptive behavior must be suppressed:
    - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY=true`
  - optional heavy-load long-edge compaction is only enabled when intentionally set (`NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION=true`),
  - visible/buffered card work remains bounded by virtualization and preview budgets rather than by limiting the number of Reference Grid cards.
- Run the automated gate harness when regressions are suspected:
  - on `/ai-studio` DevTools Console, run:
    `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
    `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
- If toolbar/panel/drop interactions lag once references accumulate, verify:
  - shell decoupling is enabled (`NEXT_PUBLIC_AI_STUDIO_SHELL_DECOUPLE` not set to `false`),
  - DnD backpressure is enabled (`NEXT_PUBLIC_AI_STUDIO_DND_BACKPRESSURE` not set to `false`),
  - panel memoization is enabled (`NEXT_PUBLIC_AI_STUDIO_PANEL_MEMOIZATION` not set to `false`),
  - high-density shell mode is enabled (`NEXT_PUBLIC_AI_STUDIO_HIGH_DENSITY_SHELL_MODE` not set to `false`).

## Media Library panel flashes "Loading media library…" while scrolling

Symptoms:

- While loading the next page or stale-refreshing, cards disappear and the panel briefly shows a blocking loading message.

Checklist:

- Confirm panel stale-refresh path is non-blocking:
  - `frontend/features/ai-studio/components/MediaLibraryPanel.tsx` should preserve rows during refreshes.
  - blocking copy should be gated by `showBlockingLoading` with zero active media rows.
- Confirm shared panel runtime behavior is active:
  - `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts` should keep existing rows visible while refreshing.
- Run focused tests:
  - `npm -C frontend run test -- MediaLibraryPanel useMediaLibraryPanelDataController`

## Character Manager alias drift (historical compatibility window)

Symptoms:

- Character Sheet slots appear assigned in one surface but missing in another.
- Character rows load with stale active sheet pointers after mixed-version deployments.

Checklist:

- Ensure `sql/migrations/012_add_character_sheet_aliases_and_compat.sql` has been applied.
- Run diagnostics by executing the SQL in `sql/check_character_sheet_alias_drift.sql`.
- All `mismatch_count` values should be `0`.

Mitigation:

- Re-run migration `012_add_character_sheet_aliases_and_compat.sql` (safe to re-run).
- Re-check drift report; if mismatches remain, inspect trigger health:
  - `trg_characters_sync_character_sheet_aliases`
  - `trg_character_reference_images_sync_character_sheet_aliases`
  - `trg_character_generation_jobs_sync_character_sheet_aliases`
- Record persistent mismatches in `docs/change_log.md` and escalate before applying `122_retire_character_sheet_alias_compat.sql`.

Post-retirement note:

- After migration `122_retire_character_sheet_alias_compat.sql`, this becomes a historical/readiness runbook rather than an active runtime compatibility path.

## Prompt or AI Generation saves fail

Checklist:

- `media_prompts`, `ai_generations`, and `media_events` tables exist.
- RLS is enabled and policies enforce `user_id = auth.uid()` on those tables.
- The client is using the anon key only (no service-role key in the browser).

## AI Studio autosave ON/OFF behavior looks wrong

Checklist:

- Ensure migration `sql/migrations/043_add_user_preferences_media_autosave_enabled.sql` is applied.
- Verify current user preference:
  ```sql
  select user_id, media_autosave_enabled, updated_at
  from user_preferences
  where user_id = auth.uid();
  ```

## AI Studio unsaved local references are missing after refresh/switch

Checklist:

- Unsaved local references (blob/data previews) now auto-upload to private user-scoped storage for session durability.
- This durability flow does **not** create `media_files` rows and does not auto-add items to Media Library tabs.
- If a local reference is still missing after refresh:
  - inspect client breadcrumbs for `ai_studio_session_reference_durability_upload_failed`,
  - verify `POST /api/media/prepare-reference-image-upload` -> browser direct upload -> `POST /api/media/stage-reference-image`, or `POST /api/media/prepare-motion-reference-video-upload` -> browser direct upload -> `POST /api/media/stage-motion-reference-video` returned `200`,
  - confirm the local preview URL was still present (not removed/replaced) before upload completed.

## AI Studio legacy `sid` session persistence is retired

Checklist:

- `sid` remains runtime identity only and does not restore or save durable workspace state.
- The legacy `/api/ai/sessions/*` route family is removed from the shipped runtime.
- If resumable workspace restore is needed, validate the project workspace path instead:
  - `GET|PUT /api/projects/:projectId/workspace`
  - `docs/sops/sop_ai_studio_projects_foundation.md`
- Historical background for the retired system remains in:
  - `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
  - `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`

## AI Studio canvas item cap reached

Symptoms:

- New drops or draft text commits stop adding items once the scene is dense.
- UI warning appears about the canvas item cap.

Checklist:

- Current hard cap is `300` scene items per session snapshot.
- Verify existing scene item count in the canvas state before further inserts.
- Remove or consolidate items, then retry the insert.

## AI Studio session autosave skipped due oversized snapshot

Symptoms:

- UI warning indicates session autosave was skipped due snapshot size.
- Local canvas/workspace state still appears live, but remote durability may lag.

Checklist:

- Reduce payload pressure:
  - remove unused canvas items,
  - avoid non-essential large text blocks in canvas/agent/workspace fields.
- Confirm warning includes current size vs max limit.
- Retry after reducing state size and verify the active persistence surface succeeds:
  - project routes: `PUT /api/projects/:projectId/workspace`
  - non-project routes: no resumable persistence; `sid` is runtime identity only

## AI Studio project autosave keeps retrying with `Internal Server Error`

Symptoms:

- The AI Studio banner says `Project autosave is retrying in the background`.
- Browser/network logs show repeated `PUT /api/projects/:projectId/workspace` failures.
- Some failures surface as a generic `Internal Server Error` message instead of a more specific route error.

Checklist:

- In `/admin/error-events`, filter by endpoint `/api/projects/:projectId/workspace` and line up the failing `request_id` with the same browser session.
- Distinguish the failure family:
  - `client.api_network`: browser/network transport failed before a JSON response was returned.
  - `client.api_response` with `500`: route returned a structured save failure.
  - `api.exception` with route label `projects-workspace-save`: server-side project workspace write failed after route entry.
- For server-side failures, inspect the exception message:
  - `Failed to save project workspace during auth resolution: ...`
  - `Failed to save project workspace during project lookup: ...`
  - `Project workspace save failed during owned id resolution: ...`
  - `Project workspace save failed during workspace upsert: ...`
- Treat `telemetry.ai_studio.project_workspace.repair_pending` as a separate degraded-save lane. That event means the durable workspace write already succeeded and should not be the cause of the retry banner.

Mitigation:

- If failures cluster under `auth resolution`, inspect the authenticated API session/bootstrap path before the workspace handler can proceed.
- If failures cluster under `project lookup`, inspect the `projects` lookup path and its environment/dependency health.
- If failures cluster under `owned id resolution`, inspect the backing Supabase reads for `media_files`, `media_prompts`, and `ai_generations`.
- If failures cluster under `workspace upsert`, inspect the `project_workspace_states` write path and its environment/dependency health.
- If the banner pauses after repeated retries, change the workspace state and confirm a fresh save attempt is issued for the new snapshot instead of waiting on the stale failed payload.

## AI Studio safety behavior differs from expected mode

Checklist:

- Verify runtime safety profile mode:
  - `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (default `prod_safe_v1`).
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED=true` means runtime prefers control-plane active profile; set `false` for env-only fallback.
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` controls active-profile cache refresh cadence (bounded `1000..60000`, default `5000`).
- Verify development-only override:
  - `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` should remain `false` outside controlled development tests.
- Verify provider-error normalization mode:
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE=production_normalized` keeps user-lane errors normalized.
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE=development_verbatim` allows detailed hard-error payloads for debugging.
- Verify auto-rollback gate behavior:
  - `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED=true` enables policy-only rollback when production hard-floor incidents are detected.
  - `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` controls cooldown lock duration (bounded `1..168`, default `24`).
- If refusal rates suddenly change after profile/env updates, roll back to:
  - `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE=prod_safe_v1`
  - `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED=false`
  - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE=production_normalized`

## Admin credit adjustments fail with missing ledger columns

Symptoms:

- Errors like `Could not find the 'created_by' column of 'ai_credit_ledger' in the schema cache`.
- Errors like `column "source" of relation "ai_credit_ledger" does not exist`.

Fix:

- Run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` in the Supabase SQL editor.
- Refresh Supabase table metadata (or reload the dashboard) and retry `/admin` credit adjustments.

## Admin Event Stream fails with `app_error_events` missing in schema cache

Symptoms:

- `/admin` Errors tab Event Stream shows messages like `Could not find the table 'public.app_error_events' in the schema cache`.
- `/api/admin/error-events` returns empty degraded health state or errors in legacy environments.

Fix:

- Run `sql/migrations/015_add_app_error_events.sql` in the Supabase SQL editor.
- Confirm relation availability:
  ```sql
  select to_regclass('public.app_error_logs') as app_error_logs_table,
         to_regclass('public.app_error_events') as app_error_events_table;
  ```
- Refresh Supabase schema cache/dashboard metadata and retry `/admin`.

## AI Studio generation fails with `Unable to process generation credits. Please retry.`

Symptoms:

- Fal submit routes fail before provider submit with the generic billing error above.
- Server logs may include SQL `42702` with `column reference "source_ref" is ambiguous`.

Cause:

- Environment is running an older `reserve_generation_credits`/reservation RPC definition (pre-fix for ambiguous output-column names).

Fix:

- Run `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`.
- Then run `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Refresh Supabase schema cache and retry generation.

Notes:

- The API now falls back to legacy direct-debit billing when reservation RPCs are stale/missing so generation can proceed.
- Applying `013` + `014` is still the durable fix to restore full reservation/capture/release behavior.

## AI Studio generation fails with `Preparation timed out before generation started. Please retry.`

Symptoms:

- Output placeholder flips to failed before provider submit starts.
- UI error banner shows `Preparation timed out before generation started. Please retry.`

Cause:

- Pre-submit media preparation exceeded the dynamic deadline budget before provider handoff.
- Common stages: local reference fetch, staged reference-image upload/finalize, or signed URL refresh.

Checklist:

- Inspect `app_error_logs` for `source='generation_preflight_timeout'` and review metadata:
  - `preflight_work_units`
  - `preflight_timeout_ms`
  - `model_id`
  - `tool`
- Inspect client breadcrumbs for `generation_preflight_prepare_stage` and identify the failing stage:
  - `fetch_local_image`
  - `upload_image_route`
  - `refresh_signed_url`
- If `upload_image_route` is timing out, verify auth/session health plus `/api/media/prepare-reference-image-upload` and `/api/media/stage-reference-image` latency.
- If `refresh_signed_url` is failing, reselect references to mint fresh signed URLs.

Mitigation:

- Retry with fewer local blob/data references in one submit.
- Re-add stale references and rerun.
- If repeated on healthy network/session, capture the stage breadcrumb packet and escalate to generation runtime incident triage.

## Fal validation fails with `file_download_error` / `Failed to download the file`

Symptoms:

- Provider response includes validation detail on `image_urls` or motion video URL download failure.
- Local logs can include follow-on parser failures like `Fal Seedream result returned non-JSON response` with `405 Method Not Allowed`.

Cause:

- Most often, a Supabase signed reference URL expired between selection time and provider fetch time.
- It can also happen when the signed URL points to a moved/deleted object or a non-user-scoped legacy path.

Current behavior:

- AI Studio now applies a pre-submit signed URL freshness gate for image references and video reference URLs (including motion-control and Kling element video references).
- URLs nearing expiry are force-refreshed before submit; if refresh fails, submission stops early with a user-facing reselect message.

Checklist:

- Re-select failed image/video references and retry generation.
- Verify storage paths are user-scoped and valid (primary + variant paths) via `sql/check_media_storage_scope_drift.sql`.
- Confirm the target object still exists in `storage.objects` under `media_library`.
- If failures persist, capture request IDs plus provider `detail[]` payload and escalate via provider incident SOP.

## SQL role update fails with `column "app_metadata" does not exist`

Symptom:

- Query against `auth.users.app_metadata` fails with `ERROR: 42703`.

Cause:

- Supabase stores auth metadata in `raw_app_meta_data` and `raw_user_meta_data` columns.

Fix:

- Update `raw_app_meta_data` instead of `app_metadata` for admin roles.
- `raw_user_meta_data` is user-editable and is not used for admin authorization.
- Sign out and sign back in so fresh JWT claims include the new role before checking `/admin`.

## Billing migration fails with `ENABLE ROW SECURITY ... not supported for views`

Symptom:

- `ERROR: 42809: ALTER action ENABLE ROW SECURITY cannot be performed on relation "ai_credit_balance"`.

Cause:

- In some legacy deployments, `ai_credit_balance` is a view, not a table.

Fix:

- Re-run the latest `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` from this repo. The current script detects view vs table and skips incompatible RLS/trigger steps automatically.
- Validate relation type:
  ```sql
  select relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'ai_credit_balance';
  ```

## Signup fails with `Database error saving new user`

Symptom:

- Supabase Auth returns `Database error saving new user` during sign up.

Checklist:

- Run the latest `sql/migrate_new_user_plan_default_to_free.sql` to replace `handle_new_user_billing_setup()` with the hardened, fail-open version.
- Ensure billing bootstrap tables exist (`billing_profiles`, `billing_plans`, `ai_credit_ledger`).
- Ensure `app_error_logs` and `app_error_events` tables exist to capture trigger failures in the Admin Errors page.

Diagnostics:

```sql
select id, source, message, last_seen_at, occurrences_count, metadata
from app_error_logs
where source = 'db.trigger.handle_new_user_billing_setup'
order by last_seen_at desc
limit 20;
```

## AI Studio auto-save fails (CORS or fetch errors)

Checklist:

- The provider URL allows browser fetches (some providers block cross-origin downloads).
- If blocked, consider a Supabase Edge Function proxy (requires an ADR) or store metadata only.

## “It works in dev but not in build”

Checklist:

- Run `npm -C frontend run build` and fix type errors first.
- Watch for accidental Node-only usage in the client (e.g., `fs`, server-only env vars).
