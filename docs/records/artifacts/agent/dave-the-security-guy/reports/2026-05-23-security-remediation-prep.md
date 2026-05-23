# Security Remediation Prep - 2026-05-23

Owner: Dave the Security Guy
Mode: prep only; no issue fixes in this pass
Scope: confirmed audit findings from the 2026-05-23 repo security audit

## Goal

Prepare the smallest high-ROI work plan for the confirmed security findings without bloating the workspace or creating speculative tooling.

## Inputs Already Sufficient

- Root repo startup contract and Dave operating contract.
- `docs/security-checklist.md`
- `docs/deployment.md`
- `docs/supabase_auth_setup.md`
- `docs/sops/sop_secret_exposure_rotation.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/database-migrations.md`
- `frontend/proxy.ts`
- `frontend/lib/server/api/protectedApiPaths.ts`
- `frontend/lib/supabaseClient.ts`
- `frontend/next.config.js`
- `.gitignore`
- `.husky/pre-commit`
- `.husky/pre-push`
- `.github/workflows/ci.yml`
- `scripts/check_secret_exposure.js`
- `sql/check_runtime_sql_security_audit.sql`

## Tools To Use

- `git status`, `git ls-files`, `git log`, and `git show` for tracked exposure and history confirmation.
- `node scripts/check_secret_exposure.js` for repository secret/session artifact gating.
- `npm -C frontend audit --omit=dev --audit-level=moderate` for production dependency vulnerability validation.
- `npm -C frontend test -- --run tests/api/protected-api-paths.parity.test.ts tests/api/internal-route-inventory-regression.test.ts tests/api/proxy-internal-utils.test.ts tests/api/auth-helper.test.ts tests/lib/runtime-sql-security-audit-script.test.ts` for security boundary regression.
- `npm -C frontend run lint`, targeted tests, and `npm -C frontend run build` only after code/config changes justify them.
- Supabase CLI and approved hosted SQL/operator path for `sql/check_runtime_sql_security_audit.sql`; do not use Docker-based Supabase workflows.
- Provider/official docs lookup only when implementing current framework/provider controls where stale guidance is risky.

## Do Not Create Yet

- No new generic security scanner.
- No new env export script.
- No new SQL migration until hosted SQL audit evidence or a concrete policy gap requires it.
- No new app-wide rate-limit framework unless the telemetry fix cannot reuse existing dependencies or lightweight route-local logic.
- No new docs hierarchy; update canonical docs only when a behavior/control actually changes.

## Remediation Lanes

### 1. Production storage-state exposure

Need:
- Commit deletion of tracked `prod-storage-state.json` and deleted raw evidence files.
- Keep the existing secret scanner and ignore patterns.
- Validate scanner failure before deletion is staged and scanner success after staged deletion.
- Obtain proof that the affected audit-user sessions are revoked or no longer active.
- Decide separately whether GitHub history rewrite/support escalation is required.

Stop condition:
- Live Supabase dashboard, session table mutation, or credential rotation requires operator approval/proof path.

### 2. Browser-session hardening headers

Need:
- Add security headers through `frontend/next.config.js`.
- Start with high-confidence headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and frame protection.
- Decide whether CSP starts as enforce or report-only after checking current Next.js header behavior and app asset needs.

Validation:
- Build-level validation plus a small route/header check if practical.

### 3. `ws` production dependency advisory

Need:
- Prefer lockfile/package override to `ws >= 8.20.1` if transitive parents do not already resolve cleanly.
- Avoid broad dependency churn.
- Re-run production audit and focused security tests.

Validation:
- `npm -C frontend audit --omit=dev --audit-level=moderate`
- targeted API/security tests

### 4. Public telemetry abuse control

Need:
- Add a narrow, route-local throttle or abuse guard for `/api/telemetry/growth`.
- Keep payload sanitization and allowlisted source behavior.
- Avoid durable storage schema unless an in-memory/serverless-compatible approach is insufficient for pre-launch risk.

Validation:
- Add or extend a focused route test if an existing test file covers telemetry.

### 5. Internal route exposure reduction

Need:
- Decide whether `/api/internal/` should be included in proxy-level internal route handling or kept as route-secret-only because Vercel cron or manual ops need direct access.
- If proxy-level treatment would break cron access, document the explicit route-secret-only model instead of changing behavior.

Validation:
- `tests/api/internal-route-inventory-regression.test.ts`
- `tests/api/proxy-internal-utils.test.ts`

### 6. Hosted SQL/RLS/RPC posture

Need:
- Run `sql/check_runtime_sql_security_audit.sql` through the approved hosted path.
- Do not create a migration until the audit output identifies a concrete hosted drift.

Validation:
- Sanitized pass/fail summary only; no secret values or raw connection strings.

## Minimal Starting Set

Begin implementation with lanes 1, 3, and the highest-confidence subset of lane 2. Those reduce immediate exposure and CI failure risk with the least architecture churn. Lanes 4, 5, and 6 should follow once the first pass is clean or when runtime evidence makes them urgent.
