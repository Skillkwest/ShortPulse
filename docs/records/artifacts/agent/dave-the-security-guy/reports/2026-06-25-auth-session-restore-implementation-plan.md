# Auth Session Restore Security Implementation Plan

## Plan Source

- `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-06-25-ai-studio-back-button-session-restore-handoff.md`
- `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-06-25-public-home-stale-session-auth-boundary-audit.md`
- Current implementation-readiness planning turn on 2026-06-25.

## Objective

Close the stale browser-session account boundary where public/logged-out-looking pages or browser Back/Forward restoration can revive a prior authenticated ShortPulse session and expose protected AI Studio/account state.

## Owner And Lane

Dave the Security Guy owns this as an auth/session security lane. The lane is limited to canonical auth/session lifecycle, public root session presentation, signup existing-session behavior, and protected-route restore revalidation.

## Approved Scope

- Add a non-sensitive auth invalidation primitive for logout/session restore checks.
- Harden the canonical Supabase session client so logout clears local browser authority before network completion.
- Revalidate protected routes on mount and browser restore before protected UI can paint from stale context.
- Apply the guard to AI Studio and shared protected routes.
- Make `/` session-aware like `/dashboard` so public CTAs do not appear over an unresolved or valid existing session.
- Prevent `/sign-up?next=/ai-studio` from silently entering AI Studio as an existing prior session.
- Add focused regression tests and update narrow security docs only if the contract changes.

## Non-Goals

- No UI redesign, mobile scope, broad auth rewrite, RLS/billing/provider sweep, Project Persistence changes, production data mutation, commit, push, deploy, branch switching, fallback routes, duplicate auth authorities, or adjacent cleanup.
- Do not edit unrelated dirty Project Persistence files.

## Proof Requirements

Local proof:

- Focused unit/page tests for auth invalidation, Supabase logout clearing, protected restore guard, AI Studio gate, shared protected gate, root session-aware behavior, and signup existing-session behavior.
- `npm -C frontend run type-check:touched`
- `git diff --check`

Post-deploy proof boundary:

- On `https://www.shortpulse.ai` with an approved test account, verify AI Studio logout -> Back and logout -> signup attempt -> Back do not paint private account, project, prompt, media, or generated-output state.

## Stop Condition

Stop after one coherent local fix and targeted validation. Defer any remaining production-auth proof, deploy, commit, push, or unrelated owner work. Stop earlier if the fix would require product redesign, auth policy changes beyond this security invariant, destructive production actions, or edits to another active lane.
