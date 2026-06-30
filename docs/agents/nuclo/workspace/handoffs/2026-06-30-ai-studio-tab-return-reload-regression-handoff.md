# Nuclo Handoff: AI Studio Tab/Window Return Reload Regression

Date: 2026-06-30 11:24 MST
Repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Branch policy: pre-launch `production` only
Current branch at handoff: `production`
Current HEAD at handoff: `3d10495b`

## Goal

Resolve the regression where an active ShortPulse AI Studio session appears to refresh or reload after the user switches to another browser tab/window and returns. The user reports this still happens after repeated production deploys and that current work disappears. This is unacceptable UX and should be treated as launch-risk data-loss/work-loss behavior.

The next agent should continue evidence-first. Do not assume the previous fixes solved production. Prove the actual browser event path and mounted-runtime behavior before making more code changes.

## Owner / Lane

Owned lane: Nuclo / Supabase + Vercel + production runtime reliability, scoped here to auth/session restore and AI Studio route bootstrap behavior.

Do not work in another agent's folder. Do not touch unrelated dirty files unless the user explicitly changes scope.

## Protected Contracts

- Preserve stale-auth security intent: protected routes must not stale-render private UI after logout, Back/Forward, or BFCache restore.
- Preserve AI Studio state/work: normal tab/window switching must not destroy active in-memory workspace state.
- Preserve current visible UI/UX except where the existing loading shell is already intentionally shown during auth/session restore checks.
- Do not weaken RLS, Supabase auth, logout epoch semantics, billing, credits, media persistence, or deployment policy.
- Do not add fallback auth systems, duplicate route authorities, or workaround refresh suppressors.

## Current Worktree Warning

At handoff time, the worktree has unrelated dirty/staged files outside this lane. The next agent must run `git status --short` before edits and avoid touching unrelated changes.

Observed dirty files at the last Nuclo check included unrelated media-library files:

```text
M  frontend/features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx
M  frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaCard.tsx
M  frontend/styles/ai-studio-media-library-panel.css
```

The exact status may have changed. Refresh it.

## What We Audited

The symptom was initially traced to the auth/session restore flow:

- `frontend/lib/useProtectedRouteRestoreGuard.ts`
- `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`
- `frontend/tests/pages/app.ai-studio-gates.test.tsx`
- `frontend/lib/__tests__/useProtectedRouteRestoreGuard.test.tsx`
- `frontend/tests/pages/protected-route-bootstrap-gate.test.tsx`

Key finding: there was no obvious literal `window.location.reload()` in the protected-route restore path. The apparent reload can be caused by React route/runtime unmounts, redirects, or browser restore checks, not necessarily a hard document reload.

Other literal reload/assign locations found during broad search:

- `frontend/components/AppErrorBoundary.tsx` has a user-click reload button only.
- `frontend/features/ai-studio/components/PresetsPanelLoader.tsx` has a user-click reload button only.
- Billing/profile/pricing routes use `window.location.href` / `assign` for external Stripe or navigation flows, not tab-return.

## First Fix Attempt

Initial hypothesis:

1. `useProtectedRouteRestoreGuard` was too aggressive on ordinary tab visibility return.
2. It previously forced Supabase session refresh or blocking checks in ways that could clear auth or redirect.
3. AI Studio hid the runtime behind a loading shell when `restoreGuard.checking` was true, causing a perceived refresh and state loss.

The restore guard was changed so normal visible-tab checks use a non-destructive shared session read, while initial mount and true BFCache restore still force-refresh:

```ts
const session = await (blockWhileChecking
  ? readSupabaseSession({ forceRefresh: true })
  : readSupabaseSession());
```

The guard currently listens to `pageshow` and `visibilitychange`; `pagehide` no longer sets checking:

```ts
const handlePageShow = (event: PageTransitionEvent) => {
  if (event.persisted) {
    void runRestoreCheck({ blockWhileChecking: true });
  }
};
```

Focused tests passed after that first attempt:

```bash
npm -C frontend run test -- --run lib/__tests__/useProtectedRouteRestoreGuard.test.tsx tests/pages/app.ai-studio-gates.test.tsx tests/pages/protected-route-bootstrap-gate.test.tsx
```

Result at that point: `29 passed`.

Why it was not enough:

- Production still reproduced the user-visible refresh after deploy.
- The first fix protected normal `visibilitychange` from forced refresh, but `pageshow.persisted` can still set `restoreGuard.checking=true`.
- `AiStudioProtectedRouteEntry` still returned the loading shell instead of the runtime when `restoreGuard.checking` was true, so BFCache restore or browser restore paths could still unmount the workspace.

## Second Fix Attempt

Second hypothesis:

If the user's browser fires `pageshow.persisted` on tab/window return, AI Studio still unmounts its runtime during the blocking restore check. That would lose unsaved work and feel like a reload even without `window.location.reload()`.

