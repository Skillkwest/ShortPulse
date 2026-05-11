# ADR 0076: Model Inventory Is Operator-Only And Server-Allowlisted

## Status
Accepted

## Context
ShortPulse now supports multiple generation providers and several model families across AI Studio image, video, audio, and helper lanes. The platform goal is to make model onboarding, hiding, retirement, and removal easier for operators without opening inventory control to end users or letting unsupported model ids leak into provider execution.

The repo already moved a large amount of model policy into the catalog and registry layers, but route-level behavior had drifted in some audio lanes. Fal/Kie queued execution already resolved model ids through catalog-backed runtime config, while some ElevenLabs routes still accepted request-supplied model ids directly and only failed later if billing or provider behavior disagreed.

That shape is operationally weaker than the desired boundary because:

- product users can attempt arbitrary model ids on routes that should expose only one approved model family
- billing becomes an accidental backstop instead of the first explicit validation seam
- model onboarding and retirement remain less predictable if executable inventory is not enforced consistently at the server boundary

## Decision
- Keep model inventory code-owned and operator-managed only.
- Do not add user-facing or admin-facing CRUD for model inventory.
- Treat `frontend/lib/model-runtime/modelCatalog.ts` and the registry derived from it as the only source of truth for executable inventory.
- Require server routes to resolve approved model ids from catalog-backed selectors or explicit route allowlists for the exact workflow they serve.
- Reject unsupported model ids during request validation before billing or provider submission.
- Keep presentation policy separate from execution policy. UI surfaces may decide how to rank or describe approved models, but they do not decide which models are executable.
- Use lifecycle metadata plus `replacementModelId` for retirement/migration instead of ad hoc deletion.

## Consequences
- Positive:
  - Users cannot add, remove, or execute arbitrary models through product routes.
  - Operators get a clearer add/hide/retire workflow because execution authority is centralized.
  - Route behavior becomes more predictable across providers because every lane follows the same allowlist-first pattern.
  - Billing becomes a pricing/accounting layer instead of the first line of inventory enforcement.
- Negative:
  - Adding a new workflow-capable model still requires operator code changes until scaffold/tooling work is finished.
  - Some routes with explicit single-model allowlists look more restrictive than provider-native APIs, but that is intentional product policy.
- Follow-ups:
  - Keep extending `model:doctor` so route-policy drift is caught automatically.
  - Exercise one real `replacementModelId` migration on a hidden/deprecated model.
  - Reduce remaining file-per-model route-wrapper churn where it materially affects operator onboarding/removal.

## Alternatives considered
- Allow admin users to create/remove model inventory from UI:
  - Rejected because inventory mutations are architecture-level changes with pricing, validation, route, and retirement consequences that belong in reviewed code.
- Rely on billing/runtime failures to reject unsupported models:
  - Rejected because it validates too late and makes the control boundary inconsistent across providers.
- Keep provider routes fully provider-shaped and trust client-supplied model ids:
  - Rejected because product workflows expose curated model inventory, not arbitrary provider inventory.
