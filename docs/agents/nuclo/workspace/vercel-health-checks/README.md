# Nuclo Vercel Health Checks

Purpose: track Nuclo's recurring Vercel account-health audits without turning the workspace into a second source of truth.

Retained health packets live in `docs/records/artifacts/agent/nuclo/reports/`. This workspace file is the lightweight control surface for cadence, default-load rules, and next-audit prep.

## Current Audit Ledger

| Audit date   | Retained packet                                                                                    | Status                                                                                   | Next action                                       |
| ------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `2026-07-08` | `docs/records/artifacts/agent/nuclo/reports/2026-07-08-vercel-account-health-and-scaling-audit.md` | Green: Vercel Pro sufficient, production deployment healthy, no plan upgrade recommended | Run next monthly health check around `2026-08-08` |

## Default Load For Vercel Health Audits

Load these first:

- `docs/agents/nuclo/README.md`
- `docs/agents/nuclo/memory.md`
- `docs/agents/nuclo/CURRENT-HANDOFF.md`
- `docs/records/artifacts/agent/nuclo/reports/README.md`
- this tracker
- the most recent Vercel health packet listed above

Do not load every Nuclo report by default.

## Monthly Audit Checklist

Use production evidence only unless the user explicitly asks for a preview/local check.

1. Confirm local operating posture:
   - branch is `production`
   - `git config --local shortpulse.allowedBranch` is `production`
   - task mode is audit-only unless the user approves edits
2. Confirm Vercel identity and project:
   - `vercel whoami`
   - `vercel teams ls`
   - `vercel project inspect shortpulse --scope kirk-artmans-projects`
3. Confirm active production deployment:
   - `vercel inspect https://www.shortpulse.ai --scope kirk-artmans-projects --format json`
   - record deployment id, deployment URL, created time, target, status, aliases, and commit
4. Confirm public route health:
   - `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
   - `curl -sS -D - -o /tmp/shortpulse-home.html https://www.shortpulse.ai/`
5. Capture Vercel usage posture:
   - `vercel usage --scope kirk-artmans-projects --from <cycle-start> --to <today> --format json`
   - track Observability Events, Fluid Active CPU, Fluid Provisioned Memory, Fast Origin Transfer, Function Invocations, Fast Data Transfer, and Edge Requests
6. Sample runtime logs:
   - inspect recent production deployment logs
   - separate fresh active-deployment failures from older retained failures
   - do not treat old `5xx` rows as Vercel account failure without source tracing
7. Check environment-contract posture:
   - `vercel env ls --scope kirk-artmans-projects --format json`
   - `node scripts/check_vercel_env_contract.mjs --environment production`
   - never print, store, or restate raw secret values
8. Check domains and aliases:
   - `vercel domains inspect shortpulse.ai --scope kirk-artmans-projects`
   - `vercel alias ls --scope kirk-artmans-projects`
   - DNS probes for apex and `www`
9. Check deployment-weight signals:
   - build warnings
   - unusually large API lambdas
   - `frontend/next.config.js` tracing includes, especially broad runtime bundles
10. Write or update the retained report:

- path pattern: `docs/records/artifacts/agent/nuclo/reports/YYYY-MM-DD-vercel-account-health-and-scaling-audit.md`
- update `docs/records/artifacts/agent/nuclo/reports/README.md`
- update this ledger

## Decision Rules

- Do not recommend a plan upgrade solely because user count is expected to grow.
- Recommend a plan upgrade only when usage, support, spend-control, or scale evidence shows Pro is becoming the constraint.
- Prefer application/runtime optimization before account-plan escalation.
- Tune observability; do not disable it wholesale.
- Treat temporary env pulls and scratch exports as non-authoritative.
- Treat sensitive Vercel env values as write-only unless verified through a safe dashboard or runtime proof path.
- Keep spend-alert setup as an operational guardrail, not a substitute for route and usage optimization.

## July 2026 Carry-Forward Watch Items

- Confirm or add Vercel spend alerts.
- Track weekly usage in the main cost buckets named above.
- Reduce noisy observability volume without losing crash/debug evidence quality.
- Source-trace older billing, Kie upload, media finalize, and telemetry runtime failures.
- Clean intentional Vercel env keys into `frontend/.env.example` or the env-contract known-key list.
- Audit deployment weight from broad `ffmpeg-static` tracing and the `outputFileTracingRoot` / `turbopack.root` warning before high traffic.

## Next Scheduled Check

Target window: `2026-08-08` plus or minus three days.

Expected closeout: one retained report, one reports index update, and one ledger row update here.
