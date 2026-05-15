# Beeper Training History

Purpose: record supervised Beeper runs, lessons, SOP/template updates, tool changes, remaining friction, and next training focus.

## 2026-05-15: Agent Setup

Task: establish Beeper as the ShortPulse live product tester.

Actions taken:

- Loaded the repo startup contract, route/testing docs, and agent-teaching setup references.
- Created Beeper's contract, repo-visible memory, retained artifact area, and owned workspace folder.
- Wired Beeper into the docs indexes and agent artifact indexes.

Training result:

- Beeper is initialized at `Level 1: Supervised`.
- Beeper has a durable contract, memory, retained artifact area, and owned workspace folder.

Next training focus:

- Complete the first authenticated live-product walkthrough and capture a dated audit report.
- Refine Beeper's testing checklist and severity language from real findings.

## 2026-05-15: Tooling Bootstrap

Task: add reusable Beeper scripts so future supervised testing runs start from a stable runtime/user posture.

Actions taken:

- Added a shared Beeper runtime helper for env resolution, auth-user alignment, compliance-gate handling, and signal capture.
- Added `ensure-audit-user.mjs` to keep the dedicated Beeper audit user aligned with the active frontend runtime project.
- Added `live-product-walkthrough.mjs` to capture a starter signed-in route packet with screenshots and JSON output.
- Added a reusable live-audit report template and linked the new tooling from Beeper's workspace docs/checklist.

Training result:

- Beeper now has a clearer setup path before future walkthroughs.
- The active runtime project and Beeper's dedicated audit user are now part of the explicit operating workflow.

Next training focus:

- Run the first full Beeper walkthrough with the new scripts and refine route-specific interaction macros from real product findings.

## 2026-05-15: Training Governance Hardening

Task: convert the user's training requirement into a durable Beeper operating system for logging every substantive supervised run.

Actions taken:

- Added a frozen Beeper baseline KPI for training quality targets.
- Added a retained Beeper run-report template focused on action logs, evidence, findings, and code handoff.
- Added a `beeper/runs/` packet area plus scratch-note template for chronological supervised-run logging.
- Added `start-training-run.mjs` so dated run packets and retained reports can be created mechanically.
- Updated Beeper's contract, memory, tools, run log, and artifact README so supervised logging is mandatory rather than implied.

Training result:

- Beeper now has an explicit training-record system instead of only general retained artifacts.
- Future substantive runs have a clearer expectation for chronological notes, retained reports, KPI comparison, and training updates.

Next training focus:

- Start the first real Beeper testing run with `start-training-run.mjs`.
- Use the resulting packet to refine severity standards and route-specific test macros from live product evidence.

## 2026-05-15: SOP Framework Creation

Task: create Beeper's canonical SOP and scenario framework so future testing behavior can expand in one durable place.

Actions taken:

- Added `docs/agents/beeper/standard-operating-procedure.md` as Beeper's standing workflow.
- Defined standard run types, required workflow order, severity buckets, handoff standards, and training standards.
- Added an initial scenario framework for auth/access gates, route walkthroughs, issue-to-code handoffs, and retests.
- Updated the Beeper indexes and SOP notes so the canonical SOP is the primary reference rather than an emerging need.
- Corrected Beeper memory to reflect the supervised state and the presence of the standing SOP.

Training result:

- Beeper now has a real operating framework instead of only scattered notes and helpers.
- Future scenario learning can extend the SOP incrementally without rewriting the contract each time.

Next training focus:

- Start the first real Beeper testing run and validate whether the SOP order holds up under real product friction.
- Add the first scenario expansion only after a real run proves a gap in the current framework.

## 2026-05-15: First Real Production Sign-In Run

Task: sign into the production ShortPulse app with Beeper's dedicated production audit account.

Actions taken:

- Started a dated Beeper training packet for the production sign-in run.
- Reached the production auth route in the in-app browser and confirmed the page loaded.
- Hit a browser-runtime limitation during credential entry because the in-app path could not type into the auth form without its virtual clipboard layer.
- Fell back to Beeper's standalone Playwright browser session and completed production sign-in successfully.
- Saved a production dashboard screenshot plus reusable storage state in the run packet and wrote the retained report.

Training result:

- Beeper completed its first real production-authenticated run.
- A new known scenario emerged: hosted auth entry may need a saved-browser-session fallback when the in-app browser cannot type credentials.

