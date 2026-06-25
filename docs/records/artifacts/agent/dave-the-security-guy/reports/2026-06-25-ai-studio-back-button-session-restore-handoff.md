# AI Studio Back Button Session Restore Security Handoff

## Summary

- Date: 2026-06-25
- Prepared by: Codex audit lane for handoff to the next security or implementation agent
- Intended next owner: Dave the Security Guy, Copperknot, or another repo-authorized launch/security agent
- Scope: logout, browser Back behavior, protected AI Studio route admission, client session snapshots, protected API bearer verification
- Environment:
  - Local repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
  - Local branch: `production`
  - Local branch guard observed: `shortpulse.allowedBranch=production`
  - Production URL inspected without auth: `https://www.shortpulse.ai`
- Mode: audit and handoff only
- Edits during audit: none before this report
- Launch relevance: critical. A signed-out or signup-attempt browser path must never restore a prior user's authenticated AI Studio session.
- Related artifact: `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-06-25-public-home-stale-session-auth-boundary-audit.md`

## User Report

The user reported two paths:

1. User logs out, then presses the browser Back button, and can return into the previous authenticated AI Studio session.
2. User logs out, attempts to sign up with a new account, presses browser Back a couple of times, and can return into the previous authenticated AI Studio session.

The user classified this as a critical security issue. Treat that severity as justified unless a live authenticated production repro proves the observed page is only a harmless loading shell.

## Decision Summary

- Decision: confirmed high-risk, launch-blocking auth/session restore class from code evidence.
- Confidence: high for missing restore-time revalidation; medium for exact live production behavior because no authenticated production credentials were used in this audit.
- Threat boundary: logged-out or new-user browser flow -> browser history/back-forward restoration -> previous authenticated AI Studio UI/session state.
- Primary risk: private AI Studio workspace contents, account identity, project references, media previews, prompts, generated output state, or account menu identity can be displayed after logout on a shared browser.
- Secondary risk: a restored page with an old in-memory access token may attempt authenticated API calls. Server-side API auth is still bearer-protected, but the local bearer verifier caches token verification for 5 seconds and Supabase access-token revocation semantics must be proven live.
- Fix recommendation: fix now before launch. Implement a canonical protected-route session invalidation and browser-history restoration guard. Do not solve this only with cache headers.

## Threat Statement

An attacker or next user on the same browser can use browser Back after logout or after starting signup to revive a protected AI Studio page that still holds the previous user's in-memory React/Supabase session state. That can reveal previous-user workspace data and may briefly let the restored page send stale bearer-authenticated API requests.

This is a real authority boundary issue even if Supabase eventually rejects API calls, because private client-rendered workspace state itself is protected data.

## Assets At Risk

- Previous user's authenticated ShortPulse account identity.
- AI Studio workspace shell and account menu.
- Project route state and project title/identity.
- Reference Grid and Quick Slot Inventory visible state.
- Prompt/composer state, Pulse/Standard mode state, parked Pulse runtime state, and generated-output restore state.
- Media Library previews or signed URLs already present in memory.
- Any API request made from a restored client while a stale bearer token is still available.

## Scope Boundaries

This handoff is not claiming:

- Cross-user Supabase RLS failure.
- Unauthenticated direct API access.
- Provider request ownership failure.
- A server-side project/media ownership bypass.

The issue is browser/session lifecycle: private UI and possibly stale tokens can outlive the user's intent to end the authenticated session.

## Browser Behavior Context

Modern browsers can restore pages from Back/Forward Cache or session history with JavaScript heap and DOM state intact. The `pageshow` event is the usual hook for detecting a restored page, especially when `event.persisted` is true.

Important external references for the next agent:

- MDN `pageshow`: `https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event`
- web.dev BFCache guide: `https://web.dev/articles/bfcache`
- Chrome Cache-Control `no-store` BFCache change: `https://developer.chrome.com/docs/web-platform/bfcache-ccns`

