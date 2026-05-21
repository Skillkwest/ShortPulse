# Gear Ball Retained Memory

Purpose: keep the retained Gear Ball working memory concise and execution-focused.

## Standing Notes

- Finish the run, then make the next run better.
- Prefer helper tooling over extra narration when friction is mechanical and recurring.
- Treat branch verification, manifest locking, preflight, and early validation as pre-commit gates, not cleanup.

## Active Execution Rules

- Full SOP runs end with: self-audit, score, tooling/SOP decision, and training-history update.
- Serialize all index-touching Git commands.
- Lock a batch manifest before the first staging step on large or mixed runs.
- Prefer file-backed manifests (`--files-from`, `--tests-from`) over long inline arg lists.
- Prefer explicit local binaries in hooks and helper tooling. Do not assume `npm` or `npx` is available on `PATH` when a repo-local binary or direct Node entrypoint is available.
- If repo-local `node_modules/.bin/*` wrappers fail because they resolve the wrong runtime or a broken native module, rerun `build` and the full suite through the approved Node 22 binary plus direct package entrypoints instead of retrying the wrapper path.
- If a blocking validation failure is fixed while a long-running build or full-suite session is already in flight, treat that older session as stale and rerun the required gates on the final tree before staging or pushing.
- Keep execution chatter near zero. Routine command progress, polling, and successful intermediate steps stay internal unless a blocker, approval need, or material plan change appears.
- Rebuild the next manifest from live `git status --short` after every commit.
- If validation generates new retained/support artifacts before the first Git write, rebuild the active manifest from live `git status --short` before staging.
- Run an inter-batch leftover audit after every commit and one final leftover audit before the first push.
- Treat shared hooks/pages/API routes and `frontend/package.json` as automatic early-build triggers.
- Treat generated docs, evidence packets, and agent artifacts as automatic early-`docs:check` triggers.
- For shared-contract changes, include downstream dependent tests in the first manifest. `gear-ball:preflight` now auto-infers preview-delivery, media-KPI, and character-layout fan-out, but manual review is still required for uncatalogued contracts.
- For AI Studio media-library contract changes, manually include controller, panel, and composer consumer tests when touching `mediaLibraryErrorText.ts` or `mediaListApi.ts`.
- Scope suite-hot admin/UI selectors to the owning card or dialog instead of broad page-level name matches.
- Qualifying route-smoke skips count as `smoke-incomplete`, not neutral.
- When route-level smoke fails on a route path that no longer exists, classify and repair the audit instead of treating the removed path as a product regression.
- A closeout is invalid the moment later product/docs/test work appears after the closeout draft or closeout commit.
- Runs below `9/10` should normally ship one mechanical remediation in the same run.

## Retained Improvement Focus

- Keep expanding helper-supported contract fan-out only when repeated misses justify it.
- Keep repo-visible memory short; detailed evidence belongs in `run-log.md` and retained reports.
