# AI Studio Browser OOM And Crash Observability Buildout Plan

Status: Final local transport, classifier, input-boundary, and harness repairs complete; hosted definition readback, convergence apply, deploy, and production mutation remain separately gated.

## Objective

Prevent cumulative AI Studio video/media lifecycle pressure from exhausting the
browser renderer, and make credible visible-tab browser failures reach
`/admin/crashes` Needs Review within approximately 105 seconds when Chrome's
native crash report is delayed or absent. Preserve existing Reference Grid,
Quick Slot Inventory, Canvas, detail, project restore, and review behavior.

## Source Of Truth

This document is the checkpoint source for the implementation. Supporting
authority, in precedence order:

1. `docs/planning/execution-authority.md` and the confirmed July 10 production incident.
2. `docs/agents/holomony/reference-grid-ownership-map.md` and
   `docs/agents/holomony/media-display-authority-plan.md` for media ownership.
3. `frontend/lib/browserSessionHealth.ts` and
   `frontend/lib/server/api/browserCrashSessions.ts` for capture/classification.
4. `docs/agents/badearsai/sop-crash-log-triage.md` for queue semantics.
5. `docs/monitoring.md`, `docs/data-dictionary.md`, and
   `docs/api/api-internal-routes.md` for the published runtime contract.

If live code or a current repo instruction contradicts this plan, stop and
update this plan before continuing. Do not resolve a contradiction with a
fallback or parallel authority.

## Owner / Lane

- Holomony owns Reference Grid and Quick Slot media lifecycle, source
  attachment, preview authority, and media-pressure instrumentation.
- Shared browser-session observability owns capture, classification, monotonic
  crash-session state, and canonical list/query behavior.
- Gottspan owns only the minimal `/admin/crashes` evidence presentation.
- Badearsai consumes the canonical crash-session list and owns triage semantics;
  it does not maintain a copied classifier.
- Copperknot owns later readiness acceptance. Gear Ball/Nuclo own later
  commit/push/deploy and hosted environment operations.

## Confirmed Problem Statement

- The affected production project held 81 outputs including 23 videos. The
  affected renderer reported approximately 646 MiB used JS heap, the largest
  of the audited July 7-10 AI Studio cohort.
- Reference Grid video nodes are detached on output removal and controller
  teardown, but ref-null and same-key node replacement do not use that release
  path.
- Quick Slot and All References may attach the same selected video on two
  physical surfaces, and card playback can prefer full media over an available
  compact preview.
- Browser crash capture stores one global previous-session marker and prunes
  stale peer records before a healthy tab can report them.
- Pressure events remain stored as `active`, while Needs Review only includes
  persisted probable/confirmed sessions. Existing pressure-level and
  used-to-allocated ratio signals are too noisy to promote alone.
- Routine event upserts are not a monotonic state machine and can erase stronger
  evidence or fail to reopen review after first escalation.

Project persistence, autosave, generation, and server errors were healthy in
the affected session and are not implementation targets unless new evidence
changes the owner boundary.

## Approved Scope

### Package A: Media/OOM prevention

1. Centralize physical video release in
   `useReferenceGridVideoLifecycleController.ts` and invoke it for ref-null,
   node replacement, output removal, and controller teardown.
2. Keep video keys surface-specific and compute lifecycle validity from the
   union of All References, Quick Slot, curated-only, and active output ids.
3. Extend the existing surface-ownership seam so a duplicated selected video
   has one physical source owner while preserving selection and navigation.
4. Make compact preview media the card-hover source when it exists; retain full
   media for detail, download, edit, and explicit full-playback consumers.
5. Add low-cardinality counts to existing telemetry for tracked video nodes,
   attached sources, visible/autoplay keys, surface ownership, Canvas sources,
   duration-probe work, and explicit heap values.
6. Extend the existing performance harness with an 81-item/23-video churn case.
   Measure Canvas/probe activity, but do not add a global coordinator unless
   evidence after the lifecycle fix still implicates them.

### Package B: Crash capture and classification

1. Replace the global previous-session marker with versioned per-tab/session
   localStorage records. Healthy tabs scan peers, using a 65-second visible-tab
   cutoff and a conservative 10-minute hidden-tab cutoff. Report each candidate
   once and inspect same-tab prior state before overwrite.
