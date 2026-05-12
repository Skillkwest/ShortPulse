# Ophestivus Error Capability Map

Purpose: group handled incident patterns by class, document current agent readiness, and identify the next classes to train toward over time.

## Relationship To Other Artifacts

- `error-ledger.md` is chronological history.
- `error-capability-map.md` is pattern-level interpretation and training direction.
- `training-rubric.md` judges how well a run was handled.
- `baseline-kpi.md` remains the frozen benchmark for mature workflow quality.

## Readiness Vocabulary

- `can-handle`
  - I can usually own this class end to end within the normal SOP, using current helpers and evidence paths.
- `can-handle-with-guardrails`
  - I can often handle it, but only when the evidence is clean and the fix shape stays bounded.
- `human-first`
  - I should escalate this class by default unless I can quickly reduce it to a bounded repo-side issue.

## Complexity Vocabulary

- `low`
  - narrow, repeatable, and easy to validate
- `medium`
  - bounded but requires judgment or targeted regression proof
- `high`
  - likely multi-lane, cross-domain, or externally dependent

## Pattern Map

| Pattern class | What it is | Seen so far | Typical disposition | Complexity | Agent readiness | Common fix shape | Evidence needed | Stop / escalate trigger |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Hidden localhost admin refresh noise | Hidden-tab localhost `/admin/errors` or `/api/admin/error-events` fetch interruptions that should not page operators | 3 | `noise-filtered`, `verified-existing-fix` | `low` | `can-handle` | Add or verify narrow skip/filter rule while preserving visible and production failures | event detail, hidden visibility, localhost/dev env, exact endpoint family | escalate only if visible or production evidence appears |
| Hidden localhost AI Studio identity noise | Hidden localhost `/api/projects/<id>` fetch failures that are non-actionable in hidden-tab/dev conditions | 1 | `noise-filtered` | `low` | `can-handle` | Add narrow skip/filter rule for hidden localhost/dev identity reads | hidden visibility, localhost/dev env, exact project identity endpoint | escalate if route is visible or environment is not local/dev |
| Hidden localhost AI Studio gate fetch noise | Hidden localhost AI Studio compliance or gate-status fetch interruptions that are non-actionable in hidden-tab/dev conditions | 1 | `noise-filtered` | `low` | `can-handle` | Add a strict hidden localhost/dev skip rule for the exact gate endpoint while preserving visible failures | hidden visibility, localhost/dev env, exact gate endpoint, paired visible-case proof | escalate if the same endpoint fails while visible or outside localhost/dev |
| Client/server request-contract validation gaps | UI allows a payload shape or size that a bounded API route rejects immediately as `Invalid request` | 1 | `resolved` | `medium` | `can-handle-with-guardrails` | Align the client-side validation and counters with the route contract, then add a focused UI regression test for the over-limit or malformed request path | route-level contract, raw error detail, client submission path, targeted UI test, clean recurrence | escalate if the route contract is ambiguous, changes per environment, or the request rules depend on provider-side state |
| Visible transient fetch hardening | Visible localhost transient network misses on bounded client API calls | 3 | `resolved` | `medium` | `can-handle-with-guardrails` | Enable one-time retry on an established request client if the operation is safe to retry | visible event detail, request path, existing fetch helper behavior, targeted tests, clean recurrence | escalate if request is not clearly safe/idempotent or failure persists after retry |
| UI runtime reference regressions | UI `ReferenceError` / undefined symbol issues on app or admin routes that can be tied to a concrete render/runtime seam | 5 | `resolved`, `verified-existing-fix`, `noise-filtered` | `medium` | `can-handle-with-guardrails` | Repair the broken scope/prop contract, add targeted regression coverage, or filter pure dev/HMR noise without hiding real runtime bugs | runtime stack, route, code path, targeted UI/runtime test, recurrence check | escalate if the runtime path is not reproducible and current source does not explain it |
| Dev-only Fast Refresh / HMR transients | Localhost development runtime noise caused by HMR/Fast Refresh rather than product behavior | 1 | `noise-filtered` | `low` | `can-handle` | Add or expand dev-only skip logic with strict localhost/dev guards | stack frames showing refresh/HMR context, localhost/dev env, no production evidence | escalate if the same error appears without HMR/refresh frames |
| Optimistic generation lifecycle classification errors | AI Studio generation placeholders are assigned the wrong lifecycle/timeout semantics, so valid direct-request work is marked as failed before the provider result can return | 1 | `resolved` | `medium` | `can-handle-with-guardrails` | Isolate the placeholder classification seam, split timeout semantics by submission mode, and add regression tests for both the stale cleanup and output lifecycle paths | incident metadata, model/provider lane, placeholder creation path, timeout logic, targeted lifecycle tests, clean recurrence | escalate if provider state, billing state, or server-side task orchestration is also implicated |
| Project workspace persistence transport failures | AI Studio autosave/project workspace write transport misses on bounded project snapshot APIs | 1 | `resolved` | `medium` | `can-handle-with-guardrails` | Retry safe PUT/GET transport once using the established fetch helper | route, endpoint, save/read path, retry safety, targeted tests, recurrence proof | escalate if writes are not clearly safe to retry or server-side data consistency is implicated |
| Billing/control-plane/provider consistency failures | Incidents where billing state, provider state, control-plane lifecycle, or settlement status may disagree | provisional | `human-review` | `high` | `human-first` | Usually no immediate code change; package evidence and hand off cleanly | row-level diagnostics, provider ids, billing records, control-plane traces | escalate by default unless root cause is quickly reduced to one bounded lane |
| Worker/control-plane background failures | Generation worker or recovery-path failures with multiple possible failing fetch or state sites | provisional | `human-review` | `high` | `human-first` | Evidence packaging, not speculative retries | worker route label, fetch site isolation, request ids, environment/runtime logs | escalate by default unless one failing site is isolated |
| Provider/upstream runtime failures | `502/503/504`, `Bad Gateway`, or provider-specific errors where external runtime may be the real fault | provisional | `human-review` or guarded `resolved` | `high` | `human-first` | At most narrow retry hardening when the request site is known-safe; otherwise escalate | provider route, exact upstream status, retry safety, deploy/runtime evidence | escalate when provider/runtime state is unclear or deploy verification is required |

