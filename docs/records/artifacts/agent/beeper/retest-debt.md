# Beeper Retest Debt

Purpose: keep known issue validations visible after the first handoff so Beeper can confirm fixes instead of only finding new bugs.

## Rule

- Add an item here when Beeper finds a real engineering issue that should be rechecked after follow-up work.
- Remove or mark the item resolved only after Beeper revalidates the live product path directly.
- Prefer one retest-debt item over a new comfortable route when coverage is not the stronger ROI.

## Open Items

| Issue | Route / Surface | Why it matters | Trigger for retest | Source handoff |
| --- | --- | --- | --- | --- |
| Dashboard AI Studio CTA mismatch | `/dashboard` | First-click semantics break trust because `Open the AI Studio` does not do what it says. | Retest after dashboard CTA copy or entry-flow wiring changes. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-dashboard-ai-studio-cta-mismatch.md` |
| AI Studio generate no-op | `/ai-studio` | Core generation confidence is broken when generate appears live but does not visibly start work. | Retest after generate-path fixes, request wiring changes, or runtime incident resolution. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-generate-noop.md` |
| AI Studio top-tab/panel mismatch | `/ai-studio` | Navigation trust drops when top layout tabs do not map cleanly to visible panel state. | Retest after AI Studio top-tab or layout-state changes. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-top-tab-panel-mismatch.md` |
| Public home dashboard title mismatch | `/` after logout | Signed-out users receive the wrong browser title, which weakens route identity and polish. | Retest after public-home metadata or title logic changes. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-public-home-dashboard-title-mismatch.md` |
| Character route bootstrap stall | `/character` fresh reopen | Route trust breaks when a reopened Character session stays on loading skeleton instead of settling back into the editor. | Retest after Character bootstrap/restore/loading-state changes. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-character-route-bootstrap-stall.md` |

## Resolved Items

- Media Library stale thumb variant: retired with standalone page removal; only reopen if reproduced on AI Studio media surfaces. Source: `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-media-library-stale-thumb-variant.md`
- Media Library search empty-state mismatch: retired with standalone page removal; only reopen if reproduced on AI Studio media surfaces. Source: `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-media-library-search-empty-state-mismatch.md`
