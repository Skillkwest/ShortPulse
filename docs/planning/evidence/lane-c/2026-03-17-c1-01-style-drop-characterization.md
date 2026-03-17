# C1-01 Styles Drop Characterization Capture Prep

- `slice_id`: `C1-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - inspect the existing Reference Grid -> Styles drop path to confirm the exact packet contract required by Lane C
  - lock the runtime capture procedure for one failing and one passing real payload packet
  - document the current blocker: real pass/fail packets cannot be completed from repo-local inspection alone
- `commands_run`:
  - `sed -n '1,260p' frontend/features/ai-studio/components/StylesLibraryPanel.tsx`
  - `sed -n '1,760p' frontend/features/ai-studio/components/style-creator/useStyleCreatorController.ts`
  - `sed -n '520,760p' frontend/features/ai-studio/components/style-creator/intake.ts`
  - `sed -n '1,220p' frontend/features/ai-studio/components/style-creator/telemetry.ts`
  - `sed -n '360,980p' frontend/features/ai-studio/components/__tests__/StylesLibraryPanel.test.tsx`
  - `sed -n '1,260p' docs/known-issues.md`
  - `sed -n '1,220p' docs/sops/sop_ai_studio_style_creator.md`
  - `sed -n '1,220p' docs/planning/lane-c-execution-plan-2026-03-16.md`
- `results`:
  - current runtime/test/doc surfaces already define the packet schema for `C1-01`
  - `useStyleCreatorController` emits the required `style_extraction.*` telemetry fields on both success and blocked-source paths
  - `intake.ts` already normalizes packet-critical classifier metadata:
    - `classifier_reason`
    - `resolution_stage`
    - `resolution_reason`
    - `candidate_count`
    - `server_copy_attempted`
  - existing tests cover synthetic pass/fail cases, but they do not satisfy the Lane C requirement for one failing and one passing real payload packet captured from runtime
  - `C1-01` is therefore `Blocked` on runtime packet capture, not on missing implementation context
- `characterization_inputs`:
  - required payload keys to capture:
    - `text/reference-origin`
    - `text/reference-version`
    - `text/reference-output-id`
    - `text/reference-media-id`
    - `text/reference-image-index`
    - `text/reference-source-surface`
    - `text/reference-render-url`
    - `text/reference-url`
    - `text/plain`
  - required resolver metadata to capture:
    - `classifier_reason`
    - `resolution_stage`
    - `resolution_reason`
    - `candidate_count`
    - `server_copy_attempted`
  - required downstream outcome to capture:
    - `POST /api/media/copy-from-url` request attempted or skipped
    - request body summary when attempted
    - response status / summary
    - UI copy shown in Styles panel
    - telemetry message family (`style_extraction.success` or `style_extraction.blocked_source`)
  - required environment context:
    - timestamp
    - repo SHA
    - browser/environment
    - `NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED` value
- `failure_modes_asserted`:
  - none yet; this slice only locks the capture contract and blocker state
- `rollback_note`:
  - revert this packet and associated tracker/plan updates if a different capture workflow is approved before runtime collection begins
- `linked_pr`: `local lane-c execution stream`

## Capture Procedure

1. Reproduce one passing and one failing drag from Reference Grid into Styles in a real authenticated runtime session.
2. For each drag, record the transfer payload keys and values before the drop handler consumes them.
3. Record the resolver path outcome:
   - whether `resolveInternalStyleDrop` was invoked
   - whether candidate recovery stayed in `primary` resolution or escalated to `server_copy_fallback`
   - the normalized classifier metadata
4. Record whether `POST /api/media/copy-from-url` ran, plus a request/response summary if it did.
5. Record final UI outcome and emitted telemetry family.
6. Freeze both packets in this artifact or linked packet appendices before `C1-02` starts.

## Blocker

1. `owner`: Engineering
2. `unblock criterion`:
   - capture one passing real packet and one failing real packet from runtime, with payload keys, resolver metadata, fallback outcome, UI result, and telemetry result attached

## Why This Is The Correct Stop Point

1. Lane C explicitly forbids more patching on this P0 path without real characterization evidence.
2. The repo already gives us the packet schema; more local reading would not produce the missing real packets.
3. `C1-02` should remain blocked until the two runtime captures are attached here.
