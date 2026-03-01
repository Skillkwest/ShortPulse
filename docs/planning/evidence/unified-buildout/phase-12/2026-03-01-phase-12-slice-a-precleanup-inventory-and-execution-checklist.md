# Phase 12 Slice A Evidence: Pre-Cleanup Inventory And Execution Checklist

Date: 2026-03-01  
Owner: Engineering  
Status: Prepared (no removals executed)

## Objective
Prepare a complete cleanup/decommission inventory now so Phase 12 can execute quickly once canary and cutover signoffs are complete.

## Hard Guardrails
1. Do not remove compatibility code before Phase 04 and Phase 11 canary/cutover signoff.
2. Do not change public `/api/fal/*` contracts during pre-cleanup prep.
3. Keep provider cutover OFF by default.

## Inventory Buckets
1. Runtime flags to retire post-cutover:
   - Fal queue-status rollout controls used only during canary transition.
   - Kie dark-path enablement/allowlist flags once provider cutover is complete and stable.
2. Compatibility wrappers/shims to review:
   - Fal compatibility wrappers that now delegate to provider-integration seams.
   - Transitional route/runtime helper aliases introduced for migration safety.
3. Documentation references to update/retire:
   - Temporary canary live logs (replace with final signoff packet).
   - Sequencing-override notes once superseded by completed canary/cutover.
4. Test scaffolding to simplify after decommission:
   - Transitional parity checks that only exist to protect compatibility windows.

## Execution Checklist (Run Later)
1. Confirm canary + cutover gates are signed off.
2. Remove retired flags and dead compatibility branches in small slices.
3. Run required validation gates after each slice:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run test:phase11:fal-regression`
   - `npm -C frontend run docs:check`
   - `npm -C frontend run build`
4. Update tracker + stage docs + change log for each removal slice.
5. Hold final phase close until two consecutive green release cycles complete.

## Rollback Plan
1. Roll back by slice only; no program-wide reset.
2. Re-enable retired compatibility flags only if a verified regression requires rollback.
