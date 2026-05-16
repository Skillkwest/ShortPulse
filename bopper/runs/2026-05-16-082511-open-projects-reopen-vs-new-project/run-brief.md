# Bopper Run Brief

Purpose: define why this lane is worth testing and what Bopper expects before the run starts.

## Run Metadata

- Date: 2026-05-16
- Task: Bopper compare Open Projects as the first deliberate entry path against New Project trust and reopening clarity
- Environment: local
- Base URL: http://localhost:3000

## Why This Lane

- Lane choice rationale: The top remaining dashboard lane was `Open Projects` as the first deliberate work-entry path because Bopper had already seen `New Project` from both public and signed-in angles.
- Coverage gap or retest reason: Bopper had not yet validated whether reopening saved work feels safer, clearer, or more trustworthy than starting a new project.
- Why this is high ROI right now: This persona is budget-sensitive and wants to get back to work fast. If reopen is clearer than create, that changes real dashboard design priorities.

## Persona Lens

- ICP pressure points in scope: time waste, unclear route semantics, dependence on admin help, and whether saved work feels dependable enough to build a side-income workflow on top of it.
- Business goal in this route: reopen an existing project quickly and feel like the product remembers prior work without making him guess.
- Credit-risk concern: low direct credit risk, but high value-risk if saved work cannot be reopened cleanly.
- Support-dependence concern: if the route to saved work is unclear or crashes, Bopper will assume he needs an admin to recover it.
- Low-effort / payoff concern: reopen should feel easier and safer than starting over, or the product starts to feel like too much work.

## Expected User Path

- Entry route: signed-in dashboard in a believable returning-user browser state.
- First likely click: `Open Projects`.
- Next likely click: choose a visible saved project card and reopen it.
- Why those controls will look right to Bopper: a returning paid user who already has work saved will prefer reopening before creating again, especially when money and time feel tight.

## Expected Outcomes

- What would count as intuitive: `Open Projects` is easy to find, the saved project list is understandable, and reopening lands in a stable AI Studio state.
- What would count as confusing: mixed public/signed-in entry signals, unclear project ownership, or a route that makes reopen feel riskier than starting over.
- What would count as abandon-worthy: rendering failures, contradictory saved-work states, or needing recovery/admin behavior just to reopen a project.
- What would count as a strong business-use signal: a clean reopen path that immediately reassures Bopper his saved work is safe and reusable.

## Guardrails

- What Bopper should avoid because it would be too smart: jumping directly to hidden routes, using internal state inspectors to decide the next click, or treating dev overlays as normal-user guidance.
- What shortcuts would change the run label: forcing authenticated state, route-jumping around the dashboard, or using non-visible project identifiers to reopen work.
