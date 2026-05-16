# Bopper Run Brief

Purpose: define why this lane is worth testing and what Bopper expects before the run starts.

## Run Metadata

- Date: 2026-05-15
- Task: Bopper retest of dashboard New Project path, fallback to auth to dashboard if signed-in path is unavailable
- Environment: local
- Base URL: http://localhost:3000

## Why This Lane

- Lane choice rationale: top queue item was the signed-in dashboard `New Project` retest, but the actual visible app state opened on the public dashboard so the lane fell back to the public-entry auth-to-dashboard expectation path as planned.
- Coverage gap or retest reason: Bopper had prior evidence for the signed-in `New Project` dead end, but no real public-entry evidence for what a paying returning user sees before login.
- Why this is high ROI right now: this path decides whether a paying `Studio` customer can confidently move from public entry toward real work without feeling upsold, redirected, or lost.

## Persona Lens

- ICP pressure points in scope: paid-user value sensitivity, workspace-entry trust, support dependence, and low patience for pricing detours.
- Business goal in this route: get back into the product quickly and start content work, not shop plans again.
- Credit-risk concern: medium, because detours toward pricing make Bopper question whether he is about to pay again or choose the wrong path.
- Support-dependence concern: high, because if the public entry path is ambiguous he may need admin help before he even reaches his workspace.
- Low-effort / payoff concern: high, because a paying user expects faster workspace entry than a multi-step acquisition-style funnel.

## Expected User Path

- Entry route: public dashboard at `/`
- First likely click: `New Project`
- Next likely click: `Log in` if the route behaves like a public gate instead of a direct workspace entry
- Why those controls will look right to Bopper: `New Project` is the largest task-entry CTA and literally promises `Open the AI Studio`; once pricing appears, `Log in` is the obvious recovery path for someone who already pays for `Studio`.

## Expected Outcomes

- What would count as intuitive: a clear route from public entry into sign-in or directly toward AI Studio without plan-shopping ambiguity.
- What would count as confusing: `New Project` behaving like a sales CTA while sounding like a workspace CTA.
- What would count as abandon-worthy: a pricing detour plus another blocked step before any actual creation surface appears.
- What would count as a strong business-use signal: the path makes it obvious how a returning paid user resumes work quickly.

## Guardrails

- What Bopper should avoid because it would be too smart: deep-linking into `/ai-studio`, inferring hidden auth state, or pretending he already knows which public CTA is acquisition-only.
- What shortcuts would change the run label: using a saved internal route or non-visible navigation path instead of following the public `New Project` flow.
