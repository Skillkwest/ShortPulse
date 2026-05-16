# D-Bug Training History

Purpose: track how D-Bug is trained, what behavior improves, and what still needs refinement.

## History

### 2026-05-13

- Prompt or task:
  - Establish D-Bug as the repo debugging agent with its own operating area and handoff workflow.
- Behavior learned:
  - Default to structured debugging handoffs and scope reduction before implementation.
- Docs or artifact updates:
  - Created the initial D-Bug contract, memory surfaces, retained artifacts area, and handoff template.
- Tool changes:
  - None.
- Remaining friction:
  - No real handoff packets or debug reports yet.
- Next training focus:
  - Capture the first real multi-agent debugging handoff and refine the intake format from actual usage.

### 2026-05-14

- Prompt or task:
  - Audit D-Bug's folder space and store the distinction between D-Bug, Gear Ball, and Nuclo responsibilities durably.
- Behavior learned:
  - D-Bug should stop at diagnosis and route the next lane explicitly when the remaining work is operational rather than debugging.
- Docs or artifact updates:
  - Added adjacent-agent routing to the D-Bug contract, memory, handoff template, retained artifact README, reports README, and handoff rules.
- Tool changes:
  - Added targeted test-command guidance to the retained tools index.
- Remaining friction:
  - No retained real-world D-Bug handoff or debug report exists yet.
- Next training focus:
  - Capture the first real D-Bug closeout that hands work to Gear Ball or Nuclo and verify the routing language is clear in practice.

### 2026-05-15

- Prompt or task:
  - Add recurring handoff-watch behavior to D-Bug and create a simple automation that keeps auditing open lanes until a stop condition is reached.
- Behavior learned:
  - D-Bug should treat handoff intake as a recurring operational loop with explicit report status, stop conditions, and checkpoint actions instead of relying on thread memory.
- Docs or artifact updates:
  - Added periodic intake guidance, report-status rules, stop-condition requirements, and recurring workflow steps to the D-Bug contract and artifact surfaces.
- Tool changes:
  - Added a recurring automation for D-Bug handoff sweeps.
- Remaining friction:
  - The first real open-lane report has not yet been exercised under the new recurring workflow.
- Next training focus:
  - Verify that a real inbound handoff can move cleanly from `handoffs/` to an `open` report and then to `done`, `blocked`, or `handed_off` without ambiguity.

### 2026-05-15

- Prompt or task:
  - Require D-Bug to record checkpoint-by-checkpoint work history, self-score performance, note weak areas, and write improvement actions back into training data.
- Behavior learned:
  - D-Bug should treat each checkpoint as both execution evidence and training evidence, not just progress tracking.
- Docs or artifact updates:
  - Added checkpoint review requirements to the D-Bug contract, artifact README, reports rules, and recurring SOP.
  - Created a reusable checkpoint review template.
- Tool changes:
  - No tool change beyond automation behavior expectations.
- Remaining friction:
  - The first live checkpoint review has not been generated yet from an active D-Bug report.
- Next training focus:
  - Exercise the new checkpoint-review rubric on the current media-library handoff and tune the scoring categories if they feel too vague or redundant.

### 2026-05-15

- Prompt or task:
  - Add a cumulative overall training log for D-Bug.
- Behavior learned:
  - D-Bug should separate three layers of training evidence:
    - checkpoint reviews for lane execution
    - training history for dated supervised-run changes
    - an overall training log for long-term patterns and drift
- Docs or artifact updates:
  - Created `overall-training-log.md` and linked it from D-Bug retained memory surfaces.
- Tool changes:
  - None.
- Remaining friction:
  - The cumulative log has only its initial baseline and no multi-run score trend yet.
- Next training focus:
  - Start rolling repeated score weaknesses and repeated improvements into the cumulative log after several live checkpoints.

### 2026-05-15

- Prompt or task:
  - Create a stable scoring system for D-Bug's overall performance.
- Behavior learned:
  - D-Bug should score itself against a fixed weighted rubric instead of relying on unweighted subjective checkpoint ratings.
- Docs or artifact updates:
  - Created `performance-scorecard.md` and linked it into checkpoint, SOP, memory, and overall-training-log surfaces.
- Tool changes:
  - No tool change; scoring logic is now a durable artifact rule.
- Remaining friction:
  - The scorecard has a provisional baseline only because there are not yet enough real checkpoint-scored lanes to freeze a numeric baseline.
- Next training focus:
  - After at least 3 real checkpoint-scored lanes, freeze the first numeric baseline and compare later runs against it.

### 2026-05-15

- Prompt or task:
  - Compare D-Bug's recent work against the scoring system, score each checkpoint, log strengths and mistakes, infer improvements, and create helper tooling.
- Behavior learned:
  - D-Bug performs best when it turns scoring from a narrative habit into a derived tool-assisted workflow.
- Docs or artifact updates:
  - Hardened the scorecard and checkpoint template.
  - Created the first real scored self-audit report.
  - Added repeated-score observations to the overall training log.
- Tool changes:
  - Created `scripts/d_bug_scorecard.mjs` to compute weighted checkpoint scores and score bands.
- Remaining friction:
  - The numeric baseline is still provisional because only one real scored lane has been fully recorded.
- Next training focus:
  - score the next two real handoff lanes from start to finish and then freeze the first numeric baseline.

### 2026-05-15

