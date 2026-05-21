# Production Media Panel Persistence Audit

Date: 2026-05-16
Surface: `ai-studio-panel`
Environment: `production`
Run type: `save/browse integrity run`

## Purpose

Prove that a real media item saved through the AI Studio Media panel remains browse-ready after:

- immediate post-upload browse
- page reload and panel reopen
- fresh signed-in browser-context reopen

## Method

- Ran `cd frontend && PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL=https://www.shortpulse.ai npm run test:e2e:media-panel-persistence`
- Uploaded a real image fixture through the panel file input
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

- AI Studio Media panel now has direct persistence proof, not just open-path runtime evidence.
- The current blocker is no longer AI Studio panel save/reopen trust.
- The remaining persistence gap is cross-surface parity:
  - Elements embedded media panel still needs an equivalent retained persistence follow-up if we want both approved surfaces covered symmetrically.

## Holomony Read

- This result strengthens the current `done enough for now` classification for the runtime lane.
- Reopening hot-path tuning now would be lower ROI than either:
  - adding an Elements persistence follow-up, or
  - waiting for a fresh measured regression.
