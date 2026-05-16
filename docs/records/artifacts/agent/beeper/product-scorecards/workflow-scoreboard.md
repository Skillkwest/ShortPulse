# Workflow Scoreboard

Purpose: track workflow-level quality scores over time.

| Workflow | Current score | Confidence | Last updated | Completion state | Strongest issue | Best artifact |
| --- | ---: | --- | --- | --- | --- | --- |
| Sign in -> dashboard | 8.4 | `high` | 2026-05-15 | `validated` | Public-home title mismatch after logout lowers polish. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-logout-signin-lane.md` |
| Dashboard -> new project | 7.4 | `medium` | 2026-05-15 | `validated` | CTA semantics still confuse the entry expectation even though creation can succeed. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-project-create-lane.md` |
| Dashboard -> open existing project | 8.1 | `high` | 2026-05-15 | `validated` | Lower issue yield, but continuity holds after reopen and reload. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-open-existing-project-lane.md` |
| AI Studio prompt edit -> reload -> reopen | 8.3 | `high` | 2026-05-15 | `validated` | Generate and layout trust are still weaker than prompt persistence. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-stateful-non-generate.md` |
| Profile edit -> save -> reload | 8.8 | `high` | 2026-05-15 | `validated` | No significant issue surfaced on the safe write path. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-profile-safe-edit-save-lane.md` |
| Media Library browse/search/select | 7.2 | `medium` | 2026-05-15 | `partial` | Search empty-state wording undermines trust on no-match queries. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-media-library-search-lane.md` |
| Character edit -> continuity | 5.8 | `medium` | 2026-05-15 | `partial` | Reload and repeat re-entry can bounce through auth instead of restoring the editor after a real edit. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-reuse-lane.md` |
| Logout -> public home -> sign back in | 8.5 | `high` | 2026-05-15 | `validated` | Public-home title mismatch remains a polish/trust issue. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-logout-signin-lane.md` |
