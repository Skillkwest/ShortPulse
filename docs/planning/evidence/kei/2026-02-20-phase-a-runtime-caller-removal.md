# STG-04 Phase A Evidence (2026-02-20)

## Scope
- Removed active runtime KEI caller/type paths from AI Studio task orchestration.
- Preserved `/api/kei/*` tombstone routes for compatibility hold window.

## Changed files
- `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`
- `frontend/features/ai-studio/logic/stateParsers.ts`
- `frontend/features/ai-studio/logic/modelRegistry.ts`
- `frontend/features/ai-studio/constants.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
- `frontend/features/ai-studio/logic/__tests__/modelOptionsRegistry.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/__tests__/routing.test.ts`

## Verification commands
| Command | Result |
| --- | --- |
| `npm -C frontend run lint` | pass |
| `npm -C frontend run type-check` | pass |
| `npm -C frontend run test` | pass (747/747) |
| `npm -C frontend run docs:check` | pass |
| `npm -C frontend run build` | pass |

## Runtime KEI reference check
Command:

```bash
rg -n "kei|KEI" frontend/features frontend/lib/server frontend/pages --glob '!frontend/pages/api/kei/**' --glob '!frontend/tests/**'
```

Result:
- `frontend/lib/server/api/protectedApiPaths.ts:7` (`/api/kei/` tombstone protection remains by design)
- `frontend/features/ai-studio/logic/__tests__/modelOptionsRegistry.test.ts:20` (retired-provider assertion only)

## Stage status impact
- STG-04 Phase A: complete.
- STG-04 Phase B: pending.
- STG-04 Phase C: pending (compatibility window hold).
