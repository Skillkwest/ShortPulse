# Holomony Run Report - 2026-05-28 - operating-space-audit-prune

Purpose: retain the self-maintenance audit prompted by Gottspan's audit/prune prompt, retargeted to Holomony by user instruction.

## Initial Audit Findings

- The highest-risk drag was not raw file count; it was stale current-state memory.
- `docs/agents/holomony/memory.md`, `media-surface-inventory.md`, and the reports index still treated the 2026-05-25 Reference Grid production baseline as current health proof with a `no clear blocker` classification.
- Later user-visible production incidents superseded that read: slow Reference Grid loading, broken media, stale references after deletion, and restored-session detail modal breakage.
- `training-history.md` is long, but it is a chronological retained training record and is not part of the default startup path.
- `Kirk.html` is large, but it is a designed visual artifact and not part of Holomony's operational load path.
- `CURRENT-HANDOFF.md` is clean: no active handoff is pending and the prior handoff is filed.
- No cross-agent maintenance was needed or appropriate; Holomony hygiene stays inside Holomony folders and artifacts.

## Re-Audit Findings

- Deleting retained reports would be the wrong move. The old Reference Grid baseline is useful historical evidence, but harmful if loaded as present truth.
- Compressing `training-history.md` today would create churn without solving the active risk.
- The real pruning target is the startup/current-source path: memory, inventory, and current report indexes.
- The Reference Grid onboarding plan remains useful because it defines scope and stop criteria; it should stay current.
- The old Reference Grid baseline should move to archive with an explicit supersession note.

## Final Decision Set

- Keep: Holomony contract files, SOP, ownership manifest, current handoff file, training history, failure taxonomy, experiment ledger, and retained historical reports.
- Compress: active Reference Grid status in memory and inventory so future runs see the reopened incident lane instead of stale confidence.
- Archive: `2026-05-25-reference-grid-production-baseline.md`.
- Stop loading by default: archived baseline reports as current health proof; training history except during explicit training or self-maintenance work.
- Remove from active memory: the old `reference-grid` `no clear blocker` classification as present truth.
- Delete: nothing.
- Replace: stale current report indexes with a narrower policy that points current Reference Grid work to onboarding criteria and fresh incident evidence.

## Memory Policy

- Durable memory should hold concise operating lessons, current owner-path status, and guardrails that change future decisions.
- Historical reports should remain intact, but archived reports are evidence for comparison, not default truth.
- Do not write every conversation insight into memory. Promote only repeated, decision-shaping, or safety-relevant lessons.
- For Holomony, the key current lesson is: prune misleading active context before pruning historical evidence.

## Startup-Load Policy

- For Holomony work, load the root startup spine plus Holomony `README.md`, `AGENTS.md`, SOP, memory, and ownership manifest.
- For media panel work, load current panel reports and the media surface inventory before implementation.
- For Reference Grid incidents, load the onboarding plan, current incident reports if present, fresh production evidence, and owner files. Do not load the archived 2026-05-25 baseline as current proof unless comparing history.
- For self-maintenance or training tasks, load this report and the teaching docs; otherwise leave long training history out of default context.

## Execution Changes Made

- Moved the superseded Reference Grid production baseline from `reports/current/` to `reports/archive/`.
- Added an archive note to that baseline explaining why it is historical evidence, not current health proof.
- Updated Holomony memory to mark Reference Grid as a reopened production incident lane.
- Updated the media surface inventory to mark `reference-grid` as `candidate-active-incident` and point current work toward restore/signing/hydration and stale media authority.
- Updated report indexes so current Reference Grid work no longer cites the old baseline as current source of truth.

## Post-Change Self-Audit

- The active operating path is now less misleading without destroying useful historical evidence.
- The remaining bulk is acceptable because it is not default-loaded and serves audit/history needs.
- No other agent folders were edited.
- Next cleanup should wait for a concrete repo-backed problem, such as closing the current Reference Grid incident and writing a one-page incident index.
