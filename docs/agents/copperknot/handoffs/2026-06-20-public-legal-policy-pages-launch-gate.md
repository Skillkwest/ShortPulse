# Next-Agent Handoff: Public Legal And Policy Pages Launch Gate

## Lane Id

`public-legal-policy-pages-launch-gate-2026-06-20`

## Why This Task

- Launch systems: `Quality of experience`, `Public entry and account trust`, `Credits, pricing, billing, and entitlements`
- Launch state: `Blocked - Policy Content Gate`
- Evidence level: `Repo Inspected`
- Human risk: `High`
- Why now: the shared public footer renders `Terms of Service`, `Privacy Policy`, and `Refund Policy` links, but the repo has no corresponding Next.js pages. A real customer can click a legal/policy link from acquisition or dashboard surfaces and land on a 404.
- Why Copperknot is stopping: creating legal, privacy, or refund text would be a public promise and policy change. Hiding the links would also be a public acquisition/UX/legal posture decision. Both cross Copperknot's approval boundary.

## Current Evidence

- `frontend/features/dashboard/components/PublicHomeFooter.tsx` links:
  - `/terms`
  - `/privacy`
  - `/refund-policy`
- `frontend/pages/` currently has no:
  - `terms.tsx`
  - `privacy.tsx`
  - `refund-policy.tsx`
- `rg` found no other existing Terms/Privacy/Refund route implementation or tests.
- `docs/routes.md` does not list those policy routes as active shipped pages.

## Required Context

Read first:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/agents/solo-owner-launch-trust-standard.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`

Inspect first:

- `frontend/features/dashboard/components/PublicHomeFooter.tsx`
- `frontend/features/dashboard/components/GuestDashboardView.tsx`
- `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx`
- `frontend/pages/pricing.tsx`
- `docs/routes.md`
- `README.md`

## Scoped Task

Resolve the public legal/policy link gate for launch without inventing policy.

Acceptable resolution paths:

1. User-approved policy content exists: implement the three canonical pages, update route docs, add footer/page route tests, and run focused validation.
2. User-approved temporary legal posture is to remove or suppress those footer links until policy content exists: remove links from the footer, update tests/docs, and record the explicit temporary decision plus removal condition.
3. User-approved external legal URLs exist: route footer links to those canonical destinations, update docs/tests, and record the external source of truth.

## Forbidden Scope

- Do not write Terms, Privacy, Refund, billing, data-use, or cancellation policy text from scratch without explicit user-approved content.
- Do not invent legal promises, refund promises, privacy claims, or Stripe/payment obligations.
- Do not hide legal links quietly as if the launch gate is solved; the decision must be explicit.
- Do not add fallback/legacy routes, placeholder policy pages, or "coming soon" legal pages.
- Do not commit, push, deploy, or release without approval.
- Do not change pricing, billing, subscription, refund, or data-retention behavior while resolving the footer-route mismatch.

## Done Proof

The lane is ready for Copperknot review when all are true:

- `/terms`, `/privacy`, and `/refund-policy` either resolve to approved canonical pages/URLs or are removed/suppressed by an explicit approved launch decision.
- Public footer tests prove the selected behavior.
- Route docs and README match the selected behavior.
- `npm -C frontend run docs:check` passes.
- Focused route/footer tests pass.
- The closeout states the exact production proof still needed after deploy.

## Stop Rules

Stop and return to the user if:

- approved policy content or approved external URLs are unavailable,
- the requested resolution changes billing/refund/data policy behavior,
- the implementation would require broad acquisition-footer redesign,
- or the route decision conflicts with launch/legal requirements.

## Required Closeout Report

Create:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/YYYY-MM-DD-public-legal-policy-pages-launch-gate-closeout.md`

Include:

- selected resolution path,
- approval source for policy/legal content or link suppression,
- files changed,
- tests run,
- production proof boundary,
- residual legal/policy risk,
- recommended Copperknot readiness decision.
