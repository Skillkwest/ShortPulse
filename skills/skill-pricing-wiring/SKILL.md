---
name: skill-pricing-wiring
description: Implement or extend shared-policy pricing display wiring for billable AI Studio surfaces without letting UI pricing drift from server debit.
---

# Pricing Wiring

Purpose: wire billable AI Studio surfaces onto the shared pricing display path while keeping server debit authoritative and helper flows explicitly out of scope.

## When to use
- Any time billable AI Studio buttons, model chips, or cost pills are being wired or refactored.
- Any time a billable surface still shows local fallback pricing.
- Any time a new billable generation surface is added.

## Sources of truth
- `frontend/lib/model-runtime/modelCatalog.ts`
- `frontend/lib/model-runtime/pricingPolicy.ts`
- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationBilling/pricingParams.ts`
- `frontend/features/ai-studio/logic/clientPricingDisplay.ts`
- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `scripts/check_ai_studio_pricing_display_drift.js`
- `skills/skill-pricing-audit/SKILL.md`

## Workflow
1. **Classify the action**
   - Confirm whether the target surface is:
     - `billable_shared_policy`
     - `non_billable_helper`
     - `legacy_local_pricing`
     - `blocked_until_migrated`
   - Do not wire helper flows into billable pricing accidentally.
2. **Confirm model and route ownership**
   - Identify:
     - model id source
     - pricing-param builder
     - submit route
     - server debit path
3. **Use canonical pricing params**
   - Reuse the existing request-shape builder family.
   - Do not invent per-component pricing params for billable actions.
4. **Use the shared client resolver**
   - Billable UI pricing must come from `clientPricingDisplay.ts`.
   - If live pricing policy is unavailable, billable UI should fail closed or show an explicit unavailable state.
5. **Preserve server authority**
   - UI pricing is a display estimate only.
   - Final debit must still come from the server billing path.
6. **Run drift checks**
   - Run:
     - `node scripts/check_ai_studio_pricing_display_drift.js`
     - `node scripts/print_ai_studio_pricing_action_inventory.js`
   - Then run the focused tests for the touched surfaces.

## Done state
- The surface uses the shared client pricing resolver.
- The surface no longer invents default billable credits locally.
- The displayed credits match the same pricing authority the server will use.
- The surface is explicitly excluded if it is helper-only.
- The drift checker and focused tests pass.

## Output format (recommended)
```text
Pricing wiring update
- Surface: <surface>
- Classification: <billable_shared_policy | non_billable_helper | ...>
- Shared resolver wired: <yes/no>
- Fail-closed behavior: <yes/no>
- Drift check: <pass/fail>
- Focused tests: <pass/fail>
```
