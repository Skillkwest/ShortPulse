# Testing Guide

Purpose: outline how to test the client-only ShortPulse experience.

## Commands
- No automated test runner is wired yet (there are `__tests__` files under `frontend/features/ai-studio/logic`, but no test script is configured).
- Until a harness exists, rely on manual checks: auth flows, AI Studio core generation, media uploads/deletes/renames, dashboard/profile flows, and pricing/credit debits. Post‑MVP surfaces (Saved Creators, Performance) can be tested when enabled.

## When to test
- Any change to Supabase interactions (auth, media library, credits).
- Any change to AI Studio pricing/debit logic.
- Any new shared components or CSS that affects multiple routes.

## Patterns
- Keep helpers pure so they are easy to unit test later without app/bootstrap.
- Co-locate future tests with the feature (`__tests__` or `*.test.tsx`) to prevent drift.
- Prefer deterministic inputs/outputs for analytics helpers so manual verification is straightforward.

## Gaps/TBD
- Frontend test harness (e.g., Playwright or component tests) is not set up.
- Add lint/format commands once a tooling choice is made.
