# Bopper Training History

Purpose: record supervised Bopper runs, lessons, SOP updates, tool changes, remaining friction, and next training focus.

## 2026-05-15: Agent Setup

Task: establish Bopper as the ShortPulse average-user tester.

Actions taken:

- Created Bopper's contract, memory, SOP, retained artifact area, workspace folder, and training metrics.
- Carried over the durable training structure used for Beeper.
- Wrote the formal handoff from Beeper so Bopper starts with explicit role boundaries and expectations.

Training result:

- Bopper is initialized at `Level 1: Supervised`.
- Bopper has a durable contract, SOP, KPI, score system, report area, and workspace.

Next training focus:

- run the first real `run average test`
- refine first-click, confusion, and abandonment patterns from live product evidence

## 2026-05-15: First Real Average Test

Task: run a supervised naive-user pass on the signed-in dashboard and follow the most obvious entry path.

Actions taken:

- Entered the local signed-in dashboard at `http://localhost:3000/`.
- Clicked the primary `New Project` CTA and accepted the default `Untitled project` name.
- Followed the natural create flow into `/ai-studio?projectId=...`.
- Captured the resulting `Project unavailable` / `Project not found.` dead end and the contradictory recovery state where `Open projects` still listed the newly created project.
- Added a Bopper run packet, detailed report, checkpoint summary, retained report, coverage updates, and a D-Bug handoff.
- Added `bopper/scripts/start-average-run.mjs` so future Bopper runs can scaffold their own packet and report shells consistently.

Training result:

- Bopper completed its first real supervised run and produced a high-value trust-break finding.
- The strongest reusable lesson is that contradictory create/open states should be preserved as a user-trust issue before deeper debugging starts.

Next training focus:

- retest the dashboard `New Project` path after the route bug is fixed
- compare `Open Projects` as the first-click path against `New Project`
- expand into auth -> dashboard and first healthy AI Studio entry once the create/open lane is stable

## 2026-05-15: Standalone Package Hardening

Task: upgrade Bopper from a light scaffold into a full standalone average-user operating package.

Actions taken:

- Expanded the contract, memory, SOP, and handoff package.
- Upgraded the run score and campaign score systems to match Beeper's training rigor.
- Added durable retest debt, tools, and SOP-notes surfaces.
- Strengthened the report template and trainer directives so Bopper can be trained comparably to Beeper.

Training result:

- Bopper now has the same training-metrics shape as Beeper.
- The remaining gap is live route evidence, not operating structure.

Next training focus:

- retest dashboard `New Project` after the local dead-end bug is fixed
- calibrate believable abandonment behavior from production evidence

## 2026-05-15: Dual-Use Training Objective Formalized

Task: make Bopper's run data useful both for better design decisions and for teaching other agents how to create new test personas.

Actions taken:

- Formalized the dual-use objective inside `bopper/TRAINING-SYSTEM.md`.
- Added `docs/records/artifacts/agent/bopper/persona-design-lessons.md` as the durable cross-agent teaching artifact.
- Updated the Bopper contract, memory, SOP, and retained-artifact index so persona-learning lessons become part of the standard workflow.

Training result:

- Bopper's data model now explicitly supports two loops:
  - improving Bopper as a faithful ICP over time
  - transferring persona-construction lessons to future testing agents

Next training focus:

- use the next 3 to 5 real Bopper runs to validate whether the new persona-design-lessons file captures genuinely reusable patterns

## 2026-05-15: Packet Self-Containment Hardening

Task: audit Bopper's workspace for remaining training-system gaps and reduce dependence on chat context.

Actions taken:

- Added structured `packet.json` scaffolding to every new Bopper run packet.
- Added `evidence/README.md` scaffolding so screenshot and runtime captures have an explicit manifest.
- Updated the training system, SOP, run-folder docs, scripts docs, and agent index to make the packet shape more discoverable.
- Corrected stale retained-artifact references and KPI language that no longer matched Bopper's real state.

Training result:

- Future Bopper runs can now be more self-contained and easier for other agents to parse.
- The main remaining weakness is not packet shape; it is lack of enough live route evidence across the app.

Next training focus:

- use the next real Bopper run to verify the new packet structure improves retained evidence quality
- expand beyond the dashboard lane so the persona is trained on more than one route family

## 2026-05-15: Workspace-Local Instruction And Memory Save

Task: ensure Bopper's own folder contains explicit saved instructions and memory, not just pointers into shared repo docs.

Actions taken:

- Added `bopper/AGENT-INSTRUCTIONS.md` as the workspace-local instruction entrypoint.
- Added `bopper/MEMORY.md` as the workspace-local memory entrypoint.
- Updated `bopper/README.md` so both files are part of the normal folder map.

Training result:

- Bopper can now reload from his own workspace folder more directly.
- The shared canonical contract and repo-visible memory still remain authoritative, but the local folder is now self-describing.

Next training focus:

- keep the workspace-local files aligned with the canonical contract and memory as Bopper evolves

## 2026-05-15: Trigger Phrase Update

Task: make `run test` the primary Bopper trigger phrase while keeping older phrases valid.

Actions taken:

- Updated the canonical contract, memory, SOP, trainer directives, and workspace-local files.
- Kept `run average test` and `run Bopper` as accepted aliases so older instructions still work.

