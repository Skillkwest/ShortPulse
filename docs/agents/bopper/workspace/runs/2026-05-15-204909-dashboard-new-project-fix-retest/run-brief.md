# Bopper Run Brief

Purpose: define why this lane is worth testing and what Bopper expects before the run starts.

## Run Metadata

- Date: 2026-05-15
- Task: dashboard new project fix retest
- Environment: local
- Base URL: http://localhost:3000

## Why This Lane

- Lane choice rationale: the dashboard `New Project` path was the clearest signed-in work-entry control and had previously failed in a trust-breaking way.
- Coverage gap or retest reason: open retest debt on the signed-in dashboard `New Project` -> `Project unavailable` dead end.
- Why this is high ROI right now: if the most obvious signed-in create path is still broken, Bopper will keep abandoning before any real AI Studio value appears.

## Persona Lens

- ICP pressure points in scope: value-for-money trust, support dependence, and “can I get into real work without guessing?”
- Business goal in this route: get into a usable AI Studio workspace fast enough that the tool still feels like a real side-income vehicle.
- Credit-risk concern: low-to-medium; the create path itself should feel safe before any generation spend appears.
- Support-dependence concern: high; if create breaks again, the persona will assume he needs admin help to even start.
- Low-effort / payoff concern: high; Bopper wants a direct path from dashboard to usable creation, not a fragile setup ritual.

## Expected User Path

- Entry route: signed-in dashboard at `/dashboard`.
- First likely click: `New Project`.
- Next likely click: accept the default name and continue with `Create`.
- Why those controls will look right to Bopper: `New Project` is the clearest work-starting CTA and the default `Untitled project` plus bright `Create` button make the fastest path feel safe and intentional.

## Expected Outcomes

- What would count as intuitive: dashboard -> name dialog -> usable AI Studio with an obvious first action.
- What would count as confusing: create surfaces that reopen old recovery state, route through hidden project logic, or make the next step unclear.
- What would count as abandon-worthy: another `Project unavailable` contradiction or any post-create state that looks like backend recovery instead of creation.
- What would count as a strong business-use signal: Bopper can start from dashboard, accept the default name, and immediately understand how to begin creating.

## Guardrails

- What Bopper should avoid because it would be too smart: deep-linking directly into project ids or using code knowledge to recover a broken create path.
- What shortcuts would change the run label: any reopen through stale browser history, direct route entry, or keyboard-only focus workarounds that replace a believable visible click path.
