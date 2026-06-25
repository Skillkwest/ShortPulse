# Public Home Stale Session Auth Boundary Audit

## Candidate

- Date: 2026-06-25
- Reviewer: Codex acting under Dave the Security Guy security rules
- Surface: public home/dashboard, signup/login auth entry, AI Studio protected route entry
- Environment:
  - Local repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
  - Local branch: `production`
  - Local branch guard: `shortpulse.allowedBranch=production`
  - Production URL inspected: `https://www.shortpulse.ai`
- Mode: audit and report. No auth code was edited during this audit.
- Finding summary: a browser can visually show the public/logged-out home surface while a valid previous Supabase browser session still exists. From that public surface, the `Sign up` / `Launch App` path goes to `/sign-up?next=/ai-studio`; the auth page then detects the existing session and redirects directly into AI Studio without a fresh login step.

## Decision Summary

- Decision: confirmed high-severity auth/session boundary issue.
- Severity: High.
- Confidence: High from static code evidence; partial live proof from clean-session production smoke.
- Boundary crossed: public logged-out presentation -> prior authenticated Supabase session -> protected AI Studio route.
- Launch relevance: high. The reported behavior can expose a previous user's authenticated AI Studio workspace on a shared browser or shared machine.
- Fix recommendation: fix now before launch. The canonical fix should prevent a public/logged-out-looking page from being able to navigate into a prior authenticated account without an explicit fresh login or an already-authenticated UI state.

## Threat Statement

Attacker or next browser user can start from a public/logged-out-looking ShortPulse home page, click a signup/launch CTA, cross the auth/session boundary through a still-valid previous Supabase browser session, and reach the previous user's authenticated AI Studio account without knowingly logging in.

This is a real authority boundary issue because the user-visible state says "logged out / sign up", while the browser's hidden auth state remains authorized for protected app routes.

## Affected Assets

- Previous user's authenticated ShortPulse account.
- AI Studio workspace state visible after `/ai-studio` opens.
- Account-linked identity shown in AI Studio account menu.
- Any authenticated AI Studio data fetched after route admission, subject to normal server-side RLS/API protections for that previous user.

The audit did not prove a server-side cross-user API authorization failure. The issue is that the wrong user's existing browser session can still be used from a page that appears logged out.

## Existing Intended Controls

Current canonical docs state:

- `/sign-up` is the canonical public signup entry.
- `/log-in` is the canonical public login entry.
- `/ai-studio` and `/ai-studio/*` are protected routes.
- Protected routes should redirect unauthenticated users to `/log-in`.
- Signup is account-first and intent-gated, but signup intent is not supposed to grant paid value or bypass auth.

