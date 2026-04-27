# C1-01 Style-Drop Capture Harness Bootstrap

- `slice_id`: `C1-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - add a reproducible authenticated audit harness for the Reference Grid -> Styles packet capture
  - keep Lane C blocked on real packet collection, but remove the ambiguity about how those packets should be captured
  - avoid product-behavior changes by using audit-only runtime helpers and an external Playwright runner
- `commands_run`:
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`
  - `npm -C frontend run build`
  - `npm -C frontend run docs:check`
- `results`:
  - added `frontend/tests/e2e/ai-studio-style-drop.audit.js`
  - added `npm -C frontend run test:e2e:style-drop`
  - extended audit-only `window.__shortpulseAiStudioPerf` runtime helper with seeded custom Reference Grid item support
  - `lint`: pass with existing baseline `7` warnings and no new errors
  - `type-check`: pass
  - `build`: pass
  - `docs:check`: pass
  - authenticated Playwright audit was not executed in this slice because audit credentials were not supplied in-session
- `characterization_inputs`:
  - capture command:
    - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:style-drop`
  - harness behavior:
    - signs in to a dedicated real audit account
    - seeds one passing and one failing live Reference Grid item
    - dispatches real runtime dragstart/drop using app-generated transfer payloads
    - captures transfer keys, telemetry payload, and `/api/media/copy-from-url` request/response summary
  - known constraints:
    - `C1-01` is still blocked until the command is actually run and its output is attached
    - the harness stubs `/api/ai/extract-style` success so the packet audit stays focused on drag/resolver/fallback behavior instead of external extractor variance
- `failure_modes_asserted`:
  - no new runtime behavior asserted in this slice; this is capture infrastructure only
- `rollback_note`:
  - revert the audit script, package script, and audit-only runtime helper additions if a different capture mechanism is approved
- `linked_pr`: `local lane-c execution stream`

## Why This Is High Value

1. `C1-01` now has a deterministic, repo-owned capture path instead of ad hoc manual reproduction.
2. The harness uses the live authenticated app and app-generated transfer payloads.
3. Lane C remains correctly blocked until the real pass/fail packets are attached; this slice does not pretend otherwise.
