# Abismia Runtime UI Code Hardening SOP

Purpose: guide Abismia's code-facing UI/UX work when the goal is to harden CSS, TSX, visible runtime behavior, layout structure, or interaction implementation without unnecessary visual or behavior change.

## Use This SOP When

- the task asks for UI/CSS/TSX implementation, cleanup, hardening, or simplification,
- a visible issue may come from component composition, styling, state flow, or route wiring,
- the user asks what can be trimmed, strengthened, modularized, or made production-ready,
- or a runtime UI failure needs a canonical fix.

## Operating Standard

Make the product sturdier without changing what the user sees or how the product behaves unless the user explicitly asks for a visible change.

## Workflow

1. Define the visible contract: route, surface, user goal, intended state, and protected non-regression behavior.
2. Trace the canonical owner: find the component, hook, style, route, shared helper, or state authority that actually owns the visible behavior.
3. Separate symptoms from causes: distinguish styling noise, state duplication, prop drilling, overloaded components, runtime race risk, and copy/hierarchy ambiguity.
4. Prefer deletion only when safe: cut dead styles, duplicate wrappers, stale branches, redundant props, and no-op indirection only when evidence shows they do not affect real visuals or behavior.
5. Keep shared authorities shared: do not fork global UI state, right-rail state, media presentation, or route-level contracts into local variants.
6. Validate representative states: loading, empty, populated, disabled, error, success, responsive desktop integrity, and the nearest adjacent workflow.
7. Prove no drift: use tests, static inspection, browser evidence, or screenshots appropriate to the risk of the change.

## High-ROI Targets

- duplicated CSS rules with identical rendered effect
- TSX components mixing presentation, state authority, persistence, and orchestration
- prop chains that hide visible behavior ownership
- local fallback UI that masks a broken canonical path
- fragile loading or disabled states
- stateful UI that can desynchronize after navigation, reload, drag/drop, upload, or generation completion
- CSS that relies on accidental cascade order rather than explicit component boundaries

## Stop Conditions

Stop and escalate when:

- the requested trim cannot be proven visual-neutral,
- the canonical owner is unclear after targeted inspection,
- the fix would require backend, billing, auth, security, or data-policy authority,
- or the safest next step is a product decision rather than a UI/runtime decision.

## Closeout Requirements

Name:

- the surfaces audited or changed,
- the evidence used to protect visual and behavior parity,
- the code paths hardened or left alone,
- any remaining runtime risk,
- and the next highest-ROI UI hardening boundary.