Do not rely solely on `Cache-Control: no-store`. Chrome has specifically changed BFCache behavior for some `no-store` pages, and the robust fix is still app-level revalidation on restore.

## Current Code Evidence

### 1. Protected pages are client-gated, not server-gated

File: `frontend/pages/_app.tsx`

- Lines 63-67 classify protected routes and special-case AI Studio.
- Lines 194-201 wrap non-AI protected routes in `ProtectedRouteBootstrapGate`.
- Lines 204-208 render AI Studio without the shared bootstrap because AI Studio owns its own route gate.

File: `frontend/pages/ai-studio.tsx`

- Lines 1-8 export `AiStudioProtectedRouteEntry` as the AI Studio page.

Impact:

- This is a client-rendered protected route. Normal loading redirects work after hydration, but old hydrated client state can be restored by browser history.

### 2. AI Studio only checks auth on normal hook lifecycle

File: `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`

- Lines 220-224 build the login redirect and call `useProtectedRoute(true)`.
- Lines 326-335 render a neutral loading shell when `loading || !session`.
- Lines 423-426 render the full runtime under `ProtectedRouteSessionProvider` once session and media compliance clear.

Impact:

- Normal entry is gated.
- There is no `pageshow`, `visibilitychange`, `popstate`, logout epoch, or browser-history restore-specific revalidation in this route entry.

### 3. Shared protected routes have the same restore gap

File: `frontend/features/compliance/routes/ProtectedRouteBootstrapGate.tsx`

- Lines 41-45 call `useProtectedRoute(true)` and `useMediaComplianceGate`.
- Lines 52-54 render a session loader when no session exists.
- Lines 91-97 provide the resolved session to children through `ProtectedRouteSessionProvider`.

Impact:

- Non-AI protected routes also depend on normal React hook lifecycle.
- They do not currently force a fresh session read when a browser restores a prior protected page from history.

### 4. `useProtectedRoute` redirects on ordinary no-session mount, but does not handle restored old context

File: `frontend/lib/authGuard.ts`

- Lines 16-23 read the protected-route context and shared Supabase session state.
- Lines 27-34 return normally when a session exists.
- Lines 35-53 redirect to login only after the shared session state has no session and persisted-session recovery is absent or exhausted.
- Lines 64-70 return the context session immediately when `ProtectedRouteSessionContext` exists.

Impact:

- A restored protected React tree can still hold the old context session.
- When that context exists, `useProtectedRoute` bypasses the shared session-state read.
- A restored page needs a hard revalidation path that can invalidate this old context before protected UI renders.

### 5. The shared session snapshot is in memory and can be stale

File: `frontend/lib/supabaseSessionSnapshotStore.ts`

- Lines 19-20 keep the current session snapshot in module memory.
- Lines 31-45 replace or set that snapshot.
- Lines 50-65 expose subscription and read helpers.

File: `frontend/lib/supabaseClient.ts`

- Lines 34-42 create the persisted Supabase browser client.
- Lines 87-99 subscribe to Supabase auth state changes.
- Lines 161-197 return the cached session snapshot unless a refresh is requested.
- Lines 218-222 sign out through Supabase and then prime the snapshot to null.

Impact:

- The app correctly keeps a shared client session snapshot for normal runtime.
- A browser history restore can revive an older heap/snapshot unless the app detects the restore and forces session revalidation or a logout epoch check.

### 6. Logout handlers route away but do not invalidate old history entries

File: `frontend/features/ai-studio/components/AiStudioToolbarAccountMenu.tsx`

- Lines 125-134 call `signOutSupabaseSession()`, close UI state, and `router.replace("/")`.

File: `frontend/features/dashboard/components/AuthenticatedDashboardRoute.tsx`

- Lines 359-368 call `signOutSupabaseSession()`, close UI state, and `router.replace("/")`.

File: `frontend/pages/profile.tsx`

- Lines 682-689 call `signOutSupabaseSession()` and `router.replace("/auth")`.

