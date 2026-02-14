# Testing Guide

Purpose: outline how to test the ShortPulse app (client UI plus internal API route behavior).

## Commands

- Unit tests (Vitest):
  - `cd frontend && npm run test`
  - `cd frontend && npm run test:ui`
  - `cd frontend && npm run test:coverage`
- End-to-end tests (Playwright, when specs exist):
  - `cd frontend && npm run test:e2e`
  - Character pipeline audit: `cd frontend && npm run test:e2e:character`
- Full local validation:
  - `cd frontend && npm run validate`

## When to test

- Any change to Supabase interactions (auth, media library, credits).
- Any change to AI Studio pricing/debit logic.
- Any new shared components or CSS that affects multiple routes.

## Patterns

- Keep helpers pure so they are easy to unit test later without app/bootstrap.
- Co-locate future tests with the feature (`__tests__` or `*.test.tsx`) to prevent drift.
- Prefer deterministic inputs/outputs for analytics helpers so manual verification is straightforward.
- Prefer `vitest` assertions/mocks for unit tests so all tests run in one harness.

## Gaps/TBD

- CI currently enforces lint/unit tests/build; add Playwright execution once environment credentials and stable test data are provisioned.
- Expand E2E coverage beyond character pipeline into media library, billing, and admin operations.
- A repo-wide Prettier baseline pass is still pending before format checks are enforced in CI.
