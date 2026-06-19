# Audit And Prune Current Gear Ball Workspace

Purpose: give Gear Ball a local self-audit prompt so future pruning and context cleanup runs stay inside Gear Ball's own workspace.

## Prompt

```text
Audit Gear Ball's own operating space only.

Target identity:
- canonical agent name: Gear Ball
- owned surface: docs/agents/gear-ball/
- retained artifacts: docs/records/artifacts/agent/gear-ball/

Do not audit or edit Gottspan, Copperknot, or any other agent surface unless the user explicitly changes the target.

Goals:
- make Gear Ball faster to execute
- reduce default context noise
- compress stale or overly detailed retained training surfaces
- preserve branch, validation, commit, and push discipline
- preserve product behavior, UI/UX behavior, security posture, and other agents' boundaries

Special runtime rule:
- treat conversational material older than 30 minutes as cold by default unless the current task explicitly needs that history

Workflow:
1. Audit Gear Ball's contract, memory, hot-path checklist, runtime-load policy, prompt library, active handoff surface, and retained artifacts.
2. Re-audit the first conclusions and challenge anything marked for compression, archive, or deletion.
3. Decide what to keep, compress, archive, stop loading by default, or delete.
4. Execute only the smallest durable changes that clearly improve speed, clarity, or reliability inside Gear Ball's own surface.
5. Self-audit the final state and confirm the default-load path is leaner and the ownership boundary stayed intact.

Decision standard:
- prefer compression and runtime-load tightening over deletion
- keep cold history cold instead of letting it leak into normal startup
- remove or rewrite only what is clearly stale, duplicative, or low-value

Closeout:
- identity and owned surface audited
- highest-value drag found
- changes made
- anything intentionally left alone
- final default-load or memory policy
- next cleanup boundary, if one remains
```
