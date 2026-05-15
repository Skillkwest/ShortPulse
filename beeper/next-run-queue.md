# Beeper Next Run Queue

Purpose: keep the highest-value next testing lanes visible so Beeper spends less time choosing and more time running deeper real-user checks.

## Selection Rule

- Prefer the topmost lane unless the user redirects scope.
- Prefer deeper workflow completion over new process hardening when both are possible.
- Use `beeper/action-coverage/master-coverage-log.md` and the performance ledger before starting.

## Ranked Queue

### 1. Logout -> sign-back-in loop

- Why this is next:
  - high real-user value
  - still `not-started`
  - should raise coverage expansion quickly
- Entry surface:
  - signed-in production dashboard or profile menu
- Success condition:
  - open logout control
  - confirm sign-out works
  - sign back in successfully
  - confirm the post-login landing state

### 2. Dashboard projects overlay -> reopen existing project

- Why this is next:
  - real user path
  - already partially covered
  - can deepen persistence confidence without inventing new data
- Entry surface:
  - production dashboard -> `Open Projects`
- Success condition:
  - open overlay
  - open an existing project from the list
  - land in AI Studio
  - confirm expected project state

### 3. AI Studio existing-project deeper non-generate workflow

- Why this is next:
  - AI Studio is the densest surface and still mostly `partial`
  - can increase coverage without waiting on the generate bug
- Entry surface:
  - existing project in production AI Studio
- Success condition:
  - keep a wide viewport from first capture
  - exercise one deeper library or selection flow
  - confirm the result through normal UI state

### 4. Profile/account safe edit-save path

- Why this is next:
  - account route is only `clicked`
  - useful real-user save validation if a safe field exists
- Entry surface:
  - profile/account settings
- Success condition:
  - identify one safe editable field
  - change it
  - save it
  - confirm persistence or clear success feedback

### 5. Media Library browse/select/search workflow

- Why this is next:
  - route has a real bug already logged, but normal-user behavior is still shallow
- Entry surface:
  - production `/media-library`
- Success condition:
  - browse the grid
  - exercise selection or search if available
  - confirm the route still works outside the stale-thumb issue

## Current Training Focus

- Weakest scoring category: `coverage expansion`
- Main rule for the next run:
  - choose a lane that validates one full user workflow instead of producing more process-only artifacts
