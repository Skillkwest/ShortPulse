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
- Internal drag/drop intake: `docs/sops/sop_ai_studio_internal_drag_drop_intake.md` — canonical snapshot-first pattern for Reference Grid, Media Library, Styles, and Create composer internal drags, including degraded browser payload handling.
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
- Create runtime contract assembly now lives in `frontend/pages/ai-studio.tsx` plus `frontend/features/ai-studio/createRuntime/*`; active Create renders either `StandardCreateRuntimeRoot` or `PulseCreateRuntimeRoot` and then passes a discriminated `propertiesCreate` contract to page content.
- UI orchestration: `frontend/features/ai-studio/hooks/useAiStudioState.ts`, `frontend/pages/ai-studio.tsx`.
- Model picker + cost badges: `frontend/features/ai-studio/components/ModelModal.tsx` (uses registry defaults).
- Reference Grid performance controls: `frontend/features/ai-studio/components/ReferenceGrid.tsx` (virtualization + autoplay budget gating, plus local image/video/audio file intake into playable reference cards).
- Replay snapshot contract + guards: `frontend/features/ai-studio/logic/generationReplay.ts` (card-level re-roll eligibility and validation).
- Character panel layout contract: AI Studio owns the only live character-management surface through `frontend/features/ai-studio/components/CharacterPanel.tsx`, `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`, and `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`.
- Left-rail placement contract: `Characters` stays under `Libraries` in the AI Studio toolbar even though the embedded Character panel remains the only live character-management surface.

## Create startup model precedence

- Storage key remains `aiStudioWorkflowSettingsByTool.v1`.
- On Create workflow restore, startup model resolution is policy-driven:
  1. Keep saved model when it remains valid for current Create mode.
  2. For Create + Image when saved model is missing/invalid, default to `fal-ai/bytedance/seedream/v4.5/text-to-image`.
  3. Return `null` when no valid/default candidate exists for the active mode.

## Expert Edit rollout defaults