2. Read the legacy marker for one release only, remove it after migration, and
   document the retirement condition.
3. Normalize heap fields to explicit used bytes, total/allocated bytes, heap
   limit, used-to-total, and used-to-limit semantics. Legacy
   `heap_usage_ratio` is ingest-only during the compatibility window and never
   queue authority.
4. Add migration `220` and rollback with typed high-water evidence plus a
   service-role-only atomic transition/list authority.
5. Start threshold calibration at:
   - extreme: at least 512 MiB used and at least 10% of heap limit once;
   - sustained: at least 384 MiB used and at least 8% of heap limit twice at
     least 30 seconds apart.
     Replay the rules against a privacy-safe recent aggregate before freezing
     them. Pressure level 2 or used-to-total/allocated ratio alone must not
     promote.
6. Enforce monotonic transition rules: confirmed cannot downgrade; abandonment
   cannot overwrite clean/confirmed; routine events cannot erase probable;
   timestamps cannot move backward; first severity escalation reopens review;
   duplicate same-level evidence does not.
7. Make one service-role list RPC return stored/effective status, reason,
   confidence, filtered count, and pagination. Admin and Badearsai must both
   consume it; generic stale sessions remain Possible Exit outside Needs Review.

### Package C: Operator truth and documentation

1. Preserve the Crash Logs layout, tabs, actions, and refresh cadence. Show an
   effective reason and unambiguous evidence such as
   `JS heap 646 MB - 15% of limit`; make the empty state describe the active
   probable/confirmed filter truthfully.
2. Update monitoring, API, data-dictionary, schema snapshot, migration/security
   inventory, media-performance SOP, Badearsai SOP, and active planning indexes.
3. Add `test:browser-crash-observability` and include it in the existing AI
   Studio crash-resilience bundle.

## Non-Goals

- No Admin redesign, mobile work, global right-rail fork, or Canvas UX change.
- No disabled hover/selection/Quick Slot/Canvas/detail behavior or reduced full
  media quality on explicit full-playback surfaces.
- No Supabase image transformations.
- No third-party crash vendor, second incident table, generic Admin Errors
  mirror, copied classifier, or long-term dual localStorage authority.
- No project persistence, generation, billing, auth, media-ingest, provider, or
  storage rewrite without new evidence and owner reconciliation.
- No broad modularization, adjacent cleanup, synthetic queue broadening, or
  pressure-level-2-only promotion.
- No commit, push, hosted SQL apply, deploy, deliberate renderer termination,
  production data mutation, or launch-readiness movement in this lane.

## Implementation Batches

1. Characterization tests and plan activation.
2. Media lifecycle release and validity-union repair.
3. Selected-source ownership, card preview authority, and causal telemetry.
4. Per-tab client registry and explicit evidence normalization.
5. Typed migration/rollback, atomic state transitions, and canonical list RPC.
6. Minimal Admin/Badearsai consumer changes and contract documentation.
7. Integrated local validation and a final diff/security/authority audit.

Each batch must pass its focused tests before the next begins. If a batch
reveals that the plan's source boundary is wrong, stop and amend the plan rather
than continuing by adjacency.

## Proof Requirements

### Media contracts

- Ref-null, replacement, removal, repeated mount/unmount, and teardown release
  the remembered physical node exactly once and leave no timer/observer/visible
  residue.
- Quick-Slot-only items stay valid and duplicate physical nodes release
  independently.
- A duplicated selected video has one attached source owner.
- Cards use a distinct compact preview when present; detail/full consumers keep
  full authority.
- In the mixed-video harness, tracked nodes equal mounted video nodes, attached
  sources remain within the configured ownership budget, and counts return to
  the initial window after 60 seconds idle.
- After warm-up and 20 cycles, final idle heap is no more than the larger of
  50 MiB or 10% above warm-up, and the samples do not show monotonic growth.

### Crash-observability contracts

- Per-tab records cannot clobber one another; a healthy sibling reports a stale
  visible peer once; hidden peers are not reported early; same-tab reload
  inspects the prior document; clean close is never abandoned.
