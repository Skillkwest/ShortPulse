# Public Pricing Plan-Selection Clarity

Purpose: retain a customer-facing UX evidence packet for the public pricing route, focused on why plan selection, auth handoff, and credit-value clarity should stay simple on `/pricing`.

## Surface

- `/pricing`
- public subscription-plan selection
- pricing-to-auth handoff

## Observed behavior

The current public pricing route is intentionally narrower than the admin pricing workspace.

It does a few specific things:

- loads only the live public billing catalog
- renders subscription plans as the primary decision surface
- preserves selected plan and pricing intent through the auth handoff
- hides the system free tier when a real starter plan exists

The route is not trying to teach internal debit math. It is trying to get a customer from “which plan fits me” to the next safe commercial step without extra cognitive load.

## Likely hesitation or trust issue

Public pricing is a caution surface.

The user is deciding:

- whether the product is worth paying for
- whether credits make sense
- whether the selected plan matches their workflow
- whether the next click will preserve what they already decided

If `/pricing` becomes too broad, too technical, or too noisy, the likely result is hesitation:

- repeated plan toggling
- abandoning before auth or checkout
- lower confidence that pricing is understandable

For this surface, clarity is more important than exhaustiveness.

## Supporting evidence

### Runtime/code evidence

- `frontend/pages/pricing.tsx` loads the live billing catalog snapshot server-side and renders only the public pricing route.
- `frontend/features/pricing/components/PricingRoute.tsx` explicitly frames the route around subscription plans, selected-plan context, billing interval selection, and the auth/checkout handoff.
- The same route tracks `pricing_viewed` and `upgrade_clicked` events, which matches the instrumentation contract that pricing should be measured as a decision surface rather than a generic marketing page.

### Test evidence

- `frontend/tests/pages/pricing.route-behavior.test.tsx` verifies that guest plan selection preserves the selected plan and intent through auth.
- The same test file verifies that when a real starter plan exists, the system free tier should not dominate the acquisition experience.

### Product contract evidence

- [docs/ux-decision-framework.md](../../../ux-decision-framework.md) says pricing should feel legible before it feels flexible.
- [docs/product-instrumentation.md](../../../product-instrumentation.md) treats pricing-page exits, repeated plan switching, and checkout-start behavior as hesitation signals.
- [docs/product/billing-pricing-catalog.md](../../../product/billing-pricing-catalog.md) separates public billing-catalog pricing from the internal model-debit policy, which is important because `/pricing` should not try to explain the admin control plane.

## Recommended decision

Treat `/pricing` as a focused plan-selection and purchase-confidence surface.

Immediate decisions:

1. keep subscription plans as the primary public pricing decision
2. preserve selected plan, interval, and intent through auth and checkout handoff
3. avoid mixing admin-style runtime pricing details into the customer route
4. keep credits legible in plan context rather than exposing internal debit mechanics
5. treat any loss of plan/intent context during auth as a trust regression

This keeps the route aligned with what a paying customer actually needs: confidence in the offer and continuity in the next step.

## Follow-up metric

The most useful measurements for this surface are:

- pricing page -> checkout or auth-start rate
- repeated pricing visits before checkout
- repeated plan toggling without advancement
- auth completion after plan selection
- checkout completion after plan selection

Expected improvement if this surface stays clear:

- fewer abandonments after plan selection
- higher continuity from pricing into auth/checkout
- fewer signs that users are confused about what plan they picked or what happens next
