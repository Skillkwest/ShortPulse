# Nuclo Memory

Purpose: keep repo-visible memory for Nuclo's version, environment, Vercel, and Supabase coordination work.

## Standing Preferences

- Formal name: Nuclo.
- Short name: Nuclo.
- Role: environment and version manager for ShortPulse's pre-launch `production` operating posture, Vercel topology, and Supabase project wiring.
- Default posture: map first, mutate second.
- Historical environment topology reference: `working-development` -> `staging-preview` -> `production`.
- Standing user branch rule: during the current pre-launch phase, work only on `production` unless the user explicitly changes that rule in the current thread.
- Branch safety rule: keep `git config --local shortpulse.allowedBranch` aligned before branch-affecting work.
- Env rule: local env files are convenience surfaces, not deployed source of truth.
- Secret rule: never store or restate raw secret values in memory or reports.
- Supabase rule: use CLI-first hosted targeting and keep environment/database intent explicit.
- Supabase manager rule: full-access Supabase management is allowed for inspection, migrations, parity, and environment work, but deleting auth users or user-owned data is out of bounds.
- Vercel rule: verify preview/production state with direct evidence before recommending cutover.

## Durable Lessons

- Nuclo's canonical owned surfaces are the active contract under `docs/agents/nuclo/`, the retained history under `docs/records/artifacts/agent/nuclo/`, and the scratch workspace under `docs/agents/nuclo/workspace/`. The workspace is operational only and should stay lean.
- Completed Nuclo handoffs should be archived immediately and `docs/agents/nuclo/CURRENT-HANDOFF.md` should return to a no-active-handoff placeholder unless another handoff is already live. Stale active handoffs are the highest-value startup drag in Nuclo space.
- The current environment model remains explicit even during production-only branch work: local `development` maps to the dedicated working-development Supabase project, hosted `preview` maps to staging, and hosted `production` maps to the dedicated production project.
- Vercel deployed state must be verified from live env inventory or direct deployment checks, not from local env files or temporary exports.
- `supabase projects list` plus `supabase/.temp/project-ref` are better local proof of the linked hosted project than `supabase/.temp/linked-project.json`, which can lag.
- Hosted schema parity is not enough by itself after restores or bootstrap work. Runtime ACL posture and critical non-`public` trigger attachments can still be missing.
- Storage bucket metadata parity is separate from actual storage object parity. Treat blob verification as its own gate when storage migration or cutover is in scope.
- The local Homebrew `libpq` client is approved for Nuclo hosted proof work. If `psql` is missing again, Nuclo may reinstall `libpq` without re-asking. Current known client path is `/opt/homebrew/opt/libpq/bin/psql`.
- Authenticated `vercel` CLI sessions are sufficient for Nuclo's live env audits; a separate token is not required when the shell is already logged in.
- GitHub rulesets are the source of truth for current branch governance posture. Do not rely on classic branch-protection assumptions alone.
- `scripts/check_billing_launch_readiness.mjs` now accepts `SHORTPULSE_PRODUCTION_DB_URL`, `SHORTPULSE_PRODUCTION_SUPABASE_DB_URL`, or `SUPABASE_DB_URL` for production signup billing DB proof and auto-checks common local `psql` paths before falling back to `psql` on `PATH`.
- The reliability diagnostics workflow is not proof just because the wrapper succeeds. Confirm `scripts/reliability_control_plane_diagnostics.sh` reaches the intended SQL files; on 2026-06-14 the runner referenced missing `sql/check_generation_queue_dispatch_latency.sql` and stopped before the runtime SQL security audit.
- For GitHub-hosted production SQL workflows, use the Supabase Dashboard `Connect` -> `Direct Connection string` -> `Session pooler` panel as the provider source for the exact IPv4-compatible pooler host. On 2026-06-15 the Dashboard-confirmed production session-pooler shape used host `aws-1-us-west-2.pooler.supabase.com`, port `5432`, and user `postgres.ftgrqgjrchpimronuhop`; local convenience variables labeled as pooler URLs may still be stale and must be shape-checked before use.
- Historical ladder-era cutover details, dev bootstrap incidents, and one-off migration chronology belong in retained reports, not in active Nuclo memory.
- Nuclo self-maintenance rule: keep the default-load path lean. Load `README.md`, `memory.md`, and `CURRENT-HANDOFF.md` first, then only the task-specific SOP/report section needed for the current request.
- Recurring Vercel account-health checks are tracked at `docs/agents/nuclo/workspace/vercel-health-checks/README.md`; retained monthly packets belong in `docs/records/artifacts/agent/nuclo/reports/` and should be indexed in that folder's `README.md`.
- Current egress lane lesson: after the 2026-06-21 production dashboard tooltip proof, sustained current-cycle egress is PostgREST-heavy from 14 Jun through 21 Jun, while Storage is a secondary early-spike follow-up. Do not keep re-auditing media/storage by default unless refreshed dashboard proof shows Storage dominating again.
- Current egress implementation target: reduce repeated PostgREST reads that select heavy `generation_projection` replay/reload/style payloads or `ai_generations.metadata`; prefer lightweight display/status hydration plus on-demand heavy metadata over broad polling slowdowns or UI behavior changes.

## Open Follow-Ups

- None. Open work should enter through `docs/agents/nuclo/CURRENT-HANDOFF.md` or a fresh user request instead of lingering in memory by default.
