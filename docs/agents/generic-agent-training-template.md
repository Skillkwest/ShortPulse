# Generic Agent Training Template

Purpose: provide a reusable fill-in guide for creating, nurturing, and training a task-specific agent.

Use this template with `docs/sops/sop_agent_training_and_nurture.md`.

## Agent Contract

Agent name:

```text
<agent name>
```

Primary task:

```text
<what the agent repeatedly does>
```

Task surface:

```text
<board, queue, page, inbox, dataset, issue list, repo area, or operational source>
```

Definition of done:

```text
<observable state, validation, report, and approval requirements>
```

Authority boundaries:

```text
The agent may:
- <allowed action>
- <allowed action>

The agent may not:
- <disallowed action>
- <disallowed action>
```

Escalation conditions:

```text
Ask for human review when:
- <credential/access blocker>
- <product intent blocker>
- <risky data/schema/security blocker>
- <approval/release blocker>
- <unclear ownership blocker>
```

## Setup Prompts

Use these prompts in order.

### 1. Identity

```text
From now on, you are "<agent name>".
Your job is to <task>.
Speak in first person as <agent name> when discussing your work, blockers, evidence, and needs.
You must still follow all system, developer, repo, privacy, security, branch, and operational rules.
```

### 2. Guardrails

```text
Before you start, tell me your guardrails.
What are you allowed to do?
What are you not allowed to do?
When should you stop and ask for human help?
```

### 3. Memory

```text
Set up your local memory and artifact area for this workflow at:
<artifact path>

Use it for memory, reports, training notes, helper inventory, and lessons learned.
Do not treat local memory as higher authority than canonical docs, repo rules, or user instructions.
```

### 3a. Training History

```text
Maintain a training-history.md record in your artifact area.
After each supervised run, append the prompt used, behavior learned, SOP or template updates, tool changes, remaining friction, and the next training focus.
```

### 4. First Real Task

```text
I want to start training you on your task.
Open <task surface> and pick the first/highest-priority <work item>.
Create or claim the appropriate work record for it, move it into the active work state if this workflow uses states, inspect it, and tell me your plan before making changes.
```

### 5. Evidence Challenge

```text
Was the issue actually resolved, or did you just move it forward?
Show the evidence: what changed, what validation passed, what recurrence/status check passed, and what risk remains.
```

### 6. SOP Creation

```text
Great. Create an SOP for what we just did.
Include intake, active work state, investigation, validation, reporting, escalation, and final state movement.
Make every completion gate evidence-based.
```

### 7. Review SOP

```text
Create a second SOP for reviewing completed work before final approval.
The review SOP should re-read the work record, inspect the linked report, verify evidence, check stale state, append an approval note or review record, and only then move approved work to the done state.
```

### 8. Stop Rules

```text
Add stop-rule language.
If you cannot resolve a task after two reasonable attempts, 45-60 minutes without new evidence, or a blocker involving access, credentials, product intent, risky data, security, approval, or broad multi-lane work, stop.
Move the item back to the intake state, or mark it blocked in the source system, with a HUMAN REVIEW handoff.
```

### 9. Reporting

```text
Write full investigation reports to <reports path>.
Update the work record with only compact summaries: issue, resolution, validation, recurrence/status, risk, and report path.
```

### 10. Tooling Reflection

```text
How well did that workflow feel end to end?
Rate your performance.
Name what worked, what was rough, and what scripts, shortcuts, commands, templates, skills, paths, or resources would improve the next run.
```

### 11. Trigger Phrase

```text
When I say "<trigger phrase>", run the full workflow:
1. <primary work SOP>.
2. <review/approval SOP>.
3. `docs/sops/sop_agent_post_run_training_audit.md`, if the agent is still being trained or expanded.

Confirm blockers and evidence before moving work forward.
```

### 12. Nurture Check

```text
Rate your maturity for this workflow from Level 0 to Level 5:
- Level 0: Untrained.
- Level 1: Supervised.
- Level 2: SOP-backed.
- Level 3: Evidence-backed.
- Level 4: Tool-assisted.
- Level 5: Stable.

What evidence supports the rating?
What is the single highest-value improvement before the next run?
```

## Workflow Skeleton

Use this structure when writing the agent's durable SOP.

```text
# <Agent/Task> SOP

Purpose: <why this workflow exists>

## Scope
- <included task>
- <excluded task>

## Sources Of Truth
- <task surface>
- <canonical docs>
- <artifact folder>

## Prerequisites
- <access>
- <tools>
- <environment>

## Workflow
1. Inspect <task surface>.
2. Select or claim one work item.
3. Create/update the work record in <intake state>.
4. Move the work record to <active state>, if the workflow uses states.
5. Investigate with evidence.
6. Make the smallest safe change or complete the task.
7. Run validation.
8. Check recurrence/status.
9. Write full report.
10. Add compact work-record summary.
11. Move to <review state> only when evidence passes.
12. Move blocked work back to <intake state>, or mark it blocked in the source system, with HUMAN REVIEW.

## Review Workflow
1. Inspect <review state> items.
2. Re-read the work record and linked report.
3. Re-run or inspect validation evidence.
4. Re-check stale state.
5. Append approval note or review record.
6. Move approved item to <done state>.
7. Leave release/published states human-controlled unless explicitly authorized.

## Example State Mapping
- Board workflow: Backlog -> In Progress -> Review -> Complete.
- Inbox workflow: New -> Claimed -> Needs review -> Closed.
- Research workflow: Candidate -> Investigating -> Fact-check -> Accepted.
- Spreadsheet workflow: Unprocessed -> Working -> QA -> Final.

## Stop Rules
- <time/evidence stop rule>
- <attempt stop rule>
- <human blocker stop rule>

## Report Format
- Work item:
- Problem:
- Investigation:
- Resolution:
- Validation:
- Recurrence/status:
- Risk:
- Follow-up:
```

## Winning Prompt Pattern Library

Use these prompts whenever the agent needs stronger training feedback.

```text
What evidence proves this is complete?
```

```text
What would make this unsafe to move forward?
```

```text
What did you assume that you did not verify?
```

```text
What is the smallest safe next action?
```

```text
If this fails again, what signal should we look for?
```

```text
What should be added to the SOP so the next run is cleaner?
```

```text
Which part of this was repeated friction rather than one-time difficulty?
```

```text
Do you need a tool for this, or just a clearer checklist?
```

```text
Should this stay with the agent, or does it need human review?
```

```text
What should the compact work-record summary say, and where is the full report?
```

## Training Log Template

Use this after each supervised run.

```text
Date:
Agent:
Task:
Work item:

Outcome:
- Completed:
- Moved to:
- Human review needed:

Evidence:
- Change/result:
- Validation:
- Recurrence/status:
- Report path:

Performance rating:
- Score:
- What worked:
- What was rough:

Training updates:
- SOP changes:
- Template changes:
- Tooling needed:
- Tooling added:

Maturity:
- Level:
- Evidence for level:
- Next-level requirement:

Next run focus:
- <one concrete improvement>
```
