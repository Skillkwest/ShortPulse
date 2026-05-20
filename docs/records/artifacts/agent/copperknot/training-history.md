# Copperknot Training History

Purpose: record supervised Copperknot runs, lessons, SOP/template updates, tool changes, remaining friction, and next training focus.

## Load Rule

- Do not load this full file during routine catalog execution.
- Use `docs/agents/copperknot/memory.md` for current durable behavior.
- Use the newest one or two entries here only when doing maintenance, pruning, or agent-quality retrospectives.

## 2026-05-06: Agent Setup

Task: establish the Copperknot as the systems catalog steward and production-readiness handoff owner.

Prompt summary:

```text
you are my new system catalog agent. you are responsible for updating and managing this catalog...
```

Actions taken:

- Loaded the repo startup contract and core docs.
- Loaded the systems catalog, rubric, route map, operator map, architecture docs, and representative code seams.
- Confirmed the current catalog scores against repo evidence.
- Loaded the agent-teaching setup docs and the existing agent/artifact repo structure.
- Created the Copperknot contract, repo-visible memory, and retained artifact area.
- Recorded the mission window from `2026-05-06` to `2026-06-06`.

Training result:

- Copperknot is initialized at `Level 1: Supervised`.
- The agent has not yet completed its first full production-readiness roadmap and execution-handoff packet set.

Next training focus:

- Produce the first full one-month production-readiness roadmap.
- Create high-quality execution handoffs for the weakest systems in the catalog.
- Decide whether a fixed handoff template and weekly scorecard should become durable artifacts.

## 2026-05-06: Operating Package Creation

Task: create the full Copperknot operating package for the current production-readiness window.

Actions taken:

- Defined the hard ship bar for the `2026-05-06` through `2026-06-06` window.
- Created the dated production-readiness plan.
- Created the prioritized all-systems handoff queue.
- Created concrete `10/10` score criteria for every current catalog system row.
- Created a reusable handoff template.
- Created detailed handoffs for the current highest-priority workflow and stability lanes.

Training result:

- Copperknot now has an actionable operating package, not just a contract and kickoff note.

Next training focus:

- Keep the handoff queue current as work lands.
- Produce weekly or milestone re-rating packets.
- Tighten ship-floor evidence for the remaining queue-only systems.

## 2026-05-06: Audit Fixes

Task: fix the initial operating-package audit findings.

Actions taken:

- Aligned the operating package and kickoff report to the dated queue as the single authoritative execution order.
- Tightened the score-criteria document so rerating requires explicit gate-style evidence instead of descriptive narrative alone.

Training result:

- The package is now more internally consistent and more usable for future rerating and handoff work.

## 2026-05-06: Dispatch Tracking Cleanup

Task: update the Copperknot space to reflect active external lanes and current handoff state.

Actions taken:

- Added a dispatch log for the current production-readiness window.
- Recorded that `Generation recovery / settlement` and `Reference Grid` are already dispatched and running externally.
- Marked `Edit workflow` as the next ready lane in the queue-facing surfaces.

Training result:

- The Copperknot space now reflects current execution reality instead of only static planning state.

## 2026-05-07: Recovery Lane Completion Tracking

Task: update the Copperknot space after the first priority handoff returned as complete.

Actions taken:

- Marked `Generation recovery / settlement` as completed externally in the dispatch log.
- Updated the queue and operating package snapshots to show that rerating is still gated on Copperknot review of the returned work.
- Kept `Reference Grid` as the remaining active external lane and `Edit workflow` as the next ready handoff.

Training result:

- The Copperknot now distinguishes between external completion and catalog-approved score movement, which keeps the ship-bar process disciplined.

## 2026-05-07: SOP And Report Intake Formalization

Task: formalize the Copperknot SOP, report intake path, and lane closeout rules so parallel execution work stays organized and rerating remains evidence-backed.

Actions taken:

- Created a standing SOP for catalog audits, rerating, queue maintenance, handoff generation, and report intake.
- Created a dedicated external closeout-report folder under the Copperknot artifact area.
- Updated the handoff template so every lane includes a lane id, owned write surface, avoid surface, stop conditions, and a required closeout report path.
- Normalized the active handoff packets to the new lane and closeout standard.
- Wired the SOP and intake path into the contract, memory, operating package, indexes, and artifact readmes.

