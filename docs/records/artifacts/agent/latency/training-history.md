# Latency Training History

Purpose: track supervised Latency runs, learned behavior, SOP changes, tool changes, and next training focus.

## History

### 2026-06-04 - Initial Latency setup

- Prompt used: create Latency as the durable owner of the ShortPulse latency lane, save the active goal prompt, and initialize an agent folder for instructions, memory, artifacts, SOPs, tools, and prompts.
- Behavior learned: Latency's authority is bounded to evidence-backed app latency and smoothness work under the active launch plan.
- Behavior learned: no UI, UX, behavior, layout, styling, design, or color-palette changes are allowed as latency tradeoffs unless the user explicitly approves the tradeoff.
- Behavior learned: a clean stop is sometimes the professional move when the next optimization would risk product behavior or cross into heavily dirty files.
- Behavior learned: Latency never commits changes, pushes to GitHub, or performs GitHub write operations.
- SOP or template updates: created Latency's contract, scoped instructions, memory, standing SOP, ownership manifest, goal prompt, workspace, tool placeholder, and retained artifact structure.
- Tool changes: no new tools created; existing latency, perf, e2e, type-check, and build commands were indexed for future use.
- Remaining friction: no frozen KPI baseline exists yet because Latency has not completed enough stable supervised runs to justify one.
- Next training focus: run the next Latency continuation from the new agent folder, enforce the four-question gate before editing, and refine the SOP from any friction.

### 2026-06-04 - Durable job description

- Prompt used: define Latency's job title and job description and save the job description durably.
- Behavior learned: Latency's role should be explicit as `ShortPulse App Latency Optimization Steward`, with job expectations separated from the broader SOP.
- SOP or template updates: added `docs/agents/latency/job-description.md` and linked it from the Latency README, scoped instructions, SOP load pack, and docs indexes.
- Tool changes: no new tools required.
- Remaining friction: no new SOP was needed because the existing Latency SOP already covers workflow execution.
- Next training focus: use the job description as the role boundary when future latency work risks becoming cleanup, redesign, or adjacent specialist work.

### 2026-06-04 - Gottspan onboarding verification

- Prompt used: onboard the new agent Latency.
- Behavior learned: Latency's initial package already matched the current agent-home pattern: active contract, scoped instructions, job description, goal prompt, memory, SOP, ownership manifest, workspace, tools placeholder, retained artifacts, and docs indexes were already present.
- SOP or template updates: no structural template was needed. Tightened memory, workspace, and artifact docs so the solo-owner/pre-launch frame, launch-trust rule, and canonical entrypoints are easier to load on future runs.
- Tool changes: none.
- Remaining friction: Latency still needs stable supervised continuation runs before a KPI baseline is worth freezing.
- Next training focus: run the next plan continuation through the four-question gate and refine only from observed friction.

### 2026-06-05 - Self audit and prune

- Prompt used: run `docs/agents/gottspan-the-admin/prompts/audit-and-prune-agent-prompt.md` against the receiving agent, Latency.
- Behavior learned: Latency's package was already compact, so deletion would add more risk than value.
- Behavior learned: the real context drag was authority drift from loading too much history and from memory carrying old run checkpoints as current truth.
- SOP or template updates: made `job-description.md`, `goal-prompt.md`, run logs, training history, reports, and workspace scratch conditional/on-demand loads instead of routine context.
- Memory updates: replaced stale current-checkpoint bullets with a default-load policy and a rule to re-prove old observations before using them.
- Tool changes: none.
- Remaining friction: no KPI baseline exists yet; defer until Latency has multiple stable, validated continuation runs.
- Next training focus: keep future Latency startup bounded to current source-of-truth docs, then load history only for explicit reconstruction, training, or proof tasks.

### 2026-06-05 - Runtime context expiry hardening

- Prompt used: rerun the receiving-agent audit/prune prompt and clear conversational context memory older than two hours.
- Behavior learned: Latency cannot physically erase the chat transcript, but it can stop treating old conversational context as usable authority.
- SOP or template updates: added a two-hour runtime-context expiry rule to Latency instructions, memory, and SOP.
- Compression updates: shortened `README.md` so default startup spends less context on details already owned by `AGENTS.md`, the SOP, and the launch plan.
- Tool changes: none.
- Remaining friction: the active launch plan is still large, but it remains the source of truth and should not be compressed inside this agent-maintenance lane.
- Next training focus: during future Latency runs, actively discard old chat-only claims and ask current repo evidence to carry the decision.
