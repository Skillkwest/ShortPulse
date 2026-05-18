# Gear Ball Training History

Purpose: record supervised Gear Ball runs, self-ratings, lessons, tool decisions, SOP changes, and next training focus.

## 2026-05-13: Self-Training Loop Added

Task: harden Gear Ball so every full commit/push SOP run ends with a retained self-review instead of relying on chat memory.

Actions taken:

- Added mandatory post-run self-audit and score requirements to Gear Ball's operating contract and worktree SOP.
- Added retained artifact space for Gear Ball under `docs/records/artifacts/agent/gear-ball/`.
- Added retained memory, run log, SOP references, tools inventory, and this training-history file.
- Reinforced the helper-tooling loop so Gear Ball explicitly decides whether new tooling is needed after each full run.

Training result:

- Gear Ball now has a durable place to accumulate performance ratings and process lessons across runs.
- Future improvements should be driven by retained evidence rather than ad hoc recollection.

Self-rating:

- Current structural readiness: `8/10`

Next training focus:

- Execute the next full worktree commit/push run using the new self-audit loop.
- Check whether the self-audit sections need a report template update after one real use.

## 2026-05-13: Space Audit And Organization Pass

Task: audit Gear Ball's repo space and make sure the retained area is organized enough to support long-term capability growth.

Actions taken:

- Audited the repo-visible Gear Ball area and the retained artifact area against the stronger agent spaces already in the repo.
- Added a retained `baseline-kpi.md` for measurable quality drift over time.
- Added a retained `reports/run-report-template.md` so substantive full runs have a default structure.
- Updated the artifact indexes so Gear Ball's retained space is discoverable and internally consistent.

Training result:

- Gear Ball now has the minimum structure needed for iterative quality improvement instead of only ad hoc memory updates.

Self-rating:

- Current structural readiness after audit: `8.5/10`

Next training focus:

- Use the retained run-report template on the next substantive full commit/push run.
- Revisit the baseline KPI thresholds after 2-3 scored Gear Ball runs.

## 2026-05-13: First Full SOP Run With Retained Self-Audit

Task: execute the first full Gear Ball SOP run that includes helper-tool validation, commit/push, retained self-audit, score, and training-history updates.

Actions taken:

- Validated the Gear Ball tooling/docs batch with `gear-ball:preflight` and `npm -C frontend run docs:check`.
- Committed and pushed the new helper tooling, retained artifacts, and SOP/contract updates on `working-development` as `9bc2861fe`.
- Produced the first retained post-push report and updated the run log, memory, and training history in the same supervised run.
- Hardened the SOP against a real slip found during execution: do not parallelize Git commands that compete for the index.

Training result:

- The new post-push loop works end to end and is now backed by retained evidence rather than only chat output.
- The helper-tooling investment was justified; validation was faster and more deterministic than earlier SOP runs.
- The remaining gap is operational discipline around Git serialization, not missing infrastructure.

Self-rating:

- Run quality: `8.5/10`

What went well:

- Scope stayed narrow and coherent.
- Preflight and docs parity both passed before commit.
- The push completed cleanly on the correct branch.
- The run ended with retained evidence instead of stopping at chat confirmation.

What slipped:

- I created an avoidable `index.lock` collision by running `git status` and `git commit` in parallel.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `yes`
- Change made: serialized Git-index operations are now an explicit Gear Ball rule

Next training focus:

- Run another mixed-lane full SOP using the new helpers and confirm the Git-serialization rule eliminates the only material process slip from this run.

## 2026-05-14: Three-Branch Promotion Run

Task: commit the current Nuclo parity-hardening lane on `working-development`, then promote the same result to `staging-preview` and `production`.

Actions taken:

- Validated the six-file Nuclo lane with `npm -C frontend run docs:check`, `node scripts/check_vercel_env_contract.mjs --environment development`, and `bash scripts/ops/supabase_public_schema_parity.sh --help`.
- Committed the lane on `working-development` as `788016344`.
- Promoted the same commit to `staging-preview` and `production` by updating the local allowed-branch contract before each branch switch and push, then restored the local workspace to `working-development`.
- Recorded the retained self-audit and documented that role-branch promotion runs should carry the closeout lane across the same branches when the user wants them aligned.

Training result:

- The branch-promotion flow is stable when the allowed-branch guard is updated before each switch/push.
- The current helper/tooling set was sufficient; no new script was needed.
- The durable lesson from this run is about scope discipline: the post-run audit lane is part of the promoted result, not an afterthought on only one branch.

Self-rating:

- Run quality: `9/10`

What went well:

