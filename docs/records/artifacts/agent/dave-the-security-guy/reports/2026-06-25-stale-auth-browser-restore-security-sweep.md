# Stale Auth Browser Restore Security Sweep

- Date: 2026-06-25
- Agent/lane: Dave the Security Guy
- Repo/branch: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse` on local `production`
- Scope: stale authentication, browser Back/Forward/BFCache restore, persisted Supabase session hints, local/session storage, and restored client state that could cross user/account, credits, billing, project, media, admin, provider, or prompt boundaries.
- Non-goals: UI/UX redesign, product behavior changes, broad security cleanup, production mutation, commit/push/deploy.
- Stop condition: stop when the sweep can distinguish confirmed launch-risk findings, non-findings, deferred proof needs, and the next highest-ROI action without adding speculative patches.

## Decision

The primary stale-auth class from the handoff is addressed in the local worktree by a canonical protected-route restore guard, but the guard files are still local/uncommitted in this dirty tree and need normal review, commit, deploy, and authenticated production proof before they count as launch-ready. I did not find a new confirmed path where browser Back/Forward or stale session state can directly leak another user's credits, Stripe billing data, project rows, media rows, admin rows, or storage objects through the server boundary.

One adjacent privacy issue remains confirmed from code evidence: legacy global `localStorage` prompt/preset preferences can be migrated into the next signed-in user's scoped preferences. This is lower severity than account/credits/billing leakage, but it is a real cross-user shared-browser privacy seam because preset text can contain private creative instructions.

## Confirmed Findings

### Medium: Global prompt/preset localStorage can migrate into a signed-in account

- Severity: Medium
- Confidence: High from code and tests
- Trust boundary: browser-global localStorage -> signed-in user preference row
- Launch impact: possible cross-user prompt/preset privacy leakage on shared browsers
- ROI: Medium; small canonical fix, but it changes legacy migration behavior

Evidence:

- `frontend/features/ai-studio/hooks/useCreatePulsePresetPanelPreference.ts` migrates global Pulse keys into the current signed-in `user_preferences` row when no user-scoped local value or remote row exists.
- `frontend/features/ai-studio/hooks/useExpertEditPresetPanelPreference.ts` does the same for Expert Edit preset panel/custom preset overrides.
- Tests explicitly encode this migration in `frontend/features/ai-studio/hooks/__tests__/useCreatePulsePresetPanelPreference.test.ts` and `frontend/features/ai-studio/hooks/__tests__/useExpertEditPresetPanelPreference.test.ts`.
- Nearby preference hooks for media autosave, style details, and deleted style ids already test that signed-in users do not hydrate from global fallback, which suggests the safer user-isolation posture exists elsewhere.

Root cause:

Legacy anonymous/global preference migration still treats global browser storage as safe authority for a resolved signed-in user. For launch security, global localStorage is not user-authenticated authority and can belong to a previous user on the same browser.

Recommended canonical fix:

Stop migrating private prompt-bearing global preset content into signed-in user preference rows. If migration must remain for prelaunch data preservation, gate it behind an explicit one-time owner-approved migration flag or an authenticated user-scoped marker; do not silently import global prompt text into whichever account signs in next.

Why not fixed in this sweep:

This is a real issue but not the top stale-auth account/billing/credits risk, and fixing it changes legacy migration behavior. It should be handled as a tight follow-up with tests that preserve anonymous/local behavior while preventing signed-in global fallback import.

## High-Value Non-Findings

### Protected routes now have a restore-time auth proof gate

- `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx` calls `useProtectedRouteRestoreGuard` before rendering the AI Studio runtime.
- `frontend/features/compliance/routes/ProtectedRouteBootstrapGate.tsx` uses the same guard for non-AI protected routes.
- `frontend/lib/useProtectedRouteRestoreGuard.ts` force-refreshes Supabase auth on initial mount, `pageshow`, and visible `visibilitychange`, and hides protected content behind a checking state.
- `frontend/lib/authSessionInvalidation.ts` stores only a non-sensitive logout epoch and rejects sessions issued before that epoch.

Residual proof need:

This needs authenticated production Back/Forward/BFCache proof after deploy. Local code proof is strong, but it does not prove the hosted bundle currently contains the fix.

### Logout paths use the canonical sign-out helper

- `frontend/lib/supabaseClient.ts` marks the local logout epoch, clears the in-memory snapshot, calls Supabase sign-out, then clears the snapshot again.
- In-repo logout callers in AI Studio, dashboard, and profile use `signOutSupabaseSession`.
- No direct app-code `supabase.auth.signOut()` bypass was found.

Residual proof need:

Supabase access-token semantics after sign-out still need authenticated production proof. The app should assume stale access tokens can remain valid briefly and rely on the protected-route restore guard to prevent restored clients from sending them.

### Protected API calls remain bearer-gated and user-scoped

- Client calls use `fetchWithAuth`, which reads the active Supabase access token and retries once after a 401 with a forced refresh.
- `frontend/proxy.ts` requires bearer auth for protected API paths.
- Server route helpers use `requireApiUser`.
- The AI agent durable conversation state is keyed by `user_id + conversation_id`, and hardened SQL/RPC posture restricts upsert authority to service role in later migrations.

Residual proof need:

Live production proof should confirm protected APIs reject stale post-logout calls from a restored page. Local source evidence does not prove deployed Supabase/JWT revocation timing.

### Dev-only AI Studio bakeoff page is not a production bypass

- `frontend/pages/dev/ai-studio-stage-bakeoff.tsx` returns `notFound` in `NODE_ENV=production`.
- This is not a launch production stale-auth route bypass from repo evidence.

## Residual Risk

1. Hosted production may not yet contain the local restore guard fix until deploy.
2. Browser BFCache behavior must be tested against the production URL with an authenticated session.
3. Supabase/JWT post-logout acceptance timing is not proven live.
4. Public `/` still renders the public home surface by default; the highest-risk `/sign-up?next=/ai-studio` path has local test coverage preventing silent AI Studio admission, but production proof is still required.
5. Prompt/preset global localStorage migration remains a confirmed shared-browser privacy issue until intentionally removed or gated.

## Next Highest-ROI Step

After deploy, run an authenticated production stale-session proof pack:

1. Sign in, open AI Studio with visible private state, sign out, press Back/Forward, and verify only a neutral auth-check/loading state appears before redirect or fresh-session proof.
2. Repeat from public `/`, `/sign-up?next=/ai-studio`, `/dashboard`, `/profile`, `/admin`, and a project-id AI Studio URL.
3. Attempt a protected API call from a restored page after logout and verify it fails or never fires with stale authority.
4. Then fix the medium Pulse/Expert Edit global localStorage migration issue with focused tests if the production stale-auth proof is clean.

## Stop Rationale

Further work without production credentials/deploy proof would mostly be speculative hardening. The only new confirmed code issue is medium severity and behavior-affecting, so it should be fixed deliberately as the next scoped lane rather than patched opportunistically during this stale-auth audit.
