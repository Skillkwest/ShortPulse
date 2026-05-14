# Gear Ball Shared File Risk Map

Purpose: name the files Gear Ball should treat as shared-risk surfaces during worktree batching so they are adapted or reconciled deliberately instead of staged blindly.

## Rules

| Path                                                     | Dominant owner     | Handling rule                                                                         | Why                                                                       |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `frontend/pages/ai-studio.tsx`                           | `ai-studio`        | Adapt manually. Pair with targeted AI Studio tests and final full-suite verification. | Central page shell with many downstream hooks and props.                  |
| `frontend/styles/admin.module.css`                       | `admin-ops`        | Stage by hunk or defer to a dominant admin batch.                                     | Cross-page admin styling makes unrelated regressions easy to hide.        |
| `README.md`                                              | `governance-docs`  | Prefer final docs reconciliation batch.                                               | Shared repo entrypoint and route/doc index.                               |
| `docs/README.md`                                         | `governance-docs`  | Prefer final docs reconciliation batch.                                               | Shared docs index.                                                        |
| `docs/routes.md`                                         | `governance-docs`  | Keep with route/API parity validation.                                                | Shared route inventory and route-doc drift source.                        |
| `frontend/tests/pages/admin.agent-instructions.test.tsx` | `tests-validation` | Re-run in isolation before the final full suite when touched.                         | Historically passes in isolation but times out under full-suite pressure. |
| `frontend/tests/api/error-logging-coverage.test.ts`      | `tests-validation` | Re-run in isolation before the final full suite when touched.                         | Guardrail file that often fails after API catch-block churn.              |

## Default Use

1. Check this map while building the batch manifest.
2. If a touched file appears here, note the handling rule in the manifest.
3. Prefer manual adaptation over whole-file transplant when the rule says `Adapt manually`.
4. Re-run suite-hot files listed here before the final full suite on large worktree runs.
