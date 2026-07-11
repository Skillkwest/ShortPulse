# System Score Criteria

Purpose: define the ship-floor and mature-state criteria for each current system row so the catalog helps ShortPulse ship honestly before it chases idealized scores.

July 7 launch-control note: this file is now a supporting baseline, not the active launch authority. For the `2026-07-07` launch decision, use `docs/agents/copperknot/july-7-launch-authority.md`, `docs/agents/copperknot/july-7-system-map.md`, `docs/agents/copperknot/july-7-launch-board.md`, and `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`.

## How To Use This

- `Ship floor` is the minimum acceptable score for the current production window.
- `10/10` is the ideal mature-state target.
- During launch-week production operations, use this supporting baseline to identify customer-impacting weakness; do not use score movement as a substitute for current production evidence.
- Do not claim `10/10` just because tests passed once. The criteria below imply sustained strength, clarity, and low operational friction.
- Do not move a score based on narrative confidence alone. A rerating should name the evidence that satisfied the relevant gates.

## Required Evidence For Rerating

A system should not move upward unless the rerating packet can point to the relevant mix of:

- contract clarity:
  - system boundary is explicit
  - included and excluded behavior is clear
- code structure:
  - risky seams are reduced, isolated, or made more explicit
- test coverage:
  - targeted regression tests exist for the change-driving behavior
- operator confidence:
  - incidents, diagnostics, or known-issue posture materially improved when relevant
- release readiness:
  - no ship-blocking known issue remains in that system lane

## Score-Movement Protocol

Every rerating decision should explicitly record:

- previous score
- proposed score
- score delta:
  - `+1`
  - `0`
  - `-1`
- exact evidence anchors:
  - report path
  - commit id or declared worktree checkpoint
  - validation commands or suites
  - blocker or incident refs when relevant

Rules:

- do not move upward without exact evidence anchors
- do not move downward on unease alone
- lane completion by itself is not score evidence
- when the evidence only supports stronger operating certainty, prefer `0` with refreshed launch-state fields

## Score Gate Meanings

- `6/10`:
  - usable but still mixed
  - notable weaknesses remain
  - rerating evidence is incomplete or confidence is still limited
- `7/10`:
  - meets the current ship floor
  - critical contracts are explicit
  - targeted regression coverage exists for the main risk areas
  - no known ship-blocking defect remains open in the lane
- `8/10`:
  - strong and dependable
  - operator/debug experience is good
  - structural fragility is materially reduced
- `9/10`:
  - very strong and low-friction
  - failures are unusual and easy to reason about
  - documentation, tests, and runtime behavior align tightly
- `10/10`:
  - mature-state target
  - excellent contract clarity, strong validation, low operator pain, and no meaningful ambiguity about system ownership or runtime behavior

## Ship-Floor Gate

To claim a system has reached its ship floor, the rerating packet should show all of these:

- the system's current known blocker list is empty or explicitly waived with fresh evidence
- the main high-risk seam has been hardened, simplified, or isolated
- targeted regression tests or validation gates exist for that seam
- the Copperknot can explain why the score now meets the floor without relying on vague adjectives

## `10/10` Gate

To claim `10/10`, the rerating packet should be able to show all of these:

- system boundary and ownership are unambiguous
- core behavior is strongly covered by targeted tests or equivalent validation
- there is no meaningful open ambiguity about persistence, billing, security, or runtime correctness in the lane
- operator/debug posture is strong enough that incidents are quickly diagnosable
- the system feels boring to operate

