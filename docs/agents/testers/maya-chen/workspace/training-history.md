# Maya Chen Training History

Purpose: preserve supervised training changes that improve Maya's future testing behavior.

Do not use this file as a full report archive. Reports belong in `docs/agents/testers/maya-chen/reports/`. This file records behavior changes, SOP updates, tool changes, remaining friction, and the next training focus.

## 2026-07-04: Runtime Persona Hardening

Prompt or user direction:

- Make any updates needed so future tests are performed as Maya's persona.

Behavior learned:

- Maya needs a compact runtime persona card loaded immediately before browser work, because long SOPs can be remembered as process instead of embodied as customer behavior.
- Strong future runs need first-person Maya notes during clicking, not only a Maya voice in the final report.
- Persona fidelity means preserving Maya's limited workflow comprehension, credit caution, question-first posture, and harsh-review threshold when trust breaks.

SOP or template updates:

- Added `workspace/persona-runtime-card.md`.
- Wired the runtime card into workspace load order, the run checklist, and the authenticated testing SOP.
- Added explicit live-note shape for Maya's in-run observations.

Tool changes:

- The run checklist now requires reading the runtime persona card and adding first-person Maya notes before major actions.

Remaining friction:

- Future test runs still need active discipline to avoid turning Maya into a coverage-focused QA operator.
- Browser-control constraints may still make visible Chrome operation slower than normal human testing.

Next training focus:

- In the next supervised run, score persona fidelity strictly and look for at least three real first-person Maya notes before any generation or credit spend.

## 2026-07-04: Run Tooling Expansion

Prompt or user direction:

- Create any tools needed and save them in Maya's folder.

Behavior learned:

- Maya needs practical working sheets during the run, not only final report templates.
- Credit discipline, persona fidelity, report assembly, and Admin publishing each need their own small checklist so the run does not depend on memory.

Tools added:

- `tools/live-session-notes-template.md`
- `tools/credit-budget-worksheet.md`
- `tools/persona-fidelity-rubric.md`
- `tools/report-assembly-checklist.md`
- `tools/admin-publish-checklist.md`
- `tools/run-folder-structure.md`
- `tools/maya-prompt-bank.md`

SOP or template updates:

- Wired the new tools into `tools/README.md`, `tools/maya-run-checklist.md`, `workspace/AGENTS.md`, and `workspace/README.md`.

Remaining friction:

- Future live runs still need a controllable Chrome browser and enough uninterrupted time to use the working sheets without turning the session into paperwork.

Next training focus:

- Use the live notes template and credit worksheet during the next browser run, then check whether they improve persona fidelity and behavior metrics quality.

## 2026-07-04: Run Contract And Recovery Hardening

Prompt or user direction:

- Utilize the identified instruction gaps and update Maya's workspace, instructions, memory, and tools as needed.

Behavior learned:

- Maya persona should be reserved for actual tester runs and Maya-authored reports; normal repo coordination should stay in Codex voice.
- The browser/tool boundary needs to be explicit: live customer testing uses visible Chrome behavior, while repo commands are allowed for setup and post-run reporting.
- A test run needs a hard definition of done so the browser portion, reports, ledgers, Admin publishing, and self-scoring do not get separated.
- Payment, billing, account, browser-control, and generation interruptions need a shared stop/resume checklist.
- Engineering handoffs need stable severity labels separate from Maya's emotional customer language.

SOP or template updates:

- Added run contract, tool boundary, payment/billing gates, session recovery rules, severity rubric, and Admin verification rules to `authenticated-testing-and-reporting-sop.md`.
- Added chat persona boundary and live-test tooling boundary to `standard-operating-procedure.md`.
- Added completion contract to `workspace/AGENTS.md`.

Tool changes:

- Added `tools/severity-and-escalation-rubric.md`.
- Added `tools/stop-resume-and-recovery-rules.md`.
- Updated the run checklist, Admin publish checklist, report assembly checklist, post-run self-audit/performance check, and self-score ledger.

Remaining friction:

- Admin Tester Reports publishing still depends on the ingest secret and admin verification access being available during the run.
- Real Chrome control remains required; if unavailable, the run must stop instead of falling back to the in-app browser.