- Prompt or task:
  - Write canonical SOPs that make D-Bug's job explicit and clear.
- Behavior learned:
  - D-Bug needed canonical SOPs in `docs/agents/d-bug/`, not only retained artifact notes, because retained records are not the right authority surface for standing procedures.
- Docs or artifact updates:
  - Created `standard-operating-procedure.md` and `scorecard-operations.md`.
  - Updated D-Bug indexes and agent indexes to point to those SOPs.
- Tool changes:
  - None.
- Remaining friction:
  - The recurring automation still relies primarily on the contract and prompt text rather than directly naming the new SOP files.
- Next training focus:
  - exercise the SOPs on the next real handoff lane and update the automation prompt only if the SOP references prove necessary for reliability.

### 2026-05-15

- Prompt or task:
  - Audit D-Bug's SOPs and rewrite them.
- Behavior learned:
  - D-Bug SOP authority should live in `docs/agents/d-bug/`, while retained artifact surfaces should index and support those SOPs instead of duplicating standing procedure.
- Docs or artifact updates:
  - Tightened `standard-operating-procedure.md` and `scorecard-operations.md`.
  - Rewrote retained `sops.md` into a pure index.
  - Aligned the report README with the actual checkpoint/scorecard contract.
- Tool changes:
  - None.
- Remaining friction:
  - The automation prompt still references workflow behavior directly instead of naming the canonical SOP files.
- Next training focus:
  - if automation drift appears, update the automation prompt to name the two canonical SOP files explicitly.

### 2026-05-15

- Prompt or task:
  - Convert D-Bug recurring work from a detached automation into a heartbeat in the current thread and capture temporary production authorization for the prelaunch sprint.
- Behavior learned:
  - When the user wants visible ongoing execution in-thread, D-Bug should prefer a heartbeat attached to the active thread over a detached cron-style sweep.
- Docs or artifact updates:
  - Updated D-Bug memory surfaces with the heartbeat cadence and the temporary production-sprint authorization note.
- Tool changes:
  - Reconfigured `d-bug-handoff-sweep` from detached recurring behavior toward a thread heartbeat.
- Remaining friction:
  - The production authorization is temporary and should not be treated as a permanent branch-policy change.
- Next training focus:
  - Reconfirm the permission at the end of the prelaunch sprint or when branch expectations change.

### 2026-05-16

- Prompt or task:
  - Check the retained D-Bug handoff queue, complete actionable local tasks, and reconcile stale versus active packets.
- Behavior learned:
  - When a handoff queue mixes historical, downstream-owned, stale, and actionable packets, D-Bug should classify the queue first and only then open code lanes.
- Docs or artifact updates:
  - Added a retained triage/closeout report and updated the handoff index to reflect active, resolved, historical, and downstream-owned lanes.
- Tool changes:
  - None.
- Remaining friction:
  - Several active D-Bug handoffs are still production-only and need fresh repro/evidence before safe code changes.
- Next training focus:
  - Start future queue-reduction passes with explicit packet classification before touching product code.

### 2026-05-16

- Prompt or task:
  - Continue the retained D-Bug queue by auditing and fixing `ai-studio-generate-noop`.
- Behavior learned:
  - When a production handoff sounds like a provider or request-start failure, D-Bug should inspect the narrowest submit-routing hook first before widening into controller or backend theories.
- Docs or artifact updates:
  - Added a retained closeout report for the Standard Create generate-noop lane.
  - Reclassified `2026-05-15-ai-studio-generate-noop.md` as resolved on the current branch.
- Tool changes:
  - None.
- Remaining friction:
  - Live production verification was not part of this narrow repo-side fix, so residual confidence still depends on targeted tests rather than browser repro.
- Next training focus:
  - Start future AI Studio no-op investigations at the immediate submit-routing surface before opening broader provider/transport audits.

### 2026-05-16

- Prompt or task:
  - Continue the retained D-Bug queue by auditing and fixing `ai-studio-top-tab-panel-mismatch`.
- Behavior learned:
  - When a UI tab/shortcut mismatch is reported, D-Bug should first test whether the controls are modeled as raw toggles instead of named destination selectors.
- Docs or artifact updates:
  - Added a retained closeout report for the AI Studio top-tab/right-rail mismatch.
  - Reclassified `2026-05-15-ai-studio-top-tab-panel-mismatch.md` as resolved on the current branch.
- Tool changes:
  - None.
- Remaining friction:
  - Live production verification still needs a browser pass if the user wants runtime confirmation beyond repo-side state and focused tests.
- Next training focus:
  - Start future layout-navigation audits at the shared domain/state helper before patching presenter components.

### 2026-05-16

- Prompt or task:
  - Continue the retained D-Bug queue by auditing and fixing `character-reload-auth-bounce`.
- Behavior learned:
  - When a protected route works in-session but fails on reload, D-Bug should inspect the shared auth gate before assuming a route-specific bootstrap failure.
- Docs or artifact updates:
  - Added a retained closeout report for the Character reload/auth-bounce lane.
  - Reclassified `2026-05-15-character-reload-auth-bounce.md` as resolved on the current branch.
- Tool changes:
  - None.
- Remaining friction:
  - Production browser verification is still useful, and the older Character bootstrap-stall lane may or may not be fully covered by this shared auth-guard fix.
- Next training focus:
  - Start future reload-continuity audits at the protected-route/session recovery layer before route-specific persistence code.