Next training focus:

- Turn the hosted auth fallback into a reusable helper instead of repeating the manual fallback.
- Begin the first broader production walkthrough and use the saved auth state to reduce setup friction.

## 2026-05-15: First Production Core Audit

Task: run the first real signed-in production route audit and convert the first credible runtime issue into a handoff-ready code investigation.

Actions taken:

- Reused the production audit account and ran the core route sweep across dashboard, AI Studio, Media Library, Character Manager, and Settings.
- Captured the initial JSON packet and screenshots, then isolated the only concrete runtime failure from the broad route pass.
- Re-ran Media Library in a focused signed-in browser session, probed the failing signed image URL directly, and captured the actual in-app `/api/media/list` payload.
- Inspected the route-first media signing path plus the client preview-recovery path to explain why the bug was recoverable.

Training result:

- Beeper learned to separate navigation churn (`ERR_ABORTED`) from a real media defect backed by a reproducible signed-URL `404`.
- Beeper also corrected an early false read: the suspicious `1x1` thumbs were not a broken derivative worker, because the source rows themselves were `1x1` audit fixtures.
- The first real production product bug is now documented as a recoverable stale `thumb_variant_path` that leaks into `/api/media/list` first paint before the client falls back to the original upload URL.

Next training focus:

- Add an opt-in capture step for paired internal API bodies when runtime media failures surface.
- Continue the production walkthrough beyond shell loading and into deeper task flows now that the first issue-to-code handoff pattern has been exercised.

## 2026-05-15: Real-User Dashboard Entry Pass

Task: shift from route-only testing to believable signed-in user behavior and see whether the dashboard's primary entry points communicate the product model clearly.

Actions taken:

- Updated Beeper's contract, memory, SOP, and checklist so real-user behavior is now a standing instruction.
- Entered production through the dashboard and used visible hero CTAs instead of route-jumping.
- Verified that `Open the AI Studio` currently opens the inline project-name modal on the dashboard rather than taking the user into AI Studio.
- Verified that `Open Projects` and `Open the project library` both resolve to the same in-page projects overlay.
- Verified that the avatar/account menu cleanly opens the settings path.

Training result:

- Beeper now has evidence that real-user exploration finds different issues than route sweeps.
- The dashboard's launch-surface semantics are now a known audit lane: CTA copy and behavior can drift even when the underlying controls technically work.
- Real-user behavior is now a durable Beeper instruction rather than a temporary user preference.

Next training focus:

- Keep testing product entry and conversion paths the way a new signed-in user would.
- After the dashboard lane, continue into the safest deeper read-only workflows inside AI Studio, Media Library, and settings before any production write path.

## 2026-05-15: D-Bug Handoff Protocol Hardening

Task: make real issue escalation to D-Bug a durable part of Beeper's operating system instead of a one-off behavior.

Actions taken:

- Updated Beeper's contract, repo-visible memory, and SOP so real issues and errors now require a D-Bug handoff packet in addition to the Beeper report.
- Added the first dashboard CTA mismatch intake packet in `docs/records/artifacts/agent/d-bug/handoffs/`.
- Updated Beeper's workspace docs, retained memory, tool inventory, retained artifact README, and SOP notes so the handoff rule is visible across the operating surfaces.
- Updated the retained run log so the handoff-process change is traceable as training data.

Training result:

- Beeper now has a consistent two-layer escalation pattern:
  - Beeper report for UX/functionality audit context
  - D-Bug handoff for debugging intake when engineering investigation is needed
- Future real issues should be easier to route without rebuilding context from chat.

Next training focus:

- Keep pressure-testing whether the D-Bug handoff threshold is calibrated well enough to avoid over-escalating light UX notes.
- If the pattern repeats often, add a helper to scaffold D-Bug handoff files directly from Beeper issue packets.

## 2026-05-15: User Summary Hardening

Task: make every Beeper checkpoint easy for the human trainer to scan and correct without reading the full audit packet first.

Actions taken:

- Added a dedicated `beeper/checkpoint-summaries/` lane for short user-facing checkpoint recaps.
- Updated Beeper's contract, memory, SOP, workspace docs, and retained artifact docs so each meaningful checkpoint now requires both a full report and a short ADHD-friendly summary.
- Added a reusable template for those summaries.
- Backfilled the existing production checkpoints into the new summary lane so prior work is easy to review.

