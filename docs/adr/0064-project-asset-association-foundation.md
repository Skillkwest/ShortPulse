# ADR 0064: Project Asset Association Foundation

## Status
Accepted

## Date
2026-04-23

## Context
ADR 0063 established project-owned workspace restore/write authority, but saved media and prompts were still only user-global library rows.

The product contract for Projects does not require turning the whole Media Library into a project-local inventory. Left-rail libraries remain broadly user-global. What Projects need is a durable way to say "this saved media" and "this saved prompt" belong to this project without duplicating the underlying assets.

## Decision
1. Keep `media_files` and `media_prompts` as the canonical user-owned inventory.
2. Introduce project association tables:
   - `project_media_items`
   - `project_prompt_items`
3. Use composite scope foreign keys so the database enforces same-user ownership across:
   - project association row
   - target project
   - target media/prompt asset
4. On project routes, save/autosave flows that create or reuse saved media/prompt ids must attach those ids to the active project.
5. Project workspace saves must also backfill associations from restore-relevant `savedMediaIds` and `promptId` values already present in the snapshot, filtering to caller-owned assets before association.
6. Reusing an already-saved media/prompt id on a project route must associate the existing asset with that project instead of forcing duplicate uploads or duplicate prompt rows.
7. This phase does not change the current global visibility of `All Media` or other user-global library surfaces.

## Consequences
- Positive:
  - Projects gain a durable asset-membership seam without duplicating the underlying media or prompt rows.
  - The current product contract stays intact: global libraries remain global while project ownership becomes explicit.
  - Future project folders can build on this association layer rather than on raw user-global media rows.
- Negative:
  - Asset association is still only one layer of the migration; generated-output authority and folder ownership remain separate follow-up cuts.
  - A project can still see user-global inventory outside its explicit association set until later library/folder cutovers happen.

## Follow-ups
1. Move generated-output authority onto project-owned seams.
2. Add project-scoped folder ownership over the associated asset set.
3. Decide whether restore-time verification needs to enforce association completeness beyond the current workspace-save backstop.
