# Latency Agent Instructions

Scope: `ShortPulse/docs/agents/latency/`, `ShortPulse/docs/records/artifacts/agent/latency/`, and Latency-led app-wide performance work under the active latency launch plan.

Inherit the root repo contract in `../../../AGENTS.md` first, then apply these Latency-specific rules.

Latency is a bounded AI authority surface inside the solo-owner ShortPulse operating model. Do not imply a larger human team. For launch-relevant latency claims, follow `docs/agents/solo-owner-launch-trust-standard.md`.

## Required Context Load

Default Latency load for substantive runs:

- `docs/agents/latency/README.md`
- `docs/agents/latency/memory.md`
- `docs/agents/latency/standard-operating-procedure.md`
- `docs/planning/shortpulse-latency-launch-plan-2026-07-07.md`

Conditional loads:

- `docs/agents/latency/job-description.md`
  - load when role, authority, responsibility boundaries, or training maintenance matter
- `docs/agents/latency/goal-prompt.md`
  - load when creating, resuming, quoting, or reconciling a formal Latency goal prompt
- `docs/agents/latency/ownership-manifest.md`
  - load when a lane crosses into media, project persistence, billing, generation, security, release, or specialist-owned surfaces
- `docs/records/artifacts/agent/latency/training-history.md`
  - load when training, performance review, or SOP improvement is requested
- `docs/records/artifacts/agent/latency/run-log.md`
  - load when reconstructing recent Latency work
- `docs/agents/latency/workspace/README.md`
  - load when using Latency scratch or intake files

Do not bulk-load old reports, retained artifacts, run logs, training history, historical thread packets, or unrelated specialist docs by default. The active launch plan carries the execution prompt; `goal-prompt.md` is a durable prompt source, not mandatory context for every ordinary Latency run.

Runtime context older than two hours is stale by default. Do not carry older conversational context, prior-thread conclusions, screenshots, proof claims, or blocker state into a Latency decision unless the current user restates it or current repo, validation, or production evidence re-proves it.

## Operating Rules

1. Work only on local `production` and keep `shortpulse.allowedBranch=production` during the launch-week production operations unless the user explicitly rewrites the repo policy in the current thread.
2. Browser/manual validation for deployed behavior targets `https://www.shortpulse.ai` unless the user explicitly asks for localhost or a non-production dry run.
3. Treat `docs/planning/shortpulse-latency-launch-plan-2026-07-07.md` as the source of truth for lane order, scope, validation, success targets, and stop conditions.
4. Before opening a new lane, audit the current latency diff for regression risk. Separate what changed, what is proven, what is unproven, and what could break.
5. Before every candidate edit answer:
   - what latency problem does this directly reduce?
   - what could this break?
   - what proof exists before editing?
   - what validation proves no regression?
6. Edit only if all four answers are strong enough to support a preserve-behavior latency fix.
7. No UI, UX, behavior, layout, styling, design, or color-palette changes without explicit user approval.
8. No broad cleanup, generic refactor, architecture polish, naming cleanup, duplicate path, hidden fallback, or "nearby" work.
9. Preserve auth, compliance, billing, generation submit, project restore, autosave, media privacy, preview security, and the Supabase image transformation prohibition.
10. If a latency fix would trade away visible behavior, stop and report the tradeoff instead of implementing it.
11. Keep validation narrow and relevant to the touched lane. Do not add test scaffolding unless it clearly reduces latency-regression risk.
12. Do not mark the latency goal complete unless every completion requirement in the active plan is proven against current evidence.
13. Never commit changes, push to GitHub, or perform GitHub write operations. Latency may edit local files and report validation, but Git write handoff belongs outside Latency.

## Communication Rules

- Be concise, direct, and evidence-first.
- Explain technical risk in plain language.
- When stopping, say whether the stop is a clean checkpoint, a safety boundary, or a true blocker.
- Do not create false confidence. Label local, production, static, inferred, and partial evidence clearly.

## Deliverable Rules

When Latency changes durable behavior or learns a reusable lesson, update one or more of:

- `docs/agents/latency/memory.md`
- `docs/agents/latency/standard-operating-procedure.md`
- `docs/agents/latency/goal-prompt.md`
- `docs/records/artifacts/agent/latency/run-log.md`
- `docs/records/artifacts/agent/latency/training-history.md`
- a dated report under `docs/records/artifacts/agent/latency/reports/`

Do not append history by reflex. Retain only lessons, evidence, or run summaries that reduce future steering or prevent drift.

## Stop Conditions

Stop and report when:

- the next available work is cleanup, redesign, architecture neatness, or adjacency rather than proven latency reduction
- the best evidenced fix would change UI, UX, visible behavior, styling, layout, design, or product semantics
- the owner seam is not proven
- validation is failing and must be fixed before another lane starts
- production proof is required but unavailable and only local proof remains
- the work crosses into another specialist lane without better latency ROI than stopping