Training result:

- The Copperknot now has an explicit operating pipeline: lane assignment, execution, closeout intake, repo audit, and rerating.

## 2026-05-07: Catalog Space Audit Cleanup

Task: audit the Copperknot space for drift in organization, duty clarity, and report flow.

Actions taken:

- Renamed the handoff index from an `active` framing to a library framing so folder contents are not mistaken for dispatch state.
- Added a reusable external lane closeout template to match the existing handoff-template discipline.
- Updated the artifact-memory and tooling notes to remove stale priority and tooling assumptions.

Training result:

- The Copperknot space now distinguishes more clearly between library surfaces, live dispatch state, and intake/report surfaces.

## 2026-05-07: SOP Audit Fixes

Task: fix the Copperknot SOP after a contract-level audit found rollover, intake, and handoff-standard gaps.

Actions taken:

- Replaced hardcoded dated operating-authority references in the SOP with an active-window resolution rule.
- Added the missing fallback path for rerating when an external lane finishes without a closeout report.
- Aligned the SOP, handoff template, and active handoff packets with the contract requirement that handoffs state target score and why the current score is low.

Training result:

- The SOP is now a stronger standing authority instead of a document that would drift at the next production-window rollover.

## 2026-05-07: Catalog Model Hardening

Task: redesign the systems catalog so it works as a stronger ship-readiness tool instead of only an architecture registry.

Actions taken:

- Added first-class ship-control fields to the catalog model: `Rating state`, `Ship floor`, `Ship status`, `Priority band`, `Active blocker`, `Active lane`, and `Review basis`.
- Tightened the `/10` scoring contract so the shorthand is derived from the `Health` band and shaped by risk, confidence, blockers, and calibration state.
- Updated the rating-pass template to capture the new fields during every rating run.
- Added a derived ship-readiness scoreboard under `docs/systems/` for fast release-control reads.

Training result:

- The canonical systems catalog is now much closer to a usable release-control instrument instead of a good-but-passive architecture table.

## 2026-05-15: Launch-Control Model Tightening

Task: fix the remaining catalog-model gaps that were still weakening the system as a launch-readiness tool.

Actions taken:

- Replaced `Owner` with `Steward` to make the field about catalog accountability rather than implied code authorship.
- Added structured `Blocker status`, `Blocker refs`, and `Execution status` fields to the canonical catalog table.
- Replaced opaque review-basis labels with concrete baseline and execution snapshot references.
- Added freshness, queue-precedence, scoreboard-sync, and launch-state cadence rules.
- Marked the existing May 7 execution snapshot surfaces as stale as of May 15 until a refresh pass occurs.

Training result:

- The catalog is now more honest about launch-state uncertainty and better structured for exact release-control refreshes.

## 2026-05-15: Production Launch-State Refresh

Task: refresh the active launch-state surfaces against current production evidence on `production` without forcing a full rerating.

Actions taken:

- Created a dated production launch-state refresh report and used it as the new evidence anchor for the refreshed rows.
- Updated the dispatch log, queue snapshot, operating package, scoreboard, and selected catalog rows to reflect the May 15 operating picture.
- Marked `Generation recovery / settlement` as reviewed complete at the execution level while explicitly holding its score unchanged.
- Kept `Reference Grid` as the active blocker lane, kept `Edit workflow` next, and kept `Project / workspace persistence` held because the strongest new contradiction report was local-only.
- Recorded two non-blocking production follow-up findings in the media surfaces without promoting them above the ship-critical queue.

Training result:

- The Copperknot now has a concrete pattern for production-only launch-state refreshes: reconcile evidence, update operating truth, and separate execution-state movement from score movement.

## 2026-05-15: Catalog Tool Hardening

Task: improve the catalog tool itself so future handoffs, rerating decisions, and launch-control reads are more trustworthy and easier to operate.

Actions taken:

- strengthened the external closeout template and intake rules with systems touched, acceptance criteria reached, evidence snapshot, validation evidence, and explicit recommended score effect
- added a stricter score-movement protocol to the SOP, score criteria, and rating-pass template
- tightened `Review basis` expectations so dated reports, snapshots, and validation anchors are preferred over vague labels
- expanded the ship-readiness scoreboard with a compact release-control summary
- created a standing Copperknot tool-health metrics doc for closeout compliance, evidence-anchor coverage, rerating lead time, freshness, queue usefulness, and score-discipline compliance

Training result:

- The Copperknot now has better evidence plumbing and a way to audit the quality of the catalog process itself, not just the app systems it rates.

## 2026-05-15: Measurement And Learning Layer

Task: give the Copperknot a durable time-based learning system so the catalog can improve its measurement quality over repeated runs.

Actions taken:

- created a standing measurement-and-learning framework for launch-state trends, score movement, and queue-decision hindsight
- added a dedicated retained `metrics/` area under the Copperknot artifacts
- seeded the first launch-metrics, score-movement, and decision-outcome logs with the current May 7 and May 15 history

## 2026-05-19: Full Repo Baseline Refresh Discipline

Task: run a full repo-plus-worktree audit without replacing the original May 6 baseline, then lock a new dated launch-control snapshot from current repo truth.

Actions taken:

- audited the full `production` repo plus the active worktree with subagent support across AI Studio, platform/runtime, and Copperknot control-surface lanes
- refreshed the queue, scoreboard, operating package, dispatch log, and May 19 user-facing brief/checklist around a new baseline report instead of rewriting older baseline artifacts
- corrected the first draft of the May 19 baseline after the live Create attachment seam was no longer reproducing in the current worktree and the focused rerun passed cleanly
- recorded confidence-only movements for `Create workflow`, `Project / workspace persistence`, and `Media delivery / signing / preview resolution` instead of forcing broad score lifts

Training result:

- Copperknot now has a stronger rule for repo-wide baseline audits: final baseline truth must follow the latest validated worktree state at closeout, not the first failing seam seen mid-audit.

## 2026-05-16: Copperknot Rename Pass

Task: rename the systems-catalog steward identity to Copperknot and realign the surrounding workspace so the new name is operationally clean.

Actions taken:

- moved the canonical contract folder from `docs/agents/system-catalog-agent/` to `docs/agents/copperknot/`
- moved the retained artifact folder from `docs/records/artifacts/agent/system-catalog-agent/` to `docs/records/artifacts/agent/copperknot/`
- updated repo indexes, operating docs, handoffs, reports, and HTML companions to point at Copperknot paths
- kept dated run/report filenames stable where the file purpose remained correct, instead of renaming historical artifacts just for cosmetic symmetry
- removed a low-value `.DS_Store` artifact from the Copperknot retained area
- validated the renamed surfaces with `npm -C frontend run docs:check`

Training result:

- Copperknot is now a clean first-class steward identity in both the canonical docs and retained artifact surfaces.

Next training focus:

- keep future run artifacts, handoffs, and operator briefs Copperknot-first by default
- avoid mixed identity drift between live docs, HTML companions, and retained reports
- wired the new metric logs into the SOP, operating package, health-metrics surface, indexes, and retained artifact layout

Training result:

- The Copperknot now has an explicit historical learning loop instead of relying only on current-state docs and narrative memory.

## 2026-05-16: Extended Learning Loop

Task: make the Copperknot’s retained learning system active enough to improve measurement quality over time.

Actions taken:

- expanded the learning framework to include weekly review, miss tracking, cycle-time tracking, confidence/stability hooks, and production-outcome backtesting
- created retained logs for weekly reviews, misses, lane cycle times, and production backtests
- extended the score-movement log with rating-state and confidence fields
- updated the health-metrics surface and SOP so these learning artifacts become part of the normal operating loop

Training result:

- The Copperknot now has a stronger self-learning layer that can measure not only what changed, but whether earlier judgments, priorities, and response times were actually good.

## 2026-05-16: Closeout Intake State Review

Task: review newly received external lane closeouts, reconcile them against live dispatch state, and decide whether to open more lanes or hold for rerating.

Actions taken:

- reviewed new closeouts for `Reference Grid`, `Edit workflow`, `Billing / credits`, and `Generation submission / polling`
- confirmed `Security boundaries` is still the only active ship-critical lane without a closeout
- created a dedicated closeout-intake review report and browser-friendly companion
- updated the dispatch log, queue snapshot, operating package, and operator brief so `closeout received` is treated as a distinct operating state
- generated browser-safe `.html` companions for the new closeout files so the in-app browser can open them directly

Training result:

- The Copperknot now distinguishes more cleanly between `running`, `closeout received`, and `reviewed complete`, which reduces premature lane expansion and keeps rerating batches easier to manage.

## 2026-05-16: Final Ship-Critical Closeout Receipt

Task: ingest the `Security boundaries` closeout and transition the current ship-critical batch from mixed execution state to rerating-ready state.

Actions taken:

- reviewed the new `Security boundaries` closeout
- moved `Security boundaries` from `running` to `closeout received / awaiting Copperknot review`
- updated the dispatch log, queue snapshot, operating package, closeout review, and operator brief to show that all five ship-critical lanes are now ready for consolidated rerating
- generated a browser-friendly `.html` companion for the new closeout so it can open in the in-app browser directly

Training result:

- The Copperknot now has a cleaner batch boundary: once all ship-critical closeouts are present, the default next action is rerating rather than dispatching more work.

## 2026-05-16: Consolidated Ship-Critical Rerating

Task: rerate the five-system ship-critical closeout batch from repo-backed evidence and decide the exact next lane order.

Actions taken:

- reran one focused validation suite spanning the five closeout seams and got `30` files / `338` tests passing
- held `Reference Grid` at `6/10` while increasing confidence and narrowing the next lane to runtime verification
- moved `Edit workflow` from `5/10` to `6/10`
- moved `Billing / credits`, `Security boundaries`, and `Generation submission / polling` to ship floor at `7/10`
- created a new narrow `Reference Grid runtime verification` handoff
- updated the catalog, scoreboard, queue, dispatch log, launch metrics, score-movement log, operator brief, and launch checklist to match the rerating outcome

Training result:

- The Copperknot now has a working pattern for batch rerating: validate the closeout group together, move only the systems that actually met their floor gates, and convert unresolved blockers into narrower follow-up lanes instead of reopening broad hardening by default.

## 2026-05-16: Memory And Catalog Prune Audit

Task: prune retained Copperknot context and launch-support docs so the tool stays focused on launch-readiness instead of accumulating duplicate or low-signal process weight.

Actions taken:

- reduced artifact-memory duplication and demoted it to sparse legacy-note status
- removed one speculative tooling need that was not clearly helping the current launch mission
- demoted older media-library planning reports from the default launch-reading path
- added routine load guidance so normal runs avoid full history and full metric-log loading
- corrected a noisy score-movement rule in `docs/systems/README.md`
- re-centered `system-score-criteria.md` on ship floor first and mature-state second
- added deadline-reassessment language so the Copperknot can recommend schedule movement honestly if the ship bar no longer supports the current target

Training result:

- The Copperknot is less likely to degrade its own execution quality through duplicate current-state memory, stale historical context, or idealized launch framing.

## 2026-05-16: Workspace Audit And Local Instructions

Task: audit the Copperknot workspace as a self-contained operating system and add any missing local instruction surfaces.

Actions taken:

- added local `AGENTS.md` files for the canonical operating folder and the retained artifact folder
- corrected stale artifact README language that still described the space as an initial setup area
- recorded a dated workspace audit confirming the current folder split is sufficient and does not need further structural expansion right now

Training result:

- The Copperknot workspace is now more self-contained and easier to operate cold, without adding unnecessary new process.

## 2026-05-16: Full Repo And Worktree Audit Refresh

Task: rerun the Copperknot audit against the full `production` repo plus current worktree state, then refresh the active window and dispatch-ready output.

Actions taken:

- moved the active target window from `2026-06-06` to `2026-07-02`
- created a new dated production-readiness plan and exact handoff queue for the July 2 window
- treated reviewed-complete recovery work as tracked follow-up instead of leaving it at the top of exact next-work order
- created new handoff packets for `Billing / credits`, `Security boundaries`, and `Generation submission / polling`
- folded new worktree and retained production evidence into the queue update:
  - Character continuity auth-bounce evidence from Beeper
  - shared media-panel runtime baseline evidence from Holomony
  - active AI Studio runtime and admin Pulse control-plane worktree diffs
