# Testing Guide

Purpose: outline how to test the client-only ShortPulse experience.

## Commands
- No automated test runner is wired yet.
- Until tests exist, rely on manual checks: auth flows, saved creators CRUD, media uploads/deletes/renames, and the performance data actions rail.

## When to test
- Any change to Supabase interactions (auth, saved creators, media library).
- Any change to performance scoring/filtering logic in `features/performance/logic` or `utils`.
- Any new shared components or CSS that affects multiple routes.

## Patterns
- Keep helpers pure so they are easy to unit test later without app/bootstrap.
- Co-locate future tests with the feature (`__tests__` or `*.test.tsx`) to prevent drift.
- Prefer deterministic inputs/outputs for analytics helpers so manual verification is straightforward.

## Gaps/TBD
- Frontend test harness (e.g., Playwright or component tests) is not set up.
- Add lint/format commands once a tooling choice is made.
