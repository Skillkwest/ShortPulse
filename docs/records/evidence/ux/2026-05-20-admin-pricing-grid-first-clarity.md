# Admin Pricing Grid-First Clarity

Purpose: retain the second live UX evidence packet for ShortPulse, focused on the admin pricing workspace and the operator trust/clarity issues surfaced during the grid-first pricing calculator rebuild.

## Surface

- `/admin/pricing`
- runtime pricing draft/live control strip
- pricing grid
- supporting `Models`, `Plans`, and `Summary` calculator modules

## Observed behavior

Live operator feedback on the admin pricing page showed repeated friction in the same areas:

- too much helper text and explanatory copy
- simulator surfaces felt like separate products instead of part of the pricing tool
- the page felt more like an admin dashboard than a calculator
- the supporting modules were hard to read and did not visually align with the pricing grid
- columns in the supporting modules were disjointed, oversized, or cut off
- the page did not use enough horizontal space for a dense pricing workspace

The repeated correction pattern from operator feedback was:

1. the pricing grid should be the real calculator
2. supporting modules should sit below it, not compete with it
3. support modules should read as real columnar grids
4. helper text should be reduced sharply
5. the page should behave more like the small standalone calculator and less like a report console

## Likely hesitation or trust issue

This is primarily a clarity and operator-confidence problem.

The operator using `/admin/pricing` is trying to make debit-driving pricing decisions. If the page feels fragmented, verbose, or visually inconsistent, it teaches:

- the pricing authority is unclear
- analysis may not match what actually goes live
- the page requires interpretation before action
- the operator may save the wrong thing

That creates hesitation at exactly the wrong moment: when editing live-affecting pricing.

For a pricing control surface, confusion is not cosmetic. It is operational risk.

## Supporting evidence

### User-side evidence

The page was reshaped over multiple live iterations in direct response to operator feedback:

- “the main page should be wider”
- “the simulators should have their own grids”
- “the grid in the sim should be real columns”
- “the truth grid should be the calculator”
- “there is way too much helper text and info feels convoluted”

The repeated nature of those requests shows that the page was not initially communicating authority and flow clearly enough.

### Product contract evidence

- [docs/ux-decision-framework.md](../../../ux-decision-framework.md) says the next step should be obvious and clarity should beat configurability when extra controls add cognitive load.
- [docs/product-instrumentation.md](../../../product-instrumentation.md) identifies hesitation as a first-class signal and notes that good instrumentation should support decisions about simplifying a surface.
- [docs/adr/0068-model-pricing-control-plane.md](../../../adr/0068-model-pricing-control-plane.md) defines model pricing as a versioned control plane whose edits affect real billing authority.
- [docs/product/billing-pricing-catalog.md](../../../product/billing-pricing-catalog.md) distinguishes runtime AI model debit policy from the broader billing catalog, which increases the need for clear operator boundaries.

### Runtime/code evidence

- `frontend/pages/admin/pricing.tsx` now describes the page as a “Grid-first admin pricing calculator for draft runtime pricing and live policy saves.”
- `frontend/features/admin/PricingPolicyStatusBar.tsx` still carries important live/draft state, but also shows how explanatory copy can grow around a pricing authority strip.
- `frontend/features/admin/PricingCalculatorSupportStrip.tsx` is the supporting calculator area and demonstrates the need for grid-like visual alignment when presenting model, plan, and summary economics.

### Inference

The clearest operator model for this page is:

1. the truth grid is the calculator
2. the truth grid is the only promotable pricing source
3. the support modules interpret the grid rather than redefining pricing
4. the page should visually teach that contract without much prose

## Recommended decision

Treat `/admin/pricing` as a pricing workspace, not a generalized admin analysis page.

Immediate design decisions:

1. keep the truth grid as the dominant calculator surface
2. keep `Models`, `Plans`, and `Summary` as compact downstream support modules
3. make support modules inherit the grid’s visual language:
   - real columns
   - dense rows
   - aligned headers and values
   - minimal helper text
4. use live/draft language only where it helps an operator make a safe decision
5. avoid report-style framing that makes the user interpret instead of act

Recommended implementation and operations follow-up:

1. continue reducing copy that restates obvious behavior
2. keep testing support-grid column fit whenever fields change
3. prefer one clear operator flow:
   - edit pricing
   - inspect impact
   - save draft live

## Follow-up metric

For this surface, the most useful signals would be:

- time from page open to first draft edit
- time from first draft edit to save
- number of reset/revert actions before save
- repeated layout/clarity complaints from operators
- repeated requests to explain what goes live vs what is analysis-only

Expected improvement after the grid-first clarification work:

- fewer clarification passes before the operator is willing to save
- fewer requests to relabel or reposition controls
- faster pricing-edit completion
- stronger confidence that the grid is the real runtime pricing authority
