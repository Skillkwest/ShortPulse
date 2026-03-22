# AI Studio SOP Index (Text, Image, Video)

Purpose: provide a single hub for AI Studio SOPs, shared defaults, and the canonical structure for any new generation flow.

## Vertical SOPs
- Text generation: `docs/sops/sop_text_generation.md` — prompt refinement and image-to-text describe flows.
- Image generation: `docs/sops/sop_image_generation.md` — text-to-image today; will house image-to-image/image-to-video notes.
- Video generation: `docs/sops/sop_video_generation.md` — text-to-video and image-to-video.
- Media performance ops: `docs/sops/sop_media_performance_operations.md` — Reference Grid autoplay budgeting, media signing behavior, and performance triage.
- Media Library panel operations: `docs/sops/sop_ai_studio_media_library_operations.md` — target contract + runtime deltas for `All Media` master-folder behavior, inline tabbed prompts/images/videos display, drag/drop membership semantics, ghost-image expectations, right-click ingest actions, and folder-canvas domain behavior.
- Agent collaboration: `docs/sops/sop_ai_studio_agent.md` — chat-based assistant that replaces prompt textareas, sees the reference grid, and applies prompts to generation.
- Agent chat ops: `docs/sops/sop_ai_studio_agent_chat_ops.md` — UI entry points, context pipeline, fallbacks, and validation checklist for the agent chat surfaces.
- Agent safety control plane: `docs/sops/sop_ai_studio_agent_safety_control_plane.md` — profile tuning knobs, admin control routes, rollback/cooldown workflow, and SQL validation gates.
- Agent rollout ops: `docs/sops/sop_ai_studio_agent_rollout_operations.md` — progressive ring rollout, freeze/rollback triggers, and evidence capture workflow.
- Create panel + generation wiring: `docs/sops/sop_ai_studio_create_properties_generation_wiring.md` — end-to-end wiring map for Create properties UI, model selectors, submit pipeline, and agent/control integration.
- Styles Library style creator: `docs/sops/sop_ai_studio_style_creator.md` — modular style creation/edit/delete workflow, extraction outcomes, metadata contract, and telemetry schema.
- Expert Edit prompt references: `docs/sops/sop_ai_studio_expert_edit_prompt_references.md` — `@img1..@img3` token grammar, drag insertion, generate preflight blocking, and submit-time Figure mapping.
- Session persistence (full canvas durability): `docs/sops/sop_ai_studio_session_persistence_reference_only.md` — default-on restore/write operation for workspace + outputs + agent + dual-canvas session continuity with rollback runbook.

## Reference Grid Foundation Program Docs
- Program plan: `docs/planning/ai-studio-reference-grid-modularization-program.md`
- Program tracker: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- Evidence index: `docs/planning/evidence/reference-grid-modularization/README.md`
- ADR: `docs/adr/0022-reference-grid-domain-modular-architecture.md`

## Shared primitives (do not duplicate)
- Canonical model API metadata: `frontend/lib/model-runtime/modelCatalog.ts` (provider model ids, submit/status aliases, validated fields, defaults, provider source URLs, verification dates).
- UI model metadata: `frontend/features/ai-studio/logic/modelRegistry.ts` (labels, mediaType, pricing strategy, UI capabilities).
- Pricing dispatcher: `frontend/features/ai-studio/logic/pricing.ts` (`computeCostForModel`, `buildDefaultPricingParams`).
- Pricing strategies: `frontend/lib/model-runtime/pricingStrategies.ts` (per-MP, per-image, per-duration).
- Create model-selection policy: `frontend/features/ai-studio/logic/modelSelectionPolicy.ts` (shared option filtering + startup default precedence).
- Create panel contract adapter: `frontend/features/ai-studio/hooks/useAiStudioCreatePanelProps.ts` (maps page orchestration state to `CreatePropertiesPanel` props).
- UI orchestration: `frontend/features/ai-studio/hooks/useAiStudioState.ts`, `frontend/pages/ai-studio.tsx`.
- Model picker + cost badges: `frontend/features/ai-studio/components/ModelModal.tsx` (uses registry defaults).
- Reference Grid performance controls: `frontend/features/ai-studio/components/ReferenceGrid.tsx` (virtualization + autoplay budget gating).
- Replay snapshot contract + guards: `frontend/features/ai-studio/logic/generationReplay.ts` (card-level re-roll eligibility and validation).
- Character panel layout parity: `frontend/features/ai-studio/components/CharacterPanel.tsx` mounts `CharacterManagerShell` with `surface=\"panel\"` and follows the same create-workspace section order contract as `/character` (see `docs/sops/sop_character_manager_operations.md`).

