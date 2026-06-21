# Legacy Route And Fallback Decommission Plan

Date: 2026-06-03

Status: implemented through runtime cleanup; DB schema decommission deferred by
stop condition

Owner: worldbuilder

## Purpose

Remove dead legacy routes, alias pages, retired rollout flags, and stale active
documentation from the ShortPulse runtime surface while preserving fallback
systems that still serve a current product, reliability, safety, or operations
purpose.

This plan is intentionally split between dead-surface deletion and higher-risk
follow-up decisions. A route or flag sounding legacy is not enough reason to
delete it. The removal decision must be backed by current runtime evidence.

## Scope

In scope:

- Retired `/api/ai/sessions/*` runtime routes.
- Dead `/api/upload-image` compatibility adapter.
- Dead alias pages `/landing` and `/creator-studio`.
- Dead active-doc or env drift for retired session flags.
- Dead active-doc or env drift for `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED`.
- Active fallback systems identified by the audit, but only for
  keep/replace/remove classification.

Out of scope for the first implementation pass:

- Broad product redesign.
- Removing live fallback systems without a replacement decision.
- Dropping database tables or RPCs without a separate schema decision.
- Scrubbing historical planning, evidence, or change-log files unless they are
  being presented as active runtime instructions.
- Changing Mini Ecosystem scope.

## Source Of Truth Order

Use this order when evidence conflicts:

1. Current runtime code and real callers.
2. Auth and route classification registries.
3. Tests that describe current behavior.
4. Active operator docs, route docs, and env examples.
5. SQL checks and schema governance docs.
6. Historical planning and evidence docs.

Historical planning docs are context, not current authority, unless a current
active doc explicitly reactivates them.

## Detailed Stop Condition

The decommission lane is complete only when all of the following are true.

### Global Completion Conditions

- Every candidate in the issue ledger has a final status:
  - `removed`
  - `kept-active`
  - `replace-then-remove`
  - `deferred-db-decision`
  - `deferred-needs-production-evidence`
- Every `removed` candidate has no remaining runtime caller, route file, page
  file, auth registry entry, active env example entry, active route/API doc
  entry, or current-behavior test asserting that surface.
- Every `kept-active` candidate has a documented current caller or operational
  authority path.
- Every `replace-then-remove` candidate has a named canonical successor and a
  separate implementation plan before deletion starts.
- Every `deferred-db-decision` candidate is explicitly isolated from runtime
  cleanup and has a follow-up DB/schema decision recorded.
- Every active doc touched by this lane matches the final runtime truth.
- Targeted tests and docs checks required by the touched surfaces have been run
  or a clear reason is recorded for any skipped check.

### Search-Based Proof Conditions

Before closing the lane, rerun exact searches for all removed paths and flags.
The final search output must show only accepted categories:

- no result
- historical planning or change-log result
- retained record explicitly marked historical

The final search output must not show:

- active runtime imports or fetch calls
- `frontend/pages` route files for removed routes
- route protection entries for removed pages or APIs
- active `README`, `docs/routes.md`, `docs/api/api-internal-routes.md`,
  `docs/deployment.md`, `docs/local-development.md`, or `frontend/.env.example`
  entries describing a removed surface as live
- tests asserting removed runtime behavior

### Stop Conditions By Candidate

`/landing` is complete when:

- `frontend/pages/landing.tsx` is removed or otherwise no longer creates a live
  alias page.
- No internal runtime navigation points to `/landing`.
- Active docs no longer describe `/landing` as a live route.
- Tests no longer assert `/landing` alias behavior.
- Final exact search for `/landing` has no active runtime or active-doc hits.

`/creator-studio` is complete when:

- `frontend/pages/creator-studio.tsx` is removed or otherwise no longer creates
  a live alias page.
- `frontend/lib/protectedRoutes.ts` no longer treats `/creator-studio` as a
  protected route or AI Studio route family member.
- App-shell tests and AI Studio entry tests no longer assert
  `/creator-studio` behavior.
- Active docs no longer describe `/creator-studio` as a live route.
- Final exact search for `/creator-studio` has no active runtime or active-doc
  hits.

`NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED` is complete when:

- No active runtime reads exist.
- `frontend/.env.example` no longer lists it as a current flag.
- Active docs no longer present it as a client upload-controller gate.
- Historical mentions may remain only in planning, evidence, or change-log
  files.