| System                                          | Current | Ship floor | Ship-floor evidence should show                                                                                           | `10/10` means                                                                                                                                                                 |
| ----------------------------------------------- | ------: | ---------: | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Create workflow`                               |       6 |          7 | clear Standard/Pulse/Create ownership, main mode-boundary tests, no known ship-blocking Create defect                     | Create mode has clear runtime ownership, predictable prompt/reference behavior, strong tests around mode boundaries, and low operator pain in normal generation use.          |
| `Edit workflow`                                 |       7 |          7 | one major state seam hardened, targeted Edit regression tests, no known ship-blocking Edit defect                         | Expert Edit state, stage behavior, prompt-token rules, inpaint/markup lanes, and save/restore behavior are modular, predictable, and regression-resistant.                    |
| `Video workflow`                                |       6 |          6 | validated mode constraints and output handling, no active ship-blocking video defect                                      | Video generation modes, provider-specific constraints, settings, and output handling are well-bounded, validated, and boring to operate.                                      |
| `Sound workflow`                                |       6 |          6 | validated staging/autosave behavior, no active ship-blocking sound defect                                                 | Voice, music, sound-effects, and voice-changing flows behave consistently, persist correctly, and do not hide brittle staging or autosave edge cases.                         |
| `Reference Grid`                                |       7 |          7 | blocker-free drag/reuse/output lifecycle path, targeted grid interaction tests, no active P0 in the lane                  | Output visibility, drag/reuse, lifecycle actions, and adaptive/media interactions are reliable, intuitive, and free of known blocker defects.                                 |
| `Characters workflow`                           |       6 |          6 | main shell/persistence ambiguity reduced, targeted workflow tests, no active ship-blocking character defect               | Character creation, preset/look management, and AI Studio character reuse are modular, persist correctly, and are easy to reason about and support.                           |
| `Elements workflow`                             |       6 |          6 | workflow authority clarified, targeted persistence/reuse tests, no active ship-blocking elements defect                   | Element creation, asset assignment, and downstream reuse are explicit, stable, and no longer dependent on vague or transitional workflow boundaries.                          |
| `Project / workspace persistence`               |       7 |          7 | restore authority made explicit, targeted persistence tests, no silent ownership/restore ambiguity                        | Project identity, workspace save/restore, project-scoped associations, and exclusion rules are explicit, tested, and trusted as durable authority.                            |
| `Media Library workflow`                        |       6 |          6 | core browse/folder/selection semantics validated, no active ship-blocking library defect                                  | Browse, search, foldering, bulk actions, and cross-surface ingest are coherent and dependable without gesture or membership surprises.                                        |
| `Media ingest / save`                           |       6 |          7 | canonical write path trusted, targeted upload/persistence checks, no ownership/quota ambiguity in hot path                | All canonical media writes are server-authoritative, validated, quota-aware, and linked cleanly to generation/project ownership semantics.                                    |
| `Media delivery / signing / preview resolution` |       6 |          6 | preview delivery path validated, no active broken-preview ship blocker                                                    | Signed previews, variant selection, and preview fallbacks are performant, secure, and free of stale-delivery or broken-preview confusion.                                     |
| `Media derivatives / variants`                  |       6 |          6 | derivative worker backlog/failure posture acceptable, targeted worker validation exists                                   | Derivative generation is timely, observable, idempotent, and operationally quiet, with low backlog risk and clear failure handling.                                           |
| `Generation submission / polling`               |       7 |          7 | submit/status ownership path hardened, targeted runtime tests, no unresolved request-tracking blocker                     | Provider submit/status paths are contract-tight, ownership-safe, observable, and resilient against admission, request-tracking, and polling drift.                            |
| `Generation recovery / settlement`              |       4 |          7 | convergence/settlement invariant hardened, targeted recovery+billing tests, no unresolved ship-blocking divergence defect | Terminal-state convergence, billing settlement, publication/projection repair, and replay/idempotency invariants are strongly enforced and trusted under degraded conditions. |
| `Provider integrations`                         |       6 |          7 | provider contract seams validated, no major adapter drift in active providers                                             | Provider adapters, model metadata, submit/status/result contracts, and recovery probes are centralized, current, and low-drift across supported providers.                    |
| `Billing / credits`                             |       7 |          7 | reservation/capture/release and reconciliation path validated, no unresolved ledger-integrity blocker                     | Reservation, capture, release, Stripe sync, balance reads, admin adjustments, and diagnostics are internally consistent and easy to reconcile.                                |
| `Pricing / entitlements`                        |       7 |          7 | versioned control-plane path remains validated and audit-safe                                                             | Public catalog and runtime pricing control-plane changes are versioned, validated, auditable, and safe to operate without accidental runtime drift.                           |
| `Auth / identity`                               |       7 |          7 | fail-closed auth boundary stays validated and no active access-control blocker exists                                     | Route protection, bearer verification, proxy metadata handling, and admin-role resolution are centralized, fail-closed, and rarely need investigation.                        |
| `Core data persistence`                         |       6 |          7 | key ownership and migration invariants validated, no unresolved persistence ambiguity in hot path                         | Schema authority, ownership guarantees, migration posture, and cross-table workflow integrity are explicit, tested, and low-drift.                                            |
| `Storage / file delivery`                       |       6 |          7 | storage-scope and signed-delivery path validated, no unresolved cross-user or broken-delivery blocker                     | Object-path ownership, signed delivery, and storage-scope guarantees are secure, observable, and operationally uneventful.                                                    |
| `Security boundaries`                           |       7 |          7 | route/RLS/RPC audit path passes, no unresolved cross-user or exposed-route blocker                                        | RLS, internal-route exposure, RPC grants, protected-route manifests, and storage-scope policies are aligned and routinely auditable with no major uncertainty.                |
| `Admin operations`                              |       6 |          6 | admin support surfaces validated for intended support tasks, no active operator-surface blocker                           | Admin tools are scoped, trustworthy, and strong enough for support work without becoming an accidental source of mutation risk or operator confusion.                         |
| `Observability / incident triage`               |       6 |          6 | incident/event surfaces expose actionable failures and support operator triage                                            | Error ingestion, grouped incidents, event streams, and operator diagnostics surface the right failures quickly and support disciplined incident handling.                     |

## Important Rule

A system may be ship-ready without being `10/10`.

The point of `10/10` is to define the ideal mature state. The point of the current window is to reach the ship floor safely and honestly.
