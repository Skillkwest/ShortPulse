# SOP: Admin Ophestivus Post-Run Training Audit

Purpose: after Ophestivus completes the Admin Error resolution SOP and the Review to Complete SOP, audit the workflow itself and decide whether new tooling, shortcuts, skills, scripts, paths, or resources would make future SOP runs more reliable.

## Temporary Status

This is a temporary development/training SOP.

- Use it while ShortPulse is still in active dev and Ophestivus is being trained on the admin error workflow.
- Retire or archive it before production if the process becomes stable enough that no post-run tooling audit is needed.
- Do not let this SOP create endless process work. It exists to improve repeated SOP execution, not to add ceremony after every task.

## Scope

- Runs immediately after both of these are complete:
  - `docs/sops/sop_admin_error_to_ophestivus_resolution.md`
  - `docs/sops/sop_admin_ophestivus_review_to_complete.md`
- Applies to Ophestivus helper commands, board workflow, local reports, docs, scripts, skills, browser/API paths, and validation friction.
- Does not reopen the completed ticket unless the audit finds evidence that the issue was not truly resolved.
- Does not touch `Published`.

## Trigger

Run this SOP after a full error-handling cycle:

1. Error-grab SOP completed.
2. Review SOP completed.
3. Ticket moved to `Complete`.
4. Incident recurrence and validation were checked.

This SOP may also run when the user asks:

- `audit Ophestivus workflow`
- `post-run training audit`
- `do you need tools after that run`
- `what would make the SOP easier next time`

## Workflow

1. Confirm the completed run.
   - Record the completed ticket id, incident id, title, final board status, and local report path.
   - Confirm the ticket is in `Complete`, not `Review`, `In progress`, or `Backlog`.
   - Confirm the original incident family has no open same-fingerprint incidents and no fresh matching events after the recorded fix timestamp.

2. Review workflow friction.
   - Identify steps that required manual one-off commands, repeated dry-runs, copied IDs, browser clicks, ad hoc SQL, temporary scripts, or repeated context reconstruction.
   - Note where Ophestivus had to inspect command help or infer helper behavior during the run.
   - Note any board detail length issues, report compaction issues, stale-state checks, unclear SOP wording, or missing validation shortcuts.

3. Decide whether anything new is needed.
   - Consider:
     - helper command
     - script option
     - Python utility
     - Node utility
     - local skill
     - SOP update
     - docs shortcut
     - board/API path
     - browser shortcut
     - report template
     - test fixture or validation harness
   - Prefer small improvements that remove repeated friction from future SOP runs.
   - Do not create new tooling for one-off inconvenience unless the same friction is likely to recur.

4. Classify the outcome.
   - `No new tooling needed`: the run was smooth and current helpers are enough.
   - `Docs/SOP cleanup`: wording or order-of-operations needs a small edit.
   - `Helper enhancement`: an existing helper needs a flag, output field, safer dry-run, or better compaction.
   - `New helper needed`: repeated manual steps should become a command.
   - `Skill/resource needed`: Ophestivus needs a reusable local skill, reference file, or command index.
   - `Human/process decision`: the improvement requires user approval or product/process choice.

5. Apply only high-value changes.
   - If the improvement is small, low risk, and clearly useful, implement it in the same turn.
   - If it is larger, write a compact recommendation and ask before building.
   - If the improvement would distract from the completed incident or requires broad refactor, do not start it automatically.

6. Record the audit.
   - Add a short `Post-run training audit` section to the local Ophestivus report when practical.
   - If the local report is already finalized and no file edit is warranted, summarize the audit in the chat.
   - If new tooling or SOP edits were made, validate them with targeted checks.

## Decision Guardrails

- Build tools only when they reduce repeated SOP friction or prevent mistakes.
- Prefer extending an existing Ophestivus helper over adding a new script.
- Prefer Node scripts for this repo unless Python is clearly better for parsing, files, or reports.
- Keep board tickets compact; full workflow notes belong in local Ophestivus reports.
- Do not expand into unrelated app work just because the audit found an adjacent issue.
- Do not create specialized templates until repeated patterns justify them.
- If the completed ticket was not truly resolved, stop this training audit and return to the relevant error/review SOP state.

## Output Template

```text
Post-run training audit:
Completed ticket:
Incident:
Workflow rating:
Friction found:
Tools/resources needed:
Decision:
Changes made:
Validation:
Next training improvement:
```

## Validation

- Docs-only changes: run `node scripts/check_docs_links.js`.
- Ophestivus helper changes: run targeted helper tests and ESLint for touched scripts.
- SOP index changes: confirm the new SOP appears in `docs/sops/README.md` and `docs/README.md`.

## Maintenance

- Review this SOP periodically while the app is in dev.
- Remove, archive, or merge it into the main Ophestivus SOPs before production.
- If this SOP repeatedly produces `No new tooling needed`, it is ready to retire.
