# AI Studio Pricing Runtime Alignment Coverage

Date: 2026-05-11
Status: Done for runtime wiring lane
Scope: Align admin pricing `billed credits`, visible generate-button pricing, and server debit without changing admin pricing UI or values.

## Contract

- Admin `billed credits` is the intended target for supported runtime variants.
- Server debit remains final truth when sources disagree.
- UI must not silently show fallback billed-credit numbers as if they were authoritative.
- This lane fixes runtime wiring first, then documents or resolves admin modeling gaps.

## Status Legend

- `aligned`: button, payload, server debit, and admin variant intent agree
- `miswired`: intended price exists, but the runtime path is not carrying it correctly
- `admin-under-modeled`: runtime can bill correctly, but admin preview does not fully describe the debit shape
- `price-inert`: UI exposes a control that does not affect billing

## Coverage Matrix

| Family | Surface | Real pricing axes | Admin pricing axes | Current status | Notes |
| --- | --- | --- | --- | --- | --- |
| Bria Remove Background | Expert Edit utility action | fixed per image | fixed per image | `aligned` | Button/runtime/admin now agree on `3` billed credits. |
| Nano Banana 2 | Create / edit / picker | resolution | resolution | `aligned` | Aspect is present but not a real billing axis. |
| Nano Banana Pro | Create / edit / picker | resolution | resolution | `aligned` | Aspect is present but not a real billing axis. |
| Seedream 4.5 | Create / edit | resolution, including `auto_4K` | resolution, including `auto_4K` preview rows | `aligned` | `auto_4K` object payloads are normalized back into the correct billing tier for server debit. |
| Seedream 5 Lite | Create / edit | no active resolution axis | resolution rows shown in admin | `price-inert` | Resolution selector exists, but strategy currently ignores it. |
| FLUX Pro Fill | Edit utility / inpaint | output dimensions / megapixel shape | aspect-expanded rows | `aligned` | Expert Edit now resolves regenerate cost overrides from the exported output dimensions, so shared display/debit parity uses the same billed-credit tier on submit. |
| FLUX Kontext Inpaint | Edit utility / inpaint | output dimensions / megapixel shape | aspect-expanded rows | `aligned` | Shared inpaint debit remains dimension-aware, and regenerate submissions now thread the same exported-dimension billed credits into guardrails and displayed debit observability. |
| ChatGPT Image 2 create | Create / picker | size, quality | size, quality | `aligned` | Core create lane uses shared pricing path. |
| ChatGPT Image 2 edit | Edit | size, quality, input image count, mask | size, quality, simplified edit preview | `admin-under-modeled` | Admin preview does not fully model multi-image or masked edits. |
| Kling 3.0 standard | Video panel | duration, mode/resolution, audio | duration, mode/resolution, audio | `aligned` | Standard lane appears materially aligned. |
| Kling 3.0 motion control | Video panel | duration, mode/resolution, audio | duration, mode/resolution, audio | `aligned` | Motion Control now uses the same shared billed-credit path as the real Kling billing strategy instead of suppressing button pricing. |
| Veo 3.1 Fast (Kie) | Video panel | flat per video | resolution/audio rows collapse | `price-inert` | Controls are visible, but pricing is flat. |
| Seedance 1.5 Pro | Video panel | duration, resolution, audio | duration, resolution, audio | `aligned` | No concrete parity bug found. |
| Seedance 2 / 2 Fast | Video panel | duration, resolution, video input | duration, resolution, video input | `aligned` | Shared view-model pricing now feeds `inputVideoCount` for multimodal video-reference runs. |
| Music | Music panel | per-song runtime contract | per-song preview | `aligned` | Billing path is consistent, but batch observability uses per-song displayed credits. |
| Sound Effects | Sound Effects panel | generation count for current UI; explicit duration at API level | generation count or explicit duration | `aligned` | Current panel only exposes the auto-duration generate path, and that button is priced correctly. Explicit-duration billing exists at the route level but is not surfaced in this UI. |
| Voiceover | Voices panel | text length | text length | `aligned` | Shared estimate path is in place. |
| Voice Changer | Voices panel | source duration | source duration | `aligned` | Generate now stays disabled until the source-duration credit estimate resolves. |

## Exception Register

| ID | Family | Type | Summary | Billing correct now? | Follow-up |
| --- | --- | --- | --- | --- | --- |
| EX-001 | ChatGPT Image 2 edit | `admin-under-modeled` | Admin preview does not fully model masks or multi-image edits. | Likely yes | Accepted as a separate modeling lane for now. Runtime/button/debit wiring stays correct; admin expansion is deferred. |
| EX-002 | Seedream 5 Lite | `price-inert` | Resolution selector does not currently affect price. | Yes | Document as price-inert unless product wants pricing behavior changed. |
| EX-003 | Veo 3.1 Fast (Kie) | `price-inert` | Resolution/audio controls do not currently affect the billed price. | Yes | Document as price-inert unless pricing strategy changes. |
| EX-004 | Music batch mode | observability gap | Button shows batch total, but each submitted request records per-song displayed credits. | Yes | Keep billing intact; decide whether observability should reflect batch total or per-request truth. |

## Priority Order

### P1 wiring bugs

None remaining.

### P2 admin-under-modeled cases

1. ChatGPT Image 2 masked edits
2. ChatGPT Image 2 multi-image edits

### P3 documentation / price-inert cleanup

1. Seedream 5 Lite resolution
2. Veo 3.1 Fast (Kie) resolution/audio
3. Music batch observability semantics

## Done Rule

This lane is complete only when:

- every `miswired` row is fixed and reclassified
- every `admin-under-modeled` row has an explicit accepted policy
- every `price-inert` row is documented as intentional
- no touched surface silently drifts between button price and server debit

Current result:

- all previously `miswired` rows are fixed
- `ChatGPT Image 2 edit` remains an explicitly accepted `admin-under-modeled` exception
- `Seedream 5 Lite` and `Veo 3.1 Fast (Kie)` remain explicitly accepted `price-inert` controls
