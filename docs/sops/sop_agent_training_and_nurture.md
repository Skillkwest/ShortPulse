# Agent Training And Nurture SOP

Purpose: provide a repeatable process for creating, training, evaluating, and improving a task-specific agent for any durable workflow.

## Scope

Use this SOP when creating a new agent that should repeatedly perform a real task, such as incident triage, QA review, content operations, support workflows, research, data cleanup, or implementation handoffs.

This SOP is task-agnostic. It was generalized from the Ophestivus training history, where a repo-working admin incident agent was trained through real work, board state, evidence checks, reporting, and post-run reflection.

## Core Principle

Do not start by writing a perfect automation. Start with one real task, supervise the agent, challenge its evidence, then convert the successful behavior into SOPs, templates, and tools.

The loop is:

1. Give the agent a concrete identity and bounded job.
2. Make it perform one real unit of work.
3. Inspect whether the work was actually done.
4. Turn the successful process into a repeatable workflow.
5. Add tools only when repeated friction proves they are useful.
6. Keep improving through post-run training audits.

## Prerequisites

- A clear task queue, work surface, board, inbox, dataset, issue list, or operational page.
- A known owner who can approve scope, blockers, and final promotion.
- A place for local training artifacts, such as `docs/records/artifacts/agent/<agent-name>/`.
- A canonical SOP location for durable process docs, such as `docs/sops/`.
- Clear authority limits for what the agent can and cannot change.

## Phase 1: Define The Agent

Create a short agent contract before training begins.

Required fields:

- Agent name.
- Primary job.
- First task surface.
- Authority boundaries.
- Escalation rules.
- Memory/report location.
- Definition of done.

Winning prompt pattern:

```text
From now on, you are "<agent name>". Your job is to help with <task domain>.
Speak in first person as <agent name> when discussing your work, blockers, evidence, and needs.
You must still follow all system, developer, repo, security, privacy, branch, and operational rules.
```

Follow-up prompt:

```text
Before you start, tell me your guardrails, what you are allowed to do, what you are not allowed to do, and when you should ask for human help.
```

## Phase 2: Create Local Training Memory

Give the agent a stable place to record non-authoritative training notes and run artifacts.

Recommended artifact layout:

```text
docs/records/artifacts/agent/<agent-name>/
  README.md
  memory.md
  sops.md
  tools.md
  training-history.md
  reports/
```

Rules:

- Local memory supports the workflow but does not override canonical SOPs, ADRs, product docs, or repo rules.
- Full reports belong in the artifact area.
- Work records, queue items, board cards, comments, or source-system notes should contain compact summaries and links to reports.
- Keep secrets, private user data, and service-role credentials out of training artifacts.

Winning prompt pattern:

```text
Set up your local memory and artifact area for this workflow.
Use it for training notes, reports, helper inventory, and lessons learned.
Do not treat local memory as higher authority than repo rules or canonical SOPs.
```

## Phase 3: Train On One Real Task

Pick one real work item. Do not use a synthetic example unless no live task exists.

Training flow:

1. Have the agent inspect the task source.
2. Have it create or claim one work item.
3. Move that item into the active state before work begins.
4. Have it investigate with backing evidence.
5. Let it attempt the smallest safe fix or completion path.
6. Require validation before promotion.
7. Require a short report.
8. Move unresolved work back to the intake state with a human handoff.

Winning prompt pattern:

```text
I want to start training you on your task.
Open <task surface> and pick the first/highest-priority <work item>.
Create or claim the appropriate work record for it, move it into the active work state if this workflow uses states, inspect it, and tell me your plan before making changes.
```

If browser interaction is not required:

```text
You can use code, APIs, database queries, or local tooling when that is faster and safer than using the browser.
```

## Phase 4: Challenge Whether The Work Is Actually Done

The most important training move is to separate state movement from real completion.

Ask:

```text
Was the issue actually resolved, or did you just move it forward?
```

The agent must answer with evidence:

- What changed.
- What validation ran.
- What recurrence/status check passed.
- What remains risky.
- What was not verified.
- Whether human review is still required.

Completion gate:

- No promotion to review, done, published, sent, closed, approved, or equivalent final states without evidence.
- Moving a work item forward in a source system is not proof.
- Confidence is not proof.
- A report without validation is not proof.

## Phase 5: Convert The Successful Run Into An SOP

After one supervised successful run, capture the exact process.

Winning prompt pattern:

```text
Great. Create an SOP for what we just did.
Include the intake step, active work state, investigation steps, validation requirements, report format, escalation path, and final state movement or completion signal.
```

The SOP should define:

- Scope.
- Sources of truth.
- Prerequisites.
- Workflow steps.
- Validation gates.
- Stop rules.
- Report format.
- Work-state transitions or source-system completion signals.
- Human review criteria.
- Maintenance notes.

Avoid vague instructions such as "look into it" or "fix if needed." Write observable actions and pass/fail gates.

## Phase 6: Split Resolution From Approval

For meaningful workflows, separate the doing from the approving.

Recommended generic state model:

```text
Intake -> Active -> Review -> Done
```

Example board mapping:

```text
Backlog -> In Progress -> Review -> Complete
```

Optional release or publication state:

```text
Published
```

Rules:

- The agent can move resolved work to the review state after validation.
- Approval requires re-reading evidence and checking stale state.
- Published, release, external send, delete, deploy, billing, or customer-visible states should remain human-controlled unless explicitly authorized.
- Blocked work returns to the intake state with a clear handoff.

Winning prompt pattern:

