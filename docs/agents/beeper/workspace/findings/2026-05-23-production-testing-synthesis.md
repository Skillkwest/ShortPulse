# Beeper Production Testing Synthesis - 2026-05-23

Purpose: preserve the real product-learning value from Beeper's 2026-05-15 production runs after retiring bulky raw evidence.

## What Is Reliably Validated

| Surface | Current truth | Best supporting docs |
| --- | --- | --- |
| Auth | Production sign-in works with the audit account. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-sign-in-summary.md` |
| Logout / login return | Full logout -> sign-back-in loop works when the confirmation step is completed. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-logout-signin-lane-summary.md` |
| Dashboard -> project create | Project creation works and the created project persists. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-project-create-lane-summary.md` |
| Dashboard -> open existing project | Opening an existing project from the dashboard overlay works and survives reload. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-open-existing-project-lane-summary.md` |
| AI Studio persistence | Prompt edits on a saved project persist after reload and after a fresh signed-in reopen. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-stateful-non-generate-summary.md` |
| AI Studio deeper non-generate action | Media Library audio playback worked during a deeper non-generate lane. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-deeper-non-generate-lane-summary.md` |
| Profile settings | Account display-name edit/save/reload flow worked. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-profile-safe-edit-save-lane-summary.md` |
| Media Library browse/select | Normal browse and select behavior mostly worked, including `Deselect all`. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-media-library-search-lane-summary.md` |
| Character in-session edit path | Existing-character rename worked in-session and `Add character look` worked in-session. | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-character-route-bundle-summary.md` |

## Open Product Issues Worth Keeping Hot

| Priority zone | Issue | Why it matters | Best handoff |
| --- | --- | --- | --- |
| Trust / continuity | Character reload can bounce back to auth after a real edit. | Breaks confidence that Character edits are durable. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-reload-auth-bounce.md` |
| Trust / continuity | Character fresh-session reopen can stall in route bootstrap/loading behavior. | Users may not get back into the editor they were using. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-route-bootstrap-stall.md` |
| Core workflow | AI Studio generate looks live but does not visibly produce output. | Makes the main creation path feel broken even though the shell loads. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-generate-noop.md` |
| Core workflow | AI Studio header tabs imply a panel state that does not match the actual visible content. | Confuses mode understanding on a dense surface. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-top-tab-panel-mismatch.md` |
| Media correctness | Media Library preview path can request a stale thumbnail variant and trigger `ERR_BLOCKED_BY_ORB` before fallback. | Trust-damaging preview behavior even when the client recovers. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-media-library-stale-thumb-variant.md` |
| UX honesty | Media Library no-match search state lies to the user. | Users get false feedback about search results. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-media-library-search-empty-state-mismatch.md` |
| Dashboard semantics | Dashboard AI Studio CTA semantics are confusing even though the control technically works. | Real users can misread what action will happen next. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-dashboard-ai-studio-cta-mismatch.md` |
| Metadata polish | Signed-out home page title still reads `ShortPulse · Dashboard`. | Low-severity but misleading browser metadata on a guest route. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-public-home-dashboard-title-mismatch.md` |

## Cross-Run Product Lessons

- Continuity checks produced the most valuable findings. Reload, reopen, and reauth return surfaced higher-trust truths than first-click smoke alone.
- AI Studio is stronger in non-generate continuity than in primary generate confidence. The shell, persistence, and some libraries work better than the headline action.
- Character is currently the weakest trust surface among the covered major routes because it fails in continuity more than in first-click interaction.
- Dashboard semantics need clarification even where functionality exists. Several flows worked but felt misleading at the moment of entry.
- Media Library issues were narrower than a full-surface failure. The evidence points to specific preview and empty-state defects rather than broad unusability.

## Best Next Beeper Lanes

1. Retest Character continuity after the auth-bounce and bootstrap fixes land.
2. Retest AI Studio generate after the noop path is repaired, then immediately apply reload/reopen pressure.
3. Revalidate Media Library preview behavior after stale-thumb handling is repaired.
4. Re-check dashboard CTA wording/semantics once the product decision is implemented.

## Evidence Retention Note

- Historical raw screenshots and JSON packets from these runs were retired on `2026-05-23`.
- The durable product signal remains in checkpoint summaries, Beeper reports, retained reports, D-Bug handoffs, route maps, scoreboards, and the redacted run-evidence index.