Relevant docs inspected during the audit:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/README.md`
- `docs/routes.md`
- `docs/security-checklist.md`
- `docs/supabase_auth_setup.md`
- `docs/adr/0095-account-first-signup-intent-gate.md`
- `docs/adr/0096-google-oauth-signup-intent-match.md`
- `docs/deployment.md`
- `docs/agents/dave-the-security-guy/*`

## Root Cause

The issue is the combination of three code behaviors:

1. The root route `/` always renders the public home surface.
2. The public home CTAs intentionally link to `/sign-up?next=/ai-studio`.
3. The auth page redirects any already-existing Supabase session to the requested `next` path before requiring interaction with the signup or login form.

That means "click signup" is also functioning as "continue as the currently stored session" whenever Supabase browser storage still contains a valid prior session.

## Code Evidence

### Root route always renders public home

File: `frontend/pages/index.tsx`

Evidence:

- Lines 1-4 describe the root route as the logged-out dashboard/home surface without the session-aware dashboard bundle.
- Lines 25-36 render `PublicDashboardRoute` directly.
- There is no call to `readSupabaseSessionBootstrapHint()`, `readSupabaseSession()`, `useSupabaseSessionState()`, or a protected/session-aware branch on `/`.

Impact:

- A user can visit `https://www.shortpulse.ai/` and see public CTAs even if the browser still has a valid Supabase session for a previous user.
- This is especially relevant because the screenshot showed `shortpulse.ai` at the public home surface.

### `/dashboard` is session-aware, but `/` is not

File: `frontend/pages/dashboard.tsx`

Evidence:

- Lines 42-44 preload the session-aware dashboard branch when `readSupabaseSessionBootstrapHint()` is true.
- Lines 76-82 set `shouldResolveSession` when a bootstrap hint exists.
- Lines 97-104 render the public route only when session resolution is not being attempted.
- Lines 128-133 render `DashboardRouteSessionAware` after the session-aware component is available.

File: `frontend/features/dashboard/routes/DashboardRouteSessionAware.tsx`

Evidence:

- Lines 57-61 read Supabase session state and compute `isAuthenticated`.
- Lines 84-86 hold a loading surface while an existing persisted session is being resolved.
- Lines 88-95 fall back to public dashboard only when there is no authenticated user.
- Lines 102-124 render `AuthenticatedDashboardRoute` only when both user and session exist.

Impact:

- `/dashboard` has a designed mitigation against flashing guest CTAs over an unresolved persisted session.
- `/` bypasses that mitigation and can therefore present guest CTAs while the auth session remains valid.

### Public CTAs route to signup with AI Studio as next path

File: `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`

Evidence:

- Lines 113-116 build guest auth URLs:
  - `loginHref = buildDashboardAuthPath()`
  - `signupHref = buildDashboardSignupPath()`
  - `guestCreateProjectHref = buildDashboardSignupPath()`
- Lines 160-166 render the top-right public `Sign up` link with `href={signupHref}`.
- Lines 171-174 pass the same signup path into `GuestDashboardView`.

File: `frontend/features/pricing/paths.ts`

Evidence:

- Lines 101-105 define `buildDashboardSignupPath()` as `buildSignupPath({ nextPath: "/ai-studio" })`.
- In tests, this resolves to `/sign-up?next=%2Fai-studio`.

Impact:

- Public signup and launch CTAs intentionally preserve `/ai-studio` as the post-auth destination.
- That is correct for a truly unauthenticated new visitor, but unsafe when the page visually appears logged out while a prior session is still active.

### Auth page redirects existing sessions to `next`

File: `frontend/pages/auth.tsx`

Evidence:

- Lines 213-225 resolve `nextPath`, `signupNextPath`, `activeMode`, and `postAuthPath`.
- Lines 249-259 call `readSupabaseSession()` on page load.
- Lines 252-254 redirect any existing session to `postAuthPath` with `router.replace(postAuthPath)`.
- For `/sign-up?next=/ai-studio`, `postAuthPath` becomes `/ai-studio`.

Impact:

- `/sign-up` is not exclusively a signup form when a session exists.
- It is also an implicit "continue as existing user" redirect.
- This is the direct mechanism that makes a public `Sign up` CTA open a previous user's AI Studio session.

### AI Studio admits any valid current session

File: `frontend/pages/ai-studio.tsx`

Evidence:

- Lines 1-6 delegate the page to `AiStudioProtectedRouteEntry`.

File: `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`

Evidence:

- Lines 220-224 build the auth redirect and call `useProtectedRoute(true)`.
- Lines 326-335 show a loading state while `loading || !session`.
- Lines 423-426 render the full runtime under `ProtectedRouteSessionProvider` once a session and compliance gate have cleared.

Impact:

- AI Studio is behaving as coded: if a valid previous session is present, it opens.
- The issue is that the preceding public/auth route flow lets the user enter that route from a page that looked logged out.

### Protected route hook attempts persisted-session recovery before redirecting to login

File: `frontend/lib/authGuard.ts`

Evidence:

- Lines 27-34 return normally when an existing session is present.
- Lines 35-53 redirect to login only when no session exists and recovery is absent or exhausted.
- Lines 39-49 attempt one session recovery when `readPersistedSupabaseSessionHint()` is true.

Impact:

- Browser back/forward to `/ai-studio` can also recover and admit a previous valid session.
- This is correct for authenticated continuity, but unsafe when the surrounding UI tells a new browser user they are logged out.

### Server/API auth is not the observed root cause

File: `frontend/proxy.ts`

Evidence:

- Lines 50-68 only process `/api/*` routes.
- Lines 70-84 require and verify a bearer token for protected API paths.
- Lines 86-99 add verified user metadata to request headers after token verification.

File: `frontend/lib/server/api/auth.ts`

Evidence:

- Lines 70-98 implement `requireApiUser` by parsing bearer auth and verifying the user server-side.
- Lines 128-139 implement `requireAdminUser` on top of verified bearer identity plus admin role checks.

File: `frontend/lib/server/api/protectedApiPaths.ts`

Evidence:

- Lines 5-17 include protected exact API paths such as `/api/projects`.
- Lines 19-34 include protected API prefixes.
- Lines 58-60 classify protected paths.

Impact:

- API paths inspected remain bearer-auth protected.
- The incident is not that unauthenticated API calls can access data. The issue is that client navigation can reuse a previous valid bearer session while the public UI suggests no one is signed in.

## Current Tests And Gaps

### Tests that currently encode the unsafe behavior

File: `frontend/tests/pages/auth.route-behavior.test.tsx`

Evidence:

- Lines 106-115 test that an existing session redirects to the sanitized `next` path.
- This is currently expected behavior.

Impact:

- The test suite will pass while preserving the observed problem.
- A future fix will likely need to update this test or add a more precise version that distinguishes "login page continue session" from "signup CTA from public logged-out home must require explicit auth".

### Tests that encode public CTA target

File: `frontend/tests/pages/dashboard.guest-route.test.tsx`

Evidence:

- Lines 230-233 expect the public `Sign up` CTA href to be `/sign-up?next=%2Fai-studio`.
- Lines 240-243 expect the public launch button to have the same href.
- Lines 253-258 expect no authenticated fetch or session state hook in the initial public rendering path.

Impact:

- The tests confirm the reported route chain exists.
- They do not test the dangerous case where a prior valid session exists but the public home still renders.

### Tests that show `/dashboard` session-aware behavior

File: `frontend/tests/pages/dashboard.bootstrap.test.tsx`

Evidence:

- Lines 186-227 test that `/dashboard` first aligns with static public dashboard, then holds loading and resolves to authenticated dashboard when a session appears.

Impact:

- `/dashboard` has an intended session-aware bridge.
- `/` does not share the same protection.

### Tests that show AI Studio gate behavior

File: `frontend/tests/pages/app.ai-studio-gates.test.tsx`

Evidence:

- Lines 134-150 verify the AI Studio entry shell while checking session.
- Lines 320-335 verify auth recovery redirects to login.
- Lines 338-343 verify the heavy AI Studio runtime renders once gates clear.

Impact:

- AI Studio waits for a session and compliance gate.
- Once a valid previous session exists, AI Studio opens as designed.

## Validation Performed

### Local targeted tests

Command:

```bash
npm -C frontend run test -- tests/pages/auth.route-behavior.test.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard.bootstrap.test.tsx tests/pages/app.ai-studio-gates.test.tsx tests/pages/index.route-behavior.test.tsx lib/__tests__/authGuard.test.tsx tests/lib/authRedirects.test.ts
```

Result:

- 7 test files passed.
- 58 tests passed.
- The test run emitted repeated `HTMLMediaElement` not implemented warnings from jsdom, but exited successfully.

Interpretation:

- Local tests confirm current behavior and route contracts.
- They do not protect against the reported stale-session public-home bug.

### Production deployment freshness

Command:

```bash
vercel inspect https://www.shortpulse.ai
```

Observed result:

- Deployment id: `dpl_4ZLyqmXoxqRnsocMX7YZSL2LPQo4`
- Target: `production`
- Status: Ready
- Deployment URL: `https://shortpulse-41bmbjrfe-kirk-artmans-projects.vercel.app`
- Alias includes `https://www.shortpulse.ai`
- Created: Thu Jun 25 2026 12:18:47 GMT-0700

Interpretation:

- Production smoke evidence below was gathered against a fresh live production deployment.

### Production clean-session smoke

Command shape:

```bash
node - <<'NODE'
// Playwright Chromium, fresh context, go to https://www.shortpulse.ai/,
// click first Sign up link, inspect resulting URL/title/content.
NODE
```

Observed result:

```json
{
  "title1": "ShortPulse · Home",
  "signupHref": "/sign-up?next=%2Fai-studio",
  "url2": "https://www.shortpulse.ai/sign-up?next=%2Fai-studio",
  "title2": "ShortPulse · Sign up",
  "hasCreateAccount": 1,
  "hasAiStudioText": 0
}
```

Interpretation:

- Clean browser state behaves correctly.
- With no stored session, public home -> Sign up stays on signup and does not enter AI Studio.
- This does not disprove the issue because the issue requires a valid previous Supabase session in browser storage.

### Production unauthenticated API fail-closed check

Command:

```bash
curl -sS -i https://www.shortpulse.ai/api/projects
```

Observed result:

- HTTP 401
- Body: `{"error":"Unauthorized"}`

Interpretation:

- Unauthenticated protected API reads are blocked.
- This supports the conclusion that the issue is client route/session presentation, not a server API auth bypass.

### Production headers

Observed from `curl -I https://www.shortpulse.ai/` and `/sign-up?next=%2Fai-studio`:

- Both returned HTTP 200.
- Security headers such as CSP, HSTS, `x-frame-options: DENY`, and `x-content-type-options: nosniff` are present.
- These headers are not the root cause.

## Reproduction Theory

The safest reproduction scenario, without using real customer data, should use a controlled test account in an isolated browser profile:

1. Open production in a fresh browser profile.
2. Sign in as a controlled test user.
3. Confirm `/ai-studio` opens and the account menu shows the test user.
4. Navigate to `/`.
5. Confirm `/` shows the public/logged-out home page with `Login` and `Sign up` CTAs.
6. Click `Sign up` or `Launch App`.
7. Current expected vulnerable behavior: the browser reaches `/ai-studio` as the previous test user without requiring login interaction.
8. Required fixed behavior: from a public/logged-out visual state, no click/back/forward/navigation path reaches protected AI Studio unless the UI first makes the authenticated state explicit or the user completes login again.

Do not use the user's real browser/session as test evidence unless the user explicitly approves that exact action. Do not capture or store raw Supabase localStorage, access tokens, refresh tokens, storage-state files, HARs, or signed URLs.

## Likely Fix Options

These are ranked by authority alignment and security value. A later implementation agent should inspect fresh code before editing.

### Option A: Make `/` session-aware like `/dashboard`

Summary:

- Reuse the `/dashboard` session-aware bootstrap behavior at `/`, or route `/` through the same session-aware shell when persisted session hints exist.
- If a valid session exists, show the authenticated dashboard/account state, not public `Sign up` CTAs.
- If no valid session exists, render public home as today.

Why this is strong:

- It eliminates the dangerous mismatch: public/logged-out UI with hidden authenticated state.
- It preserves authenticated continuity for real signed-in users.
- It follows an existing local pattern already used by `/dashboard`.

Risks:

- `/` currently has an explicit thin public route contract. Changing it may affect first-load/static public home behavior.
- Needs careful desktop production visual validation to ensure no flicker or public CTA flash while a persisted session resolves.

Validation:

- Unit test: with `readSupabaseSessionBootstrapHint() === true`, `/` should not present clickable public signup/launch CTAs before session resolution.
- Unit test: when session resolves to a user, `/` renders authenticated dashboard or redirects to `/dashboard`.
- Unit test: when session resolves null or recovery fails, `/` renders public home.
- Production-safe smoke: clean browser still sees public home and signup page.
- Controlled authenticated smoke: signed-in test profile visiting `/` sees authenticated account state or a session-resolution loading state, not public signup.

### Option B: Stop `/sign-up` from auto-redirecting existing sessions to protected `next`

Summary:

- Change `frontend/pages/auth.tsx` so the signup route does not silently redirect an existing session to `/ai-studio`.
- It could show an explicit "You are already signed in as X" state with actions:
  - Continue to AI Studio
  - Log out and create a different account
- Or it could route existing sessions to `/dashboard` instead of the protected `next`.

Why this helps:

- It closes the exact clicked-CTA symptom.
- It gives a new browser user a visible account identity before entering the previous user's protected session.

Risks:

- If implemented alone, browser back/forward directly to `/ai-studio` may still enter the existing session.
- It may alter intended "already signed in, continue after auth" behavior for normal users.
- It needs product judgment on what to show when already signed in.

Validation:

- Unit test: `/sign-up?next=/ai-studio` with existing session does not call `router.replace("/ai-studio")` silently.
- Unit test: `/log-in?next=/dashboard` can retain appropriate existing-session behavior if desired.
- Unit test: explicit continue action, if added, is required before protected navigation.

### Option C: Add a public-funnel `forceAuth` or `freshAuth` marker

Summary:

- Public CTAs could route to `/sign-up?next=/ai-studio&fresh=1` or similar.
- Auth page treats that marker as requiring visible account choice or fresh login, not silent session continuation.

Why this helps:

- Narrowly targets public CTA flows.
- Allows existing-session redirect behavior elsewhere.

Risks:

- It is more parameter-driven and easier to miss on future public CTAs.
- It is weaker than eliminating the public/authenticated UI mismatch at `/`.
- It can become a parallel behavior path unless documented as canonical.

Validation:

- Tests for every public CTA path that enters signup.
- Tests for absent marker behavior.
- Tests that unsafe or missing markers cannot bypass fresh-auth requirement from logged-out/public surfaces.

### Option D: Sign out before public signup

Summary:

- Clicking public signup could explicitly sign out any existing session before entering signup.

Why this helps:

- Strongly prevents reuse of a prior account.

Risks:

- Destructive to legitimate signed-in users who land on public home by mistake.
- Bad UX unless clearly messaged.
- May create surprising account switches.

This should be treated as a fallback, not the preferred canonical fix.

## Recommended Canonical Plan

Recommended implementation path:

1. Make `/` session-aware using the same core authority as `/dashboard`, so public CTAs cannot remain visible while a persisted Supabase session is unresolved or valid.
2. Add an explicit existing-session guard on `/sign-up?next=/ai-studio` so even if another public route links there, it does not silently enter AI Studio as an old account from a signup-labeled surface.
3. Add focused regression tests for the exact reported class:
   - public home with prior persisted session hint must not show active signup/launch CTAs before resolving auth;
   - signup route with existing session and protected `next=/ai-studio` must not silently open AI Studio;
   - direct unauthenticated `/ai-studio` still redirects to login;
   - clean no-session public signup still opens normal account creation.

Why both steps:

- Step 1 fixes the public/logged-out visual mismatch at the most visible entry point.
- Step 2 hardens the canonical auth entry so a future public CTA or browser history route cannot recreate the same issue.

## Suggested Test Cases For The Next Agent

### Auth route tests

File likely to update:

- `frontend/tests/pages/auth.route-behavior.test.tsx`

Add or update tests:

- Existing session on `/sign-up?next=/ai-studio` does not immediately `replace("/ai-studio")`.
- Existing session on `/sign-up?next=/ai-studio` shows explicit signed-in identity or redirects to safe account/dashboard surface.
- Existing session on `/log-in?next=/dashboard` preserves whatever product-approved continue behavior remains.
- Existing session with unsafe `next` still falls back to `/dashboard`.

### Root route tests

File likely to update or add:

- `frontend/tests/pages/index.route-behavior.test.tsx`
- Possibly `frontend/tests/pages/dashboard.bootstrap.test.tsx` if `/` shares the dashboard bootstrap branch.

Add tests:

- `/` with `readSupabaseSessionBootstrapHint() === true` does not render public signup/launch CTAs before session resolution.
- `/` with resolved valid session renders authenticated dashboard or an authenticated loading state.
- `/` with resolved null session renders public home.

### Public dashboard tests

File likely to update:

- `frontend/tests/pages/dashboard.guest-route.test.tsx`

Add tests:

- Guest CTAs remain correct only when no persisted session hint exists.
- If persisted session hint exists, guest CTAs are not interactable until auth resolution decides public versus authenticated state.

### AI Studio gate tests

File likely to update:

- `frontend/tests/pages/app.ai-studio-gates.test.tsx`

Add tests only if the AI Studio route behavior changes:

- No-session AI Studio remains loading then login redirect.
- Existing valid session still opens AI Studio only when the route was reached from an authenticated or explicit continue path.

## Suggested Production Validation After Fix

Use a controlled test account and a clean test browser profile:

1. Clean browser, no auth:
   - Visit `https://www.shortpulse.ai/`.
   - Click `Sign up`.
   - Confirm URL remains `/sign-up?next=/ai-studio`.
   - Confirm signup form appears.
   - Confirm AI Studio does not open.

2. Authenticated browser:
   - Sign in as controlled test account.
   - Visit `/`.
   - Confirm public `Sign up`/`Login` CTAs are not shown over the valid session.
   - Confirm account identity is visible before any protected navigation.

3. Shared-browser simulation:
   - As controlled test account, visit `/ai-studio`.
   - Navigate to `/`.
   - Click `Sign up` and `Launch App` equivalents.
   - Confirm AI Studio is not reached without explicit account identity or fresh login.

4. Browser history:
   - With valid session, visit `/ai-studio`, then `/`.
   - Use browser back/forward.
   - Confirm no logged-out/public surface provides hidden access to AI Studio without showing authenticated identity first.

5. Sign-out:
   - From authenticated dashboard/profile, log out.
   - Confirm Supabase session storage is cleared by app behavior.
   - Confirm `/ai-studio` redirects to `/log-in`.

Do not store raw browser storage state or tokens as evidence. Use screenshots with tokens absent, route URLs, and high-level account identity only if the test account is approved.

## Production Evidence Boundaries

What was proved:

- Live production clean-session `/` -> `Sign up` stays on signup and does not enter AI Studio.
- Live production unauthenticated `/api/projects` returns `401 Unauthorized`.
- Live production alias points to a fresh production deployment inspected during the audit.
- Local code inspection proves the stale-valid-session route chain.
- Local tests pass but currently encode the unsafe behavior.

What was not proved:

- I did not use a real stored user session to reproduce the account entry in production.
- I did not verify Supabase Auth hosted config, hook state, or provider console state for this specific issue.
- I did not validate a fixed build, because no fix was implemented in this audit.
- I did not run a full repo validation suite.

Why the unproved item matters:

- The user's screenshots are strong field evidence that the stale-session path occurs in the browser.
- The code path explains how it occurs.
- A controlled live-auth repro should be run after a fix or in a dedicated approved test profile if further proof is needed.

## Dirty Worktree Note

At audit time, the local worktree was already dirty with many unrelated modified and untracked files across docs, AI Studio, dashboard, webhook, SQL, and tests. This report does not classify those unrelated changes. The audit avoided editing source/auth code and did not revert or overwrite unrelated work.

## Suggested Handoff Prompt

Use this prompt for the next implementation agent:

```text
You are working in /Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse on the production branch. Load the repo startup contract and Dave security instructions. Read docs/records/artifacts/agent/dave-the-security-guy/reports/2026-06-25-public-home-stale-session-auth-boundary-audit.md.

Goal: fix the confirmed high-severity public-home stale-session auth boundary issue. A browser can show the public/logged-out home page while a previous valid Supabase session remains, then clicking Sign up or Launch App reaches /ai-studio as the previous user without a fresh login.

Threat statement: attacker or next browser user can start from a public/logged-out-looking ShortPulse home page, click a signup/launch CTA, cross the auth/session boundary through a still-valid previous Supabase browser session, and reach the previous user's authenticated AI Studio account without knowingly logging in.

Constraints:
- Fix the canonical path. Do not add a parallel auth system or hidden fallback.
- Preserve server/API fail-closed auth.
- Do not expose or store auth tokens, storage state, HARs, or signed URLs.
- Keep diffs minimal and scoped.
- Treat desktop production UX as the validation target.
- Work around the dirty worktree without reverting unrelated changes.

Recommended direction:
1. Make / session-aware like /dashboard so public signup/login CTAs cannot remain visible while a persisted session hint is unresolved or valid.
2. Add a guard on /sign-up?next=/ai-studio so an existing session does not silently enter AI Studio from a signup-labeled surface.
3. Add regression tests covering public home with prior session hint, signup route with existing session and protected next, clean no-session signup, and unauthenticated /ai-studio redirect behavior.
4. Run targeted tests and, if feasible, a controlled production-safe smoke with a test account after deployment.

Stop after the smallest canonical fix and report local proof versus production proof separately.
```

## Final Recommendation

Treat this as a launch blocker until fixed and validated. The core issue is not that Supabase sessions persist. Persistent sessions are normal. The issue is that ShortPulse can show a logged-out/public acquisition surface while a valid previous session remains capable of opening protected AI Studio through public signup navigation.

