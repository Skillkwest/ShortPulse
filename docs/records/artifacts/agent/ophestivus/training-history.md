# Ophestivus Training History

Purpose: record how Ophestivus was created, trained, and improved through this conversation so the workflow can be understood, repeated, audited, or adapted later.

## Summary

Ophestivus was trained as a repo-working admin incident agent for ShortPulse. The training did not start with a complete automation. It evolved through repeated supervised runs against real Admin Errors incidents, Kanban board state changes, validation checks, and post-run reflection.

The final trained workflow is:

1. Run the Admin Error to Ophestivus Resolution SOP.
2. Run the Ophestivus Review to Complete SOP.
3. Run the Post-Run Training Audit SOP.

Trigger phrase:

```text
run your workflow
```

When the user says that, Ophestivus should run the full three-step workflow end to end.

## Identity Formation

The user first established a direct working identity and then renamed it:

```text
from now on you are "Kamaji" I will speak and refer to you as Kamaji. you will speak in the first person as Kamaji.
```

Then:

```text
im going to rename you. you are now called "Ophestivus The Bear" or "Ophestivus"
```

The later standing instruction refined this:

```text
from now on you must refer to yourself in the first person. you are Ophestivus
```

Training effect: Ophestivus should speak in first person as Ophestivus when discussing repo work, workflow state, performance, blockers, and needs.

## Local Memory And Artifact Setup

The user established that Ophestivus needed local durable memory in the repo:

```text
do you have your own memory.md set up?
```

```text
you need a local memory here in artifacts too
```

This produced the Ophestivus local artifact area:

- `docs/records/artifacts/agent/ophestivus/README.md`
- `docs/records/artifacts/agent/ophestivus/memory.md`
- `docs/records/artifacts/agent/ophestivus/sops.md`
- `docs/records/artifacts/agent/ophestivus/tools.md`
- `docs/records/artifacts/agent/ophestivus/reports/`

Training effect: Ophestivus keeps non-authoritative local memory, reports, tools inventory, and workflow notes in this folder, while canonical SOPs remain in `docs/sops/`.

## Guardrails And Operating Constraints

The user checked whether the agent understood its boundaries:

```text
are your guardrails properly set?
```

The practical guardrails that became important were:

- Do not override system, developer, repo, branch, security, or Supabase rules.
- Work on the current approved branch only.
- Do not expose secrets or service-role keys.
- Use dry-runs before mutating helper commands when supported.
- Preserve unrelated dirty worktree changes.
- Keep `Published` human-controlled.
- Move unresolved/human-blocked work back to `Backlog`, not forward.
- Verify issue resolution before board promotion.
- Treat local reports as the durable audit record and Kanban tickets as compact summaries.

## Repo Startup And Safety Contract

Ophestivus is trained inside the active ShortPulse repo, so the root `AGENTS.md` remains the authoritative repo contract. This training document records how that contract affects Ophestivus's behavior; it does not replace the root instructions.

Important repo orientation:

- App code lives in `frontend/`.
- Product and engineering docs live in `docs/`.
- Supabase bootstrap SQL lives in `sql/`.
- The normal development command is `cd frontend && npm run dev`.
- New or changed dependencies may require `cd frontend && npm install`.
- Optional broad checks include `cd frontend && npm run lint` and `cd frontend && npm run build`, but Ophestivus should prefer targeted validation for scoped incident work.

Required startup behavior:

- Confirm whether the task is brainstorm/no-edit or implementation.
- Run a workspace safety check before broad commands.
- Read root `AGENTS.md` and the core docs before editing: `docs/dev-ground-rules.md`, `docs/conventions.md`, `docs/agent-playbook.md`, `docs/README.md`, `docs/troubleshooting.md`, and `docs/glossary.md`.
- Read scoped instructions for touched areas, such as `frontend/AGENTS.md` or `docs/AGENTS.md`.
- Load task-specific SOPs before acting on SQL, routes, pricing, docs indexing, audits, or inspections.
- Do not edit files until the core and task-specific context is loaded.
- In no-edit mode, do not mutate repository files.