- Validation was correctly scoped and passed on the first attempt.
- The feature commit promoted cleanly across all three role branches.
- The local workspace and allowed-branch contract were restored cleanly at the end.

What slipped:

- No material execution slip surfaced in this run.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: yes, in Gear Ball memory and retained memory

Next training focus:

- Use the same three-branch promotion discipline on a larger mixed-lane run and confirm the retained closeout lane remains lightweight enough to keep branch alignment practical.

## 2026-05-14: D-Bug Handoff Stabilization Run

Task: accept a D-Bug handoff for the current `working-development` stabilization lane, verify the branch baseline, commit the lane in logical batches, and push the result.

Actions taken:

- Read the new `CURRENT-HANDOFF.md` files for Gear Ball and Nuclo and used them to separate local worktree execution from hosted SQL remediation ownership.
- Re-ran the branch baseline before staging:
  - `npm -C frontend run docs:check`
  - `./node_modules/.bin/tsc --noEmit --pretty false`
  - `./node_modules/.bin/eslint . --quiet`
  - `npm run test:adaptive-v2-gate`
  - `npm run deadcode:check`
  - `npm run build`
  - `npm audit --omit=dev --audit-level=moderate`
  - `npm run test`
- Committed three logical batches on `working-development`:
  - `a753b6eb6` `docs(agents): add explicit debug handoff ownership`
  - `dfe526061` `fix(app): harden auth recovery and ai-studio persistence`
  - `60447426e` `fix(ops): add hosted sql lint remediation path`
- Pushed `working-development` after the full baseline stayed green.

Training result:

- The handoff flow worked: D-Bug narrowed and packetized the lane, Gear Ball executed the commit/push work without mixing in Nuclo’s hosted remediation responsibilities.
- The current helper/tooling stack was enough; no new script was required.
- The most useful lesson from this run is contract hygiene: if agent READMEs now point to `CURRENT-HANDOFF.md`, those files must be committed as part of the agent/docs batch.

Self-rating:

- Run quality: `8.5/10`

What went well:

- The full branch baseline stayed green on the first rerun.
- The lane was split into durable docs/agent, app, and ops commits instead of one giant blob.
- The hosted SQL remediation path was kept in the repo while the actual environment mutation stayed with Nuclo.

What slipped:

- The main app batch was still broad. It was coherent enough to ship, but it was larger than ideal for future rollback.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`

Next training focus:

- On the next large handoff lane, see whether the app stabilization batch can be split one step further without losing validation clarity.

## 2026-05-14: Nuclo Hosted SQL Remediation Handoff Packet

Task: publish the new Nuclo and D-Bug handoff packet on `working-development`, then close the run with the retained self-audit loop.

Actions taken:

- Validated the six-file docs/handoff packet with `node scripts/ops/gear_ball_preflight.mjs --files ...` and `npm -C frontend run docs:check`.
- Committed and pushed the packet on `working-development` as `4ba003d99`.
- Updated Gear Ball retained memory, run log, and training history to capture the cross-agent handoff-chain lesson from the run.

Training result:

- The narrow handoff-publish path is stable and does not need new tooling.
- The durable lesson is about chain completeness: when a handoff spans canonical agent docs, retained artifact pointers, and a workspace intake file, all three need to move together.
- The current helper stack is sufficient for small docs-only SOP runs.

Self-rating:

- Run quality: `9/10`

What went well:

- Scope stayed narrow and coherent.
- Validation passed on the first attempt.
- The publish path stayed on `working-development` and ended with a clean push.

What slipped:

- No material execution slip surfaced in this run.

Capability decision:

## 2026-05-17: Production Create Workflow And AI Studio Run

Task: run the full Gear Ball SOP on `production` for a mixed Create Workflow agent-packet lane, a large AI Studio/runtime lane, and the matching docs reconciliation lane.

Actions taken:

- Locked three disjoint manifests under `/tmp/gear-ball-run-2026-05-17/` before the first staging step.
- Validated the docs lane with `gear-ball:preflight` and `npm -C frontend run docs:check`.
- Validated the product lane with `gear-ball:preflight`, a targeted Vitest slice, `npm -C frontend run build`, and a full `npm -C frontend run test`.
- Committed three logical batches on `production`:
  - `c88a5c1ea` `docs(agents): add create workflow training packet`
  - `84684b88d` `feat(ai-studio): harden create workflow and media surfaces`
  - `bcd47fc7a` `docs: reconcile create workflow and ai-studio indexes`

Training result:

- The stronger preflight/build/docs sequence worked; there were no late build or full-suite surprises after the final rerun.
- The inter-batch leftover audit proved its value by catching two test files that had slipped outside the product manifest.
- No new tool was required; the current guardrails were sufficient when actually followed.

Self-rating:

- Run quality: `9/10`

What went well:

- The batch manifests were clean and disjoint.
- The full suite stayed green after the targeted fixes.
- The leftover audit caught the only scope miss before push.

What slipped:

- Two isolated test-only fixes were not added back into the active product manifest before the first staging pass.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`