- Pressure level 2 and used-to-total alone do not promote. Extreme/sustained
  rules, visible severe stalls, and hidden timer exclusions are locked by tests.
- Confirmed cannot regress; first escalation reopens review exactly once;
  duplicate native reports are idempotent; timestamps are monotonic.
- Needs Review pagination/count is correct and Badearsai returns the same rows
  and effective reasons as Admin.
- RPC/table evidence remains service-role-only and no private prompts, DOM text,
  signed URLs, tokens, or raw query values are captured.

### Validation commands

- Focused Reference Grid lifecycle, ownership, resolved-media, Canvas/probe,
  browser-session, server API, route, Admin, and helper tests.
- `npm -C frontend run test:browser-crash-observability`
- `npm -C frontend run test:ai-studio-crash-resilience`
- media rendering/adaptive guardrails
- `npm -C frontend run type-check:touched`
- touched-file lint, docs checks, architecture/size gates, and production build
- `sql/check_runtime_sql_security_audit.sql` contract coverage
- repository search proving no Supabase render-image transform was introduced

Local proof establishes code contracts only. It does not prove deployed
browser behavior.

## Stop Condition

Stop when all approved packages are implemented, migration and rollback are
present, focused and integrated local checks pass, documentation matches the
code, and the final audit finds no duplicate authority or out-of-scope drift.

Stop earlier if validation blocks safe progress, evidence moves the root cause
to another owner, a visible behavior/security/launch tradeoff is required, or
the only path is a workaround/fallback/parallel implementation.

After local completion, stop before commit, push, hosted SQL apply, deploy,
production mutation, deliberate renderer termination, or launch/readiness
claims. Those require separate authority. Production proof after an approved
deploy must use `https://www.shortpulse.ai` and verify a controlled visible-tab
failure surfaces once within 105 seconds, late native reporting promotes the
same row, clean/hidden tabs stay out, and media/player/heap counts plateau.

## Local Implementation Checkpoint - 2026-07-10

Completed:

- canonical Reference Grid video-node release for ref-null, replacement,
  output removal, and controller teardown;
- Quick Slot duplicate-source ownership, valid output union, and compact
  card-preview versus full-detail authority;
- causal Grid/Canvas/duration-probe/heap instrumentation and the deterministic
  `runReferenceGridVideoChurnAudit` 81-item/23-video browser harness;
- bounded per-tab/per-session v2 crash registry with acknowledged retry,
  same-tab predecessor retention, visible/hidden grace periods, and one-release
  legacy-marker migration;
- explicit heap semantics, critical metadata priority, typed evidence,
  monotonic SQL transition guard, and service-role-only canonical list RPC;
- Admin and Badearsai convergence on the canonical effective status/reason,
  count, pagination, and unambiguous heap evidence;
- migration `220`, rollback, full-schema mirror, security audit inventory,
  migration docs, monitoring/API/data-dictionary/SOP contracts, and dedicated
  validation commands.

Local proof:

- `test:ai-studio-crash-resilience`: 29 files / 308 tests passed;
- touched TypeScript and focused ESLint passed;
- media size/architecture/transform/docs guardrails passed;
- documentation, migration, archive, catalog, naming, and operator-map checks passed;
- production build passed, including `/ai-studio`, `/admin/crashes`, and all
  crash ingest/Admin API routes.

The final self-audit also locked two edge cases beyond the initial batches:
AI Studio browser-session pressure payloads no longer emit ambiguous
`heap_usage_ratio`, and a currently hidden tab cannot inherit earlier visible
high-memory evidence and enter Needs Review at the 65-second visible cutoff.

Deferred at the plan stop boundary:

- hosted migration `220` apply and SQL readback;
- commit, push, deploy, or readiness movement;
- the real-browser 81/23 churn run and Chrome player/heap plateau proof;
- controlled visible renderer termination, 105-second Crash Logs surfacing,
  late native-report promotion, and background-throttling proof.

## Second-Pass Remediation Checkpoint - 2026-07-10

The adversarial re-audit reopened the prior checkpoint and the implementation
was corrected at the canonical source boundaries:

