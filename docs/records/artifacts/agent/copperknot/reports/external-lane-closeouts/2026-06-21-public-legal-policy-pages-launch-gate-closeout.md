# Public Legal Policy Pages Launch Gate Closeout

Date: 2026-06-21

Lane: `public-legal-policy-pages-launch-gate-2026-06-20`

## Selected Resolution

Implemented the approved-content path:

- `/terms`
- `/privacy`
- `/refund-policy`

The shared public dashboard/home footer already linked to those routes. This closeout resolves the missing-page side of the gate by adding static Next.js pages rendered from the June 21, 2026 Austerity markdown publication candidates.

## Approval Source

The user explicitly identified `docs/agents/austerity/workspace/drafts` as the current drafts for Privacy Policy, Terms of Service, and Refund Policy, and identified `docs/agents/austerity/workspace/exports/2026-06-21-policy-pdfs` as the PDF versions whose text should be displayed. The implementation uses that provided text and does not author new legal policy language.

## Files Changed

- `frontend/content/legal/terms.md`
- `frontend/content/legal/privacy.md`
- `frontend/content/legal/refund-policy.md`
- `frontend/features/legal/`
- `frontend/pages/terms.tsx`
- `frontend/pages/privacy.tsx`
- `frontend/pages/refund-policy.tsx`
- `frontend/styles/legal-policy.css`
- `frontend/styles/globals.css`
- `frontend/tests/pages/legal-policy-pages.test.tsx`
- `frontend/tests/pages/dashboard.guest-route.test.tsx`
- `README.md`
- `docs/routes.md`

## Validation

Local/source proof:

- `npm run test -- tests/pages/legal-policy-pages.test.tsx tests/pages/dashboard.guest-route.test.tsx` passed at `2` files / `17` tests.
- `npx eslint features/legal pages/terms.tsx pages/privacy.tsx pages/refund-policy.tsx tests/pages/legal-policy-pages.test.tsx tests/pages/dashboard.guest-route.test.tsx` passed.
- `npm run type-check:touched` passed for touched frontend TypeScript paths.
- `npm run docs:check` passed.
- `git diff --check` passed.
- `npm run build` passed; Next generated `/terms`, `/privacy`, and `/refund-policy` as SSG pages.
- Built HTML under `frontend/.next/server/pages/` contains the expected legal page titles and publication-status text.

## Production Proof Boundary

This is local source/build proof only. After deploy, rerun production route proof against `https://www.shortpulse.ai` and verify:

- `/terms` returns `200`.
- `/privacy` returns `200`.
- `/refund-policy` returns `200`.
- public homepage/footer links navigate to those deployed pages.

## Residual Legal/Policy Risk

The published text still contains the source-provided publication-candidate status and placeholders such as legal entity, contact email, governing law, venue, and billing/support email placeholders. This implementation hosts the approved draft text; it does not convert those drafts into counsel-approved final legal policy.

## Recommended Copperknot Decision

Move the legal/policy footer-route gate from `Blocked - Policy Content Gate` to local/source-resolved pending deploy and production route proof. Keep residual policy/content finalization as a separate legal/counsel approval risk, not a routing or homepage-link blocker.