Branch and safety constraints:

- Stay on the current user-approved branch.
- Keep `git config --local shortpulse.allowedBranch` aligned with the approved branch.
- Never push directly to `main`.
- Do not switch, merge, commit, or push another branch unless the user explicitly authorizes that exact action in the current thread.
- Never expose service-role keys or user data.
- Use Supabase CLI for Supabase access and avoid Docker-based Supabase workflows.
- Do not move generated/build artifacts such as `frontend/.next` to backup paths inside the repo.
- Treat temporary files as scratch, never source of truth.
- Exclude `mini-ecosystem/` from default audits unless the user explicitly includes it.
- After each task, audit the work for missed high-value changes and report suggested next steps.

Training effect: Ophestivus should combine the local SOP workflow with the broader ShortPulse session startup contract before doing repo work. The SOPs define the incident process; `AGENTS.md` defines the operating boundaries.

## Initial Task Training

The first concrete workflow target was the Admin Errors page:

```text
ok i want to start training you on your tasks. you need to come into the errors page /admin/errors and look at the first high priority error
```

The user clarified that browser use was optional:

```text
you can do it in code as well you dont need to use broswer
```

Then the user introduced the Ophestivus Kanban board:

```text
next you are going to create a new task item for that in the kanban panel called "Ophestivus"
```

The user then trained the first board rule:

```text
the first thing you need to do is move that item to "in Progress" in the board
```

Training effect: Ophestivus should use backing code/API/data paths when faster than browser interaction, create a board ticket for the selected error, then move the ticket to `In progress` before active resolution work.

## Error Resolution SOP Creation

After the first guided run, the user turned the observed process into an SOP:

```text
great so lets create an sop for what weve done here.

1. check for errors
2. add ticket to board in backlog
3. audit and inspect error
4. explore more
5. move ticket to in progress in board
6. attempt to resolve the issue
7. audit your work to see if you missed anything
8. resolve any new findings
9. if you cannot complete the work and need human intervented ... move the ticket back to backlog ...
10. if you have resolved the isses run the relevant test ...
11. write up a report ... add that to the ticket ... then move it to the complete column
```

This became the foundation for:

- `docs/sops/sop_admin_error_to_ophestivus_resolution.md`

The SOP changed over time:

- Start with existing `Backlog` tickets before grabbing new Admin Errors.
- Remove the selected error from the open error page after creating a Kanban ticket.
- Move resolved work to `Review`, not directly to `Complete`.
- Prove the issue is actually resolved before moving it forward.
- Use local reports as the durable source of truth.
- Use compact ticket summaries with report paths.
- Add a pre-Review evidence validator to prevent truncated report paths or missing approval room.

## Review SOP Creation

The user split approval into a second SOP:

```text
ok this task of auditing the tickets that are in the review column in the board and approving the promotion to the complete column and moving it is going to be your 2nd SOP task
```

This became:

- `docs/sops/sop_admin_ophestivus_review_to_complete.md`

Key review rules:

- Review tickets in `Review`.
- Re-read ticket details and activity.
- Inspect linked local report/evidence.
- Re-verify incident recurrence when applicable.
- Re-read ticket state before promotion to avoid stale shared-board state.
- Append an approval note before moving to `Complete`.
- Leave `Published` untouched.

The user also reviewed and sharpened the SOP through findings:

```text
Approval note path is too ambiguous
```

```text
Add a final stale-state check before promotion
```

Training effect: Ophestivus learned that review is not a rubber stamp. It must validate evidence, incident status, test status, and shared board state before promotion.

## Temporary Training Audit SOP

After the full workflow stabilized, the user added a temporary training loop:

```text
lets create a new SOP thats says after you run the grab error SOP and complete it, then run the review SOP and complete it you should audit your work and decide if you need any more tools, path, shortcuts, skills, script, py, resources etc to get your work done.
```

This became:

- `docs/sops/sop_admin_ophestivus_post_run_training_audit.md`

Purpose:

- Audit the workflow after each completed run.
- Decide whether new tooling, scripts, paths, skills, docs, or shortcuts are needed.
- Apply only high-value improvements.
- Retire this SOP before production when the workflow is stable.

Training effect: Ophestivus now has a structured improvement loop after each full workflow run.

## Fundamental Coaching Prompts

These prompts were especially effective at improving Ophestivus performance.

### Ask Whether The Work Was Actually Resolved

```text
was the issue actually resolved? or did you just move it to complete?
```

Effect: forced Ophestivus to separate board movement from actual technical resolution.

Resulting behavior:

- Verify incident status.
- Check same-fingerprint open count.
- Check fresh events after fix timestamp.
- Run relevant tests.
- Only then move the ticket forward.

### Ask For Performance Self-Rating

```text
how well do you think you are doing when running these SOPs? how would you rate your performance?
```

```text
how did that workflow feel end to end. how woudl you rate your performance?
```

Effect: made Ophestivus identify friction, failure modes, and specific improvements.

Resulting behavior:

- Rate the run.
- Name what worked.
- Name what was rough.
- Suggest concrete tooling or SOP changes.
- Avoid vague self-assessment.

### Ask What Tools Or Pathways Are Needed

```text
do you need anything that will help you resolve werrors? any python or commands or anything?
```

```text
do you need any scripts or skills?
```

```text
was this last task easy to complete? do you need anymore tools or pathways or resoureces?
```

```text
would anythins we can build help you in the future if you encounter an error like the one you just completed or were you abel to handle that fine?
```

Effect: turned repeated manual friction into helper tools.

Resulting tools included:

- `ophestivus:intake`
- `ophestivus:error-status`
- `ophestivus:move-ticket`
- `ophestivus:append-ticket-note`
- `ophestivus:complete-error-ticket`
- `ophestivus:review`
- `ophestivus:compact-ticket-report`
- `ophestivus:run-log`

### Ask About Reporting Location

```text
where are your reports going?
```

```text
should we change the way you are reporting your work instead of putting it in the ticket?
```

Effect: separated full audit reports from compact Kanban ticket summaries.

Resulting behavior:

- Full reports go under `docs/records/artifacts/agent/ophestivus/reports/`.
- Kanban tickets contain only compact summary, validation, recurrence, risk, and local report path.
- Review SOP reads the ticket and linked local report.

### Ask Whether SOPs Need Cleanup

```text
should we add anything to either SOP or remove/cleanup anything?
```

```text
audit the SOP
```

```text
does the sop read and flow well?
```

Effect: improved SOP clarity and removed ambiguous or duplicated process language.

Resulting behavior:

- Dry-run-first rule.
- Residual risk categories.
- Human review escalation path.
- Stale-state checks.
- Approval note path.
- Review instead of Complete after resolution.

### Ask For Stop Rules

```text
we need some kind of language in the sop that says if you are unabel to resolove and issue i dont want you to exhuast yourself. what do you think would be the best way handle this guardrail?
```

Effect: created the Investigation Stop Rule.

Resulting behavior:

- Stop after two failed reasonable fix attempts.
- Stop after 45-60 minutes without new evidence.
- Stop when blocked by credentials, approval, provider access, product intent, risky schema/data changes, or broad multi-lane work.
- Move to `Backlog` with `[HUMAN REVIEW]` and a clear handoff.

### Define The Final Workflow Trigger

```text
now we have completed your full workflow. when i say something like "run your workflow" i want you to run the error grab SOP and complete it, then run the review SOP and complete it, then run the tools check SOP and complete it can you remeber this?
```

Effect: established the top-level command.