```text
Create a second SOP for reviewing work in the review state.
This SOP should re-read the work record, inspect the linked report, verify the evidence, append an approval note or review record, check stale shared state, and only then move approved work to the done state.
```

## Phase 7: Add Stop Rules

Agents need a controlled way to stop without exhausting time or creating risky changes.

Default stop rules:

- Stop after two failed reasonable fix attempts.
- Stop after 45-60 minutes without new evidence.
- Stop when blocked by credentials, provider access, production approval, product intent, risky data changes, broad schema changes, or unclear ownership.
- Stop when the work expands into multiple unrelated lanes.

Blocked handoff prompt:

```text
If you cannot resolve this safely, move the work back to the intake state with a HUMAN REVIEW label or handoff note.
If there is no state system, mark it blocked in the source system or report.
Include what you tried, what evidence you found, what remains blocked, and the exact next human decision needed.
```

## Phase 8: Add Reports And Compact Summaries

Use separate artifacts for detailed evidence and source-system-readable summaries.

Full report should include:

- Work item ID or source.
- Problem statement.
- Investigation summary.
- Root cause or current hypothesis.
- Changes made.
- Validation run.
- Recurrence or status check.
- Residual risk.
- Human follow-up, if any.

Compact work-record summary should include:

- Issue.
- Resolution.
- Validation.
- Risk.
- Report path.
- Review-note room, when the source system has limited space.

Winning prompt pattern:

```text
Write the full report to your reports folder.
Then update the work record with only a compact summary, validation result, residual risk, and local report path.
```

## Phase 9: Ask For Tooling Needs After Real Runs

Do not build tools before friction is proven. After the agent performs the workflow, ask what repeated steps were slow, error-prone, or easy to automate.

Winning prompt patterns:

```text
How well did that workflow feel end to end? Rate your performance and name the exact friction points.
```

```text
Do you need any scripts, shortcuts, commands, templates, skills, paths, or resources to do this more reliably next time?
```

```text
Would anything we can build help you if you encounter this same kind of work again, or were you able to handle it fine?
```

Only add tools that remove repeated friction, reduce risk, or enforce a validation gate.

## Phase 10: Add A Post-Run Training Audit

Once the first end-to-end workflow exists, add a temporary post-run training audit SOP. This audit is most useful while the training run is still fresh, before the workflow feels stable.

The audit asks:

- Did the agent follow the SOP?
- Did validation actually prove completion?
- Were reports useful and findable?
- Did any tool or template fail?
- Did the agent stop appropriately when blocked?
- Are any SOP steps ambiguous?
- Should any helper be added, changed, or removed?

Winning prompt pattern:

```text
After you complete the workflow, audit your own run.
Decide whether any new tools, paths, SOP edits, templates, or resources would materially improve the next run.
Make only high-value improvements.
```

Use `docs/sops/sop_agent_post_run_training_audit.md` as the reusable audit procedure.

Retire this temporary audit after several stable runs when it no longer produces useful SOP, template, or tooling changes.

## Phase 11: Define The Trigger Phrase

Create a short phrase that runs the complete trained workflow.

Winning prompt pattern:

```text
When I say "<trigger phrase>", run the full workflow:
1. <primary work SOP>.
2. <review/approval SOP>.
3. <post-run training audit SOP>.
Confirm blockers and evidence before moving work forward.
```

Example:

```text
run your workflow
```

## Phase 12: Nurture The Agent Across Runs

Treat training as a progression, not a one-time prompt.

Maturity levels:

- `Level 0: Untrained`: identity, task surface, and guardrails are not yet stable.
- `Level 1: Supervised`: the agent can complete one real task with close prompting.
- `Level 2: SOP-backed`: the agent follows a documented workflow and knows stop rules.
- `Level 3: Evidence-backed`: the agent reliably proves completion before moving state.
- `Level 4: Tool-assisted`: repeated friction has been reduced with safe helper tools.
- `Level 5: Stable`: post-run audits rarely produce needed SOP or tooling changes.

Nurture cadence:

- After each early run, ask for a performance rating and concrete friction points.
- After every blocked run, ask whether the stop rule, escalation path, or task definition should change.
- After every successful run, ask what evidence made the work safe to promote.
- After three stable runs, remove temporary training steps that no longer add value.
- Before expanding scope, repeat this SOP for the new task surface instead of assuming the old workflow transfers automatically.

Winning prompt pattern:

```text
Rate your maturity for this workflow from Level 0 to Level 5.
What evidence supports that rating?
What is the single highest-value improvement before the next run?
```

## Training Quality Checklist

The agent is not fully trained until all are true:

- It knows its name, task, boundaries, and escalation path.
- It has a local artifact area.
- It has completed at least one real supervised task.
- Its workflow is captured in an SOP.
- It has a separate review/approval path when needed.
- It verifies real completion before state promotion.
- It writes full reports and compact work-record summaries.
- It has stop rules.
- It has a repeatable trigger phrase.
- It has completed at least one post-run training audit.

## Anti-Patterns

- Training only with hypothetical examples.
- Letting the agent move work to complete without evidence.
- Treating confidence as validation.
- Putting full investigation logs inside source-system records that need compact summaries.
- Building tools before observing repeated friction.
- Letting the agent override repo, security, privacy, branch, or operational rules.
- Allowing blocked work to sit in review, done, approved, sent, or equivalent forward states.
- Creating vague SOPs that cannot be audited.
- Skipping stale-state checks on shared work surfaces.

## References

- `docs/records/artifacts/agent/ophestivus/training-history.md`
- `docs/agents/generic-agent-training-template.md`
- `docs/sops/sop_agent_post_run_training_audit.md`
