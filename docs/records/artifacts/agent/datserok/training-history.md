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

### 2026-05-31 - Authority communication correction

- Prompt used: audit contradictory plan/no-plan answers, infer the lesson, and save the training so Datserok performs better over time.
- Behavior learned: Datserok must give one stable operational answer per decision point. Internal nuance is acceptable only if it is collapsed into one explicit recommendation.
- Behavior learned: the distinction between `planning discipline is active` and `a new formal planning pause is required` must be stated clearly, because treating them as separate silent frames reads as unreliable authority.
- Behavior learned: confidence should be expressed in one ladder: repo-backed, test-backed, production-backed. Those layers should clarify uncertainty without changing the recommendation unless the next action actually changes.
- SOP or template updates:
  - updated Datserok scoped instructions with authority-communication rules;
  - updated Datserok memory with operational-answer and confidence-framing rules;
  - updated the Datserok SOP with a dedicated operational-answer normalization step.
- Tool changes: no new tools required.
- Remaining friction: live production validation is still the main gap for persistence claims; communication discipline is now documented but still needs reinforcement through future supervised runs.
- Next training focus: verify that future Datserok closeouts stay operationally single-threaded when discussing planning posture, confidence, and next steps during persistence incidents.

### 2026-06-01/02 - Agent-space maintenance: load discipline

- Prompt used: run the audit/prune workflow against Datserok's own workspace, not Gottspan or another agent.
- Behavior learned: Datserok's main performance risk is not artifact bulk; it is repeated startup/load language across the contract, SOP, and source-map surfaces.
- Behavior learned: default startup should load Datserok's compact control pack first, then add ownership docs, deeper persistence docs, and training artifacts only when the lane actually needs them.
- Behavior learned: Datserok's active context should not inherit prior incident narratives by momentum. Each persistence lane starts from current project evidence and current code; the source map is the first conditional proof map when source-of-truth routing, code ownership, or validation anchors are needed.
- Behavior learned: repeated self-audits should not automatically create new retained-history entries. Update one controlling policy surface unless the run teaches a genuinely new reusable lesson.
- SOP or template updates:
  - compressed Datserok's scoped instructions to distinguish default versus conditional loads;
  - compressed the SOP's surface inventory to point at the source map instead of repeating the full doc stack;
  - compressed the source map into a conditional proof map instead of a default boot surface;
  - removed a stale status block from the Datserok artifact README;
  - updated README trigger behavior to load the runtime policy first, then the source map only for substantive persistence proof;
  - added source-map guidance excluding reports, tools, run logs, workspace scratch, and prior-thread handoffs from default startup;
  - compressed tools inventory to route through the source map;
  - added a rule against retained-history entries for repeated maintenance runs with no new durable lesson.
- Tool changes: no new tools required.
- Remaining friction: retained reports remain small and useful, but future report growth needs a lightweight index before any deletion decision.
- Next training focus: enforce the new habit during the next Datserok production incident by proving the current seam before relying on any previous handoff.

### 2026-06-25 - Agent-space maintenance: learning triage

- Prompt used: make Datserok's SOPs, instructions, and memory better at preserving future learning without adding bloat.
- Behavior learned: Datserok needs a single post-run learning triage that decides whether a lesson belongs in memory, source map, runtime-load policy, retained report, training history, or nowhere.
- Behavior learned: future performance improves when Datserok records changed behavior rules and recurring failure patterns, but refuses to retain one-off chat noise or duplicate the same lesson across several surfaces.
- SOP or template updates:
  - added a learning-triage rule to Datserok scoped instructions;
  - added a self-audit learning-loop step to the SOP;
  - added closeout learning-triage rules to memory;
  - clarified that source-map-first repo inspection applies to substantive persistence lanes.
- Tool changes: no new tools required.
- Remaining friction: future runs still need discipline to avoid over-retaining incident-specific details.
- Next training focus: apply the learning triage after the next real persistence incident and preserve exactly one durable lesson if the run teaches something reusable.