## Create startup model precedence
- Storage key remains `aiStudioWorkflowSettingsByTool.v1`.
- On Create workflow restore, startup model resolution is policy-driven:
  1. Keep saved model when it remains valid for current Create mode.
  2. For Create + Image when saved model is missing/invalid, default to `fal-ai/bytedance/seedream/v4.5/text-to-image`.
  3. Return `null` when no valid/default candidate exists for the active mode.

## Expert Edit rollout defaults
- Expert Edit properties panel is enabled by default for Edit workflow in expert mode.
- Beginner Edit remains legacy and intact as fallback behavior.
- Runtime kill switch: `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false` forces legacy Edit panel.
- Chat mode control is hidden/off in Expert Edit; inline Generate remains the primary action.
- `Libraries -> Media Library` is a first-class left-panel tool (`media-library`) in AI Studio and no longer modal-only by default. Runtime fallback: set `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=false` to restore the legacy modal open path during rollback. Gesture/runtime gate: `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED` controls panel drag ghost + root right-click ingest + root delete semantics. Per-folder canvas spaces are always enabled for user-created folders, with independent camera/scene persistence via `/api/ai/media-folder-canvas/[folderId]` + `/api/ai/media-folder-canvas/save`. Target UX defines `All Media` as one master root folder with inline tabs (`Images`, `Videos`, `Prompts`) that organize content in-place (masonry for media with true aspect ratio, text reference cards for prompts), with near-bottom infinite scroll auto-load on media tabs and a global root media paginator footer retained as manual fallback, right-click media dispatch to Reference Grid, double-click preview-only modal behavior, and explicit folder membership move/assign semantics.
- `Shortcuts -> Presets` opens a primary left-panel Presets Library sourced from the Expert Edit preset catalog with `Custom 1`, `Custom 2`, and `Custom 3` placeholder tiles (including overrides) plus a full-size `Create New Preset` tile, keeps the right rail visible, supports modal create/edit for preset name + prompt text, and provides per-tile delete confirmation for permanent preset removal.
- Expert Edit generation behavior contracts (stage-camera-framed submit flatten for generate/manual, submit-scoped model overrides, Bria-only hidden replacement semantics, shared Flux Fill inpaint constants) are documented in `docs/sops/sop_image_generation.md` under `Expert Edit properties panel behavior`.
- Expert Edit markup draw/erase/color behavior (shared inline+expanded state, whole-stroke eraser semantics, and ephemeral stroke persistence policy) is documented in `docs/sops/sop_image_generation.md` under `Expert Edit properties panel behavior`.
- Expert Edit prompt token behavior (`@img1..@img3`, deferred invalid warning on Generate, and submission compile mapping) is documented in `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`.

## Canvas interaction guardrails
- Dual-canvas layout (main + right-rail) shares scene data but keeps viewport camera state independent per instance.
- For non-canvas workflows, right-rail Canvas visibility defaults to hidden on refresh/new session.
- Draft-text and text-edit ownership are instance-scoped so double-click draft creation cannot be auto-cleared by the mirrored canvas instance.
- Empty-space text draft creation must remain single-create per gesture (native `dblclick` plus pointer/click fallbacks are deduped).

## Model modal ordering policy
- Source of truth: `frontend/features/ai-studio/components/ModelModal.tsx`.
- Model chips are ordered deterministically by context using provider-priority and model-priority maps.
- Current contexts with explicit ordering:
  - `text-image` (Create): ByteDance -> Google -> Black Forest Labs.
  - `reference-image` (Edit): ByteDance -> Google -> Black Forest Labs.
  - `reference-video` (Video standard): Google DeepMind -> Kie AI -> ByteDance -> Kling AI.
  - `reference-keyframes`: Google DeepMind -> Kie AI.
- Video policy invariant:
  - `fal-ai/veo3.1/first-last-frame-to-video` and `kie-ai/veo-3.1-fast-i2v` are keyframes-compatible.
  - Standard Video mode excludes first/last-frame and surfaces standard image-to-video options (Fal + Kie) only.

