# Media Library Runtime Rebuild Evidence Packet: MLR-0-S2 Characterization And Freeze Repro Baseline

## Packet Metadata
- `slice_id`: `MLR-0-S2`
- `date_utc`: `2026-03-28`
- `phase`: `MLR-0`
- `surface_scope`: `route + modal + panel + shared signing/store seams`
- `status`: `In Progress`
- `owner`: `Frontend Engineering`
- `linked_tracker_row`: `MLR-0-S2`

## Objective
Lock the characterization inventory for the rebuilt media-library runtime and record the current baseline for freeze-risk coverage before closeout.

## What This Packet Covers
1. Confirms the current targeted automated coverage for the shared media-library runtime seams.
2. Records the exact validation bundle run after route, modal, and panel moved onto the shared preview/signing seams.
3. States clearly what is still missing before the rebuild can claim the browser-unresponsive bug is closed.

## What This Packet Does Not Claim
1. It does not claim the heavy browser freeze repro is fully closed.
2. It does not replace a real large-dataset route/modal/panel repro pass in a live browser.
3. It does not change production code or runtime behavior.

## Characterization Inventory
1. Route shell and route-owned behavior:
   - removed standalone media-library route-behavior test (historical)
2. Shared signing hot path:
   - `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts`
3. Route pagination/data controller:
   - `frontend/features/media-library/hooks/__tests__/useMediaTabDataController.test.ts`
4. Modal browse/runtime behavior:
   - `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`
5. Panel browse/runtime behavior:
   - `frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`
6. Normalized runtime store:
   - `frontend/features/media-library/runtime/__tests__/store.test.ts`

## Commands Run
1. Historical targeted test bundle included the removed standalone media-library route-behavior test plus the shared preview-signing, tab-data, modal, panel, and runtime-store suites.
2. `cd frontend && npm run docs:check`
3. Live browser repro against the former local standalone Media Library route using the configured Playwright audit account
4. Live browser repro against `http://127.0.0.1:3000/ai-studio` panel path using the configured Playwright audit account
5. Live browser repro against `http://127.0.0.1:3001/ai-studio` on an isolated local copy started with `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=false` and the configured Playwright audit account

## Results
1. Targeted characterization bundle passed:
   - `6` test files
   - `79` tests
   - route, modal, panel, signing controller, tab data controller, and runtime store all green
2. The prior unstable `useMediaTabDataController` lane now terminates cleanly inside the characterization bundle.
3. `docs:check` passed with docs, semantic drift, migration parity, archive manifest, model catalog parity, naming drift, and operator-map checks green.
4. The modal test bundle emitted expected unresolved-preview warning logs during stale-refresh scenarios; those logs did not fail the run and are part of the current characterization surface.
5. The first live repro on the historical implementation exposed the real browser failure mode:
   - repeated `Maximum update depth exceeded` warnings in `MediaLibrary`
   - route remained rendered but was in the same overload class reported by the user
6. After adding a no-op guard for semantically identical ordered row/cache writes in `frontend/features/media-library/runtime/store.ts`, the same live route repro no longer emitted the max-depth warning.
7. A live AI Studio panel repro on the current server (`NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=true`) showed the panel surface opening normally with no matching max-depth warning.
8. A live AI Studio modal repro on the isolated server (`NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=false`) showed the fallback modal opening normally, switching across all five tabs, paginating repeatedly, and surviving repeated scroll churn without any browser console errors or matching max-depth warning. The only warning observed was the pre-existing webpack/HMR `isrManifest` dev-message warning on the isolated server.

## Current Freeze-Risk Assessment
- Confidence gained:
  1. The shared preview/runtime/signing seams are covered by targeted automated tests across route, modal, and panel.
  2. The bounded signing-follow-up behavior remains green after the surface cutovers.
  3. The route pagination controller remains deterministic after the earlier test harness stabilization.
  4. The route’s live browser max-depth loop now has a concrete root cause and an in-repo fix candidate validated against the same audit account.
  5. The current AI Studio panel path does not show the same immediate max-depth warning in the live browser repro.
- Residual gap:
  1. This packet still lacks a full large-dataset watchdog-style browser run across route, modal, and panel under one repeatable audit harness.
  2. The current modal live repro is a real browser interaction pass, but it is still a focused stress pass rather than a unified heavy-data packet shared with route and panel.
  3. Because the original bug was a browser unresponsive watchdog event, automated unit/component coverage is necessary but not sufficient for final signoff.

## Validation Status
- Targeted validation outcome: `pass`
- Full docs/index validation outcome: `pass`
- Live route repro outcome: `pass after fix`
- Live panel repro outcome: `pass`
- Live modal repro outcome: `pass`
- Heavy browser repro outcome: `pass in dedicated packet`

## Risk And Rollback
- `risk_class`: `Low`
- Risk delta:
  1. Reduced planning drift by turning the implied characterization baseline into an explicit evidence artifact.
  2. Reduced false confidence risk by keeping the characterization baseline separate from the dedicated heavy-browser packet.
- `rollback_note`:
  1. Revert this packet, namespace index entries, and tracker status update if the evidence contract is rejected.

## Task Contract Checklist
- [x] Rebuild objective unchanged
- [x] Characterization inventory explicitly linked
- [x] Validation commands and outcomes recorded
- [x] Docs/index updates included for the new evidence namespace
- [x] Remaining heavy repro gap stated explicitly
- [ ] Heavy media-library browser repro packet complete

## Audit Findings
### blocking
1. None in this baseline packet after the dedicated heavy-browser repro completed in `2026-03-28-mlr-0-s2-heavy-browser-repro-packet.md`.

### non-blocking
1. Current evidence is weighted toward targeted automated coverage; there is still no large-dataset runtime timing/profile packet in this namespace.
2. The panel live repro was a smoke verification, not a deliberately overloaded watchdog scenario.
3. The modal live repro used an isolated local copy on port `3001`; the shared route/panel/modal packet now lives in `2026-03-28-mlr-0-s2-heavy-browser-repro-packet.md`.

### deferred
1. If the live browser repro still shows tab unresponsiveness after the shared seam cutovers, the next packet should target controller-internal churn inside `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`.

## Follow-up Actions
1. Use the dedicated heavy-browser packet as the closeout proof for `MLR-0-S2`.
2. If a future repro fails after the route-loop fix, instrument and reduce the remaining churn inside the shared signing controller rather than opening a new architecture lane.
3. Keep modal-path validation on a panel-disabled server when rerunning the unified packet.

## Linked PR Or Commit
- `linked_pr_or_commit`: `pending current slice commit`

## References
1. `docs/archive/planning/media-library-runtime-rebuild-master-plan-2026-03-28.md`
2. `docs/archive/planning/media-library-runtime-rebuild-tracker-2026-03-28.md`
3. `docs/records/evidence/media-library-runtime-rebuild/README.md`
4. `docs/records/evidence/media-library-runtime-rebuild/2026-03-28-mlr-0-s2-heavy-browser-repro-packet.md`