Local source change currently present in `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`:

- Add a stable `RuntimePreservationLayer`.
- Once AI Studio has rendered the runtime at least once, keep that runtime mounted during restore checking.
- Hide the runtime behind the existing restore-check loading shell using `visibility: hidden` and `pointerEvents: none`.
- If session is missing or auth redirects, the existing security path still wins.

Current key local source shape:

```ts
const RUNTIME_LAYER_VISIBLE_STYLE: CSSProperties = {
  display: "contents",
};

const RESTORE_CHECK_RUNTIME_MASK_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  visibility: "hidden",
  pointerEvents: "none",
};

const RuntimePreservationLayer = ({ children, masked }) => (
  <div
    aria-hidden={masked ? "true" : undefined}
    style={masked ? RESTORE_CHECK_RUNTIME_MASK_STYLE : RUNTIME_LAYER_VISIBLE_STYLE}
  >
    {children}
  </div>
);
```

The route now builds a stable `runtimeTree` and uses it during restore checking after initial successful render:

```ts
if (restoreGuard.checking || loading || !session) {
  if (restoreGuard.checking && hasRenderedRuntime && runtimeTree) {
    return (
      <>
        {runtimeTree}
        {sessionRestoreLoadingFrame}
      </>
    );
  }

  return sessionRestoreLoadingFrame;
}
```

Regression test added in `frontend/tests/pages/app.ai-studio-gates.test.tsx`:

```ts
it("preserves the mounted AI Studio runtime while browser restore auth revalidates after startup", () => {
  // Mount runtime once.
  // Flip restoreGuard.checking to true.
  // Assert runtime is still in DOM and unmount spy was not called.
});
```

Focused validation after second attempt:

```bash
npm -C frontend run test -- --run tests/pages/app.ai-studio-gates.test.tsx lib/__tests__/useProtectedRouteRestoreGuard.test.tsx tests/pages/protected-route-bootstrap-gate.test.tsx
```

Result: `30 passed`.

Lint after second attempt:

```bash
npm -C frontend run lint -- features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx tests/pages/app.ai-studio-gates.test.tsx
```

Result: passed. Note: project script expands to repo-wide `eslint .`.

Diff check:

```bash
git diff --check -- frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx frontend/tests/pages/app.ai-studio-gates.test.tsx
```

Result: passed.

## Why The Issue May Still Persist In Production

Do not assume one cause. The next agent should prove which of these is true.

### 1. The latest local fix may not be in the deployed artifact

The user said they deployed twice, but this repo had local unstaged changes during the conversation. Vercel production deploys usually build from GitHub/branch state, not from this local unstaged worktree unless the user uses a direct CLI deploy from local files.

The next agent must verify:

- Is `RuntimePreservationLayer` present in the production branch commit that Vercel built?
- Does the production JS bundle contain evidence of the runtime-preservation code?
- Did Vercel deploy the commit that includes `AiStudioProtectedRouteEntry.tsx` preservation changes and the new test?

If not, the issue is not yet a failed fix; it is a deploy/artifact inclusion problem.

### 2. The observed behavior may be a hard document reload outside the guard

If the browser is performing an actual document navigation/reload on return, preserving React runtime during `restoreGuard.checking` will not help. The next agent needs to distinguish:

- Hard reload: `performance.getEntriesByType("navigation")[0].type` changes to `"reload"` or a new document starts.
- Soft remount: same document, but React route/runtime unmounts and remounts.
- Redirect: route changes to `/log-in`, `/auth`, `/dashboard`, or another protected bootstrap path.
- Error-boundary recovery: an exception triggers a recovery UI or user-click reload path.
- Chunk/runtime failure: a Next route chunk fails and route-change error handling fires.

### 3. Another lifecycle hook may be clearing runtime state

There are many AI Studio lifecycle hooks:

- `useAiStudioProjectWorkspacePersistenceController`
- `useAiStudioSessionAutosave`
- `useAiStudioTaskOrchestration`
- `useAiStudioGeneratedOutputMaintenance`
- media/library/reference-grid visibility handlers

Most should not force reload, but they may flush, reset, or rehydrate state on `visibilitychange` / `pagehide`. The next agent should inspect exact event order before editing.

### 4. The user's browser surface matters

The user appears to use ChatGPT Atlas / in-app browser-like surfaces at times. Browser lifecycle semantics can differ from Chrome/Safari expectations. The next agent should reproduce on the exact user surface if possible, not only local jsdom/unit tests.

## Required Next Investigation

Before further edits, run a production-observation pass on `https://www.shortpulse.ai`.

Minimum diagnostic target:

1. Open production AI Studio authenticated.
2. Create a visible unsaved state that should survive tab switching.
3. Attach temporary console diagnostics in the browser devtools or via an approved test harness:

