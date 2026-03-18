# MRH2-P5-002 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P5-002`
- Lane: `Pipeline`
- Phase: `P5`
- Surface: `folder-scoped media/prompt list queries`

## Scope Closed
- Remove the pre-query membership id fan-in pattern from folder-scoped media and prompt list APIs.
- Preserve folder ownership validation, empty-folder behavior, and cursor ordering.
- Keep API payload shape unchanged by stripping embedded join rows before responding.

## Code Changes
- [list.ts](../../../../frontend/pages/api/media/list.ts)
- [list.ts](../../../../frontend/pages/api/media/prompts/list.ts)
- [media-list.test.ts](../../../../frontend/tests/api/media-list.test.ts)
- [media-prompts-list.test.ts](../../../../frontend/tests/api/media-prompts-list.test.ts)
- [folder-query-scalability-spec](../../media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md)

## Query Decision
- `media_files` folder filtering now uses `folder_membership:media_folder_media_items!inner()`.
- `media_prompts` folder filtering now uses `folder_membership:media_folder_prompt_items!inner()`.
- Both routes still validate owned-folder existence first so `404` remains distinct from a valid but empty folder.

## Targeted Tests
- `npm test -- --run tests/api/media-list.test.ts`
- `npm test -- --run tests/api/media-prompts-list.test.ts`

## Full Gates
- `npm run lint`
- `npm run type-check`
- `npm run build`
- `npm run docs:check`

## Results
- Targeted tests: pass
- `lint`: pass with the same two pre-existing unrelated warnings
- `type-check`: pass
- `build`: pass
- `docs:check`: pass

## Risk Review
- Folder queries no longer scale with membership id fan-in on the application side.
- The query still remains explicitly user-scoped on both the base table and the embedded membership relation.
- API payload shape remains unchanged because embedded membership rows are stripped before the response is returned.
- Empty-folder semantics remain deterministic after owned-folder validation because the inner join simply yields zero rows.

## Rollback
- Revert this slice to restore the pre-query membership fetch and `.in("id", ids)` / `.in("id", promptIds)` filter path.