## Hidden AI Studio Noise Family

The hidden localhost/dev AI Studio operator-noise class now has multiple endpoint-specific examples. They should be treated as one family with strict endpoint scoping, not as a generic rule that hides all hidden AI Studio fetch failures.

| Endpoint family | Example route | Current handling rule |
| --- | --- | --- |
| Project identity | `/api/projects/<id>` | Skip only when localhost/dev, hidden tab, AI Studio route, and `Failed to fetch` with no status code. |
| Project workspace | `/api/projects/<id>/workspace` | Skip only when localhost/dev, hidden tab, AI Studio route, and `Failed to fetch` with no status code. |
| Compliance / gate status | `/api/account/media-compliance` | Skip only when localhost/dev, hidden tab, AI Studio route, and `Failed to fetch` with no status code. |

Family rule:

- keep each endpoint on an explicit allowlist
- require paired visible-case proof so real failures still surface
- escalate if the same endpoint family starts failing while visible or outside localhost/dev

## Current Read

What I currently handle well:

- hidden localhost/dev telemetry noise classes
- bounded client fetch retry hardening on established request helpers
- bounded client/server request-contract mismatches when the failing route contract is explicit
- UI runtime reference regressions when the failing branch can be covered directly
- optimistic generation lifecycle classification bugs when the failing timeout seam is isolated
- report, board, and recurrence verification flow

What I can handle, but only with guardrails:

- visible transient fetch failures on project or pricing routes
- workspace persistence transport issues when the retry semantics are clearly safe
- verified-existing-fix closeouts where the current source is already correct but proof was missing

What should stay human-first today:

- billing settlement inconsistencies
- provider/runtime/deploy failures without isolated request-site proof
- worker/control-plane failures with multiple plausible failing fetch sites
- preview/staging fixes that need deploy/live verification I cannot perform directly

## Training Priorities

Ordered by value:

1. `Visible transient fetch hardening`
   - already partially solved
   - more repetitions here will strengthen safe retry judgment
2. `Client/server request-contract validation gaps`
   - good medium-complexity lane because the route contract is explicit and the fix stays local
   - worth repeating because it builds discipline around preventing invalid requests instead of only reacting to them
3. `Optimistic generation lifecycle classification errors`
   - good bridge from simple client retries into richer AI Studio state and timeout ownership
   - worth repeating because the blast radius is still bounded but the logic is more stateful
4. `Project workspace persistence transport failures`
   - close to a repeatable playbook
   - good bridge from simple fetch hardening into more stateful lanes
5. `UI runtime reference regressions`
   - useful because they require better evidence + test-path discipline, not just retries
6. `Worker/control-plane background failures`
   - high-value next hard class, but only after better evidence tooling exists
7. `Billing/control-plane/provider consistency failures`
   - important, but poor candidate for aggressive autonomy without stronger diagnostics and explicit approval paths

## Needed Improvements To Expand Capability

To move harder classes from `human-first` toward `can-handle-with-guardrails`, the most useful upgrades are:

- better worker/control-plane incident detail extraction
- cleaner mapping from incident family to safe retry eligibility
- stronger deploy-verification handoff and evidence capture
- explicit escalation rows in `error-ledger.md` once durable local reports exist for those cases

## How To Use This File

- Before deciding whether a new incident is a normal SOP candidate or a Human Review candidate, compare it to the closest class here.
- After each meaningful incident run, update:
  - `Seen so far`
  - readiness judgment if the pattern truly changed
  - training priority if a class became more or less valuable
- When training another agent, start with the `can-handle` classes, then move to `can-handle-with-guardrails`, and keep `human-first` classes supervised until the evidence path improves.
