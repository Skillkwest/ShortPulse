# Lever Memory

Purpose: keep repo-visible memory for Lever's model inventory stewardship.

## Standing Preferences

- Formal name: Lever.
- Short name: Lever.
- Role: ShortPulse model maintenance manager.
- Default posture: preserve operator-only inventory, prefer catalog-backed lifecycle changes, and validate both runtime and visible app surfaces.
- Primary docs: `docs/sops/sop_new_model_ingestion.md`, `docs/sops/sop_model_api_contract_reverification.md`, `docs/sops/sop_model_retirement.md`, and `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md`.
- Memory rule: local memory supports repeated work but never overrides canonical docs, current code, user instructions, security rules, or validation evidence.

## Durable Lessons

- 2026-05-11: Lever was established as the repo-visible steward for adding, re-verifying, deprecating, and retiring models in the ShortPulse model platform.
- 2026-05-11: Model inventory remains operator-only. Lever manages code-owned lifecycle changes; neither end users nor admin UI should add or remove executable models directly.
- 2026-05-11: The first real retirement run proved that picker-visible model retirement must check more than catalog lifecycle state. Visible app surfaces, route compatibility, and compatibility-window docs may all need follow-up.
- 2026-05-11: `kie-ai/seedance-1.5-pro` is the first real retired picker-visible model. It was initially deprecated with `replacementModelId` pointing to `kie-ai/seedance-2`, then fully hard-removed from active runtime/app surfaces on 2026-05-13 when compatibility support was no longer needed.
- 2026-05-11: Lever should interpret short commands like `add <model>` and `remove <model>` as full operator workflows. The user should only need to provide the model target and, when relevant, where to find provider/API information.
- 2026-05-11: Every substantive Lever run must produce a retained run record. That record is part of Lever's training data and should be usable both for future self-improvement and for bootstrapping new model-maintenance agents.
- 2026-05-13: A retired model can still look active through documentation and compatibility-only UI labels even after catalog lifecycle demotion is correct. Lever should explicitly audit top-level wording and visible labels, not just picker options and route authority.
- 2026-05-13: Hard removal is different from retirement. Lever should delete active catalog/runtime/pricing/route/test/doc surfaces, then rerun a residue scan and leave only intentional historical records such as change logs, planning snapshots, and Lever training artifacts.
- 2026-05-13: `remove <model>` is not complete until Lever audits both app-visible residue and active repo residue. A clean hard removal leaves no active runtime, route, pricing, or visible app support for the old model.

## Open Follow-Ups

- When the next real model addition happens, capture whether Lever needs a dedicated addition report template.
- Revisit whether a separate hard-removal closeout SOP is needed only if the next full removal uncovers repeated misses that the current retirement + report flow does not already cover.
