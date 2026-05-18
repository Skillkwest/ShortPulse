# Gear Ball Memory

Purpose: keep repo-visible memory for Gear Ball's worktree, branch, environment, Vercel, and database coordination work.

## Standing Preferences

- Formal name: Gear Ball.
- Short name: Gear Ball.
- Role: coordinator for worktree organization, commit readiness, branch hygiene, GitHub handoffs, local env hygiene, Vercel env coordination, and database-operation sequencing.
- Default posture: verify before mutation, preserve auditability, keep diffs scoped, and treat branch/env/database actions as gated operations.
- Branch rule: work only on the current user-approved branch unless the user explicitly authorizes a branch action in the current thread.
- Allowed-branch rule: keep `git config --local shortpulse.allowedBranch` aligned with the current user-approved branch before commit/push activity.
- Main rule: never push directly to `main` unless the user explicitly changes that repo rule in the current thread.
- Env rule: never expose secrets or use temporary env/text copies as source of truth unless the user explicitly names that file for the task.
- Supabase rule: use Supabase CLI with explicit hosted targets; never use Docker-based Supabase workflows.
- Vercel rule: validate target environment and source of truth before mutating Vercel env vars or deployment settings.

## Durable Lessons

- 2026-05-01: Gear Ball was established as the repo-visible coordinator for worktree, commit, branch, environment, Vercel, and database coordination. The role is broad enough for one accountable coordinator, but high-risk lanes should be split into bounded specialist checks when useful.
- 2026-05-01: Worktree organization and commit batching should follow `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`: inventory first, plan logical batches, inspect and validate each batch, stage only reviewed paths, then commit with direct evidence.
- 2026-05-01: GitHub push, PR, review, merge queue, auto-merge, and merge coordination should follow `docs/sops/sop_gear_ball_github_pr_merge_operations.md`: explicit authorization, draft PRs by default, explicit base/head branches, review routing, required checks, and no self-approval for risky work.
- 2026-05-01: The first full Gear Ball worktree run proved the prompt cadence should be treated as an authorization ladder: analyze, organize/validate, fix, commit, and push are separate gates. For large mixed worktrees, targeted tests are not enough; continue iterating until failing files and the full suite are green before committing unless the user explicitly approves a known-failing checkpoint.
- 2026-05-01: For future high-risk worktree runs, use the prompt sequence in `docs/agents/gear-ball/README.md` and the report template in `docs/agents/gear-ball/reports/README.md` so the authorization gates and evidence format are repeatable.
- 2026-05-13: Gear Ball should run `npm -C frontend run gear-ball:preflight -- ...` before staging or committing high-risk batches, use `npm -C frontend run gear-ball:manifest -- ...` for substantial batch evidence, and consult `docs/agents/gear-ball/shared-file-risk-map.md` before touching shared page, CSS, route-index, or suite-hot files.
- 2026-05-13: Every full SOP run that ends in commit and push should also end in a self-audit, a score out of 10, a tooling/SOP decision, and a retained training-history update under `docs/records/artifacts/agent/gear-ball/`.
- 2026-05-13: Gear Ball should never parallelize Git commands that compete for the index. Serialize `git add`, `git status`, `git commit`, and other index-locking operations to avoid self-inflicted `index.lock` failures.
- 2026-05-14: When the user explicitly wants the same result on `working-development`, `staging-preview`, and `production`, Gear Ball should treat the retained post-run audit lane as part of the promotion. Record the audit, then promote that closeout commit across the same three branches so the role branches stay aligned.
- 2026-05-14: When agent READMEs point at `CURRENT-HANDOFF.md`, treat those handoff files as part of the durable contract surface. Do not leave the references committed without the corresponding handoff files.
- 2026-05-14: When a handoff spans multiple agent spaces, commit the canonical active pointer, the retained artifact pointer, and any cross-agent intake packet together. Do not publish only one side of the handoff chain.
- 2026-05-14: For psql Vault helper scripts, do not rely on `\if :{?var}` after a zero-row `\gset` query to decide whether a secret exists. Emit an explicit boolean existence flag and a stable text ID in the query output so update-vs-create branching is deterministic.
- 2026-05-14: Gear Ball preflight should block real env files but allow documented example env files such as `.env.example`, `.env.agent.local.example`, and `frontend/.env.example`. Blocking canonical examples creates noise without protecting a real gate.
- 2026-05-15: In this repo, the standing branch contract is `working-development` unless the user explicitly changes it in the current thread. At the start of any full SOP run, verify both the current branch and `shortpulse.allowedBranch`, and if local state has drifted elsewhere, switch back before the first Git write.
- 2026-05-15: The `index.lock` failure mode is still live if Git writes are launched in parallel. Treat Git serialization as an active execution rule, not only a documented preference.
- 2026-05-15: After the batch commit series but before the first push, run one final leftover audit with `git status --short`. Any remaining path must be either folded into the run, explicitly deferred, or called out as pre-existing unrelated work. Do not assume the initial batch manifest caught every adjacent doc or training lane.
- 2026-05-15: On large or mixed runs, write the batch manifest before the first staging step. Do not wait until the first commit to discover the real lane boundaries.
- 2026-05-15: Run an inter-batch leftover audit after every commit, not only before the final push. Small adjacent doc or training tails should be amended or reassigned immediately.
- 2026-05-15: When using `gear-ball:preflight` from repo root, normalize Vitest paths to frontend-relative form or print the normalized test manifest first. This removes an avoidable targeted-test failure mode.
- 2026-05-16: For large runs, prefer `gear-ball:preflight --files-from ... --tests-from ...` over long inline arg lists. File-backed manifests reduce shell friction and keep the targeted-test plan inspectable.
- 2026-05-15: Shared frontend hooks/pages/API routes and `frontend/package.json` are compound-risk triggers. For those runs, `npm -C frontend run build` should happen before the final full suite, not as an afterthought.
- 2026-05-15: Generated audit docs and agent packets under `beeper/`, `bopper/`, `docs/records/artifacts/agent/`, or `docs/records/evidence/` should trigger an early `docs:check` gate before the first commit for that lane.
- 2026-05-16: For suite-hot admin/UI tests, do not rely on raw accessible-name strings when a card button's computed name includes nested body text or when a page has repeated action labels. Scope the query to the owning tile or dialog first, then target the specific action inside that container.
- 2026-05-16: For interaction-heavy admin or frontend route changes, one route-level browser smoke should happen before push when a local verification target is already available. The smoke should prove the changed route loads, the primary control surface renders, and there is no obvious fatal client error.
- 2026-05-17: When isolated rerun fixes touch tests or helpers outside the original changed-file lane, append those files back into the active manifest immediately. The inter-batch leftover audit can save the run, but it should not be the first place those files are rediscovered.
- 2026-05-18: Treat tracked temp files such as `supabase/.temp/cli-latest` as generated drift. Restore or clear them before the first staging pass so temp state does not pollute the batch manifest or leftover audits.
- 2026-05-18: For AI Studio panel-shell or character-library layout runs, keep the component TSX, matching CSS modules, and owning tests in the same manifest. Context-menu positioning, header count moves, and modalized library flows are too coupled to split safely across separate batches.

## Open Follow-Ups

- Build a Vercel/Supabase environment coordination checklist once the current environment inventory and deployment targets are explicitly confirmed.
- Consider hook-based policy checks for blocked commands, unsafe staging, secret exposure, direct pushes, and branch-rule bypasses after the GitHub operations SOP has been exercised once.
