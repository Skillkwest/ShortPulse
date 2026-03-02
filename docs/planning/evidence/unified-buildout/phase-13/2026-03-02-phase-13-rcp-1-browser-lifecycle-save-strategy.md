# Phase 13 RCP-1: Browser Lifecycle Save Strategy (Session Persistence)

Date: 2026-03-02  
Owner: Engineering  
Status: Complete

## Trigger
Required before Wave E session persistence implementation.

## Primary Sources
1. https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
2. https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
3. https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload
4. https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
5. https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive
6. https://web.dev/articles/bfcache
7. https://developer.chrome.com/blog/page-lifecycle-api
8. https://web.dev/articles/storage-for-the-web

## Chosen Strategy
1. Treat `visibilitychange` (`hidden`) and `pagehide` as mandatory exit/save triggers.
2. Use `fetch(..., { keepalive: true })` as the default final-flush transport.
3. Use `sendBeacon` only as a fallback for small best-effort payloads.
4. Keep `beforeunload`/`unload` out of the critical save path to preserve bfcache compatibility and avoid unreliable completion semantics.
5. Keep large/local shadow snapshots in IndexedDB, not `localStorage`.

## Rejected Alternatives
1. `unload`-driven save pipeline:
   - rejected due unreliable delivery and bfcache side effects.
2. `beforeunload` as a primary save trigger:
   - rejected because it is not consistently fired and can degrade navigation UX/caching behavior.
3. `localStorage` for full snapshots:
   - rejected due synchronous API characteristics and practical size constraints.

## Implementation Locks From This Checkpoint
1. Session write-shadow hooks must register `visibilitychange` + `pagehide` listeners.
2. Final flush implementation must support keepalive transport.
3. Any `beforeunload` usage is advisory-only and must not be required for durability.
4. Snapshot persistence layer must remain IndexedDB-first for larger payloads.

## Test/Gate Impact
1. Add hook tests for:
   - flush on `visibilitychange` hidden,
   - flush on `pagehide`,
   - no hard dependency on `beforeunload`.
2. Add transport tests for keepalive path and beacon fallback policy.
3. Run existing adaptive/no-regression gates unchanged.
