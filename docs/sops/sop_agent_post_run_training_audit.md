# SOP: Agent Post-Run Training Audit

Purpose: after a task-specific agent completes a trained workflow, audit the workflow itself and decide whether new tooling, shortcuts, skills, scripts, paths, templates, or resources would make future runs more reliable.

## Status

This is a reusable training SOP for any task-specific agent.

- Use it while a new agent is being trained or while an existing agent is expanding into a new task surface.
- Keep it lightweight; it exists to improve repeated execution, not to add ceremony after every task.
- Retire, pause, or reduce this SOP when repeated runs produce no useful SOP, template, or tooling changes.

## Scope

Run this SOP after a complete trained workflow cycle, such as:

- Intake/work selection SOP.
- Execution or investigation SOP.
- Review/approval SOP, when the workflow has one.

This SOP applies to:

- Prompt patterns.
- Agent memory and training history.
- Source-system workflow state.
- Reports and compact summaries.
- Validation friction.
- Helper commands or scripts.
- Browser/API/data-access paths.
- SOP wording and order of operations.
- Skills, templates, checklists, or reference docs.

This SOP does not:

- Reopen completed work unless the audit finds evidence that completion was not actually proven.
- Create tools for one-off inconvenience.
- Expand the agent into a new task domain without a fresh training pass.
- Override system, developer, repo, security, privacy, branch, or operational rules.

## Trigger

Run this SOP after one full workflow cycle when all expected completion gates have been reached.

Examples:

- The work item reached the done state.
- The source system was updated with a compact summary.
- The full report was written.
- Required validation passed.
- Required review or approval completed.

This SOP may also run when the user asks:

- `post-run training audit`
- `audit the agent workflow`
- `do you need tools after that run`
- `what would make the SOP easier next time`
- `what should we improve before the next run`

## Workflow

1. Confirm the completed run.
   - Record the agent name, task, work item/source, final state or completion signal, report path, and validation evidence.
   - Confirm the work is not still in an active, blocked, review, draft, or unresolved state.
   - If completion evidence is missing, stop this audit and return to the relevant execution or review SOP.

2. Review workflow friction.
   - Identify steps that required repeated prompting, copied IDs, browser clicks, ad hoc SQL, manual API calls, one-off scripts, repeated context reconstruction, or unclear source-system navigation.
   - Note where the agent had to infer helper behavior, inspect command help, or recover from ambiguous SOP wording.
   - Note report length issues, compact-summary issues, stale-state checks, validation gaps, source-system field limits, or unclear escalation paths.

3. Audit prompt patterns.
   - Identify which prompts improved behavior.
   - Identify which prompts produced vague answers, skipped evidence, or caused unnecessary work.
   - Decide whether the agent template needs a new prompt pattern, a clarified prompt, or a removed prompt.

4. Audit memory and training history.
   - Confirm the training history captured what changed in the agent's behavior.
   - Confirm the memory/artifact area contains useful notes, not duplicated canonical policy.
   - Confirm reports are findable from the compact source-system summary.
   - If the agent learned a durable lesson, add it to training history or the relevant template.

5. Decide whether anything new is needed.
   - Consider:
     - SOP update
     - prompt-template update
     - report-template update
     - helper command
     - helper flag or safer dry-run
     - browser/API shortcut
     - data query
     - validation harness
     - local skill
     - reference doc
     - source-system field or view
   - Prefer small improvements that remove repeated friction or prevent mistakes.
   - Do not build new tooling for a one-time difficulty unless it protects a high-risk workflow gate.

6. Classify the outcome.
   - `No new tooling needed`: the run was smooth and current guides are enough.
   - `Prompt/template cleanup`: the agent needs clearer prompts, training-history prompts, report format, or state mapping.
   - `Docs/SOP cleanup`: wording, order, stop rules, or validation gates need a small edit.
   - `Helper enhancement`: an existing helper needs a flag, output field, dry-run behavior, or safer summary.
   - `New helper needed`: repeated manual steps should become a command or script.
   - `Skill/resource needed`: the agent needs a reusable skill, reference file, or command index.
   - `Human/process decision`: the improvement requires approval, product/process choice, credentials, or ownership clarification.

7. Apply only high-value changes.
   - If the improvement is small, low risk, and clearly useful, implement it in the same run.
   - If it is larger, write a compact recommendation and ask before building.
   - If it would distract from the completed workflow or starts a new domain, do not start it automatically.

8. Record the audit.
   - Add a `Post-run training audit` section to the agent's run report or training history.
   - If no file edit is warranted, summarize the audit in chat.
   - If new tooling, SOP edits, or template edits were made, run targeted validation.

## Decision Guardrails

- Improve repeated workflows, not isolated annoyances.
- Prefer clearer prompts or SOP wording before adding code.
- Prefer extending an existing helper over adding a new command.
- Keep source-system summaries compact; full workflow notes belong in reports or training history.
- Do not expand into unrelated work because the audit found an adjacent issue.
- If the completed work was not truly resolved, stop this audit and return to the execution or review SOP.
- If the agent is expanding into a new task surface, run `docs/sops/sop_agent_training_and_nurture.md` again for that surface.

## Output Template

```text
Post-run training audit:
Agent:
Task:
Work item/source:
Final state or completion signal:
Report path:
Workflow rating:
Evidence quality:
Friction found:
Prompt/template changes needed:
Tools/resources needed:
Decision:
Changes made:
Validation:
Next training improvement:
```

## Validation

- Docs-only changes: run `node scripts/check_docs_links.js`.
- SOP/index changes: confirm the new or changed SOP appears in `docs/sops/README.md` and `docs/README.md`.
- Helper/script changes: run targeted tests and lint for touched files.
- Template changes: inspect `docs/agents/generic-agent-training-template.md` for stale board-specific or task-specific assumptions.

## Maintenance

- Use this SOP heavily during early agent training.
- Reduce cadence after several stable runs.
- Keep high-value lessons in the generic template when they apply across agents.
- Keep task-specific lessons in the agent's own contract, memory, or training history.
