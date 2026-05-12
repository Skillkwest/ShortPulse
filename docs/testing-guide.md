# Testing Guide

Purpose: outline how to test the ShortPulse app (client UI plus internal API route behavior).

## Commands

For default closeout selection by planning program, see:
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

- Unit tests (Vitest):
  - `cd frontend && npm run test`
  - `cd frontend && npm run test:ui`
  - `cd frontend && npm run test:coverage`
- End-to-end tests (Playwright, when specs exist):
  - `cd frontend && npm run test:e2e`
  - Character pipeline audit: `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<existing-test-user-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:character`
    - Safety: this audit now refuses to run without `PLAYWRIGHT_AUDIT_EMAIL` and will reject `@example.com` addresses to prevent accidental user creation.
  - AI Studio audio exclusivity audit:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:audio-exclusivity`
    - Seeds two Media panel audio fixtures plus one Reference Grid audio fixture in a live AI Studio session, then verifies Media-panel inline exclusivity plus `ref grid audio -> media preview modal audio` and `ref grid audio -> detail modal audio` one-at-a-time playback handoff.
    - Headless mode skips the `voice preview -> ref grid audio` lane when provider-backed sample playback never enters the playing state in the local browser runtime. Run with `PLAYWRIGHT_HEADLESS=false` if you need that lane exercised interactively.
  - Custom Pulse contract audit:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:pulse-custom-contract`
    Verifies the custom Pulse transport contract and that leaving Create clears the active Pulse session before returning to Create.
    - Signs in to the live app, creates a custom Pulse through the real Pulse Library UI, activates it from Pulse Catalog, intercepts `/api/ai/studio-agent-pulse`, and verifies the outgoing request keeps the minimal custom-Pulse contract without guided-workflow metadata.
  - Custom Pulse contract release check:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:pulse-custom-contract:release-check`
    Runs the same audit against a temporary production server.
    - Builds production, starts a temporary local server, runs the browser audit against that clean bundle, and tears the server down automatically.
    - Optional overrides:
      - `PULSE_CUSTOM_CONTRACT_SKIP_BUILD=true` to reuse an existing production build.
      - `PULSE_CUSTOM_CONTRACT_PORT=<port>` to choose a different local server port.
  - Project workspace persistence audit:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:project-persistence`
    - Uses the real project create/save/read/delete APIs plus an authenticated `/ai-studio?projectId=...` reopen to verify legacy orphan output payloads are stripped before persistence and do not leak back into the UI.
  - Lane C style-drop characterization capture:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:style-drop`
    - Uses the authenticated AI Studio runtime plus audit-only `window.__shortpulseAiStudioPerf` helpers to print one passing and one failing Reference Grid -> Styles packet summary.
  - Expert Edit coordinate parity matrix capture (CP-004 baseline harness):
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:expert-edit-parity`
    - Uses real pointer interactions in Expert Edit markup mode across DPR profiles (`1`, `2`, `3`) with a `4:3` viewport baseline.
    - Safety: this audit refuses `@example.com` addresses and requires a dedicated real test account.
  - AI Studio production perf release check:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run perf:ai-studio:release-check`
- Full local validation:
  - `cd frontend && npm run validate`
- Full repo sweep (major CI-aligned breakpoints in one run):
  - `bash scripts/run_repo_sweep.sh`
  - Optional gates: set `RUN_SQL_LINT=1`, `RUN_E2E=1`, and/or `RUN_AI_STUDIO_PERF_AUDIT=1` as needed.

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

- CI currently enforces split frontend lint/type-check/docs-contracts/fast-tests/unit-tests/build lanes plus policy/security gates; add Playwright execution once environment credentials and stable test data are provisioned.
- Expand E2E coverage beyond character pipeline into media library, billing, and admin operations.
- A repo-wide Prettier baseline pass is still pending before format checks are enforced in CI.
