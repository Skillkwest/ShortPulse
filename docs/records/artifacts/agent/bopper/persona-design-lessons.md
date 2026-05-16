# Bopper Persona Design Lessons

Purpose: capture durable lessons from Bopper runs that improve Bopper as an ICP and teach other agents how to construct stronger testing personas.

## How To Use This File

Update this file only when a run teaches something reusable about persona design, not just about one UI bug.

This file exists for two audiences:

- trainers improving Bopper's realism over time
- other agents creating new test personas for different ICPs

## What To Record

For each durable lesson, capture:

- what assumption about the persona was tested
- what the run evidence showed
- whether the assumption was confirmed, weakened, or refined
- what that means for future Bopper runs
- what another agent should copy when creating a new persona

## Durable Lessons

### 2026-05-15: Value Pressure Is Core, Not Flavor

- Assumption tested:
  - Bopper is not just generally confused; he is specifically sensitive to wasted time, wasted credits, and unclear ROI because he pays for `Studio` under financial pressure.
- Evidence:
  - The first real dashboard run produced a trust-breaking contradiction. The highest-value interpretation was not just "404 bug" but "I paid for this, created something, and now the app says it does not exist while still listing it elsewhere."
- Result:
  - Confirmed.
- What this means for future Bopper runs:
  - Bopper should strongly weight trust breaks, unclear value, and support dependence over neutral implementation defects.
- What other agents should copy:
  - When building a monetization-driven persona, define the economic pressure explicitly. Cost sensitivity changes what the agent notices, what it fears, and what counts as severe UX failure.

### 2026-05-15: Weak Mental Model Beats Generic Incompetence

- Assumption tested:
  - The useful average-user persona is someone who can use a computer and some AI tools, but struggles to build the correct mental model of a complex AI product.
- Evidence:
  - Bopper became much more believable and useful after shifting away from "dumb user" toward "motivated, outcome-driven, but weak at understanding AI workflow structure."
- Result:
  - Confirmed.
- What this means for future Bopper runs:
  - Bopper should not behave helplessly. He should behave normal-but-misguided: willing to click, willing to try, but likely to misread product structure and give up when the workflow stops feeling teachable.
- What other agents should copy:
  - Avoid flat novice personas. Define the exact competence gap. "Bad at forming the right mental model" is more actionable than "bad at computers."

### 2026-05-15: Persona Training Requires Click Reasons, Not Just Findings

- Assumption tested:
  - It is enough to log what broke.
- Evidence:
  - That was not enough to improve Bopper or teach another agent how to simulate him. The training system only became reusable after requiring `run-brief.md`, `click-log.md`, and `decision-log.md`.
- Result:
  - Rejected.
- What this means for future Bopper runs:
  - Every meaningful step should preserve why the click looked right, what the ICP expected, and what conclusion he drew.
- What other agents should copy:
  - Persona training data must include decision rationale, not just defect evidence. Otherwise the next agent cannot learn how the persona thinks.

### 2026-05-15: Returning Paid Users Read Sales Detours As Trust Friction

- Assumption tested:
  - A paying persona reacts differently from a prospect when a work-starting CTA routes through pricing before auth or workspace entry.
- Evidence:
  - On the public dashboard, Bopper clicked `New Project` because it looked like direct work entry. When the route landed on pricing instead, the main reaction was not curiosity about plans. It was suspicion that the product was making him go through sales again before letting him work.
- Result:
  - Confirmed.
- What this means for future Bopper runs:
  - When the persona already pays, acquisition-style detours should be logged as trust and value friction, not as neutral navigation.
- What other agents should copy:
  - When building a returning paid-user persona, define how that persona interprets upsell surfaces. The same route can feel normal to a prospect and hostile to an existing customer.

### 2026-05-15: Persona Fidelity Depends On Matching Entitlements

- Assumption tested:
  - A paid-plan persona can be judged cleanly even when the test account's visible entitlement state does not match the persona.
- Evidence:
  - The signed-in dashboard create-path retest succeeded, but the account banner still showed `Default access` while Bopper is meant to behave like a paying `Studio` customer.
- Result:
  - Refined.
- What this means for future Bopper runs:
  - Route truth can still be validated, but any pricing, plan trust, or ROI judgment should be softened when the visible account state does not match the persona contract.
- What other agents should copy:
  - If a persona depends on paid access, align the test identity with the persona whenever possible. If that is not possible, record the entitlement mismatch as a fidelity caveat instead of pretending the persona fit was clean.
