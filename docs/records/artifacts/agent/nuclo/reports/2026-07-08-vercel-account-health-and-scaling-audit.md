# 2026-07-08 Vercel Account Health And Scaling Audit

Purpose: capture Nuclo's read-only Vercel account health check for ShortPulse, including current production deployment state, usage posture, plan sufficiency, runtime health signals, and scale recommendations.

## Scope

- Date: `2026-07-08`
- Mode: inspection only
- Branch: `production`
- Local branch guard: `shortpulse.allowedBranch=production`
- Vercel team scope: `kirk-artmans-projects`
- Vercel project: `shortpulse`
- Production URL: `https://www.shortpulse.ai`
- Requested outcome: determine whether the current Vercel plan is sufficient, what is driving usage, and what to optimize before scaling toward 100, 300, 500, and 1,000 users.

## Executive Summary

ShortPulse is healthy on Vercel Pro. No Vercel plan upgrade is recommended right now.

The production deployment is live, ready, and aliased to `https://www.shortpulse.ai`. Route parity passed against the current deployment after the latest production alias move. Recent active-deployment logs showed no fresh `5xx` errors.

Current Vercel usage is comfortably within Pro-plan posture. The main cost pressure is not CDN bandwidth. It is application runtime behavior:

- observability/logging events
- server/API runtime memory and CPU
- Fast Origin Transfer
- function invocation volume

The first optimization targets should be noisy observability and hot API paths, not an account-plan upgrade.

## Current Production Deployment

Latest verified production deployment:

- Deployment URL: `https://shortpulse-gukt6phck-kirk-artmans-projects.vercel.app`
- Deployment ID: `dpl_6AmHghA797jifLSy93H3K9TNi85y`
- Status: `READY`
- Created: `2026-07-08T18:28:53.127Z`
- Target: `production`
- Aliases:
  - `www.shortpulse.ai`
  - `shortpulse.ai`
  - `shortpulse.vercel.app`
  - `shortpulse-kirk-artmans-projects.vercel.app`
  - `shortpulse-git-production-kirk-artmans-projects.vercel.app`

Important freshness note:

- During the audit, an in-flight production deployment initially appeared as `Initializing`, then `Building`.
- The build completed successfully and production aliases moved to the new deployment.
- Route parity was rerun after the alias move, so the final result in this report applies to the current active production bundle.

## Production Route Proof

Command:

```bash
node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai
```

Result:

- Resolved deployment: `https://shortpulse-gukt6phck-kirk-artmans-projects.vercel.app`
- Created at: `2026-07-08T18:28:53.127Z`
- Auth mode: `vercel-cli-session`
- Env files loaded by checker: `2`
- Route entries inspected: `200`
- Required internal route parity: passed
- Forbidden retired route checks: passed
- Expected anonymous route status: `404 /dev/ai-studio-stage-bakeoff`

Conclusion:

- Current production route parity is green.

## Homepage Probe

Production homepage probe:

```bash
curl -sS -D - -o /tmp/shortpulse-home-final.html https://www.shortpulse.ai/
```

Observed response:

- HTTP status: `200`
- Server: `Vercel`
- Cache: `HIT`
- Body size: `73809` bytes

Conclusion:

- Public production homepage is reachable through Vercel.

## Account And Project Posture

Verified with Vercel CLI:

- CLI user: `sleepyseamonster`
- Team: `kirk-artmans-projects`
- Project: `shortpulse`
- Project ID: `prj_LyBCIYaHPY25CHGfrSiQBl0HCnBJ`
- Root directory: `frontend`
- Framework preset: `Next.js`
- Node.js version: `24.x`
- Build command: default `npm run build` / `next build`

Project-level config:

- `frontend/vercel.json` contains only the ignore-build hook:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "bash ./scripts/vercel-ignore-build.sh"
}
```

Production deployments always build because the ignore script intentionally exits nonzero for `VERCEL_ENV=production`.

## Usage Summary

The Vercel dashboard screenshot showed current billing-cycle consumption around `$17.59`, excluding the Pro base line.

The CLI audit confirmed the same shape:

- Date range checked: `2026-06-11` through `2026-07-08`
- Consumption excluding Pro line: approximately `$17.61`
- CLI total including prorated Pro line: approximately `$36.28`
- CLI billed cost for that date range: approximately `$4.77`
- Charge rows processed: `17528`

Top consumption buckets:

| Service                           | Effective cost |
| --------------------------------- | -------------: |
| Observability Events              |        `$8.50` |
| Fluid Provisioned Memory          |        `$3.12` |
| Fast Origin Transfer              |        `$2.26` |
| Fluid Active CPU                  |        `$2.21` |
| Function Invocations              |        `$0.74` |
| Build CPU Minutes                 |        `$0.73` |
| ISR Writes                        |        `$0.02` |
| Image Optimization Transformation |        `$0.02` |

Dashboard plan-limit snapshot from the user's Vercel UI:

- Fast Data Transfer: `46 GB / 1 TB`
- Edge Requests: `752.79K / 10M`

Conclusion:

- Vercel CDN and edge-request limits are not close to pressure.
- The account is not currently bandwidth-bound.
- Runtime and observability behavior are the first cost levers.

## Recent Runtime Logs

After the current production deployment became active, a 15-minute log sample showed:

- Sample size: `200`
- Status counts:
  - `200`: `96`
  - `206`: `44`
  - `202`: `41`
  - `0`: `14`
  - `401`: `5`
- Fresh `5xx`: `0`

Top paths in the fresh sample:

- `/api/dashboard/tutorial-thumbnail`
- `/api/log/browser-session`
- `/api/fal/kie-gpt-image-2-edit-status`
- `/api/fal/seedream-edit-status`
- `/api/log/client-error`
- project workspace routes
- generation abandon and telemetry routes

The broader 24-hour `5xx` sweep found older failures:

| Route                                           | Count |
| ----------------------------------------------- | ----: |
| `/api/billing/stripe/subscription-transactions` |  `11` |
| `/api/billing/subscription/change`              |  `10` |
| `/api/kie/upload-url`                           |   `7` |
| `/api/telemetry/growth`                         |   `3` |
| `/api/media/finalize-upload`                    |   `1` |
| `/api/log/browser-session`                      |   `1` |
| `/api/billing/storage-addon/change`             |   `1` |
| `/api/admin/pricing/model-policy/apply`         |   `1` |

Interpretation:

- Current active-deployment health is good.
- Older failures should be treated as product reliability follow-up, especially billing, Kie upload, and telemetry paths.
- These older failures do not justify a Vercel plan upgrade by themselves.

## Environment Inventory And Contract

Production Vercel env inventory was inspected without printing raw secret values.

Observed inventory shape:

- Total env rows: `163`
- Production-targeted rows: `113`
- Preview-targeted rows: `114`
- Development-targeted rows: `100`

Production env contract command:

```bash
node scripts/check_vercel_env_contract.mjs --environment production
```

Result:

- Status: `PASS`
- Environments checked: `production`
- Loaded env files: `2`

Warnings:

- Several live Vercel keys are not declared in `frontend/.env.example`.
- Examples include Stripe publishable-key rows, media upload flags, web-search flags, and reference-grid tuning flags.

Interpretation:

- Production env posture is operationally acceptable.
- The `.env.example` contract is lagging the deployed Vercel inventory and should be cleaned up so future env audits are less noisy.
- No raw secret values were printed or stored in this report.

## Domain And DNS

Vercel domain inventory:

- Domain: `shortpulse.ai`
- Registrar: third party
- Edge Network: yes
- Age: `75d`

DNS probe:

- Nameservers:
  - `ns33.domaincontrol.com`
  - `ns34.domaincontrol.com`
- Apex `A` record:
  - `216.198.79.1`
- `www.shortpulse.ai` CNAME:
  - `55f490b2d8febdd9.vercel-dns-017.com`
- `www` Vercel-resolved A records:
  - `216.150.16.193`
  - `216.150.1.193`

Interpretation:

- DNS is functioning.
- Vercel CLI marked third-party nameserver rows with `x` indicators because the domain is not using Vercel-managed nameservers. This is not a launch blocker when the records resolve correctly.

## Build And Deployment Findings

The newest deployment completed successfully:

- Region: `iad1`
- Build machine: `4 cores`, `8 GB`
- Commit: `104a629`
- Dependencies installed successfully
- TypeScript finished in about `24.2s`
- Production build compiled successfully in about `21.0s`
- Static pages generated successfully
- Build completed in about `1m`
- Deployment completed successfully

Build warning:

```text
Both `outputFileTracingRoot` and `turbopack.root` are set, but they must have the same value.
Using `outputFileTracingRoot` value: /vercel/path0.
```

Deployment output shape:

- Route entries inspected by parity checker: `200`
- Current deployment output showed many API lambdas around `45.12 MB`
- `frontend/next.config.js` includes broad tracing for:

```js
const bundledMediaRuntimeFiles = ["node_modules/ffmpeg-static/ffmpeg"];