Next training focus:

- On the next long mixed run, append any file touched during isolated rerun fixes back into the active manifest immediately instead of relying on the leftover audit to catch it.

## 2026-05-18: Production Create Composer And Voices Run

Task: run the full Gear Ball SOP on `production` for the AI Studio create-composer/voices surface refactor and the matching docs reconciliation lane.

Actions taken:

- Locked one product manifest and one docs manifest under `/tmp/gear-ball-run-2026-05-18/`.
- Preflighted the docs lane, fixed four Prettier-only docs files, and revalidated with `docs:check`.
- Preflighted the product lane, fixed one `VoicesPropertiesPanel.tsx` lint issue and one `next/image` test shim issue, then validated the changed-test slice.
- Ran `build`, found a real type regression in `frontend/lib/server/projectsService.ts`, fixed the nullable filter guard, reran the affected test, reran `build`, and reran the full suite.
- Committed two logical batches on `production`:
  - `60d3a54ff` `feat(ai-studio): reshape create composer and voice surfaces`
  - `2d84a7da6` `docs: reconcile create composer route and SOP indexes`

Training result:

- The early-build rule was justified again; the build caught a real issue that the targeted test slice and the first full-suite pass did not.
- The current helper/tooling stack was sufficient. No new script or SOP change was required.
- The lane remained reviewable because product and docs stayed separate after validation finished.

Self-rating:

- Run quality: `8.5/10`

What went well:

- Preflight surfaced cheap formatting/lint issues before commit time.
- The final full-suite rerun stayed green after the build-only fix.
- The worktree stayed cleanly partitioned into product and docs batches.

What slipped:

- The first full-suite pass happened before the build-only type regression was resolved.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`, in retained history/report only

Next training focus:

- On the next shared-server-file lane, run the early build immediately after the changed-test slice instead of waiting until the first broad checkpoint finishes.

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`

Next training focus:

- Keep the same narrow-batch discipline on the next handoff-only run and confirm the retained closeout stays lightweight enough to remain routine.

## 2026-05-14: Vault Secret Helper Hardening

Task: publish the narrow SQL ops-script fix on `working-development`, then close the run with the retained self-audit loop.

Actions taken:

- Validated the two SQL helper scripts with `node scripts/ops/gear_ball_preflight.mjs --files ...`.
- Committed and pushed the fix on `working-development` as `eaeadaa98`.
- Updated Gear Ball retained memory, run log, and training history with the deterministic `psql \gset` branching lesson from the run.

Training result:

- The helper stack is sufficient for tiny SQL ops-script runs.
- The durable lesson is procedural: `psql` helper scripts should emit an explicit boolean existence flag instead of inferring existence from a variable that may be omitted by a zero-row `\gset`.
- No new tool or SOP change was needed.

Self-rating:

- Run quality: `9/10`

What went well:

- Scope stayed narrow and coherent.
- Validation passed on the first attempt.
- The publish path stayed on `working-development` and ended with a clean push.

What slipped:

- No material execution slip surfaced in this run.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`

Next training focus:

- Keep using the same minimal-batch path for repo-only operational fixes and confirm the retained closeout remains cheap enough to do every time.

## 2026-05-14: Public-Origin Authority Hardening

Task: publish the auth/public-origin authority lane on `working-development`, then close the run with the retained self-audit loop.

Actions taken:

- Validated the lane with targeted auth/env tests, `npm -C frontend run build`, `npm -C frontend run docs:check`, and a final full `npm -C frontend run test`.
- Committed and pushed the feature batch on `working-development` as `6f1ab4ae1`.
- Fixed the retained helper friction from the run by allowing canonical example env files through `gear-ball:preflight`, then updated retained memory, run log, tools, and training history.

Training result:

- The feature lane shipped cleanly, but two suite-hot guardrails (`error-logging-coverage` and `runtime-sql-security-audit-script`) still needed stale test updates before the full suite could go green.
- The most useful tooling improvement was small and justified: preflight now distinguishes example env files from real env files.
- The current SOP and helper set are otherwise sufficient for this class of route/env/doc lane.

Self-rating:

- Run quality: `8.5/10`

What went well:

- The lane stayed coherent across runtime helpers, auth routes, env validators, docs, and tests.
- Focused validation caught the real issues before publish.
- The final build, docs check, and full suite all passed before commit readiness.

What slipped:

- The helper initially blocked `.env.agent.local.example`, which created unnecessary friction.
- Two suite-hot guardrail tests were stale and were only surfaced by the full-suite rerun.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `yes`
- Change made: `gear-ball:preflight` now allows documented example env files while still blocking real env files

Next training focus:

- Add more explicit suite-hot coverage guidance for guardrail tests that tend to drift when runtime audit scripts or route-level logging policy changes.

## 2026-05-15: Auth Email Hardening And Agent Scaffolding Run

Task: run the full Gear Ball SOP on a mixed worktree containing a Supabase auth-email hardening lane plus new Ayal/Beeper agent scaffolding, then push `working-development`.

Actions taken:

- Loaded the auth-email docs and route context, then split the worktree into an auth/app lane and a new-agent lane.
- Ran batch validation:
  - `node scripts/ops/gear_ball_preflight.mjs --files ...` for both lanes
  - `npm -C frontend run docs:check`
  - `npm -C frontend run test -- tests/pages/auth.callback.route-behavior.test.tsx tests/pages/auth.route-behavior.test.tsx tests/pages/profile.account-actions.test.tsx`
  - `npm -C frontend run build`
  - `npm -C frontend run test`
- Fixed only formatting drift surfaced by preflight.
- Committed three logical batches on `working-development`:
  - `0f2b2fdae` `feat(auth): harden supabase auth email flows`
  - `7013b198a` `docs(agents): add ayal and beeper contracts`
  - `ddeb9624b` `docs: reconcile auth and agent indexes`
- Hardened the Gear Ball branch contract in the SOP and README during closeout after catching a local branch-drift slip.

Training result:

- The validation ladder was strong enough; no product-code fixes were needed after the broad gates.
- The most important gap was execution discipline, not missing tooling: I launched parallel Git writes and hit `index.lock`, and I also allowed the local checkout to stay on `production` until after the first commit attempt.
- The right improvement is contract hardening around branch enforcement before the first Git write, plus stricter obedience to serialized Git operations.

Self-rating:

- Run quality: `7/10`

What went well:

- Batch splitting was coherent.
- Preflight, docs parity, targeted auth tests, build, and the full suite all passed.
- The auth lane and the new-agent lane both landed cleanly on `working-development`.

What slipped:

- I repeated a known `index.lock` failure by attempting parallel Git writes.
- I committed the first batch on a drifted local `production` checkout before moving it to `working-development`.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `yes`
- Change made: Gear Ball now treats the standing approved branch as something to enforce before the first Git write, and the contract explicitly reiterates Git-write serialization.

Next training focus:

- On the next full SOP run, verify that the branch is corrected to `working-development` before any staging and keep all Git-index operations strictly serialized.

## 2026-05-15: Production Prelaunch Mixed-Worktree Run

Task: execute a full Gear Ball SOP run directly on the temporary prelaunch `production` branch, commit all approved work, and push only `production`.

Actions taken:

- Validated the mixed production worktree with targeted product tests, `docs:check`, `gear-ball:preflight`, `npm -C frontend run build`, and the full frontend suite.
- Published the production product lane in `d49aaa91e` with AI Studio project-route recovery, media preview/runtime telemetry, preview backfill scripts, and SQL execute-posture hardening.
- Published the Beeper and D-Bug prelaunch audit record lane in `35c9a1dc9`.
- Caught one adjacent Beeper scoring lane that was still dirty after the first two commits, validated it, and published it in `1a2fc669b` before push.
- Added a retained SOP/memory rule requiring a final leftover audit after the commit series and before the first push.

Training result:

- The validation ladder was strong: no post-suite product fixes were needed.
- The main process miss was manifest completeness, not code correctness. A side documentation lane remained dirty after the first commit series.
- The right correction is procedural: final pre-push leftover classification, not new tooling.

Self-rating:

- Run quality: `8.5/10`

What went well:

- Full-suite pressure stayed green.
- Batch boundaries were coherent once staged.
- The production-only branch override was respected through the whole run.

What slipped:

- The first manifest did not capture one adjacent Beeper score-system lane.
- I only discovered that lane during the post-commit `git status` audit.

Capability decision:

- New tool needed: `no`
- Existing helper update needed: `no`
- SOP/doc update needed: `yes`
- Change made: Gear Ball now requires a final leftover audit after the batch commit series and before the first push.

Next training focus:

- On the next large mixed run, treat the final `git status --short` classification as a hard gate, not a courtesy check.

## 2026-05-15: Production Route Retirement And Audit Expansion Run

Task: run the full SOP on the temporary prelaunch `production` branch for a mixed worktree covering standalone Media Library retirement, AI Studio/media persistence hardening, and expanded Beeper/D-Bug production audits.

Actions taken:

- Cleared a docs blocker by stripping repo-local absolute markdown links out of the new Beeper and D-Bug packets before rerunning `docs:check`.
- Fixed a real hook regression in `useMediaAutosavePreference` (`sessionUserId` write path) and stabilized its focus-retry test.
- Caught a build-only type regression in `useExpertEditStageInteractions` after the targeted slice and full suite were already green, then reran build and the full suite after the fix.
- Published four logical commits on `production`:
  - `ccdd3f41d` `feat(ai-studio): retire standalone media library route`
  - `260c1e780` `fix(ai-studio): harden saved media authority`
  - `e8c5d2053` `docs(media): reconcile standalone library retirement`
  - `4d64f7f34` `docs(beeper): record deeper production audit lanes`

Training result:

- The validation ladder was materially stronger because `docs:check` ran before staging and `build` stayed in the gate after targeted tests.
- The main miss was assuming the targeted product slice plus full suite were enough; the build still caught a type error those tests did not exercise.
- Beeper/D-Bug report packets are still prone to local absolute-link drift when generated quickly; early docs validation remains the right containment step.

Self-rating:

- Run quality: `8.5/10`

What went well:

- The mixed worktree was split coherently into product, follow-up product, media docs, and audit artifacts.
- The final full suite stayed green after the fixes.
- The production-only branch contract held for the entire run.

What slipped:

- The autosave hook regression and the `useExpertEditStageInteractions` type mismatch were both avoidable first-pass misses.
- The new audit docs still defaulted to invalid repo-local absolute links and needed cleanup.

Capability decision:

- New tool needed: `no`
- Existing helper update needed: `no`
- SOP/doc update needed: `no`

## 2026-05-16 - Production expert-edit control-plane and retained packet closeout

Prompt cadence used:

- run sop

What changed in this run:

- Published the production AI Studio/admin lane for expert-edit system presets, runtime prompt/version hardening, media-panel KPI scoring, billing guardrail updates, and SQL migration `125`.
- Closed out the remaining Beeper/Bopper/System Catalog/Gear Ball/Holomony packet lane and recorded the retained report for this production run.

What worked:

- The early build gate caught a type-contract mismatch in the character-mode decision helper before any commit.
- The full-suite rerun found the only real remaining regressions, and both fixes stayed inside test scope.
- The inter-batch leftover audit kept the product lane and retained-doc lane separated cleanly.

What failed or slipped:

- My first `gear-ball:preflight` attempt from repo root was clumsy under `zsh`, so I had to fall back to direct validation commands.
- Two suite-hot UI tests still depended on brittle accessible-name matching and only broke under full-suite pressure.

Durable lesson:

- When card buttons derive their accessible name from nested title + body text, click the intended action by scoping to the card or dialog container instead of relying on an exact name string.
- When a page has repeated `Save` buttons, scope the interaction to the active dialog/card. Unscoped role queries are not stable enough for suite-hot admin pages.

Self-rating:

- Run quality: `8.5/10`

Capability decision:

- New tool needed: `no`
- Existing helper update needed: `no`
- SOP/doc update needed: `yes`

## 2026-05-16 - File-backed preflight and route-smoke hardening

Task: convert the remaining repeated execution friction from recent scored runs into durable helper and SOP changes before the next full SOP cycle.

Actions taken:

- Added `--files-from` and `--tests-from` support to `scripts/ops/gear_ball_preflight.mjs` so large runs can preflight newline-delimited manifests instead of long shell arg lists.
- Updated the Gear Ball contract, SOP, retained memory, tools inventory, KPI baseline, and retained report template to treat file-backed preflight manifests as the preferred path for large runs.
- Added a route-level browser-smoke expectation for interaction-heavy admin or frontend route changes when a local verification target is already available.
- Recorded the change in retained docs so the next run can execute against the new guardrails instead of relying on thread memory.

Training result:

- The remaining friction was mechanical, not conceptual.
- Gear Ball now has a lower-friction repo-root preflight path and a stronger explicit gate for route-level regressions that tests/build may miss.
- The next score increase depends on clean execution against these rules, not more missing documentation.

Synthesized pattern summary:

- Repeated misses across recent runs came from Git serialization, branch drift before first write, leftover adjacent lanes, repo-root Vitest path mismatches, and late build/docs discovery.
- Those process-shape failures are now directly covered by helper support and SOP gates.
- The next likely miss surface is real route behavior, so the browser-smoke gate is now explicit.

Self-rating:

- Structural readiness after this hardening pass: `9/10`

Capability decision:

- New tool needed: `no`
- Existing helper update needed: `yes`
- Change made: preflight now accepts file/test manifests and the SOP now requires route-level smoke on qualifying runs

Next training focus:

- Use file-backed preflight manifests on the next substantial SOP run.
- Execute the new route-level smoke gate on the next interaction-heavy admin/UI lane and record whether it catches anything tests miss.

## 2026-05-15 - Post-Run Process Tightening

Task: encode the specific changes needed to move Gear Ball closer to a `10/10` run quality after the latest production SOP passes.

Actions taken:

- Added a hard rule that large or mixed worktrees must get a batch manifest before the first staging step.
- Added an inter-batch leftover audit rule so `git status --short` is checked after every commit, not only before the final push.
- Hardened `gear-ball:preflight` so repo-root `frontend/...` test paths are normalized to frontend-relative Vitest targets automatically.
- Added a `--print-test-manifest` mode so the next run can inspect the exact frontend-relative Vitest target list before execution.
- Updated the public Gear Ball contract, the worktree SOP, retained memory, and the tools inventory to reflect the tighter process.

Training result:

- The remaining friction from the last run is now treated as mechanical process debt, not as something to relearn ad hoc.
- The next large mixed run should fail earlier and more clearly if batch boundaries or test targets are malformed.

Next training focus:

- Confirm on the next real mixed run that the inter-batch leftover audit prevents post-commit doc tails.
- Confirm the normalized preflight test manifest removes repo-root Vitest path mistakes entirely.

## 2026-05-15 - Training Synthesis Audit

Task: audit the Gear Ball SOP stack against retained run history and synthesize repeated failure modes into a smaller set of hard rules.

Actions taken:

- Reviewed the retained training history and production/working-development reports for repeated slips.
- Identified five recurring themes:
  - Git-index collisions from parallel writes
  - branch drift before the first Git write
  - leftover adjacent docs/training tails after early commits
  - repo-root Vitest path mismatches
  - build-only regressions or docs-packet issues on compound-risk runs
- Confirmed the first four are already addressed by recent SOP/tooling updates.
- Added the remaining hard rules:
  - early `build` on shared frontend hooks/pages/API/package-manifest runs
  - early `docs:check` on generated audit-doc / agent-packet lanes
- Updated the baseline KPI so these failure modes are measurable instead of anecdotal.

Training result:

- The recurring failure set is now narrower and more explicit.
- Gear Ball’s remaining path to `10/10` is mostly disciplined execution against these codified gates, not major missing infrastructure.

Synthesized pattern summary:

- Most low scores came from process shape, not technical inability.
- The highest-value fixes were small guardrails added exactly where the retained evidence showed repetition.
- Large mixed runs benefit more from earlier hard gates than from more verbose reporting.

Next training focus:

- Validate that early `build` catches the next compound-risk regression before the full suite.
- Validate that early `docs:check` catches generated audit-packet drift before the first docs commit.

Next training focus:

- On the next mixed production run, treat `docs:check` plus `build` as early gates whenever Beeper packet generation and shared editor hooks both moved in the same run.

## 2026-05-15 - Production panel media and agent closeout

Prompt cadence used:

- run SOP on prod

What changed in this run:

- Finalized the panel-oriented media-library/runtime lane, including autosave projection save-state propagation and production-facing preview/detail parity.
- Updated route/media ADR and planning docs, refreshed Beeper retained packets, and created the new Bopper agent space and retained artifact area.

What worked:

- Targeted reproduction plus grouped reruns isolated the real suite-hot failures quickly.
- Build and full-suite reruns caught the auth recovery timing gap and the remaining test timeout pressure before push.
- Keeping the branch contract pinned to `production` prevented any branch drift while the run expanded.

What failed or slipped:

- I underestimated the remaining dirty worktree after the earlier production commits and had to do a broader second batching pass.
- The recovery-form test was modeling a `PASSWORD_RECOVERY` event on a signup callback route, which only passed intermittently under suite pressure.

Durable lesson:

- For auth callback recovery tests, the mocked route flow must match the emitted auth event; otherwise suite pressure can let the fallback error path win the race.
- After any apparent closeout on a large production run, re-check the entire worktree immediately. A small visible leftover slice can hide a much larger second lane.

Self-rating:

- Run quality: `8/10`

Capability decision:

- New tool needed: `no`
- Existing helper update needed: `no`
- SOP/doc update needed: `no`

## 2026-05-15 - Production media autosave and training-system expansion

Prompt cadence used:

- run your sop on production. commit and push should be part of that sop

What changed in this run:

- Published the production AI Studio/media autosave hardening lane, including save-state propagation, quota refresh handling, workspace persistence fixes, and the media-panel KPI tooling/migration package.
- Published the Beeper/Bopper training-system reorg, removed the old Beeper mode tree, and introduced the Holomony agent space and retained artifacts.

What worked:

- The validation ladder held: changed tests, `build`, `docs:check`, and the full suite all passed before the first Git write.
- The full-suite rerun exposed the real edit-modal ref regression, which let me fix the underlying callback-ref churn instead of shipping a flaky test workaround.
- Branch discipline stayed correct on `production` from start to finish.

What failed or slipped:

- The targeted Vitest call initially used repo-root paths while running from `frontend`.
- Product and training-system docs still arrived as one large mixed dirty tree, which made the batch review heavier than it should have been.

Durable lesson:

- Keep frontend-relative changed-test manifests for repo-root SOP runs so the first targeted rerun is not wasted on path mismatches.
- When production product work and agent-training lanes land together, split the Git batches before the first commit even if validation can be shared.

Self-rating:

- Run quality: `8.5/10`

Capability decision:

- New tool needed: `no`
- Existing helper update needed: `no`
- SOP/doc update needed: `no`

## 2026-05-16 - Production AI Studio runtime and packet run

Task: run the full Gear Ball SOP on the temporary prelaunch `production` branch for a mixed AI Studio/runtime hardening lane plus related agent packet updates, then close the run with the retained audit/training loop.

Actions taken:

- Locked the run to `production` and validated the large product lane with file-backed preflight manifests instead of long inline arg lists.
- Fixed the stale runtime/type seams exposed by early build pressure:
  - `frontend/features/ai-studio/components/PromptStep.tsx`
  - `frontend/prefabs/agent/panels/AgentChatPanel.tsx`
  - `frontend/features/ai-studio/createRuntime/contracts.ts`
  - `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
  - `frontend/lib/server/api/createPulseBuiltInControlPlane.ts`