Retired AI session flags are complete when:

- `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` and
  `NEXT_PUBLIC_AI_STUDIO_SESSION_*` are absent from active runtime docs and
  env examples.
- Active troubleshooting and deployment docs do not instruct operators to set,
  troubleshoot, or rely on those flags.
- Historical planning and change-log references may remain.

`/api/upload-image` is complete when:

- `frontend/pages/api/upload-image.ts` is removed.
- `frontend/lib/server/api/protectedApiPaths.ts` no longer protects that exact
  route.
- Runtime code still uses the canonical
  `/api/media/prepare-reference-image-upload` plus
  `/api/media/stage-reference-image` path for local reference images.
- `upload-image` is removed from legacy adapter telemetry typing unless another
  live runtime path still uses that label.
- Route tests for `/api/upload-image` are removed or rewritten around the
  canonical staged upload path.
- Active docs no longer describe `/api/upload-image` as live compatibility.
- Final exact search for `/api/upload-image` has no active runtime or active-doc
  hits.

`/api/ai/sessions/*` runtime is complete when:

- `frontend/pages/api/ai/sessions/index.ts`,
  `frontend/pages/api/ai/sessions/save.ts`, and
  `frontend/pages/api/ai/sessions/[sid].ts` are removed.
- Route tests that expect `410` retired responses are removed.
- The dead session-specific save/get/list RPC helper logic is removed.
- Any reusable snapshot validation still needed by project workspace state is
  moved or preserved under a name that does not imply retired session authority.
- Active API docs no longer list `/api/ai/sessions/*` as live routes.
- Current docs continue to state the canonical persistence authority:
  project-owned workspace state through project routes.
- Final exact search for `/api/ai/sessions` has no active runtime or active-doc
  hits except historical records.

`ai_studio_sessions` database schema is complete only after a separate decision:

- If `retired-but-retained`, active runtime docs stop presenting it as a live
  product path, but SQL checks may continue to enforce safe dormant posture.
- If `full-decommission`, a migration and SQL audit update are created, tested,
  and documented before table or RPC removal is considered complete.
- Runtime route cleanup must not be blocked on this DB decision unless the
  implementation discovers a current runtime dependency.

Live fallback systems are complete when each has one classification:

- `/api/upload-video`
- `/api/upload-audio`
- `/api/media/copy-from-url`
- `/api/media/resolve-previews`
- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`
- `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED`
- `STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED`
- `OPENAI_VISION_FALLBACK_MODEL`
- safety rollback controls

Each classification must include evidence:

- `kept-active`: current caller or active SOP/incident-response authority.
- `replace-then-remove`: named successor, parity requirement, and proof path.
- `deferred-needs-production-evidence`: repo code is insufficient to decide.

## Hard Pause Conditions

Pause implementation and ask for an explicit decision if any of these occur:

- A supposedly dead route has a current runtime caller.
- A route has no runtime caller but may have intentional external inbound
  traffic and the choice is between hard removal and redirect.
- A cleanup step would require database table or RPC removal.
- A live fallback system lacks a clear successor.
- A test failure suggests the removed path still describes current product
  behavior.
- An existing user change directly conflicts with a planned edit.

## Execution Ledger

| Candidate                                     | Final status         | Evidence                                                                                                                                                                                                                                                                      | Stop gate result                                                                                 |
| --------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/landing`                                    | removed              | Deleted `frontend/pages/landing.tsx` and the alias route test; active route docs now name `/`, `/dashboard`, and `/pricing` only.                                                                                                                                             | no active route, route docs, tests, or runtime references                                        |
| `/creator-studio`                             | removed              | Deleted `frontend/pages/creator-studio.tsx`; `frontend/lib/protectedRoutes.ts` only treats `/ai-studio` as the AI Studio route family.                                                                                                                                        | no active route, route-classification, route docs, or tests                                      |
| `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED`        | removed              | Removed from `frontend/.env.example` and active deployment/API docs.                                                                                                                                                                                                          | no active docs/env entry presenting it as live                                                   |
| retired AI session flags                      | removed              | Active troubleshooting/deployment/local docs no longer instruct operators to set or troubleshoot `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` or `NEXT_PUBLIC_AI_STUDIO_SESSION_*`.                                                                                            | no active docs/env entries presenting them as live                                               |
| `/api/upload-image`                           | removed              | Deleted route and route test; removed API registry entry and upload-adapter telemetry label; runtime image helper already uses staged reference-image upload routes.                                                                                                          | no active route, auth registry entry, route docs, route tests, or runtime caller                 |
| `/api/ai/sessions/*`                          | removed              | Deleted route family, retired 410 tests, and session RPC helper module; project workspace validation now owns its own payload-size guard.                                                                                                                                     | no active route/test/API-doc listing; project workspace persistence remains canonical            |
| `ai_studio_sessions` schema/RPCs              | deferred-db-decision | Runtime callers are gone; data dictionary/security/migration docs now mark the schema/RPC contract dormant until a separate DB decommission decision.                                                                                                                         | SQL untouched by this lane; follow-up schema decision required                                   |
| `/api/upload-video`                           | removed              | Motion-reference create, stale cleanup, and lease-aware committed-clip retirement now use `/api/media/prepare-motion-reference-video-upload` plus `/api/media/stage-motion-reference-video`; deleted route and route test; removed auth registry entry and active route docs. | no active route, auth registry entry, route docs, route tests, or runtime caller                 |
| `/api/upload-audio`                           | removed              | Current audio-reference caller `frontend/features/ai-studio/utils/audioUpload.ts` uses `/api/media/prepare-upload` -> browser direct storage upload -> `/api/media/finalize-upload`; deleted route, route test, telemetry shim, API docs row, and auth registry entry.        | no active route, auth registry entry, route docs, route tests, telemetry shim, or runtime caller |
| `/api/media/copy-from-url`                    | kept-active          | Current callers in media-library persistence/style ingestion logic; troubleshooting docs identify it as the CORS/security fallback.                                                                                                                                           | retained as server copy fallback                                                                 |
| `/api/media/resolve-previews`                 | kept-active          | Current caller in `frontend/features/media-library/logic/mediaPreviewResolver.ts`; active docs and tests cover preview resolution.                                                                                                                                            | retained as preview delivery route                                                               |
| `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`         | removed              | The `/api/media/upload` compatibility route is retired; active upload lanes use `/api/media/prepare-upload` -> browser direct storage upload -> `/api/media/finalize-upload`.                                                                                                 | no active runtime read, env-example entry, route test, or active route gate                      |
| `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED`     | kept-active          | Read by `frontend/lib/server/api/openAiCompat.ts` and Standard runtime config.                                                                                                                                                                                                | retained as OpenAI compatibility control                                                         |
| `STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED` | kept-active          | Read by `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts`; tests cover disabled fallback.                                                                                                                                                                         | retained as Standard runtime migration control                                                   |
| `OPENAI_VISION_FALLBACK_MODEL`                | kept-active          | Read by `frontend/features/agent-runtime/styleExtractionService.ts`; deployment docs list it as optional fallback model.                                                                                                                                                      | retained as extraction fallback control                                                          |
| safety rollback controls                      | kept-active          | Read by Pulse runtime, incident auto-rollback logic, and admin safety rollback route; active SOP documents incident response use.                                                                                                                                             | retained as incident-response control                                                            |

## Implementation Phases

### Phase 1: Dead Docs And Env Drift

Handle low-risk active-doc and env cleanup first.

Candidates:

- `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED`
- `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`
- `NEXT_PUBLIC_AI_STUDIO_SESSION_*`

Proof:

- Exact searches show no active docs or env examples presenting these as live
  controls.
- Historical references remain only in planning, evidence, or change logs.

### Phase 2: Dead Alias Pages

Candidates:

- `/landing`
- `/creator-studio`

Likely touched areas:

- `frontend/pages/landing.tsx`
- `frontend/pages/creator-studio.tsx`
- `frontend/lib/protectedRoutes.ts`
- app-shell and route-entry tests
- `README.md`
- `docs/routes.md`
- route-protection docs

Proof:

- No active runtime links or route classification references remain.
- Tests match the canonical routes `/` or `/dashboard` and `/ai-studio`.

### Phase 3: Dead Upload Adapter

Candidate:

- `/api/upload-image`

Likely touched areas:

- `frontend/pages/api/upload-image.ts`
- `frontend/lib/server/api/protectedApiPaths.ts`
- retired upload-adapter telemetry shims when no live adapter route remains
- upload-image route tests
- active API and troubleshooting docs

Proof:

- Local reference images still use the staged upload path.
- `/api/upload-audio` is removed only when exact source inspection proves no
  active caller remains and the canonical media upload path owns audio refs.

### Phase 4: Retired AI Session Runtime

Candidates:

- `/api/ai/sessions/save`
- `/api/ai/sessions/:sid`
- `/api/ai/sessions`
- dead session save/get/list helper logic

Likely touched areas:

- `frontend/pages/api/ai/sessions/*`
- `frontend/lib/server/api/aiStudioSessions.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- AI session route/helper tests
- active API/session docs

Proof:

- Project workspace persistence still validates and saves current snapshots.
- Old session routes are gone.
- Old session RPC helper methods are gone or isolated as historical-only code.

### Phase 5: Database Decision Gate

Candidate:

- `ai_studio_sessions` table and RPCs

Decision options:

- `retired-but-retained`: keep dormant SQL contract with safe grants/checks.
- `full-decommission`: write migration and update SQL audits to remove contract.

Proof:

- Decision is recorded before touching SQL schema.
- If full decommission is chosen, migration, rollback posture, SQL checks, and
  docs are updated together.

### Phase 6: Live Fallback Classification

Classify, do not delete by default:

- `/api/upload-video`
- `/api/upload-audio`
- `/api/media/copy-from-url`
- `/api/media/resolve-previews`
- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`
- OpenAI fallback flags
- safety rollback controls

Proof:

- Each retained fallback has a current caller or active operations reference.
- Each future removal has a named successor and proof path.

## Standard Proof Pack

Run the relevant subset before and after each phase:

```bash
rg -n '<route-or-flag>' frontend README.md docs sql --glob '!frontend/.next/**'
rg -n '<route-or-flag>' frontend --glob '!frontend/tests/**' --glob '!frontend/.next/**'
rg -n '<route-or-flag>' frontend/tests frontend/features --glob '!frontend/.next/**'
rg -n '<route-or-flag>' docs README.md frontend/.env.example sql --glob '!docs/archive/**'
```

For changed docs, run:

```bash
npm -C frontend run docs:check
```

For changed frontend route/API code, run the narrow affected tests first, then
broaden only when shared route classification, auth, or persistence helpers are
touched.

## Final Decommission Review

Before closing, answer these questions from fresh searches:

- Are any removed routes still present under `frontend/pages`?
- Are any removed routes still protected by route or API registries?
- Are any active docs presenting removed routes or flags as live?
- Are any tests still asserting removed aliases or retired API behavior?
- Are any live fallback systems incorrectly classified as dead?
- Are any SQL checks still enforcing a contract that the plan claims has been
  fully decommissioned?
- Did any change create a new compatibility path, hidden fallback, duplicate
  implementation, or alias?

The lane stops only when the answer to each question is known and recorded.

## Execution Proof

Validation run on 2026-06-03:

- `npm -C frontend run test -- app.ai-studio-entry app.ai-studio-gates app.route-change telemetry-growth`
  passed with 4 files and 16 tests.
- `npm -C frontend run test -- imageUpload protected-api-paths.parity motion-reference-video-upload-route`
  passed with 5 files and 36 tests.
- `npm -C frontend run test -- auth-guarded-ai-routes projectWorkspaceStatesService projects-create protected-api-paths.parity`
  passed with 4 files and 70 tests.
- `npm -C frontend run docs:check` passed after each cleanup lane that touched
  active docs or doc-link-sensitive historical records.

Final review answers:

- Removed routes are no longer present under `frontend/pages`.
- Removed routes are no longer protected by route or API registries.
- Active docs do not present removed routes or removed flags as live product
  paths.
- Tests no longer assert `/landing`, `/creator-studio`, `/api/upload-image`, or
  retired `/api/ai/sessions/*` behavior.
- Live fallback systems were classified as `kept-active` only when a current
  caller or active operations reference exists.
- SQL checks still mention `ai_studio_sessions` only as a dormant DB contract;
  this plan records that schema decommission is a separate DB decision, not
  completed runtime cleanup.
- No new compatibility path, hidden fallback, duplicate implementation, or alias
  was added in this lane.
