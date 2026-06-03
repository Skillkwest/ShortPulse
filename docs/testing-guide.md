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
  - AI Studio audio exclusivity audit:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:audio-exclusivity`
    - Seeds two Media panel audio fixtures plus one Reference Grid audio fixture in a live AI Studio session, then verifies Media-panel inline exclusivity plus `ref grid audio -> media preview modal audio` and `ref grid audio -> detail modal audio` one-at-a-time playback handoff.
    - Headless mode skips the `voice preview -> ref grid audio` lane when provider-backed sample playback never enters the playing state in the local browser runtime. Run with `PLAYWRIGHT_HEADLESS=false` if you need that lane exercised interactively.
  - Custom Pulse contract audit:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:pulse-custom-contract`
    Verifies the custom Pulse transport contract and that an active Pulse can survive leaving Create for another workflow and resume intact when the user returns.
    - Signs in to the live app, creates a custom Pulse through the real Pulse Library UI, activates it from Pulse Catalog, intercepts `/api/ai/studio-agent-pulse`, and verifies the outgoing request keeps the minimal custom-Pulse contract without guided-workflow metadata.
  - Built-in Pulse contract audit:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:pulse-builtin-contract`
    Verifies the built-in Pulse browser contract and that an active built-in Pulse survives leaving Create for another workflow and resumes intact when the user returns.
    - Signs in to the live app, loads `/api/ai/create-pulse-builtins`, verifies the public built-in catalog is authoritative and does not expose hidden instructions, activates a real built-in from Pulse Catalog, intercepts `/api/ai/studio-agent-pulse`, and verifies the browser request stays on the built-in/server-authoritative contract with no browser-supplied system instructions.
  - Custom Pulse contract release check:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:pulse-custom-contract:release-check`
    Runs the same audit against a temporary production server.
    - Builds production, starts a temporary local server, runs the browser audit against that clean bundle, and tears the server down automatically.
    - Optional overrides:
      - `PULSE_CUSTOM_CONTRACT_SKIP_BUILD=true` to reuse an existing production build.
      - `PULSE_CUSTOM_CONTRACT_PORT=<port>` to choose a different local server port.
  - Built-in Pulse contract release check:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:pulse-builtin-contract:release-check`
    Runs the built-in Pulse audit against a temporary production server.
    - Builds production, starts a temporary local server, runs the built-in browser audit against that clean bundle, and tears the server down automatically.
    - Optional overrides:
      - `PULSE_BUILTIN_CONTRACT_SKIP_BUILD=true` to reuse an existing production build.
      - `PULSE_BUILTIN_CONTRACT_PORT=<port>` to choose a different local server port.
  - Project workspace persistence audit:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:project-persistence`
    - Uses the real project create/save/read/delete APIs plus an authenticated `/ai-studio?projectId=...` reopen to verify legacy orphan output payloads are stripped before persistence and do not leak back into the UI.
  - Media panel save/reopen browse-readiness smoke audit:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:media-panel-persistence`
    - Uploads a real image through the target media panel, verifies the persisted preview renders and decodes in the panel, reloads and reopens the panel in the same context, repeats the check in a fresh signed-in context, then deletes the audit fixture.
    - Defaults to the AI Studio Media panel.
    - Add `-- --surface elements-media-panel` to run the same audit against the Elements embedded media panel.
  - Lane C style-drop characterization capture:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:style-drop`
    - Uses the authenticated AI Studio runtime plus audit-only `window.__shortpulseAiStudioPerf` helpers to print one passing and one failing Reference Grid -> Styles packet summary.
  - Expert Edit launch-surface browser audit:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:expert-edit-parity`
    - Verifies the authenticated production/browser Standard-only Edit launch surface across DPR profiles (`1`, `2`, `3`): AI Studio route reachability, visible Edit stage shell, hidden Inpaint/Markup launch-locked controls, and non-generative Edit controls.
    - Safety: this audit does not click Generate or submit provider work.
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
