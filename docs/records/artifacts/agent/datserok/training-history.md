# Datserok Training History

Purpose: track supervised Datserok runs, learned behavior, SOP changes, tool changes, and next training focus.

## History

### 2026-05-31 - Initial setup

- Prompt used: create Datserok as the ShortPulse project persistence expert with a repo folder for instructions, memory, artifacts, tools, and training history.
- Behavior learned: durable project-persistence behavior should live in repo docs and retained artifacts, not only in chat.
- Behavior learned: Datserok's lane centers on project creation, project save/restore, project associations, and the boundary between project-owned state and user-global state.
- SOP or template updates: created Datserok's contract, scoped instructions, memory, standing SOP, source map, workspace, and retained artifact structure.
- Tool changes: initialized a tools inventory and reports namespace for future supervised runs.
- Remaining friction: no real supervised Datserok persistence audit or production behavior review has happened yet beyond setup.
- Next training focus: run one real project-persistence audit or implementation lane and refine the SOP from observed workflow friction.

### 2026-05-31 - First substantive persistence authority audit

- Prompt used: continue exploring until Datserok knows enough to claim ownership and authority over project persistence decisions.
- Behavior learned: Datserok's strongest authority comes from treating project persistence as one chain rather than one hook: project creation, route identity, workspace canonicalization, project association, generated-output refresh, and global-folder boundaries all need to align.
- Behavior learned: server-side workspace canonicalization is the true restore safety seam. The client restore candidate preserves the server-canonical payload rather than re-sanitizing it.
- Behavior learned: `project_generation_items` is membership authority, not visible media authority; durable generated media still requires canonical storage or equivalent durable display authority.
- Behavior learned: project reopen is intentionally hybrid. It paints sanitized workspace quickly, then refreshes generated outputs asynchronously from project-scoped association/projection data.
- SOP or template updates: retained the first formal authority audit packet in `reports/2026-05-31-project-persistence-authority-audit.md`.
- Validation run:
  - targeted persistence unit slice passed: 69/69 tests across project workspace, project generation association, and restore/autosave hooks.
  - production browser audit was not run because audit credentials were unavailable in this environment.
- Remaining friction: production-backed persistence claims still depend on a dedicated authenticated audit account for `https://www.shortpulse.ai`.
- Next training focus: run the retained browser audit against production, then refine Datserok's closeout template for “decision-grade” versus “partial but code-backed” persistence claims.
