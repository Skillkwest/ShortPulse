# D-Bug Report - Character Reload Auth Bounce Closeout

- current status: `done`
- source handoff path:
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-reload-auth-bounce.md`
- failing surface:
  - protected `/character` route reload continuity
  - protected-route auth/session recovery before redirect

## Evidence gathered

- `frontend/lib/authGuard.ts` redirected protected routes to `/auth?next=...` as soon as the shared session snapshot reported `initialized: true` and `session: null`.
- `frontend/lib/supabaseClient.ts` can legitimately reach that state after a transient bootstrap read failure because:
  - `useSupabaseSessionState()` triggers a background `readSupabaseSession()`
  - `setSessionSnapshotFromError()` marks the shared snapshot as `initialized: true, session: null`
- `frontend/lib/__tests__/supabaseClient.test.ts` already encoded that behavior for aborted bootstrap reads.
- The Character route itself is thin:
  - `frontend/pages/character.tsx` just renders `CharacterManagerShell`
  - the reported auth bounce happens earlier at the protected-route gate
- This explains the handoff symptom:
  - route becomes interactive in-session
  - reload briefly shows `Checking your session…`
  - transient session bootstrap failure is treated as a hard logged-out state
  - protected route redirects to `/auth?next=%2Fcharacter`

## Reproduction status

- Root cause reproduced from repo code and patched.
- This lane did not require a Character Manager renderer change.
- The failure class is a protected-route recovery issue that is visible on `/character`.

## Root-cause analysis

- The route guard treated “no session after initialization” as final, even though the shared Supabase session cache can reach that shape after a transient bootstrap/read failure.
- There was no one-time recovery attempt before redirecting to auth.
- On reload, that makes protected routes brittle against transient session-read failures and creates exactly the observed bounce loop.

## Changes made

- `frontend/lib/authGuard.ts`
  - added a one-time `refreshSupabaseSession({ preserveSnapshotOnError: true })` recovery attempt before redirecting protected routes to `/auth`
  - used refs to keep recovery in-flight state stable across effect reruns
  - only redirects after the recovery attempt finishes and the route still has no session
- `frontend/lib/__tests__/authGuard.test.tsx`
  - added regression coverage for:
    - recovery attempt fails -> redirect after one retry
    - recovery attempt restores session -> no redirect

## Validation run

- `cd frontend && npm run test -- lib/__tests__/authGuard.test.tsx lib/__tests__/supabaseClient.test.ts`
- `cd frontend && npx eslint lib/authGuard.ts lib/__tests__/authGuard.test.tsx`

## Explicit stop condition

- Stop when protected routes no longer redirect immediately on the first transient no-session snapshot and the auth guard has focused regression coverage for both recovery success and failure.

## Checkpoint review

### Checkpoint summary

- Date: 2026-05-16
- Active report: `2026-05-16-character-reload-auth-bounce-closeout.md`
- Current lane status: `done`
- Checkpoint goal:
  - determine whether the Character reload bounce is a Character route bug or a shared protected-route/session recovery bug
  - patch the smallest shared surface if the latter is true

### What I did

- Audited the retained Character auth-bounce handoff and the supporting Beeper report.
- Traced the protected-route gate, `_app` loading shell, Character page shell, and Character bootstrap hook.
- Identified the earlier redirect path in `authGuard.ts`.
- Patched the guard to try one shared session refresh before redirecting.
- Added focused auth guard regressions.

### How I did it

- commands run:
  - targeted `sed` and `rg` across `authGuard.ts`, `_app.tsx`, `supabaseClient.ts`, `character.tsx`, and Character bootstrap surfaces
  - `cd frontend && npm run test -- lib/__tests__/authGuard.test.tsx lib/__tests__/supabaseClient.test.ts`
  - `cd frontend && npx eslint lib/authGuard.ts lib/__tests__/authGuard.test.tsx`
- files/doc surfaces inspected:
  - retained Character auth-bounce handoff
  - retained Beeper Character reuse report
  - shared auth/session client and tests
  - Character route shell and bootstrap controller
- validations run:
  - focused auth guard tests
  - shared Supabase session tests
  - targeted eslint
- reasoning or narrowing method used:
  - inspect the earliest route gate first
  - verify whether the Character route had enough independent evidence to exonerate the renderer
  - patch the shared protected-route recovery surface once the failure class was clear

### Performance rating

- scope control (1-10): 9
- evidence quality (1-10): 9
- validation discipline (1-10): 9
- communication clarity (1-10): 8
- stop-condition discipline (1-10): 8
- learning capture (1-10): 8
- weighted overall score (derived): 8.6
- score band: `healthy`
- critical failure override triggered: `no`
- override reason if yes:

### Weakest areas

- lowest category: `communication clarity`, `stop-condition discipline`, and `learning capture` tied at `8`
- why it was weak:
  - the route-level symptom pointed at Character Manager, but the real defect lived one layer earlier in shared protected-route recovery

### Improvement action

- what I will do differently next checkpoint:
  - when a protected route works in-session but fails on reload, inspect the shared auth gate before assuming route-specific bootstrap failure
- should this be written into training history? `yes`

### Next step

- next checkpoint action:
  - review the remaining `character-route-bootstrap-stall` handoff to see whether it is now stale, partially resolved by this guard fix, or still needs a separate Character bootstrap patch
- stop condition still active:
  - no

## Residual risk

- This closes the repo-side protected-route recovery bug, but it does not replace live browser verification on production `/character`.
- The older `2026-05-15-character-route-bootstrap-stall.md` handoff may overlap with this fix, but that relationship is not yet proven.

## Exact next step

- Start with `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-route-bootstrap-stall.md` and re-audit whether it remains active after the shared auth-guard recovery fix.
