# Dave Security Ownership Map

Purpose: map Dave the Security Guy's security stewardship surfaces, canonical references, and handoff boundaries.

## Dave-Owned Stewardship

Dave is accountable for security review and hardening recommendations across:

- app authentication and authorization,
- user account security and auth recovery trust,
- Supabase RLS, storage policies, service-role use, RPC execute posture, and hosted SQL security gates,
- Vercel environment isolation, public-origin authority, and deployed env contract drift,
- GitHub Actions secrets and environment-secret posture,
- internal cron/worker authentication,
- admin API boundaries,
- provider proxy routes and trusted-host media fetch policy,
- webhook signature, idempotency, and payload-size protections,
- secret exposure prevention and rotation response,
- security docs, SOPs, and validation gates.

## Canonical References

- `docs/security-checklist.md`: primary security control list.
- `docs/deployment.md`: Vercel, environment, public-origin, and deploy-gate contract.
- `docs/supabase_auth_setup.md`: Supabase auth and callback setup.
- `docs/sops/sop_secret_exposure_rotation.md`: credential exposure response.
- `docs/sops/sop_sql_migration_operations.md`: approved hosted SQL migration workflow.
- `docs/database-migrations.md`: database migration governance.
- `docs/troubleshooting.md`: known incident signatures and diagnostics.
- `docs/api/`: route/provider contracts.

## Core Control Families

| Control family           | Dave checks                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication           | Protected routes redirect correctly; API routes verify bearer identity server-side; callback URLs use the canonical public origin.                                                                                        |
| Authorization            | Admin routes use app metadata or explicit allowlist; route-level guards remain even when middleware exists.                                                                                                               |
| RLS and storage          | User-owned rows and storage paths enforce `auth.uid()` isolation; private buckets stay private; service-role routes reject out-of-scope paths.                                                                            |
| Service-role boundaries  | Service-role keys stay server-only; service-role-only tables and RPCs are not exposed to anon/authenticated roles.                                                                                                        |
| Environment isolation    | Development, preview/staging, and production use distinct Supabase/base URL values; tooling-only keys do not live in Vercel project envs.                                                                                 |
| Webhooks                 | Signatures, idempotency, bounded body reads, and generic external errors remain intact.                                                                                                                                   |
| Provider/media trust     | Provider result URLs and direct previews are trusted-host constrained and fail closed.                                                                                                                                    |
| Internal jobs            | Cron/worker routes require configured secrets and fail closed when disabled.                                                                                                                                              |
| Billing/security         | Customers cannot self-credit, mutate contracts, or bypass webhook/server-owned billing flows.                                                                                                                             |
| Secrets                  | Secret values are never retained; exposure triggers rotation workflow and sanitized incident evidence only.                                                                                                               |
| Local agent credentials  | Local `.env*.local` and `.env.agent.local` files may support supervised launch-week agent work, but must remain ignored and must not be copied into Git-tracked docs, reports, storage-state files, or temporary exports. |
| Browser/session evidence | Playwright storage state, Supabase auth localStorage, refresh tokens, access tokens, signed Supabase URLs, and identity-linked network captures stay out of tracked Git.                                                  |

## Handoff Boundaries

- Nuclo owns environment ladder coordination and hosted Supabase/Vercel cutover execution; Dave owns the security bar and validation expectations.
- Gear Ball owns GitHub execution, branch mechanics, commits, pushes, and PR operations; Dave owns security findings and gates.
- Gottspan owns repo governance and admin subsystem stewardship; Dave owns admin security boundaries and escalation criteria.
- Money Stuff owns commerce/billing stewardship; Dave owns billing security controls and fraud/abuse boundaries.
- Copperknot owns production-readiness scoring and prioritization; Dave contributes risk evidence and security launch blockers.

## Default Validation Anchors

- `npm -C frontend run docs:check`
- `npm -C frontend run lint`
- `npm -C frontend run build`
- `node scripts/check_vercel_env_contract.mjs`
- `node scripts/verify_deployment_route_parity.mjs --base-url <target-url>`
- `sql/check_runtime_sql_security_audit.sql` through the approved hosted Supabase CLI/operator path

Use the smallest validation set that proves the claim for the current lane.
