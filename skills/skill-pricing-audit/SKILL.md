---
name: skill-pricing-audit
description: Audit AI Studio pricing/credit logic against model registry and SOPs; detect display vs debit drift.
---

# Pricing Audit

Purpose: verify pricing formulas, defaults, and debit behavior across AI Studio.

## When to use
- Any model/pricing change
- Any change to credits/debit logic
- Before MVP release readiness

## Sources of truth
- `frontend/features/ai-studio/logic/modelRegistry.ts`
- `frontend/features/ai-studio/logic/pricing.ts`
- `frontend/lib/model-runtime/pricingStrategies.ts`
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `docs/sops/sop_ai_studio_index.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_video_generation.md`

## Workflow
1. **Registry vs SOPs**
   - Compare `modelRegistry.ts` defaults (aspect/duration/resolution/audio) with SOP tables.
   - Flag any missing models or mismatched defaults.
2. **Pricing formulas**
   - Confirm each `pricingStrategy` maps to the intended cost formula.
   - Spot-check constants (USD rates) against SOP notes.
3. **UI cost display**
   - Validate that `useAiStudioViewModel` uses the same params that UI controls expose.
   - Ensure model picker, prompt cards, and generate buttons show consistent credits.
4. **Debit timing**
   - Ensure debits occur for create/image/video runs and for prompt refine/describe.
   - Ensure debit uses estimated cost when actual usage is unavailable.
5. **Report**
   - Output a short drift report: `match`, `mismatch`, or `missing` per model.
   - List required updates (SOPs, registry, pricing constants, UI).

## Output format (recommended)
```
Pricing audit report
- Models checked: N
- Matches: N
- Mismatches: N

Mismatches
- <model>: <issue> → <suggested fix>
```