- produced a dated dispatch-ready worklist report from the full repo-plus-worktree pass

Training result:

- The Copperknot now has a stronger pattern for full repo-and-worktree audits: launch docs update first, actionable queue second, score conservatism third.

## 2026-05-16: SOP And Historical Window Trim

Task: trim Copperknot process drift after the full repo-and-worktree audit so older window files and weak evidence patterns stop competing with current launch truth.

Actions taken:

- tightened the SOP with explicit full repo-plus-worktree audit rules
- added evidence-quality weighting so production durable, repo durable, local follow-up, and incomplete artifacts are treated differently
- added a pruning rule to demote superseded plans and queues instead of letting them read like live authority
- marked the old June 6 plan and queue as superseded
- removed a stale open follow-up about weekly scorecards now that the standing metrics layer already exists

Training result:

- The Copperknot should now spend less time fighting its own stale artifacts and more time making current launch decisions.

## 2026-05-16: Operator Brief Requirement

Task: add a standing ADHD-friendly operator summary requirement so the user can see the current handoff set and next action at a glance after each meaningful run.

Actions taken:

- created a reusable operator-brief template
- wired the operator-brief requirement into the contract, SOP, operating package, AGENTS load guidance, memory, and reports index
- created the first operator brief for the latest full repo-and-worktree audit

Training result:

- The Copperknot should now close runs with a clearer user-facing action summary instead of relying on the full audit packet alone.
- clarified that operator briefs must always ship as both Markdown source and companion HTML render
- added a direct rendered-view pointer to the 2026-05-16 operator brief after the user opened the raw Markdown source view
- locked the user's preference into Copperknot memory and scoped instructions: always create and surface the rich-format operator brief by default
- tightened the artifact contract so the HTML brief is the actual operator brief and the Markdown file is explicitly source-only

## 2026-05-16: Handoff Endgame Hardening

Task: reduce the need for the user to repeatedly prompt execution agents with follow-up audit/fix language after a lane appears complete.

Actions taken:

- strengthened the reusable handoff template with a mandatory endgame section
- updated the SOP so all future handoffs require validation, self-audit, and in-scope follow-on cleanup before stop
- expanded the external closeout template to require self-audit findings and explicit out-of-scope leftovers
- patched the currently running handoffs so they inherit the stronger finish contract immediately

Training result:

- The Copperknot should now expect execution agents to stop later and with better closeouts, reducing the need for repeated `continue to audit` and `fix all issues` prompts from the user.

## 2026-05-16: Send To Catalog Phrase Mapping

Task: make the user phrase `send this to the catalog` operationally reliable for execution agents.

Actions taken:

- added a reusable `Send To Catalog` section to the handoff template
- added the same section to the active handoff library and the recovery handoff
- updated the closeout template and handoff README so the phrase resolves to one concrete closeout workflow

Training result:

- The user should now be able to use `send this to the catalog` as shorthand for writing the required closeout report and reporting the final lane status back cleanly.

## 2026-05-16: Managed Lane Review And Reference Grid Clear

Task: review the managed subagent closeouts, rerun the blocked Reference Grid verification lane with canonical local audit credentials, and propagate the resulting launch-state changes.

Actions taken:

- stored the Playwright audit credentials only in the canonical local env surface and recorded the rule to avoid copying raw secrets into repo-visible Copperknot docs
- reran `reference-grid-styles-runtime-verification` after credentials existed and captured fresh protected-route browser evidence
- moved `Reference Grid` from `6/10` to `7/10`, cleared `KI-AI-RG-STYLES-001`, and retired the blocker from the operator brief
- held `Project / workspace persistence` and `Edit workflow` at `6/10` after confirming both bounded follow-up patches were real but not yet broad enough to lift the full systems
- shifted the exact next-work queue and operator brief to `Characters workflow` and `Elements workflow`

Training result:

- Copperknot now has a working pattern for managed subagent reruns: unblock the lane with local runtime prerequisites, separate product-path validation from tooling-path drift, and keep held-score follow-ups out of the user-facing action brief.
