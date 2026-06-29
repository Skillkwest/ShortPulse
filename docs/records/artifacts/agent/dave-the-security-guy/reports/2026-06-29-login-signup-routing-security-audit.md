# 2026-06-29 Login, Signup, and Routing Security Audit

Status: audit complete; local remediation applied after audit
Owner surface: Dave the Security Guy / auth-routing security
Repo branch checked: `production`
Production URL checked: `https://www.shortpulse.ai`

## Local Remediation Follow-Up

Status as of the follow-up implementation pass:

1. P1 dashboard/root stale authenticated UI: locally remediated by routing signed-in dashboard/root rendering through the shared restore-check authority with a public-route clear mode.
2. P2 Supabase auth flow not explicitly PKCE: locally remediated by configuring the primary browser Supabase client with `auth.flowType = "pkce"`.
3. P2 admin UI cached grant fail-open: locally remediated so `/api/admin/access` revalidation failures drop cached admin access and render the existing unable-to-verify shell instead of privileged children.
4. P2 conditional stale server auth verifier: locally remediated by removing stale-grace authorization after the fresh bearer-verification cache expires.

Focused validation passed after remediation:

```bash
npm -C frontend run test -- --run tests/lib/protected-routes.test.ts tests/pages/dashboard.bootstrap.test.tsx lib/__tests__/useProtectedRouteRestoreGuard.test.tsx lib/__tests__/supabaseClient.test.ts tests/pages/auth.callback.route-behavior.test.tsx tests/pages/auth.route-behavior.test.tsx tests/lib/authRedirects.test.ts tests/api/auth-callback-url.test.ts features/admin/logic/__tests__/useAdminAccess.test.tsx tests/api/auth-helper.test.ts
cd frontend && npx eslint features/dashboard/routes/DashboardRouteSessionAware.tsx lib/useProtectedRouteRestoreGuard.ts lib/supabaseClient.ts features/admin/logic/useAdminAccess.ts lib/server/api/authTokenVerifier.ts tests/pages/dashboard.bootstrap.test.tsx lib/__tests__/useProtectedRouteRestoreGuard.test.tsx lib/__tests__/supabaseClient.test.ts features/admin/logic/__tests__/useAdminAccess.test.tsx tests/api/auth-helper.test.ts
git diff --check -- frontend/features/dashboard/routes/DashboardRouteSessionAware.tsx frontend/lib/useProtectedRouteRestoreGuard.ts frontend/lib/supabaseClient.ts frontend/features/admin/logic/useAdminAccess.ts frontend/lib/server/api/authTokenVerifier.ts frontend/tests/pages/dashboard.bootstrap.test.tsx frontend/lib/__tests__/useProtectedRouteRestoreGuard.test.tsx frontend/lib/__tests__/supabaseClient.test.ts frontend/features/admin/logic/__tests__/useAdminAccess.test.tsx frontend/tests/api/auth-helper.test.ts
```

Remaining proof boundary: this is local source and unit/route proof only. Production hosted proof still needs authenticated browser smokes for PKCE email confirmation, password recovery, email-change confirmation, Google sign-in/signup, dashboard Back/Forward restore after logout, and admin access denial/revocation behavior. Existing implicit/token-fragment links issued before the PKCE change remain a migration compatibility risk until hosted auth smokes prove the active provider behavior and any compatibility window is intentionally closed.

## Goal Prompt Used

Audit ShortPulse login and signup security end to end, including route admission, browser Back/Forward Cache behavior, tab/window session behavior, OAuth/password callback handling, Supabase Auth integration, account bootstrap, protected API identity checks, admin access gates, Stripe account bootstrap touchpoints, and current online best practices for auth/session navigation attacks. Write findings with attacker paths, repo evidence, production-safe proof, risk levels, and recommended fixes into a retained security report.

Stop conditions:

- Stop after login/signup/auth-callback/dashboard/profile/admin/API auth surfaces are covered with repo evidence.
- Stop after current primary-source browser/auth guidance is mapped to ShortPulse behavior.
- Stop before live mutations, credential disclosure, Stripe mutations, Supabase data changes, or authenticated production account changes unless a separate approval explicitly promotes that proof.
- Stop if a required hosted provider check is blocked by missing management credentials, and record the proof gap instead of guessing.

## Executive Summary

ShortPulse has strong security structure around auth routes: app-level `next` redirect sanitization is good, protected API routes require bearer verification server-side, admin role authority comes from verified `app_metadata`, signup intent gating is constrained, production security headers are present, and the production callback-url endpoint rejects hostile absolute redirects.

The audit found four security-relevant issues or unresolved risks:

1. P1: signed-in dashboard/root can stale-render after logout or browser history restore because `/dashboard` and `/` are not covered by the protected-route restore guard.
2. P2: Supabase auth flow is not explicitly set to PKCE, while the callback still supports token-in-URL artifacts.
3. P2: admin UI access can fail open from a prior in-memory grant when `/api/admin/access` cannot be reverified.
4. P2 conditional: protected and admin API routes can accept a recently cached user for up to 30 seconds if Supabase auth verification is unavailable.

No confirmed open redirect, cross-user Stripe/customer takeover, public service-role exposure, or direct unauthenticated protected API bypass was found in this audit.

## Scope Covered

- Auth entry routes: `/auth`, `/sign-up`, `/log-in`
- Callback route: `/auth/callback`
- Session-aware surfaces: `/`, `/dashboard`, `/profile`, `/report-issue`, `/ai-studio`, `/admin`
- Shared protected-route guard and route classification
- Logout epoch and browser restore handling
- Supabase browser client configuration
- Signup intent API and SQL hook posture
- Protected API path list, proxy auth checks, server bearer verification
- Admin access UI hook and server admin role helper
- Account bootstrap and Stripe customer ownership touchpoints
- Production-safe unauthenticated checks against `https://www.shortpulse.ai`
- Current primary-source guidance from OWASP, MDN, web.dev, Chrome, RFC 9700, and Supabase docs

Out of scope / not performed:

- No live Supabase table or RLS mutation.
- No Stripe mutation.
- No authenticated production user journey.
- No credential values printed or copied.
- Hosted Supabase Auth hook and production RLS/storage policy state were not verified because the Supabase Management API token is not available in this local environment.

## Findings

### P1: Dashboard and Root Can Stale-Render Signed-In UI After Logout/History Restore

Attacker path:

A user signs in on a shared browser, reaches `/dashboard` or `/`, logs out in another tab/window or navigates away, then another person presses Back/Forward or restores the page from browser history/BFCache. The route can render previously authenticated dashboard UI from React/session memory because it is not covered by the same forced restore guard used for protected routes. Server APIs should still reject invalid tokens, but visible account/dashboard state can leak.

Evidence:

- `frontend/lib/protectedRoutes.ts:6` defines protected route families as `/profile`, `/report-issue`, `/ai-studio`, and `/admin`; `/dashboard` and `/` are absent.
- `frontend/pages/_app.tsx:65` classifies protected routes from that list, and `frontend/pages/_app.tsx:194` only wraps those non-AI routes in `SharedProtectedRouteBootstrapGate`.
- `frontend/features/dashboard/routes/DashboardRouteSessionAware.tsx:61` uses `useSupabaseSessionState()` directly and renders `AuthenticatedDashboardRoute` at `frontend/features/dashboard/routes/DashboardRouteSessionAware.tsx:156` when user/session state exists.
- The stronger guard exists in `frontend/lib/useProtectedRouteRestoreGuard.ts:39`, force-refreshes before rendering at `frontend/lib/useProtectedRouteRestoreGuard.ts:72`, redirects if no current session or the session predates logout at `frontend/lib/useProtectedRouteRestoreGuard.ts:88`, and listens for `pagehide`, `pageshow`, and `visibilitychange` at `frontend/lib/useProtectedRouteRestoreGuard.ts:116`.
- Logout marks a browser-local epoch and clears local session state before network signout in `frontend/lib/supabaseClient.ts:236`.