Impact:

- Logout is local-session clearing plus client navigation.
- It does not mark a global logout epoch.
- It does not hard-navigate out of the current JavaScript document.
- It does not invalidate previous protected history entries or restored client state.

### 7. Auth/signup path can redirect an existing session into AI Studio

File: `frontend/pages/auth.tsx`

- Lines 213-225 compute `nextPath`, `signupNextPath`, `activeMode`, and `postAuthPath`.
- Lines 249-259 call `readSupabaseSession()` on auth page load.
- Lines 252-254 redirect any existing session to `postAuthPath`.
- Lines 329 redirects after email/password auth with `router.push(postAuthPath)`.

Impact:

- `/sign-up?next=/ai-studio` doubles as "continue with the current existing browser session".
- This is related to the separate public-home stale-session report.
- For the user's second path, this can combine with browser Back to return toward old authenticated AI Studio history entries.

### 8. Protected APIs are bearer-gated, but stale restored tokens can still matter

File: `frontend/lib/authenticatedFetch.ts`

- Lines 139-150 read the current access token and throw `AUTH_REQUIRED` if none exists.
- Lines 158-162 attach `Authorization: Bearer <token>`.
- Lines 184-194 retry once after 401 with a refreshed token.

File: `frontend/proxy.ts`

- Lines 50-68 only enforce for protected `/api/*` paths.
- Lines 70-84 require and verify a bearer token before allowing protected API routes through.

File: `frontend/lib/server/api/authTokenVerifier.ts`

- Lines 27-31 define a 5,000 ms verified-user cache.
- Lines 97-105 return a cached verified user for the same token before contacting Supabase.
- Lines 121-128 verify uncached tokens against Supabase `/auth/v1/user`.

Impact:

- Server-side API auth is real and should usually prevent unauthenticated direct access.
- However, if a restored page still has an old in-memory access token, it can try authenticated calls.
- For up to 5 seconds after a token was cached, the app's own verifier may accept that token without asking Supabase again.
- The next agent must prove whether a post-logout stale token is accepted live and, regardless, prevent restored clients from sending stale tokens.

### 9. Production unauthenticated route headers do not prevent the class

Command run:

```bash
curl -sSI https://www.shortpulse.ai/ai-studio
curl -sSI 'https://www.shortpulse.ai/log-in?next=%2Fai-studio'
```

Observed:

- `/ai-studio` returned `HTTP/2 200`.
- `/ai-studio` returned `cache-control: public, max-age=0, must-revalidate`.
- `/ai-studio` returned `x-vercel-cache: HIT`.
- `/ai-studio` static HTML contained only the protected loading shell: `Checking your session before project restore continues.`
- `/log-in?next=%2Fai-studio` also returned `cache-control: public, max-age=0, must-revalidate`.

Impact:

- Production unauthenticated HTML is not private by itself.
- The private data exposure risk is the already-hydrated/restored browser client.
- Adding route-level `Cache-Control: no-store` for protected pages may still be useful defense-in-depth, but it is not sufficient and must not be the only fix.

## Existing Validation

Focused guard tests run during this audit:

```bash
npm -C frontend run test -- --run lib/__tests__/authGuard.test.tsx tests/pages/app.ai-studio-gates.test.tsx tests/pages/protected-route-bootstrap-gate.test.tsx
```

Result:

- Passed.
- 3 test files.
- 17 tests.

Interpretation:

- The normal mount path is covered and healthy.
- The browser restore path is not covered.
- The tests passing do not disprove the user's report.

## Missing Tests

Add coverage for at least these scenarios:

1. AI Studio restored after logout:
   - Render AI Studio with a session.
   - Simulate logout epoch or cleared Supabase session.
   - Dispatch `pageshow` with `persisted: true`.
   - Assert protected runtime is removed or never rendered and router redirects to `/log-in?next=...`.