## Fal reliability rollout notes (v2 architecture)
- Primary tracker: `docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`
- Audit snapshot: `docs/planning/ai-studio-generation-runtime-audit-2026-02-20.md`
- ADR: `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
- Route contracts and rollout flags: `docs/api/api-internal-routes.md`
- Provider/operator runbook: `docs/sops/sop_provider_incident_response.md`

Non-negotiables for this rollout:
- Preserve current `ReferenceGrid` user-visible loading and retry UX behavior.
- Keep `/api/fal/*` response contracts backward-compatible.
- Keep billing reservation/capture/release semantics unchanged and idempotent.

Planned reliability module boundaries:
- `frontend/lib/server/falIntegration/contracts.ts`
- `frontend/lib/server/falIntegration/modelProfiles.ts`
- `frontend/lib/server/falIntegration/submitEngine.ts`
- `frontend/lib/server/providerIntegration/statusProviderSelection.ts`
- `frontend/lib/server/falIntegration/falAdapter.ts`
- `frontend/lib/server/falIntegration/stateMachine.ts`
- `frontend/lib/server/falIntegration/parity.ts`
- `frontend/lib/server/falIntegration/reconciler.ts`
- `frontend/lib/server/falIntegration/circuitBreaker.ts`

## Default model params (source of truth: modelCatalog.ts surfaced via modelRegistry.ts)
| Model | Defaults | Notes |
| --- | --- | --- |
| fal/flux-2 / -pro | Aspect: 4:3 (allowed: 1:1, 4:3, 3:4, 16:9, 9:16) | Uses Fal size map for per-MP pricing; safety checker off by default (Pro also sets tolerance 5). |
| fal-ai/flux-2/klein/9b | Aspect: 4:3 (allowed: 1:1, 4:3, 3:4, 16:9, 9:16) | FLUX.2 Lite pricing is `$0.006/MP` with exception rounding (`ceil(markedCredits)`, no nearest-5); safety checker off by default. |
| fal/flux-2/edit | Aspect: 4:3 default (allowed: 1:1, 4:3, 3:4, 16:9, 9:16) | Fal image-to-image/edit queue; requires references; pricing uses `$0.012/MP` over output MP plus normalized `1 MP` input basis; safety checker off by default. |
| fal-ai/nano-banana | Aspect: 1:1 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Fal text-to-image queue; flat per-image pricing ($0.039 -> 5 credits after 5-credit rounding). |
| fal-ai/nano-banana/edit | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Fal image-to-image/edit queue; requires reference `image_urls`; flat per-image pricing (5 credits). |
| fal-ai/nano-banana-2 | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16); Resolution: 1K default (allowed: 0.5K, 1K, 2K, 4K) | Fal text-to-image queue; per-image pricing starts at $0.08 with resolution multipliers (0.5K x0.75, 2K x1.5, 4K x2) and optional web-search surcharge (+$0.015) before credit rounding. |
| fal-ai/nano-banana-2/edit | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16); Resolution: 1K default (allowed: 0.5K, 1K, 2K, 4K) | Fal image-to-image/edit queue; requires reference images; pricing mirrors Nano Banana 2 text-to-image including resolution multipliers and web-search surcharge handling. |
| fal-ai/nano-banana-pro | Aspect: 4:5 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 4:5, 3:4, 2:3, 9:16, 1:1) | Fal text-to-image queue; base `$0.15` per image, `4K` doubles, web-search adds `$0.015`; with current markup/rounding policy default lane bills 20 credits. |
| fal-ai/nano-banana-pro/edit | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Fal image-to-image/edit queue; requires reference images; pricing mirrors Nano Banana Pro text-to-image (default lane 20 credits under current policy). |
| fal-ai/bytedance/seedream/v4.5/text-to-image | Aspect: 1:1 (broad set allowed) | Per-image pricing, 4K doubles cost; proxied via Fal queue with safety checker off by default. |
| fal-ai/bytedance/seedream/v4.5/edit | Aspect: 1:1 (broad set allowed) | Image-to-image/edit; requires reference images; safety checker off by default; per-image pricing. |
| fal-ai/bytedance/seedream/v5/lite/text-to-image | Aspect: 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9); Resolution: auto_2K default (allowed: auto_2K, auto_3K) | Fal text-to-image queue; per-image pricing at $0.035 with shared credit rounding (5 billed credits). |
| fal-ai/bytedance/seedream/v5/lite/edit | Aspect: 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9); Resolution: auto_2K default (allowed: auto_2K, auto_3K) | Fal image-to-image/edit queue; requires reference images (up to 10); pricing mirrors Seedream 5 Lite text-to-image. |
| fal-ai/kling-video/v3/pro/image-to-video | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 10s; Resolution: 1080p default (allowed: 720p, 1080p); `generate_audio: true` by default | Per-second pricing (`$0.112/s` audio-off, `$0.168/s` audio-on, `$0.196/s` with voice control). Image-to-video with required start image. |
| fal-ai/kling-video/v3/pro/text-to-video | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 10s; `generate_audio: true` by default | Per-second pricing (`$0.112/s` audio-off, `$0.168/s` audio-on, `$0.196/s` with voice control). Text-to-video with multi-shot support. |
| fal-ai/sora-2/text-to-video/pro | Aspect: 16:9 default (allowed: 16:9, 9:16); Duration: 8s default (queue accepts 4/8/12s); Resolution: 1080p; Audio: on | Per-second pricing by resolution (`720p = $0.30/s`, `1080p = $0.50/s`); proxied via Fal queue. |
| fal-ai/veo3.1/image-to-video | Aspect: auto default (allowed: auto, 16:9, 9:16); Duration: 8s; Resolution: 720p; Audio: on | Per-second pricing ($0.20/s audio-off, $0.40/s audio-on at 720p/1080p; 4K $0.40/$0.60). Requires a reference image; proxied via Fal queue. |
| fal-ai/veo3.1 | Aspect: 16:9 default (allowed: 16:9, 9:16); Duration: 8s; Resolution: 1080p; Audio: on | Per-second pricing (same tiers as before); proxied via Fal queue. |
| kie-ai/veo-3.1-fast-i2v | Aspect: 16:9 default (allowed: 16:9, 9:16); Duration: 5s default (allowed: 5, 8); Resolution: 720p default (allowed: 720p, 1080p); Audio: on | Kie image-to-video queue; fixed `$0.30` per generation from Kie credits conversion evidence (default billed 35 credits under current policy). |
| kie-ai/kling-3.0 | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 10s default (allowed: 5, 10); Resolution: 1080p default (allowed: 720p, 1080p); Audio: on | Kie image-to-video queue; per-second pricing by resolution: `1080p` `$0.20/$0.135` (audio on/off), `720p` `$0.15/$0.10` (audio on/off); default lane bills 210 credits under current policy. |
| fal-ai/bytedance/seedance/v1.5/pro/text-to-video | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9); Duration: 10s; Resolution: 1080p; Audio: on | Token-based pricing (~$0.26 per 720p 5s video with audio); proxied via Fal queue. |
| fal-ai/bytedance/seedance/v1.5/pro/image-to-video | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9); Duration: 5s; Resolution: 720p; Audio: on | Token-based pricing; requires a reference image; supports start & end frames; proxied via Fal queue. |
| gpt-5-nano | Aspect: n/a; Token-based | Used for prompt refine + describe flows. |

## Standard SOP skeleton (apply to new/updated SOPs)
1. Scope (what flows, what is out of scope).
2. Key components (files + roles) — link to the shared primitives above instead of duplicating code.
3. Prerequisites (keys, env vars, ledger/debit expectations).
4. Workflow (inputs → submission → polling → output handling → charging behavior).
5. Reference handling (if applicable).
6. Costing defaults (reference `computeCostForModel` + registry defaults).
7. Error handling & UX (banner states, disabled conditions).
8. Supported models (table) — sourced from the registry; note defaults/duration/audio as needed.
9. Upcoming/placeholder flows (note planned image-to-image/image-to-video/video-to-video details when ready).
10. Maintenance rules and tests to run.

## Coordination rules
- Add/modify SOPs in the vertical file, and add the link here if a new vertical is introduced.
- When changing model defaults or adding models, update `modelCatalog.ts`, `modelRegistry.ts`, pricing strategies, and the per-vertical SOP tables; avoid duplicating raw values elsewhere.
- Use this index to keep headings consistent across SOPs; keep shared info here and link out from the vertical docs.

## Upcoming flows (prep checklist)
- Image-to-Image: require at least one reference image; reuse Reference Grid/Studio Preview ingestion; clamp aspects using `allowedAspects` in `modelRegistry.ts`; document reference count limits per model.
- Image-to-Video: align duration/audio/aspect defaults with `modelRegistry.ts`; require a primary reference image; surface per-model reference requirements in disabled-state copy before enabling Generate.
- Video-to-Video: plan for source clip ingestion (drag/drop + file picker), aspect/duration/audio defaults from `modelRegistry.ts`, and per-second/per-frame pricing. Document whether trim/segment selection is supported and how costs are estimated (e.g., per-second of output or input).
