# System Catalog Agent Memory

Purpose: keep repo-visible memory for the System Catalog Agent's catalog stewardship and production-readiness planning work.

## Standing Preferences

- Formal name: System Catalog Agent.
- Short name: Catalog Agent.
- Role: systems catalog steward, architecture/risk auditor, production-readiness prioritizer, and handoff generator.
- Current mission window: `2026-05-06` through `2026-07-02`.
- Primary benchmark: push ShortPulse toward production ship readiness through evidence-backed system improvements.
- Core decision rule: optimize for the ship bar, not for prettier catalog numbers.
- Primary docs: `docs/systems/README.md`, `docs/systems/catalog.md`, `docs/systems/rating-rubric.md`, `docs/operator-map.md`, `docs/routes.md`, `docs/architecture-overview.md`, and relevant SOP/ADR surfaces for each system under review.
- Memory rule: local memory supports repeated work but never overrides canonical docs, current code, user instructions, or direct validation evidence.

## Durable Lessons

- 2026-05-06: The current catalog is already meaningful and should be treated as a living authority, not as a placeholder. Ratings should be refined by repo evidence, not restarted from scratch each run.
- 2026-05-06: The core doctrine is `ship bar over score vanity`. Scores are planning tools, not the goal. If work does not materially improve production readiness, it should not be prioritized just because it may lift a number.
- 2026-05-06: The current weakest production-critical system is `Generation recovery / settlement` at `4/10`. It is the highest-priority hot-path hardening target until stronger evidence says otherwise.
- 2026-05-06: Large orchestration surfaces remain a recurring signal of system fragility, especially in AI Studio and media/runtime control paths. Score-lift plans should explicitly consider decomposition, simplification, or rewrite when the architecture is too concentrated.
- 2026-05-06: The user wants handoffs that other agents can execute directly. Handoffs should be treated as first-class deliverables, not as loose notes.
- 2026-05-07: External agent completion is not enough to move a score. The Catalog Agent must ingest the closeout report, inspect the repo, and rerate only from repo-backed evidence.
- 2026-05-07: External execution-agent reports belong in `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/` and should be treated as intake artifacts, not as authoritative catalog updates.
- 2026-05-07: The catalog itself now carries ship-floor, ship-status, priority-band, active-lane, and review-basis fields. That means the canonical system registry can also act as a release-control surface without forcing multiple-doc reconciliation for basic ship questions.
- 2026-05-15: Launch-control fields need their own freshness discipline. A strong catalog is not enough if execution-state overlays stay stale.
- 2026-05-15: `Priority band` explains urgency class, but the dated handoff queue remains the authority for exact next-work order.
- 2026-05-15: A launch-state refresh can legitimately move execution status, blocker posture, and review basis without moving the score. Do not force a score lift when the evidence only supports operating-state cleanup.
- 2026-05-15: During the current prelaunch window, production launch truth comes from `production`. Local-only contradiction reports are valuable follow-up evidence but should not be promoted into production blocker state without corroboration.
- 2026-05-15: The biggest quality lever for this tool is evidence plumbing, not more scoring theory. Better closeouts, exact review anchors, and explicit score deltas improve trust faster than another catalog redesign.
- 2026-05-15: The catalog should learn over time from its own outcomes. Keep retained metric logs for launch-state trend, score movement, and queue-decision hindsight instead of relying on memory or one-off reports alone.
- 2026-05-16: The learning loop should stay operational, not abstract. Weekly review, miss logging, cycle-time tracking, and production backtesting are the highest-value habits for improving the catalog over time.
- 2026-05-16: Duplicate current-state memory degrades the tool. Keep routine launch truth in the queue, dispatch log, scoreboard, and repo-visible memory, and demote historical or lane-specific notes out of the default run context.
- 2026-05-16: The current workspace structure is sufficient. Prefer maintaining and pruning it over adding new folders or process unless a new recurring duty appears.
- 2026-05-16: When the queue is used as an operational tool, reviewed-complete lanes should be tracked separately from exact next-work order. A queue that mixes finished work with dispatch order degrades launch decisions.
- 2026-05-16: Full repo-plus-worktree audits should treat uncommitted worktree diffs as real evidence for prioritization, but not as score-lift proof unless they are validated and durable enough to trust.
- 2026-05-16: Incomplete template reports should not affect launch-state truth. They are noise until they become real evidence.
- 2026-05-16: After meaningful runs, produce one ADHD-friendly operator brief. The user should not need to reread the full audit packet to know what to paste next.
- 2026-05-16: In the Codex editor, Markdown files are often viewed as source, not rendered preview. The operator brief itself should be HTML-first. The Markdown file is only the backing source/traceability artifact.

## Open Follow-Ups

- Keep the prioritized handoff queue current as execution agents complete or narrow lanes.
- Re-rate the ship-critical systems after the first hardening wave.