outputFileTracingIncludes: {
  "/api/**/*": bundledMediaRuntimeFiles,
}
```

Interpretation:

- The build is passing.
- The tracing-root warning should be resolved later to reduce build noise.
- The broad `ffmpeg-static` include likely contributes to large API lambda bundles. This is acceptable for launch if runtime is healthy, but it is a good optimization target before high traffic.

## Scale Assessment

Vercel Pro remains sufficient for the next staged user goals.

| Goal        | Vercel plan read            |
| ----------- | --------------------------- |
| 100 users   | Fine                        |
| 300 users   | Fine                        |
| 500 users   | Likely fine                 |
| 1,000 users | Likely fine with monitoring |

Why:

- Current Fast Data Transfer is far below the `1 TB` dashboard threshold.
- Current Edge Requests are far below the `10M` dashboard threshold.
- Most ShortPulse cost risk is not raw Vercel hosting. It is provider/media/storage/runtime behavior.
- Vercel runtime cost should be managed through route efficiency and observability controls before considering a higher plan.

Upgrade triggers to watch:

- Fast Data Transfer approaches `25-40%` of plan allocation.
- Edge Requests approaches `25-40%` of plan allocation.
- Observability Events scale linearly with users and become a meaningful monthly cost center.
- Fluid CPU or Provisioned Memory grows faster than active-user growth.
- Product usage becomes bursty enough that Pro support/spend controls are no longer operationally comfortable.

## Recommended Next Actions

Priority 1: set operational guardrails.

- Add or confirm Vercel spend alerts.
- Track weekly usage for:
  - Observability Events
  - Fluid Active CPU
  - Fluid Provisioned Memory
  - Fast Origin Transfer
  - Function Invocations
  - Fast Data Transfer
  - Edge Requests

Priority 2: reduce noisy observability before scale.

- Inspect `/api/log/browser-session`.
- Consider sampling, dedupe, or lower-frequency lifecycle pings where product diagnosis still remains useful.
- Preserve crash/debug evidence quality; do not blindly disable telemetry.

Priority 3: investigate older runtime failures.

- Billing:
  - `/api/billing/stripe/subscription-transactions`
  - `/api/billing/subscription/change`
  - `/api/billing/storage-addon/change`
- Provider/media:
  - `/api/kie/upload-url`
  - `/api/media/finalize-upload`
- Telemetry:
  - `/api/telemetry/growth`

Priority 4: clean env-contract drift.

- Update `frontend/.env.example` or the env-contract known-key list for live Vercel keys that are intentionally deployed.
- Keep this as documentation/tooling cleanup unless a required key is missing.

Priority 5: run a focused deployment-weight audit.

- Review `outputFileTracingIncludes` in `frontend/next.config.js`.
- Avoid bundling `ffmpeg-static` into every API lambda if only a smaller route subset needs it.
- Resolve the `outputFileTracingRoot` and `turbopack.root` mismatch warning.

## Do Not Do Yet

- Do not upgrade away from Pro solely because user count is about to grow.
- Do not disable observability wholesale; tune it.
- Do not treat older `5xx` rows as Vercel account failure without source tracing.
- Do not mutate Vercel env values from this report alone.
- Do not rely on temporary env pulls or scratch files as source of truth.

## Final Health Rating

Vercel account health: green.

Scaling posture: green with watch items.

Upgrade urgency: none.

Highest ROI next work:

1. observability volume controls,
2. older billing/Kie route error source tracing,
3. API lambda bundle-size audit,
4. env-contract cleanup.

## Evidence Commands

Representative non-secret commands used:

```bash
vercel whoami
vercel teams ls
vercel project inspect shortpulse --scope kirk-artmans-projects
vercel usage --scope kirk-artmans-projects --from 2026-06-11 --to 2026-07-08 --format json
vercel inspect https://www.shortpulse.ai --scope kirk-artmans-projects --format json
vercel inspect https://shortpulse-gukt6phck-kirk-artmans-projects.vercel.app --scope kirk-artmans-projects --logs
vercel env ls --scope kirk-artmans-projects --format json
vercel domains inspect shortpulse.ai --scope kirk-artmans-projects
vercel alias ls --scope kirk-artmans-projects
node scripts/check_vercel_env_contract.mjs --environment production
node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai
curl -sS -D - -o /tmp/shortpulse-home-final.html https://www.shortpulse.ai/
```

## Residual Risks

- The repo worktree had unrelated uncommitted changes during this documentation write. This report does not classify, validate, or alter those changes.
- CLI usage totals and dashboard consumption charts present Pro/base charges differently. For operational scaling decisions, use the consumption buckets and plan-limit percentages rather than the raw CLI total alone.
- Vercel logs are a sample and can miss older or retained application-level error details. Use ShortPulse admin error logs for root-cause work on route failures.
- This report does not include authenticated browser workflow proof or credit-consuming provider generation proof.
