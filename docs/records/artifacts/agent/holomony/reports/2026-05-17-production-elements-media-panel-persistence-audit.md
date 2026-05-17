# Production Elements Media Panel Persistence Audit

Date: 2026-05-17
Surface: `elements-media-panel`
Environment: `production`
Run type: `save/browse integrity run`

## Purpose

Prove that a real media item saved through the Elements embedded media panel remains browse-ready after:

- immediate post-upload browse
- page reload and panel reopen
- fresh signed-in browser-context reopen

## Method

- Ran `cd frontend && PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL=https://www.shortpulse.ai npm run test:e2e:media-panel-persistence -- --surface elements-media-panel`
- Uploaded a real image fixture through the Elements panel file input
- Verified the image preview rendered in the `Images` tab
- Verified hover actions were available on each step
- Reloaded and reopened the same panel
- Repeated the check in a fresh signed-in browser context
- Deleted the audit fixture after verification

## Result

- `ok: true`
- `saveRoundtripFailureRate: 0`
- `saveRoundtripMismatchRate: 0`
- `saveBrowseReadyRatio: 1`
- cleanup: attempted and succeeded

## Step Result

| Step | Visible | Preview loaded | Browse ready | Download action visible |
| --- | --- | --- | --- | --- |
| upload | yes | yes | yes | yes |
| reload reopen | yes | yes | yes | yes |
| fresh-context reopen | yes | yes | yes | yes |

## Interpretation

- Elements embedded media panel now has direct persistence proof, not just shared-runtime KPI evidence.
- Cross-surface persistence parity is now closed for the two approved media panels.
- The current blocker is no longer save/reopen trust on either approved panel surface.

## Holomony Read

- This result upgrades the current lane from "AI Studio runtime is healthy but Elements parity still needs proof" to "both approved panels have direct retained persistence proof."
- The right classification for the current lane is now `done enough for now`.
- Reopening hot-path tuning without a fresh measured regression would be momentum, not disciplined media-performance work.