Training result:

- Beeper now has a two-speed reporting model:
  - dense audit records for product/debug fidelity
  - fast scan summaries for human correction and training
- Future trainer feedback should be easier to apply because each checkpoint now has a short recap with links to the full artifacts.

Next training focus:

- Keep the summaries short enough to scan quickly without stripping out decisions, failures, or handoffs.
- Watch whether a small script should scaffold these summaries automatically from run metadata.

## 2026-05-15: Coverage Log Hardening

Task: give Beeper a durable way to track which routes, controls, and real-user actions have already been exercised so future runs can widen app coverage deliberately.

Actions taken:

- Added a dedicated `beeper/action-coverage/` lane for route/control/action history.
- Updated Beeper's contract, memory, SOP, checklist, workspace docs, and retained docs so future runs must consult and update coverage before choosing the next lane.
- Backfilled the known production checkpoints into a master coverage log with status labels for route access, control exercise, and create/edit/save depth.
- Added a reusable coverage-update template for future manual logging.

Training result:

- Beeper now has a simple durable map of what has been touched already and what still needs real-user coverage.
- Future runs can be chosen to expand into untouched or only partially covered areas instead of repeating dashboard-only passes.

Next training focus:

- Keep the coverage log honest about depth so "opened" is not confused with "fully validated."
- If the manual log becomes too slow, add a small helper to scaffold coverage entries from checkpoint notes.

## 2026-05-15: Scoring And Directive Logging Hardening

Task: make Beeper's supervised evaluation auditable by logging trainer directions, tools used, and a stable performance score for each substantive run.

Actions taken:

- Added a durable trainer-directives log for the user's standing instructions and prompt patterns.
- Added a Beeper-owned performance scorecard with weighted categories totaling `10.0`.
- Updated the baseline KPI so future substantive runs are expected to include tool logging, directive traceability, and scorecard use.
- Updated the training notes template, retained report template, memory, SOP, and retained docs so the scoring/logging rules are part of the normal workflow.

Training result:

- Beeper no longer has to improvise performance scoring from memory.
- Future runs can be judged more consistently on user realism, coverage expansion, evidence quality, triage quality, handoff usefulness, logging discipline, and operational discipline.
- Trainer directions now have a durable home instead of relying on thread memory alone.

Next training focus:

- Use the scorecard on the next substantive run rather than only in process hardening.
- Watch for whether the score breakdown helps cut meta-noise and force deeper product coverage.

## 2026-05-15: Score Earning System Hardening

Task: make Beeper's score something that is earned over time through repeated substantive runs rather than stated as a one-off rating.

Actions taken:

- Extended the scorecard with earning rules, promotion thresholds, and a ledger rule.
- Added a durable performance ledger with the first operating assessment row.
- Updated baseline KPI, memory, SOP, retained docs, and run log so future substantive runs are expected to append ledger entries.

Training result:

- Beeper now has a persistent score history instead of only a current snapshot.
- The scoring system now rewards deeper workflow validation and repeated quality, not just one strong report.

Next training focus:

- Use the ledger on the next substantive product run.
- Raise the weakest category, which is currently coverage expansion.

## 2026-05-15: Score System Audit Hardening

Task: audit whether Beeper's score system is a real training tool or just a reporting layer.

Actions taken:

- Identified the main flaw: the score recorded quality but did not strongly force better behavior.
- Added hard score caps for shallow workflow validation, weak evidence, and repeated known mistakes.
- Added a confidence tag so uncertain scores are marked instead of overstated.
- Added a mandatory next-run drill tied to the weakest category.
- Updated the ledger, report template, notes template, KPI, SOP, and run log so the training loop is durable.

Training result:

- The score system now acts more like coaching and less like bookkeeping.
- High documentation quality can no longer hide shallow app testing.
- Repeated misses now have a clearer escalation path from note -> drill -> system fix.

Next training focus:

- Use the next-run drill rule on the next real product checkpoint.
- Confirm that the weakest category actually changes after the drill instead of staying static.

## 2026-05-15: Run Queue Hardening

Task: reduce planning churn and make it easier for Beeper to resume with the highest-value next workflow lane.

Actions taken:

- Added a ranked `beeper/next-run-queue.md` with the current highest-value real-user testing lanes.
- Updated memory, SOP, retained memory, tools inventory, and artifact docs so the queue becomes part of the normal run-start workflow.
- Added a durable rule that deeper workflow coverage should win over further process-only hardening unless process drift is blocking the run.

Training result:

- Beeper now has a single control surface for "what should I test next?"
- Future runs should spend less time choosing and more time executing deeper user workflows.

Next training focus:

- Use the logout -> sign-back-in loop as the next high-value lane unless the user redirects scope.
- See whether the next substantive score raises the `coverage expansion` category.

## 2026-05-15: Trigger Phrase Hardening

Task: make the start signal for Beeper testing runs explicit and durable.

Actions taken:

- Added `run test` as a standing Beeper trigger phrase in the contract, memory, SOP, workspace docs, and retained memory.
- Logged the trigger phrase change in the retained run log so the behavior change is traceable.

Training result:

- Beeper now has a simple user-facing start command for future testing runs.
- The trigger no longer depends on chat memory or informal phrasing.

Next training focus:

- Treat `run test` as the default start signal unless you later want separate triggers for smoke test, exploratory test, or retest lanes.

## 2026-05-15: Project Creation Validation Run

Task: move beyond dashboard click-only testing and validate one real production create/save workflow like a normal user would.

Actions taken:

- Reviewed the coverage log and chose the project-creation lane because it was the highest-value gap.
- Opened production `/dashboard`, clicked `New Project`, entered a real custom title, and submitted create.
- Confirmed the flow landed in AI Studio with a real `projectId`.
- Returned to the dashboard and reopened the projects overlay to confirm the new project persisted in the normal UI.
- Updated the retained report, full Beeper report, checkpoint summary, and coverage log with the new evidence.

Training result:

- Beeper now has one validated production create/save workflow instead of only route-entry and semantics checks.
- The earlier dashboard CTA issue is now narrowed: the first-click semantics are still confusing, but the actual create/save path works.
- The next highest-value gap has shifted from project creation into AI Studio working-state coverage.

Next training focus:

- Test one real AI Studio action from an existing project rather than stopping at the landing route.
- Keep building toward full app coverage by choosing untouched or only partially covered actions from the coverage log.

## 2026-05-15: AI Studio Working Lane

Task: move beyond route-opened coverage and use a saved AI Studio project like a real user.

Actions taken:

- Reopened the saved Beeper production project in AI Studio.
- Mapped the visible studio controls and confirmed access to the prompt composer, mode controls, libraries, and in-studio project overlay.
- Entered a real prompt and clicked the visible generate controls in chat-off Standard Create mode.
- Captured the resulting request trail and narrowed the behavior to a likely generate no-op path with workspace persistence but no observed generation request.
- Inspected the smallest runtime wiring around the generate action and created a D-Bug handoff.

Training result:

- Beeper now has partial real-use AI Studio coverage instead of only shell access.
- The main new product finding is specific: generation appears actionable but does not visibly proceed in production.
- The code narrowing is stronger than a pure UX note because the tested runtime hook contract expects the inline generate action to call `handleGenerate`.

Next training focus:

- Continue testing non-generate AI Studio workflows while the generate bug is open.
- After the bug is fixed, retest the same project and validate real output creation plus reference-grid behavior.

## 2026-05-15: AI Studio Non-Generate Lane

Task: keep testing AI Studio like a real user while the generate bug stays open, and verify whether the surrounding workspace still behaves coherently.

Actions taken:

- Reopened the saved production project and stayed inside AI Studio instead of bouncing back to the dashboard.
- Tested the in-studio `Projects` overlay, top layout tabs, `Add files`, and the left-side libraries.
- Corrected an initial cramped-capture mistake by recapturing the dense desktop surface at a much wider viewport before logging a layout conclusion.
- Confirmed that several non-generate studio surfaces work, but the top layout tabs still do not map cleanly to the visible panel state.
- Created a D-Bug handoff for the top-tab/right-rail mismatch.

Training result:

- Beeper now has a stronger capture-discipline rule for dense desktop UI.
- AI Studio is better differentiated:
  - generate path appears broken
  - multiple non-generate library surfaces still work
  - top layout shortcut semantics are independently questionable

Next training focus:

- Start wide on dense studio surfaces by default.
- Keep exploring successful non-generate AI Studio actions while the generate bug is open.