```js
(() => {
  const id = Math.random().toString(36).slice(2);
  window.__shortpulseReloadProbe = {
    id,
    startedAt: new Date().toISOString(),
    href: location.href,
    events: [],
  };
  const log = (name, extra = {}) => {
    const entry = {
      t: new Date().toISOString(),
      name,
      href: location.href,
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      navType: performance.getEntriesByType("navigation")[0]?.type ?? null,
      ...extra,
    };
    window.__shortpulseReloadProbe.events.push(entry);
    console.log("[shortpulse-reload-probe]", entry);
  };
  [
    "visibilitychange",
    "pagehide",
    "pageshow",
    "beforeunload",
    "unload",
    "focus",
    "blur",
  ].forEach((name) => {
    window.addEventListener(
      name,
      (event) => log(name, { persisted: event.persisted ?? null }),
      true,
    );
    document.addEventListener(
      name,
      (event) =>
        log(`document:${name}`, { persisted: event.persisted ?? null }),
      true,
    );
  });
  log("probe-installed", { id });
})();
```

4. Switch tabs/windows and return.
5. Capture:
   - Was there a new document?
   - Did `beforeunload` / `unload` fire?
   - Did `pageshow.persisted` fire?
   - Did route path change?
   - Did auth redirect occur?
   - Did AI Studio runtime unmount or only hide?
   - Did console show route-change or chunk-load errors?

If using an automated browser, also collect:

```js
performance.getEntriesByType("navigation").map((entry) => ({
  type: entry.type,
  name: entry.name,
  startTime: entry.startTime,
  duration: entry.duration,
}));
```

## High-ROI Next Code Direction If Production Confirms Soft Remount

If the production probe proves this is still a React remount/restore-check issue and not a hard reload:

1. Verify the preservation code is deployed.
2. If deployed but remount still happens, move preservation boundary higher:
   - The stable mounted owner may need to wrap `AiStudioProtectedRouteEntry` more broadly.
   - Current `runtimeTree` still depends on `session` and `RuntimeComponent`; if parent route/component identity changes, it can still remount.
3. Add an E2E-style test or page-level test that simulates actual `pageshow.persisted` after runtime mount, not only mock return/rerender.
4. Consider separating “auth checking overlay” from route return branches entirely:
   - Keep route tree mounted.
   - Overlay the restore-check loading surface.
   - Only unmount/redirect on confirmed missing/invalid session.

## High-ROI Next Code Direction If Production Confirms Hard Reload

If the production probe proves a real document reload:

1. Stop editing `useProtectedRouteRestoreGuard`; it is not the source.
2. Inspect:
   - Next/Vercel route error telemetry in `_app.tsx`.
   - `client.route_change_script_load_failure`.
   - Browser memory pressure / BFCache eviction / service worker or cache headers if applicable.
   - Any production runtime exception leading to `AppErrorBoundary`.
3. Check if switching tabs triggers media/canvas/WebGL/recording resources that crash or force reload.
4. Add production error/route breadcrumb correlation around the exact timestamp.

## Validation Requirements For The Next Agent

Local/focused:

```bash
npm -C frontend run test -- --run tests/pages/app.ai-studio-gates.test.tsx lib/__tests__/useProtectedRouteRestoreGuard.test.tsx tests/pages/protected-route-bootstrap-gate.test.tsx
npm -C frontend run lint -- features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx tests/pages/app.ai-studio-gates.test.tsx lib/useProtectedRouteRestoreGuard.ts lib/__tests__/useProtectedRouteRestoreGuard.test.tsx
git diff --check -- frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx frontend/tests/pages/app.ai-studio-gates.test.tsx frontend/lib/useProtectedRouteRestoreGuard.ts frontend/lib/__tests__/useProtectedRouteRestoreGuard.test.tsx
```

Production proof:

- Authenticate to `https://www.shortpulse.ai`.
- Open AI Studio.
- Create unsaved state.
- Switch tabs/windows and return.
- Confirm no hard reload, no route redirect, no runtime unmount, no work loss.
- If issue persists, capture the diagnostic event log and exact production deployment id/commit.

## Stop Conditions

Stop and ask/report before continuing if:

- The fix requires weakening auth, logout, RLS, or private-route stale UI protections.
- The fix requires broad AI Studio state/persistence rewrite.
- Production proof depends on deploy/commit/push authority that is not available in the lane.
- The next likely owner is Gear Ball/deployment artifact inclusion rather than Nuclo source behavior.
- The observed issue is a hard browser reload unrelated to auth guard source.

## Current Best Assessment

The most likely reason the user still sees the issue is one of:

1. The local state-preservation fix is not actually in the deployed production artifact.
2. The browser return is producing a hard reload or route-level remount outside `useProtectedRouteRestoreGuard`.
3. AI Studio state preservation must move higher than `AiStudioProtectedRouteEntry`.

Do not continue patching blindly. The next agent should first prove deployed artifact inclusion and capture the real browser lifecycle event sequence.
