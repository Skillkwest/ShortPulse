# Ledger SOP Notes

Purpose: track Ledger's workflow references and smaller operational notes that do not belong in the formal contract.

## Canonical SOP

The authoritative Ledger SOP lives at:

- `docs/sops/sop_billing_credits_operations.md`

## Supporting References

- `docs/product/billing-pricing-catalog.md`
- `docs/routes.md`
- `docs/adr/0059-billing-internal-comp-contracts-and-admin-exempt-renewals.md`
- `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
- `docs/adr/0069-admin-created-billing-plans.md`
- `docs/adr/0077-paid-starter-tier-with-hidden-free-default.md`

## Current Notes

- Treat customer commerce billing as four truths that must agree: public, commercial, billing/runtime, and support.
- Treat subscriptions and storage add-ons as one recurring-commerce lane.
- Treat credit packages as a one-time-commerce lane.
- Keep AI usage billing as a separate adjacent lane unless the user explicitly expands Ledger into that scope.
