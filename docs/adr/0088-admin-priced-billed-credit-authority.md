# 0088: Admin-Priced Billed Credit Authority

## Status

Accepted

## Supersedes

- `docs/adr/0068-model-pricing-control-plane.md` for AI usage billed-credit authority

## Context

AI usage pricing currently has two competing authorities:

- runtime/shared-policy pricing math used by billable UI surfaces and server debit paths
- workbook-style billed-credit values shown in `/admin/pricing`

That split has already produced drift between:

- the admin pricing grid
- AI Studio `Generate` button costs
- and live billed debits

ShortPulse now needs one operator-authored authority for AI usage pricing. Scott is the primary author of the admin pricing page and will set final billed-credit amounts manually per model variant.

## Decision

For AI usage pricing, the canonical authority is now the admin-priced `Billed credits` variant row managed through `/admin/pricing`.

This means:

1. The final billed-credit amount is operator-authored, not computed from shared-policy runtime math.
2. Billable product UI must read the canonical billed-credit variant row for the user’s exact configuration and display that value directly.
3. Server-side debit must read that same canonical billed-credit variant row and charge that same amount.
4. Missing variant rows must fail closed. The product must not silently fall back to shared-policy math, provider-derived estimates, or local pricing formulas for a billed action.
5. Shared-policy/runtime pricing math is deprecated as authority for AI usage billed credits. It may remain temporarily as migration-era implementation detail only until all billed surfaces and debit paths are moved onto canonical variant-row lookup.

## Consequences

### Positive

- One human-controlled price source for AI usage
- No display-vs-debit authority split once migration is complete
- Faster pricing changes without code-level formula coordination
- Cleaner audits because operator intent and runtime charge should match exactly

### Negative

- Every billed workflow needs a complete variant-row inventory
- Missing row coverage now becomes a hard blocker instead of a soft estimate gap
- Existing shared-policy documentation and runtime assumptions must be retired or rewritten

## Required Migration Rules

- Treat `/admin/pricing` as the authoring surface, but use the canonical stored billed-credit variant data behind it as runtime authority.
- Build one lookup path that resolves the billed-credit row from the real priced configuration.
- Use that same resolved value for:
  - generate button display
  - model picker cost chips
  - optimistic required-credit checks
  - submit observability metadata
  - server debit
- Do not ship any billed lane where display and debit read different authorities.

## Notes

- This ADR changes AI usage pricing authority only. Subscription, top-up, storage add-on, and Stripe contract authority do not change here.
- Scott remains the primary author of the admin pricing page implementation. Money Stuff owns pricing interpretation and downstream product billing behavior, not the page implementation itself.