- Expert Edit is the only Edit workflow surface in AI Studio.
- Create has one supported Standard surface plus Pulse mode; there is no legacy fallback path.
- The left-rail `Dashboard` control exits AI Studio through hard navigation to `/dashboard` so users can always leave the studio even when client-side runtime state is degraded.
- Chat mode control is hidden/off in Expert Edit; inline Generate remains the primary action.
- Double-clicking image/video references in the Reference Grid or Quick Slot Inventory opens the shared detail modal; `Save` persists that media into `All Media` and renders to the left of `Download`.
- `Libraries -> Media Library` is a first-class left-panel tool (`media-library`) in AI Studio. The canonical panel runtime includes custom drag ghosts, root right-click ingest, and root delete semantics. Per-folder canvas spaces are always enabled for user-created folders, with independent camera/scene persistence through the active folder authority boundary: non-project surfaces use `/api/ai/media-folder-canvas/[folderId]` + `/api/ai/media-folder-canvas/save`, while project routes use `GET|PUT /api/projects/:projectId/media/folders/:folderId/canvas`. Target UX defines `All Media` as one master root folder with inline tabs (`All Media`, `Images`, `Videos`, `Prompts`) that organize content in-place. The mixed `All Media` tab now carries saved images, videos, audio, and prompts together, while audio also supports save/upload/root-drop/folder-drop flows through the same Media Library surface instead of a dedicated `Audio` tab. Near-bottom infinite scroll auto-load remains on media tabs with a global root media paginator footer retained as manual fallback, right-click media dispatch to Reference Grid, double-click preview-only modal behavior, and explicit folder membership move/assign semantics.
- `Libraries -> Elements` is a first-class left-panel tool (`elements`) in AI Studio. The embedded Elements panel now mirrors the Character panel shell: one top authoring workspace, a fixed embedded Media Library below, and a saved-elements modal opened from the top `Elements` button instead of a persistent left list. Elements do not expose `Looks`. The top workspace keeps `Name`, `Description`, and `Element References`, with the first two image reference slots required for first save while existing saved elements continue to autosave after edits.
- `Libraries -> Presets` opens one primary left-panel Presets Library with internal `Pulses` and `Prompt Presets` sections. The `Pulses` section is a merged catalog surface for per-user custom Pulses plus shared built-in guided workflows. Built-in workflow records are shared/admin-owned and are not editable from the user library, while custom Pulses remain user-created records that can be created, edited, and deleted. Guided `workflow_gpt` Pulses now persist authoritative workflow session state (`status`, current step, collected inputs, final artifact, completion source) so Create restore does not depend on transcript-only reconstruction.
- Custom Pulse authoring now centers on `Preset Name` and `System Instructions`; advanced runtime controls are not exposed in preset editors. A custom Pulse is a saved system-instruction preset, so any reusable prompt or artifact behavior must be requested directly inside those instructions.
- In Create `Pulse` mode, the inline left rail uses that same merged custom-plus-guided catalog with pinned preset chips, drag/drop from `More Presets`, editable saved custom pulses, and hidden preset activation that updates the active Pulse runtime without writing into the visible Create composer. `More Presets` also acts as an activation surface and pins the selected Pulse automatically, while `Libraries -> Presets -> Pulses` remains catalog-management only. When a built-in guided workflow is active, the server re-resolves its instructions from the admin control plane before runtime execution. When a Pulse is active, the Create topbar exposes an explicit `Deactivate Pulse` action. Switching back to `Standard` clears active Pulse ownership and keeps Pulse composer drafts, transcript state, workflow session, preset/session identity, and telemetry out of Standard runtime contracts. Switching, restarting, or deactivating a Pulse starts a fresh Pulse session.
- The `Prompt Presets` section inside `Libraries -> Presets` is sourced from the Expert Edit preset catalog with `Custom 1`, `Custom 2`, and `Custom 3` placeholder tiles (including overrides) plus a full-size `Create New Preset` tile, keeps the right rail visible, supports modal create/edit for preset name + prompt text, and provides per-tile delete confirmation for permanent preset removal.
- `Sound -> Voice` keeps voice management inside the dedicated Voices panel: the main header owns the `Voices` modal trigger, while the modal header owns `Create New Voice` plus the selected-voice destructive action. Voice hydration still comes from `GET /api/elevenlabs/voices`, which now returns capability metadata and refreshes private saved voice-sample signed URLs so the modal can render protected built-ins/default catalog voices, local-only `Remove` actions for saved voices, and true provider `Delete` actions for user-created provider voices. `DELETE /api/elevenlabs/voices/:voiceId` follows the same server-authoritative contract for saved/provider cleanup. The selectable voice chip library lives inside that modal instead of the main panel body.
- `Sound -> Voice -> Create New Voice` now has two modal creation methods. `Generate Voice` preserves the existing Voice Design preview/select/save flow through `POST /api/elevenlabs/text-to-voice/design` and `POST /api/elevenlabs/text-to-voice/create`; save creates a short TTS sample with the new voice, stores it in the caller's private `voice-samples` namespace, and attaches that sample to the saved voice chip. `Clone Voice` is audio-only in v1: local audio samples stage through `POST /api/media/stage-voice-clone-source` under the caller's private `voice-clone/source-audio` namespace, while durable Reference Grid/internal audio can also reach clone creation through an existing trusted storage path. Clone mode requires inline permission confirmation, then submits the trusted `sourceStoragePath` to `POST /api/elevenlabs/voices/clone`, where ShortPulse validates and normalizes the audio into a provider-safe payload before the ElevenLabs instant voice cloning request, creates the same saved TTS sample, and returns sample-backed metadata for the Voices modal. Short samples are allowed; there is no app-enforced minimum-duration gate for voice clone samples. Clone mode intentionally does not reuse Voice Changer storage namespaces or `speech-to-speech` generation routes.
- `Sound -> Voice -> Voice Changer` uses one storage-first preparation flow in both local and deployed environments, but the initial staging adapter now differs by source type: dropped local video is written through `POST /api/upload-video` so the original clip lands on the repo's stable storage-only adapter before extraction, while dropped local audio is written through `POST /api/media/stage-voice-changer-source`. Dragging audio from the Reference Grid or Quick Slot Inventory follows the same source contract: durable/generated/library audio resolves through its storage path or trusted media URL, while same-session local audio references are converted back into a browser `File` and staged through the local audio adapter instead of sending `blob:` URLs downstream. Video sources are then converted into staged WAV audio through `POST /api/media/extract-audio`, and final conversion submits only the staged audio reference or trusted URL to `POST /api/elevenlabs/speech-to-speech`. When that staged audio came from video, the final generation lane hard-locks to the current ElevenLabs default speech-to-speech voice settings (`stability: 1`, `similarity_boost: 1`, `speed: 1`, `use_speaker_boost: true`) and hides the Voice Shaping panel instead of exposing per-run slider tuning, then remuxes the converted voice back onto the original video and publishes that derived video as a second Reference Grid output. Extraction rejects trusted-but-oversized staged videos before ffmpeg runs so local and Vercel follow the same bounded path. Final generation no longer accepts direct local multipart media uploads.
- Expert Edit generation behavior contracts (stage-camera-framed submit flatten for generate/manual, submit-scoped model overrides, Bria-only hidden replacement semantics, shared Flux Fill inpaint constants) are documented in `docs/sops/sop_image_generation.md` under `Expert Edit properties panel behavior`.
- Expert Edit markup pen/lasso behavior (shared inline+expanded state and unified session persistence; legacy eraser remains internal-only) is documented in `docs/sops/sop_image_generation.md` under `Expert Edit properties panel behavior`.
- Expert Edit prompt token behavior (`@img1..@img3`, deferred invalid warning on Generate, and submission compile mapping) is documented in `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`.

