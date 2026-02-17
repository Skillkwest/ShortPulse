# Documentation Governance Audit — 2026-02-17

## Purpose
Execute the documentation governance + backlog recovery pass using a hybrid method:
1. Scripted inventory/status extraction.
2. Manual senior-review classification and evidence validation.

Scope is documentation-only.

## Baseline Snapshot
- Audit date: `2026-02-17`
- Planning directory baseline captured from `docs/planning/`.
- Backlog baseline captured from `docs/planning/backlog.md`.
- Existing non-doc repo changes were present before this pass; this audit modifies docs only.

## Repeatable Contradiction Detection Method
Use this sequence on future audits:
1. Route reality:
   - `rg --files frontend/pages`
2. Doc claims:
   - `rg -n "Coming Soon|post-MVP|refresh|rescore|character-soon|performance-soon" README.md docs/*.md docs/**/*.md`
3. Planning drift:
   - `for f in docs/planning/*.md; do rg -n "^status:|Remaining|Paused|Open|\- \[[x ]\]" "$f"; done`
4. Backlog proof:
   - `rg -n "<feature keywords>" frontend docs frontend/tests`

## Planning Classification Matrix

| File | Classification | Evidence summary |
| --- | --- | --- |
| `docs/planning/backlog.md` | Active | Canonical execution backlog with open items. |
| `docs/planning/audit-progress.md` | Active | Explicit backlog for later audit weeks remains open. |
| `docs/planning/mvp-pretester-full-audit-remediation-plan.md` | Active | One paused Stripe/subscription item remains tracked. |
| `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md` | Active | Multiple open UX workstream items remain. |
| `docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md` | Active | Ticket register still includes non-done work. |
| `docs/planning/mvp-ui-ux-issue-board.md` | Active | Active queue includes paused/deferred items. |
| `docs/planning/ai-studio-agent-tooling-phased-plan.md` | Active | Rollout phases and deferred MCP gates remain future work. |
| `docs/planning/ai-studio-agent-pipeline-hardening-plan.md` | Active | Implementation complete, but explicit operational follow-up remains. |
| `docs/planning/ai-studio-primary-character-panel-build-plan.md` | Active | Open acceptance checklist items remain. |
| `docs/planning/expert-workflow-hardening-css-reorg-plan.md` | Active | Manual visual-baseline sign-off still pending. |
| `docs/planning/mvp-ui-ux-phase0-baseline-qa-checklist.md` | Reference | Reusable QA checklist template artifact. |
| `docs/planning/mvp-ui-ux-phase0-baseline-capture-template.md` | Reference | Reusable capture template artifact. |
| `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md` | Reference | Baseline evidence report (historical snapshot). |
| `docs/planning/media-library-reference-grid-optimization-plan.md` | Reference | Proposed architecture doc, intentionally planning-only. |
| `docs/planning/media-optimization-phase0-measurement-spec.md` | Reference | Proposed measurement spec. |
| `docs/planning/media-optimization-schema-and-migration-spec.md` | Reference | Proposed schema/migration spec. |
| `docs/planning/tooling-audit-2026-02-16.md` | Reference | Research/audit reference with backlog links. |
| `docs/planning/documentation-audit-2026-02-17.md` | Reference | This governance audit artifact. |

## Archive Actions Applied

### Moved to `docs/archive/planning/`
1. `docs/archive/planning/ai-studio-character-mode-injection-plan.md`
   - Classification: Completed.
   - Evidence: implementation and tests logged in `docs/change_log.md` (2026-02-14 entries), plus runtime helper/test files referenced in that entry.
2. `docs/archive/planning/media-library-move-tabs-plan.md`
   - Classification: Completed.
   - Evidence: implemented routes/tests/docs (`frontend/pages/api/media/move.ts`, `frontend/pages/api/media/move-batch.ts`, `frontend/tests/api/media-move.test.ts`, `docs/sops/sop_media_library_ui.md`, `docs/api/api-internal-routes.md`).
