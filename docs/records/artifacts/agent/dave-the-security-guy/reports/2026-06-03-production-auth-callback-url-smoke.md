# Production Auth Callback URL Smoke

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security smoke, read-only production check
Repo branch: local `production`

## Scope

This lane ran the first safe, read-only step from `docs/sops/sop_auth_recovery_trust_smoke.md`: production `/api/auth/callback-url` authority checks.

No signup, password-reset, email-change email, hosted Supabase, Vercel setting, GitHub secret, production data, billing/customer state, UI, UX, or product behavior was mutated.

## Checks Run

Production endpoint checked:

```text
https://www.shortpulse.ai/api/auth/callback-url
```

Requests:

```text
GET ?flow=recovery&next=%2Fdashboard
GET ?flow=signup&next=%2Fdashboard
GET ?flow=email-change&next=%2Fprofile%3Fsection%3Daccount
GET ?flow=recovery&next=%2F%5Cevil.example%2Faccount
```

## Initial Result Before Deploy

| Check | Production status | Result |
| --- | --- | --- |
| Recovery callback host | `200` | Returned `https://www.shortpulse.ai/auth/callback?...` |
| Signup callback host | `200` | Returned `https://www.shortpulse.ai/auth/callback?...` |
| Email-change callback host | `200` | Returned `https://www.shortpulse.ai/auth/callback?...` |
| Backslash hostile `next` | `200` | Production returned the hostile backslash `next` instead of normalizing to `/dashboard` |

## Initial Finding

Production initially did not match the local auth return-path fix for hostile backslash `next` values.

Severity: High until deployed production is re-smoked.
Confidence: High.
Trust boundary: auth callback/user trust boundary.
Launch impact: production auth links and post-auth navigation must not allow attacker-steered external return paths.
ROI: high as a deployment/readiness gate; no new code patch is justified because local `production` source already contains the canonical fix and focused regression coverage.

## Deploy Action

Commit pushed to `origin/production`:

```text
500992299 Harden auth account security boundaries
```

The commit included only the scoped security code/test subset for:

- auth callback backslash `next` rejection
- token-first API auth without proxy metadata fallback authority
- email-change confirmation billing-error sanitization

No unrelated dirty worktree files were staged or committed.

Vercel status for the pushed commit: success, deployment completed.

## Current Repo Evidence

Current local source in `frontend/lib/authRedirects.ts` rejects backslash-containing `next` paths before callback URL generation.

Focused validation:

```bash
npm -C frontend test -- --run tests/lib/authRedirects.test.ts tests/api/auth-callback-url.test.ts
```

Result: passed. 2 files, 15 tests.

The local route test explicitly expects hostile backslash `next` input to resolve to:

```text
https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fdashboard
```

## Root Cause Assessment

Canonical code root cause was fixed locally in the auth return-path sanitizer. The initial remaining risk was hosted deployment drift: production had not yet proven it was running the local fixed source.

No patch layer was added. The existing local fix was committed and pushed through the approved `production` path, then the same production smoke was rerun.

## Post-Deploy Production Smoke

After Vercel reported the deployment completed, the same production endpoint returned:

| Check | Production status | Result |
| --- | --- | --- |
| Backslash hostile `next` | `200` | Returned `https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fdashboard` |
| Recovery callback host | `200` | Returned `https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fdashboard` |
| Signup callback host | `200` | Returned `https://www.shortpulse.ai/auth/callback?flow=signup&next=%2Fdashboard` |
| Email-change callback host | `200` | Returned `https://www.shortpulse.ai/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount` |

Result: production now matches the local auth return-path safety contract for this callback URL route.

## Residual Launch Risk

- Production callback URL host authority passed for the normal recovery, signup, and email-change flows.
- Production backslash hostile `next` handling passed after the pushed deployment.
- Full auth-email smoke remains incomplete because no live signup, password-reset, or email-change emails were sent or inspected in this read-only lane.
- The GitHub CI run for commit `500992299` still had unrelated failing jobs at the time of this report (`size_budget`, `phase11_fal_regression`, `adaptive_media_gate`, `type_check`, `deadcode`, and `frontend_lint`). Vercel deployed successfully and the specific production security smoke passed, but full launch-readiness still requires resolving or separately adjudicating those CI failures.

## Deferred Work

- Do not continue into adjacent callback, SMTP, or auth UI cleanup from this lane.
- Before release signoff, run the full `docs/sops/sop_auth_recovery_trust_smoke.md` email flow with real inboxes.

## Stop Condition Reached

Reached. This bounded production smoke found a concrete hosted launch-readiness gap, deployed the already-scoped canonical local fix, and re-smoked production successfully. The next action is full auth-email smoke with real inboxes or separate CI/release readiness adjudication, not more code editing in this security lane.