Next training focus:

- On the next `run test`, verify the full definition of done end to end, especially Admin report verification and stop/resume discipline.

## 2026-07-04: UGC Goal And Human Error Modeling

Prompt or user direction:

- Build in the human nuances Maya needs while testing and create a UGC AI content goal related to her persona and work.

Behavior learned:

- Maya needs a durable creator project so test runs have continuity and purpose.
- Maya should behave like a real human working toward that project, including realistic mistakes, hesitation, imperfect prompts, and backtracking.
- Human error should be goal-driven and plausible, not random sabotage.

SOP or template updates:

- Added `workspace/ugc-content-goal.md` for the `Tiny Apartment Reset Kit` project.
- Updated the ICP, runtime persona card, scenario backlog, prompt bank, run checklist, live notes template, workspace load order, memory, and README indexes.

Tool changes:

- The run checklist now asks for the UGC project goal, project progress ladder step, and realistic human mistakes expected during the run.
- The live notes template now tracks project-goal context and human error/backtrack notes.

Remaining friction:

- Future runs must intentionally preserve human imperfection without becoming random or careless.

Next training focus:

- In the next browser run, pursue one small `Tiny Apartment Reset Kit` step and record at least one realistic human misunderstanding or backtrack if it naturally occurs.

## 2026-07-04: SOP Optimization Audit

Prompt or user direction:

- Audit all Maya SOPs and update them so testing runs perform optimally.

Audit findings:

- The detailed authenticated SOP was complete but too long to be the live operating surface during browser work.
- The report templates lagged behind the current UGC project, human-realism, severity, run-status, and Admin verification rules.
- The self-audit did not yet force next-run corrections for weak human realism.
- The run checklist needed the UGC goal in its required-doc load list.

SOP or template updates:

- Added `tools/run-control-panel.md` as the compact live-run control surface for scenario, timebox, status, Admin publish availability, and final gate.
- Linked the control panel from `authenticated-testing-and-reporting-sop.md`, `workspace/AGENTS.md`, `workspace/README.md`, and `tools/README.md`.
- Updated report templates with UGC project goal, run status, human realism notes, current severity labels, Admin tab verification, and expanded self-audit summary.
- Updated self-audit and persona rubric rules so weak human realism requires a specific correction.

Remaining friction:

- Admin Tester Reports publishing still depends on an ingest secret and admin verification access during the run.
- The next live test should verify whether the compact control panel is enough to keep the run human and timely.

Next training focus:

- Use the run control panel during the next `run test` and score whether it improves SOP order fidelity without making Maya too mechanical.

## 2026-07-04: Performance Check Hard Gate

Prompt or user direction:

- Make Maya's self-scoring and performance checks explicit after every run.

Behavior learned:

- Maya is part of the testing system being tested.
- A browser run can create useful product findings while still failing as a Maya run if persona fidelity, human realism, credit discipline, reporting, or stop/resume discipline are weak.

SOP or template updates:

- Updated the authenticated testing SOP, run control panel, run checklist, and post-run self-audit template so a run is not complete until the self-audit/performance check and self-score ledger row are complete.
- Required specific next-run corrections for applicable scores below `7`.
- Required repeated weak scores to become durable updates in memory, training history, or the relevant SOP/tool.

Remaining friction:

- The next live test should prove the scoring loop is useful without making Maya overly mechanical.

Next training focus:

- After the next `run test`, compare Maya's self-score against the actual report quality and browser behavior, then adjust the rubric only if the scores fail to predict usefulness.

## 2026-07-04: Human Nuance Hardening

Prompt or user direction:

- Make Maya's persona more empowering so she can act as a real human with nuance during tests.

Behavior learned:

- Maya needs more than politeness, caution, and frustration thresholds.
- Strong Maya runs should show agency, taste, social stakes, pride, embarrassment, temptation, and trust shifts while she works toward `Tiny Apartment Reset Kit`.
- Human nuance should affect visible choices and report interpretation without turning into random or theatrical behavior.

SOP or template updates:

- Added `workspace/human-nuance-card.md`.
- Added the human nuance card to Maya's required load order.
- Updated run checklist, live notes, runtime card, persona rubric, run control panel, report templates, self-audit template, workspace memory, and the ICP to preserve taste, social stakes, contradictions, and empowered customer judgment.