- Fixed the page-level null-safety gap in `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePanelProps.ts` after the first full-suite rerun exposed the `trim()` crash.
- Re-ran the full validation ladder before any Git write:
  - `gear_ball_preflight` for the product lane
  - `gear_ball_preflight` for the Gear Ball lane
  - `npm -C frontend run build`
  - `npm -C frontend run docs:check`
  - `npm -C frontend run test -- tests/pages/ai-studio.character-mode.test.tsx`
  - `npm -C frontend run test`

Training result:

- The recent helper/SOP hardening is working. File-backed manifests and the early-build rule removed the mechanical friction that used to dominate these mixed runs.
- The remaining friction is semantic, not mechanical: large AI Studio lanes still surface stale cross-contract assumptions between runtime helpers, panel props, and page-level flows.
- No new tool or SOP change is needed from this run.

Self-rating:

- Run quality: `9/10`

What went well:

- The build gate caught the stale runtime/type seams before staging.
- The product lane, agent packet lane, and Gear Ball closeout lane stayed separate.
- The full suite was green before the first Git write.

What slipped:

- One prompt null-safety issue still escaped targeted checks and only surfaced under full-suite page pressure.
- The initial status inventory was noisy because the run mixed product code with a broad packet refresh.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`, in this retained history and the run report

Next training focus:

- On the next large AI Studio lane, add one small targeted null/undefined prompt-flow test slice to the first validation pass before the full suite.

## 2026-05-16 - Production Copperknot and AI Studio preset/control-plane run

Task: publish the broad Copperknot/Holomony docs rename lane, then the remaining AI Studio preset/media/control-plane lane, then close the run with retained Gear Ball updates on `production`.

Actions taken:

- Committed the docs/agent packet lane first on `production` as `501d3bbb1` after docs preflight and `npm -C frontend run docs:check`.
- Validated the remaining product lane with targeted selector/guard tests, `npm -C frontend run build`, `npm -C frontend run docs:check`, and a full `npm -C frontend run test` pass (`714` files passed, `4813` tests passed, `42` skipped).
- Committed the product/runtime lane on `production` as `70dc5f16c`.
- Hardened `scripts/ops/gear_ball_preflight.mjs` so file-backed runs skip deleted/absent manifest entries instead of failing direct file checks on them.
- Rebuilt the final product staging manifest from live `git status` before the product `git add` so newer untracked files were not missed by an older saved manifest.

Training result:

- The docs-first split worked. The broad initial status inventory collapsed into a clean product seam after the first commit.
- File-backed manifests remain the right approach, but they need a final live rebuild before staging on long runs.
- The preflight helper should treat deleted manifest entries as informational, not as a false failure source.

Self-rating:

- Run quality: `9/10`

What went well:

- Validation was green before the product commit.
- The leftover audit after the docs commit was clean and useful.
- The product batch landed as one coherent lane instead of being polluted by the docs rename work.

What slipped:

- The earlier saved product manifest drifted and missed newer untracked files.
- The helper hardening happened during the run instead of already being in place.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `yes`
- Change made: preflight now skips deleted manifest entries; final staging should rebuild from current `git status`

Next training focus:

- Promote the manifest-rebuild rule from this run into the main Gear Ball SOP/memory if it is not already explicit enough.
- Watch whether one more large repo-root production run completes without any manifest drift or helper patching.

## 2026-05-18 - Production project foundation and prompt-bridge run

Task: publish the production AI Studio project-foundation, prompt-bridge, and billing follow-up lanes, then close the run with the related docs reconciliation and retained Gear Ball closeout on `production`.

Actions taken:

- Committed the initial AI Studio project/workspace lane as `9f8034bc4`, then used repeated inter-batch leftover audits to surface and commit the adjacent runtime/product follow-up commits `81c171037`, `2f9c0f2fb`, `b6e548fa5`, `2b94cce5c`, `0d5d48d5d`, `3ba5f9cc2`, `c88db8e41`, `e65084165`, and `edc726df9`.
- Re-ran focused validation where the leftover chain touched riskier billing logic: `npm -C frontend run test -- tests/api/stripe-webhook.test.ts`.
- Landed the final docs reconciliation batch as `ede601d9e` after the product tail was fully zeroed out.
- Kept the retained closeout as a separate final lane.

Training result:

- The inter-batch leftover audit rule is doing real work. It prevented code from leaking into the final docs commit even when hook side effects kept revealing adjacent product files.
- Large AI Studio seams still tend to hide contract cleanup outside the first manifest, especially when removed props, selector seams, or layout CSS sit behind the first product slice.
- No new tooling was required; the friction was execution discipline, not missing capability.

Self-rating:

- Run quality: `7.5/10`

What went well:

- The final product/document boundary stayed clean.
- Full validation was green before the push.
- The Stripe webhook follow-up got its own targeted proof instead of riding only on the earlier full suite.

What slipped:

- Too many small cleanup commits were needed after the first product batch because leftover product files kept surfacing after hook-driven commit passes.
- A build-only type issue still escaped the first targeted pass.
- A malformed JSX restructure in `VoicesPropertiesPanel.tsx` slipped into the staged batch and was only caught at pre-commit lint time.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`, in this retained history and the run report

