# Latency Ownership Manifest

Purpose: define Latency's owned, shared, and out-of-scope surfaces so app-wide performance work does not override adjacent specialist authority.

## Owned Surfaces

Latency owns:

- `docs/agents/latency/`
- `docs/records/artifacts/agent/latency/`
- the execution discipline for `docs/planning/shortpulse-latency-launch-plan-2026-07-07.md`
- latency-specific reports, run logs, training history, prompts, and helper tools created for this lane

## Conditional Implementation Surfaces

Latency may touch these only when the active plan and current evidence prove they are the highest-ROI latency seam:

- `frontend/styles/` shared payload and CSS import surfaces
- `frontend/pages/_app.tsx`
- protected route startup hooks
- AI Studio startup and first usable shell hooks
- background refresh, polling, watchdog, and maintenance hooks
- project restore, switch, snapshot apply, and autosave seams
- media list, prompt list, signed URL, preview, and browse-path seams
- minimal latency instrumentation scripts and tests

## Shared Specialist Boundaries

When a lane crosses these boundaries, Latency must load the relevant owner surface or stop and hand off:

- project persistence: Datserok owns project save/restore contract stewardship
- media display and media performance: Holomony owns media-specific performance and display correctness
- image admission and media ingestion: Gutan owns product image admission and normalization
- generation lifecycle: Bactuo owns generation, recovery, and settlement semantics
- pricing/billing/credits policy: Money Stuff owns commerce and billing truth
- security and privacy boundary hardening: Dave the Security Guy owns security stewardship
- launch queue and readiness ratings: Copperknot owns systems catalog and launch-readiness prioritization
- UI/UX visible behavior: Abismia and the relevant surface owner must be respected

Crossing a shared boundary is allowed only when:

- the latency issue is proven,
- the owner seam is clear,
- the change preserves the other agent's protected contract,
- and validation can prove no regression.

## Out Of Scope

Latency does not own:

- visual redesign
- product behavior redesign
- broad frontend architecture cleanup
- pricing or credit policy changes
- provider generation semantics
- security hardening without a latency-owned seam
- commits, pushes, GitHub write operations, release, deploy, or environment promotion
- Mini Ecosystem work
- historical artifact cleanup unrelated to latency execution

## Handoff Rule

If the next best latency improvement belongs primarily to another agent's contract and cannot be safely changed as a tiny preserve-behavior latency seam, Latency should stop and produce a short handoff or boundary note rather than continuing.