Why this matters:

Browser Back/Forward Cache is an auth boundary for client-rendered apps. Current browser guidance says pages can be restored with JavaScript heap state intact, and current Chrome work means `Cache-Control: no-store` alone should not be treated as a complete logout defense for all cases.

Recommended fix:

- Put `/dashboard` and the signed-in root branch behind the same restore-check authority as protected routes, or extract a dashboard-specific use of `useProtectedRouteRestoreGuard` before any authenticated dashboard UI can render.
- Add tests for `/dashboard` BFCache restore, `pageshow`, logout epoch, and Back-after-logout behavior.
- Add a cross-tab visible-window logout test, preferably with a `storage` event or `BroadcastChannel` assertion, so a second visible window does not keep stale authenticated UI until focus/visibility changes.

### P2: Supabase Auth Flow Is Not Explicitly PKCE While Callback Still Accepts Token URL Artifacts

Attacker path:

If production flows use implicit/token-fragment behavior, access or refresh tokens can appear in URL fragments during signup, sign-in, password recovery, or email confirmation. Fragments are not sent to servers in ordinary HTTP requests, but they are visible to browser extensions, local browser history/session restore, screenshots, shoulder surfing, and in-page JavaScript before cleanup. Authorization Code + PKCE avoids placing bearer tokens in the callback URL.

Evidence:

- `frontend/lib/supabaseClient.ts:40` creates the browser Supabase client with `persistSession` and `autoRefreshToken`, but no explicit `auth.flowType: "pkce"`.
- `frontend/pages/auth/callback.tsx:66` treats `access_token` and `refresh_token` as auth callback artifacts.
- `frontend/pages/auth/callback.tsx:79` reads `access_token` from either query string or hash.
- `frontend/pages/auth/callback.tsx:390` exchanges a `code` for a session only for Google OAuth sign-in/signup callbacks.

Why this matters:

OAuth 2.0 Security Best Current Practice and OWASP guidance favor Authorization Code with PKCE for browser-based apps. Supabase also documents PKCE as the server-side/auth-code flow. Leaving the client flow implicit by default creates an unresolved production posture even if some current paths already use `code`.

Recommended fix:

- Explicitly configure the primary browser Supabase client with `auth: { flowType: "pkce" }` if supported by the installed Supabase version.
- Confirm all email/password confirmation, recovery, email-change, Google sign-in, and Google signup flows still complete under PKCE.
- After migration, reduce or remove token-fragment acceptance where it is no longer needed, or document a bounded compatibility window with a removal condition.
- Consider route-specific `Referrer-Policy: no-referrer` on `/auth/callback` as defense in depth while callback artifacts may exist.

### P2: Admin UI Access Check Fails Open From Prior In-Memory Grant on Reverification Failure

Attacker path:

An admin or former admin has already loaded admin UI in the current JS runtime. Later, their role is revoked or access needs revalidation. If `/api/admin/access` returns a non-OK response or throws, the client hook keeps rendering admin UI from the previous granted cache. Server admin APIs still enforce `requireAdminUser`, so this is not a direct API bypass, but it can leak admin UI structure, cached UI state, and may trigger child loaders with stale assumptions.

Evidence:

- `frontend/features/admin/logic/useAdminAccess.ts:37` keeps `cachedAdminAccessStateByUserId` in module memory.
- `frontend/features/admin/logic/useAdminAccess.ts:56` initializes from that cached state.
- `frontend/features/admin/logic/useAdminAccess.ts:158` returns a granted state on non-OK access response when there was a prior granted cache.
- `frontend/features/admin/logic/useAdminAccess.ts:198` does the same when the access request throws.
- Server-side admin authority itself is stronger: `frontend/lib/server/api/auth.ts:128` requires a verified API user, and `frontend/lib/server/api/auth.ts:100` derives admin roles from verified `app_metadata`.