Next training focus:

- On the next large product run, rebuild the live manifest from `git status --short` after every commit boundary until the lane goes clean, not only after the first leftover audit.
- When a late UI/layout sub-lane appears, run its owning component test immediately before retrying the commit instead of relying on the broader lane slice alone.

## 2026-05-18 - Production create-workflow diagnostics and billing audit run

Task: publish the Create workflow diagnosis/runtime lane and the recurring billing diagnostics lane on `production`, then close out the run with the retained Gear Ball self-audit packet.

Actions taken:

- Locked two explicit manifests before staging: Create workflow runtime/debugging and recurring billing diagnostics.
- Ran `gear-ball:preflight` for both lanes, fixed one formatter-only pass and one lint-only explicit-`any` warning before the first commit, then reran both lanes clean.
- Re-ran the shared gates before any commit: `npm -C frontend run build`, `npm -C frontend run docs:check`, and `npm -C frontend run test` (`724` files passed, `4880` tests passed, `42` skipped).
- Committed the Create workflow lane as `41e135566` and the billing lane as `99e62b52b`.
- Cleared tracked generated drift in `supabase/.temp/cli-latest` before staging so the real batch manifests stayed clean.

Training result:

- The current preflight stack is catching the right failures at the right time. Formatter drift and lint-only type hygiene were both stopped before staging instead of surfacing in the first commit hook.
- File-backed manifests worked cleanly across two coherent lanes with no post-commit leftovers.
- Generated tracked temp drift is still a real distraction source; it should be cleared before staging so leftover audits stay high-signal.

Self-rating:

- Run quality: `9/10`

What went well:

- Both feature lanes were identified correctly before the first Git write.
- The branch stayed disciplined and the inter-batch leftover audits stayed clean.
- Full validation was already green before the first commit.

What slipped:

- Preflight still needed one formatter pass and one lint-only test typing fix.
- No route-level browser smoke was run because no local target was already active.

Capability decision:

- New tool needed: `no`
- Existing helper or SOP update needed: `no`
- Durable lesson added: `yes`, tracked temp drift should be cleared before staging

Next training focus:

- Convert one more large production run with zero preflight fixups.
- Keep watching whether tracked temp drift or missing browser-smoke targets recur often enough to justify another helper change.