3. `docs/archive/planning/mvp-pre-tester-anchor-plan.md`
   - Classification: Superseded.
   - Superseded by: `docs/planning/mvp-pretester-full-audit-remediation-plan.md`.

### Follow-up transfer check
- No unique unresolved items were lost during archive moves.
- Remaining active-scope pretester work is still tracked in `docs/planning/mvp-pretester-full-audit-remediation-plan.md` and `docs/planning/backlog.md`.

## Backlog Evidence Matrix (Strict Proof)

| Backlog item | Status | Evidence | External dependency |
| --- | --- | --- | --- |
| Create Stripe price IDs and populate Supabase IDs | Blocked external dependency | Requires Stripe dashboard + environment data not present in repo. | Yes |
| Configure Stripe Billing Portal flow | Verified complete | `frontend/pages/profile.tsx`, `frontend/pages/api/billing/stripe/portal.ts`, `frontend/tests/api/stripe-portal.test.ts` | No |
| Subscription tab E2E signoff (upgrade/downgrade/cancel/webhook/renewal) | Blocked external dependency | Requires live environment run + sign-off evidence. | Yes |
| Two-account RLS verification for `saved_creators` + `media_files` | Blocked external dependency | Requires multi-account runtime validation evidence. | Yes |
| Automated tests for auth + saved creators + media library critical flows | Open | Auth/media coverage exists; saved-creators critical test coverage still missing. | No |
| Account setting: Show Beginner Mode Toggle | Open | No profile/account setting surface found for this control. | No |
| CSV import/export for saved creators | Open | No import/export feature evidence found. | No |
| Additional demo dataset variants/cohort switching on Performance | Open | No cohort-switching implementation evidence found. | No |
| Replace hard-coded usage counters with live client state | Open | `storage` + `credits` are dynamic; `searches` remains hard-coded in dashboard/performance. | No |
| Long-link tooltip/url resilience | Open | Partial formatting exists; no complete cross-surface closure evidence. | No |
| Performance status-history trail follow-up | Open | No status-history trail evidence in performance route. | No |
| SOP for Performance data actions + recomputation behavior | Open | No dedicated SOP for this specific contract found. | No |
| Character alias drift monitoring for full release cycle | Paused policy scope | Monitoring query exists (`sql/check_character_sheet_alias_drift.sql`), but full release-cycle evidence not complete. | Time/ops dependent |
| Character alias deprecation migration plan | Paused policy scope | Dependent on drift-monitoring completion. | Time/ops dependent |
| Research / spikes items (`react-masonry-css`, `next/image`, `dnd-kit`, `sonner`, `lightbox`, `date-fns`, `zustand`, `zod`) | Open | Still research-stage by design. | No |
| Later items (live data sources, ML experiments) | Open | Post-MVP exploratory work; no implementation closure evidence. | No |

## Documentation Staleness Corrections Applied
1. `README.md`
   - Reconciled stale "data actions rail refresh/rescore" wording with current performance surface behavior.
   - Clarified staged rollout relationship between `/performance` and `/performance-soon`.
2. `docs/routes.md`
   - Corrected Character Manager reference limit wording (`10` persisted QuickSwap Deck references).
   - Reframed `/performance` note to staged visibility rather than contradictory route existence.
3. `docs/release-checklist.md`
   - Replaced stale post-MVP "data actions rail" phrasing with current performance demo verification wording.
4. Planning/archive indexes updated for moved docs.
5. `ROADMAP.md`
   - Reviewed for top-level consistency with `README.md` and `docs/routes.md`; no wording changes were required in this pass.

## Upload-Ready Packaging Method
Best method remains: single docs-focused branch + single PR.

Suggested commands:
```bash
git checkout -b chore/docs-governance-2026-02-17
git add README.md docs
git commit -m "docs: governance audit, planning archive cleanup, backlog evidence refresh"
```

PR body should include:
1. Audit summary and method.
2. Archive moves performed.
3. Backlog items checked off with strict evidence.
4. Validation command results.

## Validation Checklist
- `node scripts/check_docs_links.js`
- `npm -C frontend run docs:check`
- Confirm no orphan references to moved planning docs.
