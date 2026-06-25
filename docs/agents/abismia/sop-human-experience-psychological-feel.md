# Abismia Human Experience And Psychological Feel SOP

Purpose: guide Abismia's user-perspective UX audits when the goal is to understand how ShortPulse feels to a real human moving through the app, including trust, clarity, confidence, hesitation, perceived speed, and emotional load.

## Use This SOP When

- the task asks how the app feels, not only whether it works,
- the user asks for psychological experience, confidence, trust, hesitation, friction, or abandonment risk,
- a flow needs signed-in browser observation,
- or perceived latency and feedback quality matter to the UX conclusion.

## Operating Standard

Audit from the human user's point of view. Treat confusion, waiting without feedback, unclear next steps, weak affordances, and trust leakage as real UX defects even when the code is technically functioning.

## Evidence Sources

- production URL observation unless the current thread explicitly asks for local validation
- signed-in browser walkthroughs when credentials are available and the task requires authenticated behavior
- screenshots, timings, and route/context notes
- current code and docs only after the felt issue is named
- tests or diagnostics for latency and runtime confirmation when needed

Credential source for Abismia's authorized ShortPulse browser account is local-only:

- `/Users/worldbuilder/.codex/secrets/shortpulse-abismia.env`

Do not copy credential values into repo files, reports, chat closeouts, screenshots, logs, or test fixtures.

## Workflow

1. Name the human journey: user identity, route, goal, expected payoff, and emotional stakes.
2. Walk the flow as a human: notice hesitation, confidence, surprise, anxiety, fatigue, dead ends, and moments where the interface asks the user to trust it.
3. Measure perceived runtime: capture whether loading, disabled, empty, progress, completion, and error states explain what is happening quickly enough.
4. Check agency and control: verify that the user knows what action is available, what it will do, whether it is safe, and how to recover.
5. Separate feeling from implementation: describe the felt UX issue first, then trace code only when a fix or hardening decision is needed.
6. Avoid destructive validation: do not spend credits, submit expensive generations, alter real account data, or delete user assets unless explicitly authorized.
7. Report decision-grade findings: rank issues by user harm, confidence, and likely implementation leverage.

## Psychological Lenses

- Trust: does the product feel safe, honest, and in control of its promises?
- Momentum: does each screen make the next step obvious and worthwhile?
- Agency: can the user predict, interrupt, recover, or correct the flow?
- Perceived speed: does feedback make waiting understandable and tolerable?
- Cognitive load: does the UI reduce decisions or make the user hold too much in memory?
- Payoff: does the user see value quickly enough after investing effort?

## Stop Conditions

Stop and escalate when:

- a live walkthrough would require spending money, credits, or mutating production data without approval,
- the issue is really product positioning or pricing policy rather than UI/UX execution,
- the user journey depends on credentials, account state, or production data that is unavailable,
- or the finding cannot be separated from another agent's authority surface.

## Closeout Requirements

Name:

- the journey audited,
- the strongest psychological friction or trust hotspot,
- the evidence used,
- whether findings are production-backed or inspection-only,
- the highest-ROI fix or deeper diagnostic,
- and anything intentionally left untested.
