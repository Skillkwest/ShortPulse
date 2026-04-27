# Lane B Hotspot Map: B4-01 Admin Dashboard Page

date_utc: 2026-03-17  
slice_id: B4-01  
track: B-Core  
owner: Engineering  
linked_pr: n/a (planning/control artifact)

## Purpose
1. Record the decomposition surface inside `frontend/pages/admin/index.tsx` before opening the next Admin extraction slice.
2. Identify the highest-value first boundary after the `B3-02` checkpoint.
3. Define the characterization-first sequence so `B4-01` starts with a real controller split instead of another monolithic page rewrite.

## Current State
1. `frontend/pages/admin/index.tsx` is `1660` lines and above the Lane B warn budget (`1300`).
2. Existing extracted support already exists, most notably `ErrorIncidentsPanel.tsx` (`1168` lines) and `useAdminAccess.ts` (`108` lines).
3. Existing regression surface is partial but useful:
   - `frontend/tests/pages/admin.announcements.test.tsx`
   - `frontend/features/admin/components/__tests__/ErrorIncidentsPanel.pagination.test.tsx`
4. The page still mixes tab-local fetch state, filters, mutation flows, and presentation glue in one route component.

## Remaining Domain Clusters
### 1. Announcements tab controller
Includes:
1. current announcement fetch
2. publish/clear actions
3. announcement form state and result messaging

Why it matters:
1. This is a bounded async workflow with direct page-level test coverage already in place.
2. It has the cleanest route boundary (`/api/admin/announcements/current|publish|clear`).
3. It is the best first controller seam for `B4-01`.

### 2. Errors and error-events controller
Includes:
1. error table filters/search/pagination
2. error-events filters/search/pagination
3. summary/health loading
4. bulk incident state and refresh timers

Why it matters:
1. This is likely the largest remaining domain cluster.
2. `ErrorIncidentsPanel` already exists, which lowers presentational risk.
3. It is valuable, but more coupled than announcements and should follow a simpler first seam.

### 3. Users and credits controller
Includes:
1. user search/pagination
2. credit adjustment form
3. credit ledger loading
4. selected-user state

Why it matters:
1. It is a coherent operator workflow.
2. It spans multiple API routes and shared overview state, so it is a good second or third seam after a simpler bounded tab controller lands.

### 4. Overview tab orchestration
Includes:
1. active-tab routing
2. top-level summary cards
3. shared page refresh interactions

Why it matters:
1. This is mostly orchestration glue and not the best first split target.
2. It becomes easier after the tab-specific controllers are extracted.

## Extraction Readiness Ranking
1. `Announcements tab controller`
   - Strongest first seam due to direct tests and bounded API surface.
2. `Errors and error-events controller`
   - Largest remaining domain, best second seam after the first controller lands.
3. `Users and credits controller`
   - Valuable but broader and more cross-cutting than announcements.
4. `Overview tab orchestration`
   - Defer until tab-local controllers are isolated.

## Recommended Next Sequence
1. Characterize the announcements tab controller surface only if existing page tests prove insufficient.
2. Extract an announcements controller that owns:
   - current announcement load,
   - publish/clear mutations,
   - form input limits,
   - result/error messaging.
3. Reassess whether the next `B4-01` seam should be the error-events controller or the users/credits controller.

## Explicit Do-Not-Do List
1. Do not start `B4-01` with generic fetch helpers.
2. Do not split render fragments before tab-local controllers are isolated.
3. Do not mix announcements with users/credits in the same first seam.
4. Do not open the error-events controller first unless announcements coverage is unexpectedly insufficient.

## Immediate Next Slice Criteria
The next accepted `B4-01` slice should satisfy all of:
1. It keeps the `/admin` page contract and route behavior unchanged.
2. It isolates one tab-local controller boundary with explicit API ownership.
3. It reduces net page complexity instead of only moving fetch calls.
4. It leaves the next controller seam clearer than it is today.