2. Shared protected route restored after logout:
   - Use `ProtectedRouteBootstrapGate`.
   - Simulate old `ProtectedRouteSessionProvider` context.
   - Dispatch `pageshow`.
   - Assert fresh session read occurs and stale context does not admit the page.

3. Auth signup/back flow:
   - Start from `/sign-up?next=/ai-studio` with no current session after logout.
   - Confirm it does not redirect from stale cache alone.
   - Confirm prior session state cannot be revived by a synthetic history restore.

4. Stale token API guard:
   - With a stale/restored client token, ensure the client clears token state before `fetchWithAuth` sends the request.
   - Optional server-side test: after explicit logout epoch, client should not attempt token refresh or retry.

5. Production E2E with real auth state:
   - Login to `https://www.shortpulse.ai`.
   - Open AI Studio and verify private workspace UI.
   - Logout from AI Studio.
   - Press browser Back.
   - Assert no private AI Studio UI, account menu, project title, prompts, media previews, or generated outputs are visible.
   - Assert any protected API call after restore is `401` or not attempted.

## Recommended Canonical Fix

Implement one shared protected-session lifecycle guard. Do not patch only AI Studio.

### A. Add an auth invalidation primitive

Suggested module:

- `frontend/lib/authSessionInvalidation.ts`

Responsibilities:

- Maintain a browser-visible logout epoch, for example `shortpulse.auth.logoutEpoch`.
- Expose:
  - `markAuthSessionLoggedOut()`
  - `readAuthSessionLogoutEpoch()`
  - `isSessionOlderThanLogoutEpoch(session)`
  - possibly `clearCurrentSessionSnapshot()` or an explicit invalidation wrapper.
- Use `localStorage` rather than only `sessionStorage` so duplicate tabs and same-origin history entries see it.
- Keep data non-sensitive. Store only timestamps or random epochs, never tokens, user ids, emails, signed URLs, or project ids.

### B. Harden `signOutSupabaseSession`

File: `frontend/lib/supabaseClient.ts`

Candidate changes:

- Mark logout epoch synchronously before or immediately after signout begins.
- Prime the session snapshot to null before awaiting networked signout if safe for UX.
- Clear `currentSessionReadPromise` so an old in-flight read cannot repopulate the snapshot after logout.
- Still call `supabase.auth.signOut()`.
- Treat any signout failure carefully:
  - local user intent to end session should still clear local browser authority;
  - server-side signout failure should surface a recoverable message only if needed;
  - do not leave protected UI visible because signout network cleanup failed.

### C. Add a protected-route restore guard

Suggested module:

- `frontend/lib/useProtectedRouteRestoreGuard.ts`

Responsibilities:

- Run only for protected route families from `frontend/lib/protectedRoutes.ts`.
- On mount, `pageshow`, `visibilitychange` to visible, and possibly Next route `routeChangeComplete` for protected routes:
  - force-read or force-refresh the Supabase session;
  - compare session freshness against logout epoch;
  - if invalid/missing, clear local session snapshot and route to `buildLoginPath({ nextPath: currentProtectedPath })`;
  - while checking, render a neutral loader or set an invalidated state so stale protected children do not paint.
- Special-case auth callback/recovery pages only if necessary; do not block legitimate Supabase callback completion.

Important implementation point:

- `ProtectedRouteSessionProvider` and `useProtectedRoute` must not be able to bypass this guard with an old context session.
- The guard should sit above protected page content, preferably in the AI Studio route entry and the shared `ProtectedRouteBootstrapGate`, or in `_app.tsx` with route-family awareness.

### D. Apply to AI Studio and shared protected routes

Files likely touched:

- `frontend/pages/_app.tsx`
- `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`
- `frontend/features/compliance/routes/ProtectedRouteBootstrapGate.tsx`
- `frontend/lib/authGuard.ts`
- `frontend/lib/protectedRouteSessionContext.ts`
- `frontend/lib/supabaseClient.ts`
- New tests under:
  - `frontend/lib/__tests__/`
  - `frontend/tests/pages/`