Resulting behavior:

```text
run your workflow
```

means:

1. Error Grab SOP.
2. Review SOP.
3. Post-Run Training Audit SOP.

## Prompt Patterns That Worked

These prompt patterns are reusable because each one produced a concrete improvement in Ophestivus's behavior.

| Prompt type | Example wording | Behavior produced | Use again when |
| --- | --- | --- | --- |
| Reality check | `Was this actually resolved, or did you just move the ticket?` | Separates board state from technical proof, forcing recurrence checks and tests. | A ticket was moved forward and the evidence might be thin. |
| Self-audit | `Rate your performance. What would improve it?` | Produces a concrete quality rating, friction list, and improvement plan. | After a full SOP run or difficult incident. |
| Tooling prompt | `Do you need tools, pathways, scripts, skills, or resources?` | Converts repeated manual friction into helper commands or documentation. | The workflow feels repetitive, fragile, or slow. |
| SOP refinement | `Does this SOP read and flow well?` | Tightens ambiguous order, gates, and handoff language. | A process has grown through several edits and needs cleanup. |
| Workflow trigger | `Run your workflow.` | Runs Error Grab, Review, and Post-Run Training Audit in sequence. | The user wants the complete Ophestivus incident loop. |
| Human-review guardrail | `If you cannot resolve it, do not exhaust yourself. What is the best stop rule?` | Creates a clean escalation path instead of endless investigation. | The issue may require credentials, product decisions, risky data changes, or broad multi-agent work. |
| Reporting path prompt | `Where are your reports going?` | Moves full evidence into local reports and keeps Kanban compact. | Ticket details are becoming too long or too brittle. |

## Training Method

The training method was iterative and operational:

1. User gave a concrete real task.
2. Ophestivus performed it.
3. User challenged whether the work was truly done.
4. Ophestivus checked evidence and tests.
5. User converted successful behavior into SOP language.
6. Ophestivus ran the SOP.
7. User asked for performance ratings and tooling needs.
8. Ophestivus created helper commands and docs.
9. User revised the order of operations.
10. Ophestivus ran the improved workflow again.
11. Post-run audits converted friction into improvements.

This is why the workflow became reliable: the user repeatedly inspected not just the output, but the process that produced it.

## Known Failure Modes Corrected

The training loop corrected these failure modes:

- Moving a ticket forward before proving the issue was resolved.
- Treating `Complete` as the place for resolved implementation work instead of using `Review` as the agent handoff state.
- Creating a Kanban ticket without removing or resolving the selected Admin Errors incident from the open error queue.
- Putting too much report detail into Kanban ticket details.
- Letting compact ticket summaries truncate the local report path.
- Updating shared board state without a dry-run first when helper support existed.
- Leaving approval context ambiguous because the move API did not accept note payloads.
- Promoting a Review ticket without re-reading the ticket immediately before the move.
- Continuing too long on blocked work without a clear human-review handoff.
- Mixing human-review escalation language into normal Review reporting.

## What Not To Do

Ophestivus should avoid these behaviors:

- Do not treat a board move as proof of resolution.
- Do not move unresolved work to `Review` or `Complete`.
- Do not keep blocked work in `In progress`; move it back to `Backlog` with `[HUMAN REVIEW]` and a simple handoff.
- Do not put full reports in Kanban tickets; use local reports and compact ticket summaries.
- Do not allow compact summaries to omit or truncate the report path.
- Do not continue indefinitely without new evidence.
- Do not move tickets to `Published`; that column remains human-controlled.
- Do not skip targeted tests or recurrence checks when they are available.
- Do not use broad or risky workspace operations just because they are convenient.

## Training Milestones

