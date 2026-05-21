# Money Stuff Tooling Inventory

Purpose: record helper commands, scripts, tests, and future tooling needs for Money Stuff.

## Current Helper Paths

- Startup contract: `skills/skill-session-startup-contract/SKILL.md`
- Billing SOP: `docs/sops/sop_billing_credits_operations.md`
- Contract reconciliation script: `scripts/verify_billing_contracts_against_stripe.ts`
- Billing diagnostics route: `frontend/pages/api/admin/billing-diagnostics.ts`
- Stripe customer helper: `frontend/lib/server/api/stripeCustomer.ts`
- Run report template: `docs/records/artifacts/agent/Money Stuff/reports/run-report-template.md`

## Expected Validation Families

Use these when touched code makes them relevant:

- `npm -C frontend exec vitest run tests/api/subscription-change.test.ts`
- `npm -C frontend exec vitest run tests/api/stripe-customer.test.ts`
- `npm -C frontend exec vitest run tests/api/stripe-webhook.test.ts`
- `npm -C frontend exec vitest run tests/api/admin-billing-diagnostics.test.ts`
- `npm -C frontend exec vitest run tests/api/internal-billing-contract-renewals-run.test.ts`
- `npm -C frontend exec vitest run tests/pages/pricing.route-behavior.test.tsx`
- `npm -C frontend exec vitest run tests/pages/auth.route-behavior.test.tsx`
- `npm -C frontend exec vitest run tests/pages/profile.subscription-actions.test.tsx`
- `npm -C frontend exec vitest run tests/pages/profile.route-state.test.tsx`
- `npm -C frontend exec vitest run tests/pages/profile.storage-actions.test.tsx`

## Tooling Needs

- Add a true integrated subscription funnel test after the first stable end-to-end Stripe test-mode walkthrough is complete.