Do not fork route protection into an AI-Studio-only path. The bug class applies to `/profile`, `/report-issue`, `/admin`, and any future protected page too.

### E. Add cache headers as defense-in-depth only

Consider adding protected page HTML headers:

- `/ai-studio`
- `/ai-studio/:path*`
- `/profile`
- `/report-issue`
- `/admin`
- `/admin/:path*`
- `/saved-creators`

Candidate header:

```text
Cache-Control: no-store, max-age=0
```

But:

- Do not rely on this alone.
- Browser restore behavior can still restore pages in modern Chrome under certain conditions.
- Static shell HTML is not the main private-data surface; hydrated client state is.

## Implementation Warnings

- Do not break legitimate "already signed in, go to `/ai-studio`" behavior from dashboard/profile.
- Do not make `/sign-up` unusable for legitimate existing users unless product explicitly wants signup to force logout. The safer fix is: public logged-out-looking pages must not silently route into a prior session, and protected restored pages must revalidate.
- Do not store sensitive auth details in the logout marker.
- Do not add mobile-specific QA; current repo policy is desktop-first.
- Do not touch unrelated dirty AI Studio files unless the implementation truly owns them. The worktree was dirty during this audit.
- Do not treat local tests as production proof. Production proof requires `https://www.shortpulse.ai` with authenticated browser state.

## Suggested Execution Plan For Next Agent

1. Fresh-start under repo startup contract.
2. Read this report and the related public-home stale-session report.
3. Re-read current versions of:
   - `frontend/lib/supabaseClient.ts`
   - `frontend/lib/authGuard.ts`
   - `frontend/lib/protectedRouteSessionContext.ts`
   - `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`
   - `frontend/features/compliance/routes/ProtectedRouteBootstrapGate.tsx`
   - `frontend/pages/auth.tsx`
   - `frontend/pages/_app.tsx`
4. Create the smallest shared lifecycle abstraction that invalidates old protected page state.
5. Add unit/page tests for `pageshow` restoration and logout epoch handling.
6. Run focused validation:
   - `npm -C frontend run test -- --run lib/__tests__/authGuard.test.tsx tests/pages/app.ai-studio-gates.test.tsx tests/pages/protected-route-bootstrap-gate.test.tsx`
   - plus the new regression tests.
   - `npm -C frontend run type-check:touched`
   - `git diff --check`
7. If implementation touches route docs or auth behavior docs, update:
   - `README.md`
   - `docs/routes.md`
   - `docs/security-checklist.md`
   - possibly `docs/supabase_auth_setup.md`
8. Perform production browser proof on `https://www.shortpulse.ai` with an approved authenticated account:
   - AI Studio logout -> Back.
   - AI Studio logout -> sign-up attempt -> Back twice.
   - Confirm no private AI Studio session state paints after logout.

## Stop Condition

Stop and hand back if any of these occur:

- The fix would require changing public signup product policy beyond the security invariant.
- Auth callback, password recovery, or email-change flows begin failing.
- Production proof needs credentials or account actions not available to the agent.
- The worktree has overlapping active-lane edits in the exact files required for implementation and ownership is unclear.

## Final Proof Boundary From This Audit

Proven:

- Current code lacks restore-time protected-route revalidation.
- Current code has logout handlers that clear Supabase state and route away but do not invalidate old history entries.
- Current code allows protected route context to bypass shared session reads.
- Current server API auth is bearer-protected but includes a 5 second verified-token cache.
- Production unauthenticated `/ai-studio` serves only a loading shell and is publicly cached.
- Existing focused tests pass but do not cover browser history restoration.

Not proven:

- Exact authenticated production reproduction with the user's account.
- Whether post-logout stale bearer API calls succeed beyond the 5 second app verifier cache.
- Whether the user's observed "back into session" included active API success or only private UI restoration.

Treat the unproven items as required implementation-proof tasks, not reasons to downgrade severity.