## Canvas interaction guardrails

- Canvas workspace internals remain dual-canvas-capable. The canonical AI Studio shell does not expose Canvas as a top-level workflow entry, but it does expose the shared right-rail Canvas panel through the top-right header toggle across the four primary workflows (`Create`, `Edit`, `Video`, `Sound`).
- The top-right AI Studio header keeps visible `Canvas`, `Quick Slot Inventory`, and `Reference Grid` toggles available across those four primary workflows. Single-click toggles those three right-rail surfaces independently, so any combination of them can be visible or hidden, including `none`. Double-clicking one of those header toggles enters an isolate mode for that surface only, and clicking the same toggle again or the eye restore control returns to the prior panel combination. `Canvas` controls the live right-rail canvas section rather than collapsing the entire rail. The right-rail Canvas section defaults off on first load.
- Draft-text and text-edit ownership are instance-scoped so double-click draft creation cannot be auto-cleared by the mirrored canvas instance.
- Empty-space text draft creation must remain single-create per gesture (native `dblclick` plus pointer/click fallbacks are deduped).

## Model modal ordering policy

- Source of truth: `frontend/features/ai-studio/components/ModelModal.tsx`.
- Model chips are ordered deterministically by context using provider-priority and model-priority maps.
- Model chips render in family columns after filtering/sorting so users can scan related lanes together (for example Seedream, Nano Banana, Veo, Kling, and Seedance).
- Current contexts with explicit ordering:
  - `text-image` (Create): ByteDance -> Google -> Black Forest Labs.
  - `character-image` (Create Character Mode): ByteDance -> Google -> Black Forest Labs.
  - `reference-image` (Edit): ByteDance -> Google -> Black Forest Labs.
  - `reference-video` (Video standard): Kie AI only.
  - `reference-keyframes`: Google DeepMind -> Kie AI.
- Video policy invariant:
  - `kie-ai/veo-3.1-fast-i2v` is the active Veo-family lane for text, single-image, and first/last-frame video generation.
  - `kie-ai/seedance-2` and `kie-ai/seedance-2-fast` are active Seedance 2 lanes for prompt-only, first-frame, first/last-frame, and multimodal reference generation.
  - Standard Video mode is Kie-only and surfaces `kie-ai/veo-3.1-fast-i2v`, `kie-ai/kling-3.0`, `kie-ai/seedance-2`, and `kie-ai/seedance-2-fast`.
  - Empty-standard-frame state defaults to Kie Veo text-to-video, but the modal still allows manual selection of Kie Kling and both active Seedance families; selecting Kling there makes the first frame required before Generate is enabled.
  - Kie Seedance 2 follows the Kling-pattern shot workspace and linked Character/Element surfaces, but submits Seedance-native frame/multimodal payload fields.
  - Kie Kling Standard exposes three product shot modes:
    - `Single`
    - `Multi`
    - `Custom`
  - `Single` and `Multi` both use the standard Kie single-shot Kling route with top-level `prompt`; `Custom` is the only true Kie multi-shot path and submits `multi_prompt[]`.

## Fal reliability rollout notes (v2 architecture)

- Primary tracker: `docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`
- Audit snapshot: `docs/archive/planning/ai-studio-generation-runtime-audit-2026-02-20.md`
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