- clean close is now a durable acknowledged tombstone, survives late local
  events, retries without borrowing the next document's evidence, and remains
  terminal unless a native crash report confirms the same row;
- `record_browser_crash_session_event_v1` is the single service-role mutation
  authority for lifecycle, abandonment, and native crash evidence. It locks per
  browser session, orders staleness by database receipt time, bounds client
  occurrence time to the preceding 24 hours, merges evidence atomically, and
  leaves Admin review-only updates outside ingestion logic;
- migration `220` backfills privacy-safe historical heap/stall/abandonment
  evidence, and Admin/Badearsai both treat typed zero as absent when legacy
  metadata contains real evidence;
- compact preview video remains the card-hover source while the full playable
  URL remains drag/detail/edit authority;
- duplicate Quick Slot / All References videos transfer their one attached
  source owner during All References hover instead of disabling hover;
- bounded Grid, Canvas, and duration-probe counters persist with routine session
  evidence and selected Chrome `CrashReportContext` fields;
- the 81/23 harness exercises hover, seeds Quick Slot through the canonical
  snapshot hydrator when available, and fails rather than passing when heap,
  Canvas, Quick Slot, or idle-return evidence is unavailable;
- raw route query values are redacted before localStorage or API capture.

Fresh local proof after remediation:

- `test:browser-crash-observability`: 9 files / 80 tests passed;
- `test:ai-studio-crash-resilience`: 29 files / 322 tests passed;
- focused card/controller/harness/media telemetry: 4 files / 115 tests passed;
- touched TypeScript, focused ESLint, media rendering guardrails, docs checks,
  migration/schema RPC parity, and the production build passed.

Still outside local authority/proof:

- apply migration `220` and execute the RPC/state-machine behavior against
  hosted PostgreSQL, including concurrency and ACL readback;
- run `sql/check_browser_crash_classifier_calibration.sql` after apply and
  record the privacy-safe aggregate before accepting the 384/512 MiB thresholds;
- deploy and run the real-browser 81/23, controlled renderer termination,
  105-second Crash Logs surfacing, late-native-promotion, clean-close, and
  background-throttling production checks.

## Final Adversarial Re-audit Checkpoint - 2026-07-10

The final widened audit found and closed four remaining ordering/lifecycle
gaps without changing visible UI or product behavior:

- a delayed acknowledged clean-close can now correct an inferred probable
  crash; only a native confirmed crash remains stronger than clean-close;
- duplicate native crash reports preserve the first confirmed `suspected_at`
  and `ended_at` values instead of moving terminal timestamps backward;
- a queued `IntersectionObserver` callback is ignored unless its target is
  still the canonical registered video node for that surface key;
- a reviewed active row reopens when it later crosses the server-derived
  probable threshold, while a review performed after that threshold remains
  authoritative.

Fresh proof after these repairs:

- focused lifecycle and SQL contract tests: 2 files / 12 tests passed;
- `test:browser-crash-observability`: 9 files / 80 tests passed;
- `test:ai-studio-crash-resilience`: 29 files / 322 tests passed;
- touched TypeScript, focused ESLint, docs checks, formatting, migration/schema
  RPC parity, and `git diff --check` passed.

The implementation stop boundary is unchanged: executable PostgreSQL,
concurrency/ACL readback, threshold calibration, real-browser churn, controlled
renderer failure, deploy, and production proof require separate authority.

## Final Closeout Repair Activation - 2026-07-10

A fresh read-only closeout audit reopened local implementation for exactly five
source defects and one operator guard:

1. Persisted BFCache pagehide state is absent from the peer registry, allowing
   a healthy suspended same-tab predecessor to be reported as abandoned.
2. Authenticated `ReportingObserver` crash events use insert-capable ingestion,
   while migration `220` rejects that event/flag combination; update-only alone
   would retain a race with fire-and-forget session start.
3. The ten bounded Grid, Canvas, and duration-probe counters are allowlisted but
   absent from the 48-key critical-priority order and can be evicted by later
   crash evidence.
4. Grid and Canvas teardown can leave stale nonzero causal counters in the
   process-wide crash-evidence snapshot.
