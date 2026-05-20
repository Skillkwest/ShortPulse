# UX Evidence

Purpose: provide one durable home for retained UX evidence that explains where users hesitate, lose trust, recover, convert, or abandon important ShortPulse flows.

## What belongs here

- usability findings
- support-derived confusion patterns
- pricing hesitation findings
- auth and recovery friction notes
- onboarding drop-off observations
- output continuity or retrieval pain points
- short decision packets that connect observed behavior to a recommended UX change

## What does not belong here

- current source-of-truth product contracts
- active implementation plans
- raw telemetry dumps with no summary
- generic brainstorming without evidence

Use `docs/ux-decision-framework.md` and `docs/product-instrumentation.md` as the active contracts. Use this namespace for retained proof and learnings.

## Suggested packet shape

Keep UX evidence packets short and decision-oriented.

Recommended sections:

1. `Surface`

- the workflow or screen under review

2. `Observed behavior`

- what users did

3. `Likely hesitation or trust issue`

- what human problem the behavior suggests

4. `Supporting evidence`

- event signals, support examples, interview notes, or session observations

5. `Recommended decision`

- what should change and why

6. `Follow-up metric`

- what should improve if the change works

## File naming

Use compact, sortable names:

- `YYYY-MM-DD-<surface>-<topic>.md`

Examples:

- `2026-05-19-auth-password-reset-friction.md`
- `2026-05-19-pricing-credit-clarity.md`
- `2026-05-19-admin-pricing-hesitation-audit.md`

## How agents should use this namespace

Agents should read from this namespace when they need real UX evidence for:

- audits
- support triage
- pricing recommendations
- auth-flow recommendations
- onboarding or admin UX critiques

Agents should add to this namespace only when the finding is durable enough to matter beyond one chat reply.

## Current starting focus

The first evidence packets should target:

1. auth confirmation and password reset trust
2. pricing clarity and hesitation
3. admin pricing calculator comprehension

## Current packets

- `2026-05-20-auth-recovery-public-origin-trust.md`: production auth email links resolving to `localhost` instead of the real public origin, captured as a trust-surface failure rather than a narrow routing bug.
- `2026-05-20-admin-pricing-grid-first-clarity.md`: operator evidence showing `/admin/pricing` needed a grid-first calculator model, denser support grids, and less explanatory overhead to reduce hesitation around live pricing edits.
- `2026-05-20-support-auth-recovery-manual-intervention.md`: support-derived evidence showing that wrong-host production recovery flows should be classified as trust/recovery incidents and escalated instead of treated as ordinary login tickets.
- `2026-05-20-public-pricing-plan-selection-clarity.md`: customer-facing evidence showing `/pricing` should stay focused on plan selection, credit legibility, and intent-preserving auth handoff rather than internal pricing mechanics.
