# Testing Guide

Purpose: outline how to test the client-only ShortPulse experience.

## Commands

- Unit tests (Vitest):
  - `cd frontend && npm run test`
  - `cd frontend && npm run test:ui`
  - `cd frontend && npm run test:coverage`
- End-to-end tests (Playwright, when specs exist):
  - `cd frontend && npm run test:e2e`
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

- E2E test specs are not yet populated for core user journeys.
- CI currently enforces lint/unit tests/build; expand coverage targets as new tests are added.
- A repo-wide Prettier baseline pass is still pending before format checks are enforced in CI.
