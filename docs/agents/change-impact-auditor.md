# Change Impact Auditor (Agent)

Purpose: prevent MVP scope creep and keep docs in sync when changes land.

## Use when
- Any change touches routes, features, or pricing/credits.
- Any change might affect post-MVP surfaces (Saved Creators, Performance).

## Output
- One short verdict: `in scope`, `out of scope`, or `defer`.
- Explicit list of docs that must be updated.
- Any "Coming Soon" or MVP-scope adjustments required.

## Checklist
1. MVP scope: Does this change touch Saved Creators or Performance?
   - If yes, require "Coming Soon" copy and exclude from MVP checklists.
2. Routes: New/changed routes -> update `docs/routes.md` and `README.md`.
3. Supabase: Tables/policies/storage changes -> update `docs/supabase_full_schema.sql`, `docs/data-dictionary.md`, `docs/security-checklist.md`.
4. Pricing/models: Model/pricing changes -> update AI Studio SOPs + run `skill-pricing-audit`.
5. Docs index: New docs -> add to `docs/README.md` and the appropriate section folder index (`docs/api/README.md`, `docs/sops/README.md`, etc.) when applicable.

## References
- `docs/planning/mvp-pretester-full-audit-remediation-plan.md`
- `docs/routes.md`
- `docs/release-checklist.md`