5. The 81/23 harness hovers the first video card, which is the DOM-earlier Quick
   Slot copy, rather than exercising All References ownership transfer.
6. The production harness replaces current workspace state, so its SOP must
   require a disposable audit project with no unsaved work.

Protected contracts remain unchanged: no visible UI/UX change, no right-rail or
persistence-authority change, anonymous native reports remain correlation-only
and update-existing-only, all captured evidence remains bounded and private,
and no fallback classifier or transport is added.

Each item requires a focused regression before advancing. Final local proof is
the crash-observability and AI Studio crash-resilience suites, touched type/lint,
docs and migration/schema parity, production build, and final diff audit. Stop
before stage/commit/push, hosted migration apply, deploy, production workspace
mutation, or controlled renderer termination.

## Final Closeout Repair Checkpoint - 2026-07-10

Transport note: the authenticated buffered-report behavior recorded in this
historical checkpoint was superseded by the later Final Transport And
Classifier Repair. The current contract does not accept authenticated client
`crash_report` assertions; only the public correlation-only Reporting API route
may confirm an existing session row.

Completed at the canonical source boundaries:

- peer records now preserve BFCache suspension, clear it on pageshow/terminal
  close, and exclude suspended documents from both same-tab and stale-peer
  abandonment;
- authenticated buffered crash reports may create their own user-scoped
  confirmed row, closing the session-start race, while anonymous native reports
  remain update-existing-only;
- all ten bounded Grid, Canvas, and duration-probe counters are critical through
  both TypeScript sanitization and the SQL 48-key merge cap;
- final Grid and Canvas teardown emits synchronous zero causal evidence;
- the 81/23 harness targets All References, samples during hover, and requires
  exactly one attached duplicate source owned by All References;
- the media-performance SOP requires a disposable audit project with no unsaved
  work and forbids running the state-replacing harness on customer/incident
  projects.

Fresh local proof:

- `test:browser-crash-observability`: 9 files / 85 tests passed;
- `test:ai-studio-crash-resilience`: 29 files / 329 tests passed;
- touched type-check and focused ESLint passed;
- media size, architecture, Supabase transform, and documentation gates passed;
- migration `220` and the full-schema RPC bodies match;
- production build passed with `/ai-studio`, `/admin/crashes`, and both crash
  ingest routes.

Production read-only proof originally returned `404`/`PGRST202` for
`list_browser_crash_sessions_v2`. A later July 10 readback proved that the RPC
is now present and returns five Needs Review rows. The exact hosted function
definitions, owners, grants, and columns still require comparison with the
latest repo source before application deploy. Production browser churn and
controlled renderer termination remain separately approved proof work.

## Final Transport And Classifier Repair Activation - 2026-07-10

The current production queue and Chrome's documented transport contract reopen
the lane for exactly five bounded issues:

1. `Reporting-Endpoints` uses `crash-reporting`, while Chrome requires the
   endpoint name `default` for crash delivery.
2. `ReportingObserver` is not a native crash transport; authenticated clients
   must not self-assert confirmed crashes through the lifecycle route.
3. One recovered visible stall remains permanent standalone high-confidence
   queue authority. Four of the five current rows are stall-only at 6-37 MiB,
   so recovered stalls remain evidence but no longer promote by themselves.
4. The mutation RPC must normalize nullable insertion flags, require bounded
   object metadata on first insert and update, and safely clamp pressure-event
   counts in both TypeScript and SQL.
5. The 81/23 harness needs stable card output identity before ownership transfer
   because the suppressed All References video node does not exist pre-hover.

Production now has a manually available list RPC but no linked migration-ledger
proof. Hosted SQL readback must precede any forward convergence migration or
deploy. This pass may prepare a new forward migration when the source boundary
is provable, but it must stop before hosted apply, deployment, commit/push, row
review mutation, or controlled renderer termination.

Protected contracts remain unchanged: no visible UI/UX or right-rail change,
no persistence or billing change, native reports remain correlation-only and
cannot create anonymous rows, evidence remains bounded/private, and Admin plus
Badearsai retain one list/classification authority.

## Final Transport And Classifier Repair Checkpoint - 2026-07-10

Completed at the canonical local source boundaries:

- Chrome native crash delivery now uses the required `default` Reporting API
  endpoint, and the authenticated lifecycle route no longer accepts a client
  `crash_report` assertion;
- recovered visible stalls remain retained forensic evidence but no longer
  promote a low-memory stale session into Needs Review by themselves;
- the aggregate calibration query now reports stall-only stale, open, reviewed,
  and clean-close outcomes by release/build alongside the heap thresholds;
- nullable insert permission is deny-by-default, metadata is normalized to a
  bounded object before both insert and update, numeric evidence is clamped
  before SQL casts, and pressure counts saturate at `10000`;
- Reference Grid cards expose stable output identity on the card root, allowing
  the 81/23 harness to identify All References before intentional hover-time
  video attachment.

Fresh local proof:

- crash observability: 9 files / 87 tests passed;
- full AI Studio crash resilience: 29 files / 331 tests passed across the
  composed run;
- touched type-check, focused ESLint, docs/migration parity, media architecture,
  size-budget, and Supabase transform gates passed;
- migration `220` and the full-schema record/list RPC bodies match exactly;
- production build passed with `/ai-studio`, `/admin/crashes`,
  `/api/browser-crash-report`, and `/api/log/browser-session` present.

No forward convergence migration was created. The production list RPC is
present, but the linked CLI exposes neither a migration ledger nor exact hosted
function definitions/owners/grants; the plan requires that readback before a
new forward convergence migration or deploy. The next boundary is read-only
hosted SQL definition and ACL proof through an approved PostgreSQL-capable
channel, followed by a separately approved forward apply/deploy if drift is
confirmed. Production row review mutation, controlled renderer termination,
stage/commit/push, and deploy were not performed.

## Final Cleanup Audit Checkpoint - 2026-07-10

A final source-and-proof audit found and closed five additional local gaps
without changing visible UI, product behavior, persistence, or queue semantics:

- the 81/23 harness now proves duplicated card-root ownership before transfer,
  then requires exactly one attached All References video source after hover;
- first-hover intent now survives the inactive/non-autoplay ownership-transfer
  render, so the source owner can attach and begin playback without a second
  hover;
- duration probes are deduplicated, limited to two active and 64 queued jobs,
  and cancelled when their last consumer leaves, including queued work;
- the named crash-observability suite now includes the security-header and both
  Admin crash status/page contracts, and the route docs no longer describe the
  native crash endpoint as authenticated lifecycle ingestion;
- the SQL security audit now proves fixed empty `search_path`, table RLS,
  service-role table privileges, public/anon/authenticated table denial, and
  service-role-only RPC execution. The unused recorder-local extreme-memory
  variable was removed from migration `220` and the full-schema mirror.

Fresh local proof:

- `test:browser-crash-observability`: 12 files / 98 tests passed;
- the focused AI Studio crash-resilience phase: 20 files / 247 tests passed;
- touched TypeScript, scoped ESLint, Prettier, documentation, media rendering
  guardrails, production build, exact migration/full-schema RPC parity, and
  `git diff --check` passed;
- local canonical SQL no longer contains the lane-owned unused variable; the
  linked SQL linter still reports it from the pre-convergence hosted recorder
  body. One separate billing-function unused-variable warning remains outside
  this lane.

Fresh production-safe readback still shows the retired state: the deployed
`Reporting-Endpoints` header names `crash-reporting` instead of `default`, and
the canonical production list returns one confirmed high-memory crash plus four
low-memory rows promoted only by `stale_after_visible_severe_stall`. Do not
manually resolve those four rows; the corrected list authority should remove
them dynamically after hosted convergence.

The implementation boundary is now exact: obtain approved read-only hosted
function definitions, columns, owners, grants, and migration-ledger evidence;
create a forward convergence migration only if that comparison proves it is
needed; then separately approve SQL apply before app deploy. After deployment,
prove the `default` header, queue reclassification, calibration query, 81/23
browser churn, controlled renderer termination, approximately 105-second Admin
surfacing, late native promotion, clean close, and background throttling. No
row review mutation, hosted apply, stage/commit/push, deploy, or controlled
renderer termination occurred in this checkpoint.
