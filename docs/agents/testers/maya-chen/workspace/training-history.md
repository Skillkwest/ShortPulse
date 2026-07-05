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