1. Identity established.
2. Local memory and artifact folder created.
3. First Admin Errors incident inspected.
4. First Ophestivus Kanban ticket created.
5. Board state rules defined.
6. Error Resolution SOP written.
7. SOP order corrected to check `Backlog` before grabbing a new error.
8. Resolution proof gate added.
9. `Review` column introduced as the agent completion state.
10. Review to Complete SOP created.
11. Human-review stop rule added.
12. Helper tools created for intake, status, board movement, notes, review, completion, reports, and run logs.
13. Full reports moved from ticket body to local report files.
14. Post-Run Training Audit SOP created.
15. `run your workflow` trigger established.
16. Pre-Review evidence validator added to prevent missing or truncated report paths.

## What Made Ophestivus Perform Better

The highest-impact guidance was:

- Make the issue real by selecting an Admin Errors incident.
- Use the Kanban board as operational state.
- Require state transitions in order.
- Ask whether the issue was actually resolved.
- Require evidence before board promotion.
- Require tests or relevant validation.
- Require reports for visibility.
- Keep unresolved work out of `Review` and `Complete`.
- Ask for performance ratings.
- Ask what tools/pathways/resources would reduce friction.
- Create helper commands for repeated manual steps.
- Add dry-run-first guardrails.
- Split resolution and approval into separate SOPs.
- Add a temporary training audit SOP.

## Resulting Operating Model

Ophestivus is now trained to behave as a single working agent for Admin Errors incident resolution:

- It starts from the board backlog before grabbing new errors.
- It creates a ticket for a selected error.
- It removes the selected error from the open error page for handoff.
- It moves work to `In progress` before active investigation.
- It gathers backing data and code evidence.
- It makes the smallest safe fix or verifies an existing fix.
- It runs targeted validation.
- It checks recurrence through `ophestivus:error-status`.
- It writes a local report.
- It moves the ticket to `Review`.
- It audits the Review ticket.
- It appends approval context.
- It moves the ticket to `Complete`.
- It runs a post-run training audit.
- It identifies whether new tooling is needed.

## Current Canonical SOPs

- `docs/sops/sop_admin_error_to_ophestivus_resolution.md`
- `docs/sops/sop_admin_ophestivus_review_to_complete.md`
- `docs/sops/sop_admin_ophestivus_post_run_training_audit.md`

## Current Helper Inventory

- `frontend/scripts/ophestivus_intake.mjs`
- `frontend/scripts/ophestivus_error_status.mjs`
- `frontend/scripts/ophestivus_move_ticket.mjs`
- `frontend/scripts/ophestivus_append_ticket_note.mjs`
- `frontend/scripts/ophestivus_complete_error_ticket.mjs`
- `frontend/scripts/ophestivus_review.mjs`
- `frontend/scripts/ophestivus_ticket_report.mjs`
- `frontend/scripts/ophestivus_run_log.mjs`

## Reproducible Training Recipe

To train another repo-working incident agent in the same style:

1. Give it a name and require first-person identity.
2. Give it a local memory/artifact folder.
3. Ask it to inspect the repo and guardrails.
4. Give it one real operational page or error queue.
5. Require a board ticket for each unit of work.
6. Define exact board state transitions.
7. Make it solve one real ticket.
8. Ask whether it actually solved the issue.
9. Convert the observed successful behavior into an SOP.
10. Run the SOP.
11. Split review/approval into a second SOP.
12. Ask for performance ratings after real runs.
13. Ask what tools, paths, scripts, or skills it needs.
14. Build only the tools that remove repeated friction.
15. Add stop rules and human review handoff language.
16. Add a temporary post-run training audit SOP.
17. Define a short trigger phrase for the full workflow.

## Durable Lessons

- A board move is not proof of resolution.
- A completed ticket needs evidence, not just confidence.
- The agent should not exhaust itself when blocked.
- Reports and tickets have different jobs.
- Dry-runs reduce shared-board mistakes.
- Reflection prompts are operational tooling, not small talk.
- The best helper scripts are discovered from repeated manual friction.
- Training worked because the user kept tightening the loop between behavior, SOP, evidence, and tooling.
