# AI Studio SOP Index (Text, Image, Video)

Purpose: provide a single hub for AI Studio SOPs, shared defaults, and the canonical structure for any new generation flow.

## Vertical SOPs
- Text generation: `docs/sop_text_generation.md` — prompt refinement and image-to-text describe flows.
- Image generation: `docs/sop_image_generation.md` — text-to-image today; will house image-to-image/image-to-video notes.
- Video generation: `docs/sop_video_generation.md` — text-to-video and image-to-video.

## Shared primitives (do not duplicate)
- Model metadata: `frontend/features/ai-studio/logic/modelRegistry.ts` (provider, mediaType, defaultAspect, allowedAspects, pricingStrategy, defaultDurationSeconds/resolution/audio).
- Pricing dispatcher: `frontend/features/ai-studio/logic/pricing.ts` (`computeCostForModel`, `buildDefaultPricingParams`).
- Pricing strategies: `frontend/features/ai-studio/logic/pricingStrategies.ts` (per-MP, per-image, per-duration).
- UI orchestration: `frontend/features/ai-studio/hooks/useAiStudioState.ts`, `frontend/pages/ai-studio.tsx`.
- Model picker + cost badges: `frontend/features/ai-studio/components/ModelModal.tsx` (uses registry defaults).

## Default model params (source of truth: modelRegistry.ts)
| Model | Defaults | Notes |
| --- | --- | --- |
| fal/flux-2 / -pro / -max | Aspect: 4:3 (allowed: 1:1, 4:3, 3:4, 16:9, 9:16) | Uses Fal size map for per-MP pricing. |
| fal/imagen4/preview/fast | Aspect: 1:1 (allowed: 1:1, 16:9, 9:16, 4:3, 3:4) | Flat per-image pricing. |
| google/nano-banana | Aspect: 1:1 (wide/portrait variants allowed) | Flat per-image pricing. |
| nano-banana-pro | Aspect: 4:5, Resolution: 1K default | 4K doubles cost; web-search surcharge optional. |
| seedream/4.5-text-to-image | Aspect: 1:1 (broad set allowed) | Per-image pricing, 4K doubles cost. |
| fal/kling-video-v1.6 (+text) | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 5s | Image-to-video requires reference; per-second pricing. |
| kling/v2-5-turbo-text-to-video-pro | Aspect: 16:9 default; Duration: 10s | Per-duration pricing (base 5s + increments). |
| kling-2.6/text-to-video | Aspect: 16:9 default (allowed: 1:1, 16:9, 9:16); Duration: 10s; Audio: on by default | Per-second pricing; audio flag matters. |
| veo3 | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 8s; Resolution: 1080p; Audio: on | Per-second pricing; 4K/audio-on is highest tier. |
| gpt-4.1-nano | Aspect: n/a; Token-based | Used for prompt refine + describe flows. |

## Standard SOP skeleton (apply to new/updated SOPs)
1. Scope (what flows, what is out of scope).
2. Key components (files + roles) — link to the shared primitives above instead of duplicating code.
3. Prerequisites (keys, env vars, ledger/debit expectations).
4. Workflow (inputs → submission → polling → output handling → debit timing).
5. Reference handling (if applicable).
6. Costing defaults (reference `computeCostForModel` + registry defaults).
7. Error handling & UX (banner states, disabled conditions).
8. Supported models (table) — sourced from the registry; note defaults/duration/audio as needed.
9. Upcoming/placeholder flows (note planned image-to-image/image-to-video/video-to-video details when ready).
10. Maintenance rules and tests to run.

## Coordination rules
- Add/modify SOPs in the vertical file, and add the link here if a new vertical is introduced.
- When changing model defaults or adding models, update `modelRegistry.ts`, pricing strategies, and the per-vertical SOP tables; avoid duplicating the raw numbers elsewhere.
- Use this index to keep headings consistent across SOPs; keep shared info here and link out from the vertical docs.

## Upcoming flows (prep checklist)
- Image-to-Image: require at least one reference image; reuse Reference Grid/Studio Preview ingestion; clamp aspects using `allowedAspects` in `modelRegistry.ts`; document reference count limits per model.
- Image-to-Video: align duration/audio/aspect defaults with `modelRegistry.ts`; require a primary reference image; surface per-model reference requirements in disabled-state copy before enabling Generate.
- Video-to-Video: plan for source clip ingestion (drag/drop + file picker), aspect/duration/audio defaults from `modelRegistry.ts`, and per-second/per-frame pricing. Document whether trim/segment selection is supported and how costs are estimated (e.g., per-second of output or input).***