Recommended fix:

- Treat admin access revalidation failures as `checking`, `error`, or `denied` for rendering privileged admin children.
- If continuity is desired, render a limited "cannot verify admin access" shell that does not mount admin child data loaders.
- Add a regression test that a prior cached grant does not render admin route children after `/api/admin/access` fails.

### P2 Conditional: Stale Server Auth Verification Can Authorize During Supabase Auth Outage

Attacker path:

A user or admin presents a token that was valid moments ago. Their account or admin role is revoked. If Supabase `/auth/v1/user` verification becomes unavailable within the stale grace window, ShortPulse can accept the cached identity instead of failing closed. The window is short, but it applies to protected API and admin authorization paths.

Evidence:

- `frontend/lib/server/api/authTokenVerifier.ts:28` sets a 5 second verification cache TTL.
- `frontend/lib/server/api/authTokenVerifier.ts:29` sets a 30 second stale grace period.
- `frontend/lib/server/api/authTokenVerifier.ts:77` reads stale verified users.
- `frontend/lib/server/api/authTokenVerifier.ts:199` returns the stale user when auth verification is unavailable.
- `frontend/lib/server/api/auth.ts:70` and `frontend/lib/server/api/auth.ts:128` treat the returned user as authorization authority for normal and admin routes.

Recommended fix:

- Remove stale fallback from authorization paths, or at minimum require fresh verification for admin routes and all mutation routes.
- If stale fallback is retained for read-only resilience, encode that policy explicitly: route class, max age, logging, metrics, and fail-closed behavior for admin and account mutation surfaces.
- Add tests proving revoked/admin-sensitive paths return `503` rather than using stale identity when Supabase verification is unavailable.

## Confirmed Strengths

- Redirect safety: `frontend/lib/authRedirects.ts:47` requires relative app paths, rejects backslashes, rejects protocol-relative paths, and blocks auth self-redirect loops. Signup next paths are more restrictive at `frontend/lib/authRedirects.ts:108`.
- Production callback URL safety: `https://www.shortpulse.ai/api/auth/callback-url?flow=signin&next=https%3A%2F%2Fevil.example%2F` returned `https://www.shortpulse.ai/auth/callback?flow=signin&next=%2Fdashboard`.
- Signup intent posture: `frontend/pages/api/auth/signup-intent.ts:92` is POST-only, `frontend/pages/api/auth/signup-intent.ts:96` respects public-signup feature state, `frontend/pages/api/auth/signup-intent.ts:100` rate limits, `frontend/pages/api/auth/signup-intent.ts:122` constrains signup `next`, and `frontend/pages/api/auth/signup-intent.ts:151` stores hashed matching data plus short TTL intent rows.
- API auth authority: `frontend/lib/server/api/protectedApiPaths.ts:5` and `frontend/lib/server/api/protectedApiPaths.ts:19` cover account, billing, credits, admin, generation, media, AI, provider, and project route families. `frontend/lib/server/api/auth.ts:21` verifies bearer auth server-side rather than trusting proxy metadata.
- Admin role source: `frontend/lib/server/api/auth.ts:100` only reads admin/operator role authority from verified `app_metadata`, not user-controlled metadata.
- Production security headers: `https://www.shortpulse.ai/log-in` and `/auth/callback` returned CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and Vercel HSTS.
- Dev route exposure: `https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff` returned `404`.
- Account bootstrap does not grant paid value by itself; the local route is authenticated and Stripe customer sync remains separate from paid-plan authority.
- Stripe ownership checks were present in the audited account/subscription paths; this audit did not find a login/signup navigation path that lets one user claim another user's Stripe customer or subscription.
- Private media/storage SQL posture was spot-checked from local SQL and aligns with user-scoped paths/RLS expectations; no auth navigation leak into private storage was found from the inspected route layer.

## Production-Safe Proof Run

Commands were read-only and unauthenticated:

```bash
curl -sSI https://www.shortpulse.ai/log-in
curl -sSI 'https://www.shortpulse.ai/auth/callback?flow=signin&next=%2Fdashboard'
curl -sS 'https://www.shortpulse.ai/api/auth/callback-url?flow=signin&next=https%3A%2F%2Fevil.example%2F'
curl -sSI https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff
node scripts/check_supabase_auth_signup_config.mjs --expect-enabled
```

Results:

- `/log-in` returned `200` with production security headers and HSTS.
- `/auth/callback?flow=signin&next=%2Fdashboard` returned `200` with production security headers and HSTS.
- The hostile absolute `next=https://evil.example/` was sanitized to `/dashboard`.
- The dev bakeoff route returned `404`.
- The Supabase auth config check was blocked by missing `SUPABASE_ACCESS_TOKEN` / `SUPABASE_MANAGEMENT_API_TOKEN`. No hosted Supabase Auth config claim is made from this audit.

## Browser and Auth Edge-Case Checklist

| Edge case                           | Security expectation                                                                       | ShortPulse status                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Back after logout / BFCache restore | Revalidate before private UI paints.                                                       | Strong for protected route families; gap for `/dashboard` and signed-in `/`.                                   |
| Forward after logout                | Same as Back: restored app state must prove current auth.                                  | Same dashboard/root gap.                                                                                       |
| Two tabs / two windows              | Logout or revocation in one context should invalidate visible private UI in the other.     | Logout epoch exists; explicit storage/BroadcastChannel listener coverage should be added or proven.            |
| OAuth redirect abuse                | Exact trusted redirect URI plus same-origin app `next` validation.                         | Local and production-safe evidence aligned.                                                                    |
| OAuth token URL exposure            | Prefer Authorization Code + PKCE, avoid implicit fragments.                                | Unresolved; client does not explicitly set PKCE and callback accepts token artifacts.                          |
| Password reset / recovery           | Short-lived trusted callback, no raw host trust, fail closed on invalid links.             | Callback URL authority and recovery handling look intentional; PKCE migration would reduce URL-token exposure. |
| CSRF                                | Bearer-header API auth reduces cookie CSRF; cookies would need SameSite and CSRF checks.   | Current protected API model uses bearer headers; no cookie-auth mutation bypass found.                         |
| Clickjacking                        | Deny framing.                                                                              | CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY` present.                                              |
| Web Storage                         | Never store service-role keys, signed URLs, or durable sensitive artifacts in Web Storage. | Supabase SPA session persistence is a known tradeoff; no service-role browser storage found in this audit.     |
| Admin route caching                 | Privileged UI should fail closed when access cannot be reverified.                         | Gap: prior granted admin UI cache survives access check errors.                                                |

## Primary Sources Used

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [MDN pageshow event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event)
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
- [MDN Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
- [MDN Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy)
- [web.dev Back/forward cache](https://web.dev/articles/bfcache)
- [Chrome bfcache for Cache-Control: no-store](https://developer.chrome.com/docs/web-platform/bfcache-ccns)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/rfc9700/)
- [RFC 7636: Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase signInWithOAuth reference](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)

## Recommended Fix Order

1. Add dashboard/root restore guard coverage and focused BFCache/logout tests.
2. Explicitly migrate/configure Supabase browser auth to PKCE and verify all callback flows.
3. Make admin UI revalidation failures fail closed for privileged children.
4. Remove or route-class-restrict stale auth verifier fallback.
5. Add explicit multi-tab/window logout propagation coverage with `storage` event or `BroadcastChannel`.
6. Re-run hosted Supabase auth signup/hook checks when a management token is available.

## Final Audit Boundary

This report is decision-grade for local source posture and unauthenticated production route/header posture. It is not authenticated production proof of a real signup, login, password reset, admin action, Stripe customer operation, or Supabase RLS/storage policy state. The next proof step should be read-only hosted Supabase config verification, followed by authenticated test-account browser smokes for Back/Forward, two-window logout, login, signup, recovery, and admin denial behavior.