| Model                                           | Defaults                                                                                                                                                                                                                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fal-ai/flux-2/klein/9b                          | Aspect: 4:3 (allowed: 1:1, 4:3, 3:4, 16:9, 9:16)                                                                                                                                                                                                             | FLUX.2 Lite pricing is `$0.006/MP`; final billed credits now come from the shared global policy plus any explicit per-model overrides in `/admin/pricing`; safety checker off by default.                                                                                                                                                                                                                                                                         |
| fal-ai/nano-banana-2                            | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16); Resolution: 1K default (allowed: 0.5K, 1K, 2K, 4K)                                                                                                                | Fal text-to-image queue; per-image pricing starts at $0.08 with resolution multipliers (0.5K x0.75, 2K x1.5, 4K x2) and optional web-search surcharge (+$0.015) before markup and credit ceiling.                                                                                                                                                                                                                                                                 |
| fal-ai/nano-banana-2/edit                       | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16); Resolution: 1K default (allowed: 0.5K, 1K, 2K, 4K)                                                                                                                | Fal image-to-image/edit queue; requires reference images; pricing mirrors Nano Banana 2 text-to-image including resolution multipliers and web-search surcharge handling.                                                                                                                                                                                                                                                                                         |
| fal-ai/nano-banana-pro                          | Aspect: 4:5 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 4:5, 3:4, 2:3, 9:16, 1:1)                                                                                                                                                                           | Fal text-to-image queue; base `$0.15` per image, `4K` doubles, web-search adds `$0.015`; with current conversion/markup policy default lane bills 16 credits.                                                                                                                                                                                                                                                                                                     |
| fal-ai/nano-banana-pro/edit                     | Aspect: auto default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16)                                                                                                                                                                    | Fal image-to-image/edit queue; requires reference images; pricing mirrors Nano Banana Pro text-to-image (default lane 20 credits under current policy).                                                                                                                                                                                                                                                                                                           |
| fal-ai/bytedance/seedream/v4.5/text-to-image    | Aspect: 1:1 (broad set allowed)                                                                                                                                                                                                                              | Per-image pricing, 4K doubles cost; proxied via Fal queue with provider safety checker enabled.                                                                                                                                                                                                                                                                                                                                                                   |
| fal-ai/bytedance/seedream/v4.5/edit             | Aspect: 1:1 (broad set allowed)                                                                                                                                                                                                                              | Image-to-image/edit; requires reference images; provider safety checker enabled; per-image pricing.                                                                                                                                                                                                                                                                                                                                                               |
| fal-ai/bytedance/seedream/v5/lite/text-to-image | Aspect: 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 9:16, 16:9, 21:9); Resolution: auto_2K default (allowed: auto_2K, auto_3K)                                                                                                                       | Fal text-to-image queue; per-image pricing at $0.035 (4 billed credits by default before per-model overrides); provider safety checker enabled.                                                                                                                                                                                                                                                                                                                   |
| fal-ai/bytedance/seedream/v5/lite/edit          | Aspect: 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9); Resolution: auto_2K default (allowed: auto_2K, auto_3K)                                                                                                                  | Fal image-to-image/edit queue; requires reference images (up to 10); pricing mirrors Seedream 5 Lite text-to-image; provider safety checker enabled.                                                                                                                                                                                                                                                                                                              |
| kie-ai/veo-3.1-fast-i2v                         | Aspect: 16:9 default (allowed: 16:9, 9:16); Duration: 5s default (allowed: 5, 8); Resolution: 720p default (allowed: 720p, 1080p); Audio: on                                                                                                                 | Active Kie Veo lane for text-to-video, single-image animation, and first/last-frame generation. Fixed `$0.40` per generation from current Kie pricing evidence (default billed 42 credits under current policy).                                                                                                                                                                                                                                                  |
| kie-ai/kling-3.0                                | Standard: Aspect 16:9 default (allowed: 16:9, 9:16, 1:1); Duration 10s default (allowed: 5, 10); Resolution 1080p default (allowed: 720p, 1080p); Audio: on. Motion: one character image + one motion video; Resolution 720p/1080p; Audio: on/off supported. | Active Kie Kling lane for Standard video and Motion Control. Standard mode exposes `Single`, `Multi`, and `Custom`: `Single` and `Multi` both use standard single-shot submit with a top-level prompt plus first frame and optional last frame; `Custom` uses Kie multi-shot submit with `multi_prompt[]` and first-frame-only image input. Motion is treated as a dedicated transfer workflow and no longer surfaces standard-video aspect or duration controls. |
| kie-ai/seedance-2                               | Aspect: 16:9 default (allowed: 1:1, 21:9, 4:3, 3:4, 16:9, 9:16); Duration: 5s default (allowed: 5, 10, 15); Resolution: 1080p default (allowed: 720p, 1080p); Audio: off; `return_last_frame`/`web_search`: off                                              | Active Seedance 2 lane for prompt-only, first-frame, first/last-frame, and multimodal Standard video generation. Reuses Kling-pattern shot prompts plus linked Character/Element slots in the panel, then compiles to Seedance-native prompt and `reference_*_urls` payloads.                                                                                                                                                                                     |
| kie-ai/seedance-2-fast                          | Aspect: 16:9 default (allowed: 1:1, 21:9, 4:3, 3:4, 16:9, 9:16); Duration: 5s default (allowed: 5, 10, 15); Resolution: 1080p default (allowed: 720p, 1080p); Audio: off; `return_last_frame`/`web_search`: off                                              | Active Seedance 2 Fast lane with the same Kling-pattern UI and Seedance-native payload compiler as Seedance 2, routed through the fast Kie model id.                                                                                                                                                                                                                                                                                                              |
| gpt-5.4-nano                                    | Aspect: n/a; Token-based                                                                                                                                                                                                                                     | Used for prompt refine + describe flows.                                                                                                                                                                                                                                                                                                                                                                                                                          |

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
