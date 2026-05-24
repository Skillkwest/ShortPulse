# Beeper Redacted Run Evidence Index - 2026-05-23

Purpose: preserve the useful evidence facts from Beeper's historical production runs after retiring tracked raw screenshots and JSON captures.

## Prune Summary

- Retired raw artifacts: `107` PNG screenshots and `29` JSON captures.
- Highest-risk removals:
  - `prod-storage-state.json` contained live auth/session material.
  - `media-library-list-network.json` and related packets contained signed Supabase object URLs plus user/object identifiers.
  - Multiple summary packets encoded direct `user_id` query parameters and other identity-linked request traces.
- Durable sources kept:
  - `docs/agents/beeper/workspace/runs/*/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/`
  - `docs/agents/beeper/workspace/reports/`
  - `docs/records/artifacts/agent/beeper/reports/`
  - `docs/records/artifacts/agent/d-bug/handoffs/`
  - `docs/agents/beeper/workspace/findings/2026-05-23-production-testing-synthesis.md`

## Run Index

### 2026-05-15-084342-prod-sign-in

- Retired raw evidence: `1` PNG, `1` JSON
- Sensitive material removed: auth tokens, refresh token, user email, user ID, session payload
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-084342-prod-sign-in/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-sign-in-summary.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-sign-in.md`
- Product signal preserved: production sign-in worked; the in-app browser credential-entry path was clunky

### 2026-05-15-120659-prod-core-audit

- Retired raw evidence: `6` PNG, `4` JSON
- Sensitive material removed: signed Supabase media URLs, user/object identifiers, network request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-120659-prod-core-audit/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-core-audit-summary.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-core-audit.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-media-library-stale-thumb-variant.md`
- Product signal preserved: core signed-in routes loaded; Media Library stale thumbnail preview path was isolated cleanly

### 2026-05-15-125952-prod-real-user-exploratory

- Retired raw evidence: `13` PNG, `4` JSON
- Sensitive material removed: user-linked request traces and identity-linked response data
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-125952-prod-real-user-exploratory/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-real-user-exploratory-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-real-user-interaction-audit.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-real-user-exploratory.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-dashboard-ai-studio-cta-mismatch.md`
- Product signal preserved: dashboard launch semantics were confusing even though key controls technically worked

### 2026-05-15-133047-prod-project-create-lane

- Retired raw evidence: `5` PNG, `1` JSON
- Sensitive material removed: user-linked request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-133047-prod-project-create-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-project-create-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-project-creation-validation.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-project-create-lane.md`
- Product signal preserved: real project creation and persistence worked; earlier dashboard issue narrowed to semantics

### 2026-05-15-133731-prod-ai-studio-working-lane

- Retired raw evidence: `14` PNG, `4` JSON
- Sensitive material removed: user-linked request traces and generated route-summary payloads
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-133731-prod-ai-studio-working-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-working-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-ai-studio-working-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-working-lane.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-generate-noop.md`
- Product signal preserved: AI Studio shell opened and controls were reachable, but the main generate action looked live and produced no visible output

### 2026-05-15-134930-prod-ai-studio-non-generate-lane

- Retired raw evidence: `26` PNG, `2` JSON
- Sensitive material removed: user-linked request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-134930-prod-ai-studio-non-generate-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-non-generate-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-ai-studio-non-generate-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-non-generate-lane.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-top-tab-panel-mismatch.md`
- Product signal preserved: non-generate panels mostly worked, but top layout tabs implied the wrong panel state

### 2026-05-15-143100-prod-logout-signin-lane

- Retired raw evidence: `8` PNG, `1` JSON
- Sensitive material removed: user-linked request traces and auth/logout request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-143100-prod-logout-signin-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-logout-signin-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-logout-signin-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-logout-signin-lane.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-public-home-dashboard-title-mismatch.md`
- Product signal preserved: logout/login return loop worked; public home page title mismatch remained as a low-severity issue

### 2026-05-15-150037-prod-open-existing-project-lane

- Retired raw evidence: `5` PNG, `1` JSON
- Sensitive material removed: user-linked request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-150037-prod-open-existing-project-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-open-existing-project-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-open-existing-project-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-open-existing-project-lane.md`
- Product signal preserved: opening an existing project from the dashboard overlay worked and the same project survived reload

### 2026-05-15-153045-prod-ai-studio-deeper-non-generate-lane

- Retired raw evidence: `3` PNG, `1` JSON
- Sensitive material removed: signed Supabase media URLs and user-linked request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-153045-prod-ai-studio-deeper-non-generate-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-deeper-non-generate-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-ai-studio-deeper-non-generate-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-deeper-non-generate-lane.md`
- Product signal preserved: audio playback worked; one signed video preview ORB event did not map to a visible user-facing failure

### 2026-05-15-160043-prod-profile-safe-edit-save-lane

- Retired raw evidence: `4` PNG, `1` JSON
- Sensitive material removed: user-linked request traces
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-160043-prod-profile-safe-edit-save-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-profile-safe-edit-save-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-profile-safe-edit-save-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-profile-safe-edit-save-lane.md`
- Product signal preserved: display-name edit/save persisted after reload; page-title specificity remained a light UX note

### 2026-05-15-163023-prod-media-library-search-lane

- Retired raw evidence: `4` PNG, `1` JSON
- Sensitive material removed: none beyond ordinary UI-state capture
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-163023-prod-media-library-search-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-media-library-search-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-media-library-search-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-media-library-search-lane.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-media-library-search-empty-state-mismatch.md`
- Product signal preserved: normal browsing mostly worked, but the no-match empty state was misleading

### 2026-05-15-170121-prod-character-route-bundle

- Retired raw evidence: `11` PNG, `3` JSON
- Sensitive material removed: none beyond ordinary UI-state capture
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-170121-prod-character-route-bundle/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-character-route-bundle-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-character-route-bundle.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-route-bundle.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-route-bootstrap-stall.md`
- Product signal preserved: Character accepted a real edit and add-look action in-session, but fresh-session reopen looked unstable

### 2026-05-15-171728-prod-ai-studio-stateful-non-generate

- Retired raw evidence: `7` PNG, `4` JSON
- Sensitive material removed: user-linked request traces from saved-project persistence checks
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-171728-prod-ai-studio-stateful-non-generate/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-stateful-non-generate-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-ai-studio-stateful-non-generate.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-stateful-non-generate.md`
- Product signal preserved: saved-project prompt edits persisted across reload and fresh signed-in reopen; no new bug came from this lane

### 2026-05-15-231544-prod-character-reuse-lane

- Retired raw evidence: `0` PNG, `1` JSON
- Sensitive material removed: none beyond summary-state capture
- Durable docs to use:
  - `docs/agents/beeper/workspace/runs/2026-05-15-231544-prod-character-reuse-lane/notes.md`
  - `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-character-reuse-lane-summary.md`
  - `docs/agents/beeper/workspace/reports/2026-05-15-production-character-reuse-lane.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-reuse-lane.md`
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-reload-auth-bounce.md`
- Product signal preserved: real in-session rename succeeded, but edit -> reload continuity collapsed back to auth