Training result:

- Bopper now has one shorter primary trigger phrase that is easier to use in practice.

Next training focus:

- use `run test` as the default trigger in future live runs

## 2026-05-15: ADHD Summary Tightening

Task: make every checkpoint summary a short ADHD-friendly digest of the full Bopper reports.

Actions taken:

- Tightened `bopper/checkpoint-summaries/README.md` with a fixed skim format.
- Updated the Bopper SOP and training system so summaries explicitly digest the packet, detailed report, and retained report.
- Updated the run scaffold so new summaries always prompt for `Lane`, `Confused`, `ICP takeaway`, and `Handoff`.
- Saved the directive in the trainer directives log.

Training result:

- Future checkpoint summaries should be faster to read and less likely to omit the actual customer takeaway.

Next training focus:

- keep future summaries blunt and short enough that the trainer can scan them without opening the full reports first

## 2026-05-15: Local Instruction Sync For ADHD Summaries

Task: write the ADHD-friendly checkpoint-summary rule into Bopper's own local instruction files.

Actions taken:

- Updated `bopper/AGENT-INSTRUCTIONS.md`.
- Updated `bopper/MEMORY.md`.

Training result:

- The summary requirement now lives in Bopper's local reload surfaces, not just the broader SOP and training docs.

Next training focus:

- keep local instruction files aligned whenever checkpoint-summary rules evolve

## 2026-05-15: Public Entry Expectation Lane

Task: run Bopper from the visible public dashboard and follow the most obvious route a returning paid user would trust.

Actions taken:

- Started from the public dashboard because the app state was unauthenticated rather than signed-in.
- Clicked `New Project`, which visually promises `Open the AI Studio`.
- Observed a pricing detour at `/pricing?intent=create-project` instead of a direct move toward creation or workspace entry.
- Followed `Log in` because the persona already believes he pays for `Studio`.
- Reached the auth gate and stopped there because no saved paid test identity was available in this browser session.
- Saved the lane as a structured packet with self-contained evidence files.

Training result:

- Bopper now has evidence for a second distinct `New Project` trust pattern:
  - signed-in `New Project` can fail after creation
  - public `New Project` can behave like pricing instead of work entry
- The auth screen itself reads clearly, but the public-entry intent remains muddy for a returning paid user.

Next training focus:

- complete the same public-entry auth -> dashboard path with a saved paid identity
- compare whether public `New Project` wording should change if pricing is the intended destination

## 2026-05-15: Workspace Consolidation And Trigger Correction

Task: reduce Bopper workspace drift and correct the trigger split between Beeper and Bopper.

Actions taken:

- Promoted `bopper/HANDOFF.md` into the single workspace command-center file.
- Removed redundant workspace-local instruction and memory overlays that mostly duplicated canonical docs.
- Corrected Bopper's canonical trigger surfaces so `run average test` is primary and `run test` stays with Beeper unless explicitly redirected.

Training result:

- Bopper is less drift-prone because there are fewer overlapping instruction surfaces.
- The Beeper/Bopper trigger split is now clearer across workspace and retained docs.

Next training focus:

- keep the workspace lean and avoid recreating local files that only duplicate canonical instructions
- continue expanding route breadth with the cleaned command-center setup

## 2026-05-15: Segregation Hardening And Local Reload Restore

Task: audit Bopper's space for Beeper drift, restore missing local reload files, and harden Bopper's operational segregation.

Actions taken:

- Restored `bopper/AGENT-INSTRUCTIONS.md` and `bopper/MEMORY.md` as thin workspace-local reload files.
- Corrected the active trigger across Bopper's live surfaces so `run test` is primary and older phrases remain aliases.
- Removed active instructions that routed `run test` or live Bopper work back through Beeper.
- Clarified that historical Beeper handoff files remain archival context rather than daily operating truth.

Training result:

- Bopper now has a cleaner operational boundary and less trigger ambiguity.
- The remaining Beeper mentions are intentional historical or comparison references, not live control surfaces.

Next training focus:

- keep local reload files thin and in sync with the canonical Bopper contract
- expand route breadth so the cleaner operating boundary is exercised under more real runs

## 2026-05-15: Dashboard Create-Path Debt Retired

Task: rerun the signed-in dashboard `New Project` lane and verify whether the old create-path contradiction is actually gone.

Actions taken:

- Corrected stale browser/session reopen state and returned to a real signed-in dashboard at `/dashboard`.
- Verified the adjacent compare path `Open Projects` -> `New Project` -> `Create`.
- Verified the direct dashboard `New Project` -> `Create` path separately.
- Confirmed that both variants now land in usable AI Studio instead of a `Project unavailable` dead end.
- Updated the route-success map, coverage log, retest debt, checkpoint summary, retained report, and score ledgers.
- Recorded the paid-persona fidelity caveat that the visible account entitlement still reads `Default access` instead of `Studio`.

Training result:

- Bopper has now validated one real signed-in dashboard success path and one real natural AI Studio entry.
- The earlier create-path trust break has been retired as active retest debt.

Next training focus:

- broaden into `Open Projects` as a deliberate first-choice lane
- complete the auth -> dashboard path with a visibly paid `Studio` identity
- keep recording entitlement mismatches whenever paid-plan persona truth is only partial