Remaining friction:

- The next live browser run needs to prove the nuance card makes Maya more human without making the run slower or overly scripted.

Next training focus:

- During the next `run test`, capture at least one live taste/social-stakes/trust-shift note and score whether it improved Maya's usefulness as a realistic tester.

## 2026-07-05: Performance Improvement Intake

Prompt or user direction:

- Take in all the supervised feedback and improve Maya as a tester.

Behavior learned:

- Maya needs a frozen performance baseline so later ratings can be compared against a stable historical snapshot.
- Maya needs an active short scenario queue so she does one realistic customer goal at a time.
- Maya should use live notes as the default evidence layer and keep screenshots only when they diagnose issues, show confusion, or prove important states.
- Maya should explicitly ask where she stopped behaving like a real customer and started behaving like a tester.

SOP or template updates:

- Added `workspace/baseline-kpi-2026-07-05.md`.
- Added `workspace/active-next-scenarios.md`.
- Updated workspace instructions, run checklist, run control panel, live session notes, post-run self-audit, self-score ledger, and memory.

Remaining friction:

- Admin Tester Reports publishing still depends on the ingest secret and admin verification access.
- Future runs must prove the new baseline and scenario queue improve flow instead of adding overhead.

Next training focus:

- On the next `run test`, use the active scenario queue for prompt/detail recovery, keep screenshots sparse, and answer the post-run coach question before scoring the run complete.

## 2026-07-05: Agent Tester Reports Publish Correction

Prompt or user direction:

- Ensure Maya's local reports are also added to the Agent Tester Reports tab in the admin page after each run.

Behavior learned:

- The admin page label is `Agent Tester Reports`, and the route is `/admin/tester-reports`.
- Local Markdown reports remain durable files, but the same persona and engineering report bodies must be ingested so the operator can view both reports in the admin UI.

SOP or template updates:

- Clarified Maya's publish SOP and checklist to name the Agent Tester Reports tab.
- Updated the July 5 run reports and index after delayed publish.

Remaining friction:

- Future runs still need the canonical ingest secret available or a clearly recorded publish blocker.

Next training focus:

- After the next run, publish before final closeout and verify both report cards are visible in Agent Tester Reports.

## 2026-07-05: Second Image Variant Run

Prompt or user direction:

- Run a test.

Behavior learned:

- Maya can spend credits in a controlled way when the cost is visible and the run has a strict one-generation boundary.
- Prompt recovery cannot be trusted from one successful prior run; future Maya testing should re-check visible saved-work affordances after every paid generation.
- Browser-control or clipboard failures should not become the customer's evidence. Maya should fall back to visible product state and report only what a customer could see.

SOP or template updates:

- No SOP structural change needed. The existing one-scenario queue, credit ledger, live notes, reports, and self-score ledger were sufficient.

Remaining friction:

- Media Detail prompt display may be inconsistent or blank after restore/generation.
- The live run was shorter than the 45-minute target because the scenario had a clear one-generation stop condition. Future broader scenarios should use more of the 45-minute session budget.

Next training focus:

- In the next run, verify both assets are still findable and distinguishable without spending credits, and keep the session customer-like without overusing screenshots.

## 2026-07-06: Find Both Assets Later Run

Prompt or user direction:

- Run test.

Behavior learned:

- Maya can now complete a no-spend return workflow and stay focused on saved-work trust instead of drifting into generation.
- The current short scenario queue worked as intended: it advanced Maya one customer goal at a time across prompt recovery, second image creation, and later saved-asset verification.
- Repeated prompt-recovery findings should not be re-proved indefinitely unless product behavior changes, a deploy is suspected, or the user asks for a regression check.

SOP or template updates:

- No structural SOP change needed. The scenario queue was marked complete and future unspecific runs should choose from the backlog or user direction.

Remaining friction:

- Prompt/detail reuse remains the dominant customer trust blocker for Maya's current project.
- Screenshots were still somewhat numerous, but each kept image tied to saved-work proof, prompt-blank proof, or project recovery proof.

Next training focus:

- For the next unspecific run, choose a no-spend scenario from the backlog unless the user explicitly authorizes another generation or asks for a prompt-recovery regression check.

## 2026-07-06: Report Intelligence Hardening

Prompt or user direction:

- Audit whether Maya's reports are detailed, informative, correct, customer-service useful, product-decision useful, and actionable for other Codex agents; then make all needed workspace improvements.

Behavior learned:

- Maya reports should not only describe what happened. They should help the user anticipate real customer concerns, support tickets, harsh reviews, retention risk, credit-spend anxiety, and customer journey drop-off points.
- Engineering handoffs should not only name findings. They should give the next Codex agent a practical fix packet: issue tags, repeat-finding context, likely owner/source boundary when known, acceptance criteria, validation steps, protected behavior, and stop/escalation conditions.
- Repeated issues should be marked as repeated product patterns rather than rediscovered as new findings every run.

SOP or template updates:

- Added `tools/report-intelligence-template.md`.
- Updated report assembly, behavior metrics, severity mapping, live notes, self-audit, workspace instructions, authenticated testing SOP, memory, and self-score rules.
- Added a report-usefulness cap when required customer-service or engineering-fix sections are missing without explanation.

Remaining friction:

- Existing already-published reports may not contain every new section unless explicitly revised and republished.
- Future runs need to keep the new sections concise so reports become sharper, not bloated.

Next training focus:

- In the next Maya run, use the report intelligence template before Admin publishing and verify the resulting reports are stronger for product decisions, customer service preparation, and engineering handoff.

## 2026-07-06: Credits And Renewal Confidence Run

Prompt or user direction:

- Run test.

Behavior learned:

- Maya can run a no-spend billing/credit confidence check while avoiding all subscription, top-up, cancellation, and billing-portal mutations.
- The upgraded report intelligence sections improved the report shape: customer-service simulation, product-decision signal, issue tags, and an agent fix packet were created before Admin publishing.
- Sensitive account/billing screenshots should be discarded even when they helped Maya observe a surface; notes can preserve the non-secret customer interpretation.

SOP or template updates:

- No structural update needed after this run. The report intelligence template worked as intended.

Remaining friction:

- Credit usage history is not customer-visible enough for Maya to reconcile generation debits.
- Future billing/credit checks should be careful not to turn into admin/billing-engineering audits unless the user explicitly asks for issue solving.

Next training focus:

- On the next Maya run, continue using the report intelligence template and keep evidence minimal when account or billing surfaces are involved.

## 2026-07-07: Supervised Feedback Inference Intake

Prompt or user direction:

- "Update everything you need to in order to continue to learn and grow over time."
- "Glean insights from all the interactions we've had in the chat."
- "Infer why I am making correction or asking you questions and utilize inferences as training data in your training logs."

Inferred intent:

- The user is training Maya as an operational tester, not just correcting isolated mistakes.
- The user's questions about ratings, report usefulness, screenshot discipline, Admin publishing, and missing tools are meant to create a feedback loop that improves future runs.
- The desired system is a real working tester: human-like during browser use, honest during self-review, concise but actionable in reports, and durable in workspace memory.

Behavior learned:

- Maya should treat performance questions and corrections as supervised training signals.
- Maya should infer the likely reason behind a correction, name the risk if ignored, and convert it into a small durable behavior change when appropriate.
- Maya should not overfit a single correction into a broad rewrite; the right default is the smallest useful update.
- Maya should keep customer-visible testing human and browser-based while improving setup, report assembly, scoring, validation, and publishing through supporting tools.

SOP, memory, or tool updates:

- Added `workspace/supervised-feedback-inference-log.md`.
- Added `workspace/tools/post-run-learning-intake.md`.
- Updated `workspace/AGENTS.md`, `workspace/README.md`, `tools/README.md`, `tools/post-run-self-audit-template.md`, and `tools/report-assembly-checklist.md`.
- Updated `workspace/memory.md` with the supervised-feedback intake rule.

Remaining friction:

- Admin publishing and report quality checks are still too manual and should become scripts when the next tooling lane is approved.
- Maya's self-scores are useful but should be discounted when session duration, metric precision, or operational drag weakens the run.
- Maya reports should preserve more raw customer texture without losing actionability.

Next training focus:

- On the next `run test`, use the learning intake only if a correction/performance prompt appears, and prove the new loop works by naming the exact behavior change carried forward from the previous run.

## 2026-07-07: Clear Bug Escalation Override

Prompt or user direction:

- "you need to be able to see when things are clearly broken and if you are experiencing bugs."
- "if this happens you can brek the maya persona and fully report on the bug findings"

Inferred intent:

- The user wants Maya to remain a realistic customer during normal testing, but not at the cost of hiding objective product breakage.
- Clear bugs should become actionable product and engineering findings, not just soft customer uncertainty.
- Breaking persona is appropriate when it makes the bug evidence more accurate and useful.

Behavior learned:

- Maya should first preserve the customer-impact note, then mark `BUG OVERRIDE` and switch into Codex bug-reporting mode.
- Crashes, freezes, blank pages, visible errors, stuck generation, missing output, billing/credit mismatch, saved-work loss, wrong-account data, broken controls, and unsafe mutations are objective bug candidates.
- Further spend or mutation should stop when the bug touches credits, billing, auth, saved work, generation reliability, destructive controls, privacy, or account boundaries.

SOP, memory, or tool updates:

- Updated `standard-operating-procedure.md` with the clear bug escalation override.
- Updated `authenticated-testing-and-reporting-sop.md` with the clear bug escalation duty.
- Added `tools/clear-bug-escalation-checklist.md`.
- Updated workspace instructions, memory, tool index, report assembly checklist, self-audit template, and supervised feedback inference log.

Remaining friction:

- Future runs need discipline to avoid both extremes: over-softening clear bugs as Maya confusion or overusing bug mode for ordinary UX ambiguity.

Next training focus:

- On the next run, use normal Maya persona for customer exploration, but if objective breakage appears, create a `BUG OVERRIDE` packet and let the self-audit score bug recognition.

## 2026-07-10: Admin Publishing Completion Gate

### Supervised prompt

The user asked Maya to ensure every future report is added correctly to the Admin Tester Reports panel and to make that behavior durable in the SOP and agent instructions.

### Behavior learned

- Local report completion is not the same as completed tester-run delivery.
- Admin readiness must be checked before Chrome so a run does not knowingly create another unpublished report.
- A normal run is complete after authenticated ingest accepts both report bodies and returns the expected `externalRunId` plus a non-null row id. Maya never accesses Admin.
- Missing credentials require a pre-run stop unless the user explicitly authorizes a local-only partial run.
- Older unpublished Maya reports must be backfilled oldest first before starting a new scenario when access returns.

### SOP and tool updates

- Hardened `authenticated-testing-and-reporting-sop.md` and `standard-operating-procedure.md` with a fail-closed Admin publish readiness gate.
- Updated workspace `AGENTS.md`, run control, run checklist, Admin publish checklist, self-audit scoring, and memory.
- Corrected the 2026-07-10 Quick Slot run from `completed` to `partial` and replaced the `n/a` Admin score with an evidence-based failure score.

### Remaining friction

- None for Maya report delivery. Owner/operator review of Admin remains a separate workflow.

### Next training focus

- On the next `run test`, preflight ingest access only, keep Maya on regular-user surfaces, and publish through the authenticated ingest route after the customer run.

## 2026-07-11: Full-Width Chrome Viewport Correction

### Supervised prompt

The user explained that the prior Styles run used a Chrome window at roughly 75% size and therefore hid the right rail where the Styles interface opens.

### Behavior learned

- Opening a fresh Chrome window does not prove a valid desktop test surface.
- Chrome must be maximized to full available width and height, with the complete ShortPulse shell and expected right rail represented.
- Missing-panel bug escalation requires a second geometry preflight and one visible retry.
- A clipped target is invalid bug evidence and must not be published as objective product breakage.

### SOP and tool updates

- Hardened the authenticated SOP, compact SOP, run checklist, run control panel, live-notes template, clear-bug checklist, and workspace memory.
- Corrected the Styles run's false broken-control conclusion while retaining the separately observed customer-copy concern.

### Next training focus

- Start the next Maya run by explicitly recording `maximized/full-width: yes` and verifying the right rail before the first product action.
