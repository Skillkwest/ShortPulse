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
| fal-ai/nano-banana | Aspect: 1:1 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 4:5, 3:4, 2:3, 9:16) | Fal text-to-image queue; flat per-image pricing ($0.039 ≈ 4 credits). |
| fal-ai/nano-banana-pro | Aspect: 4:5 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 4:5, 3:4, 2:3, 9:16, 1:1) | Fal text-to-image queue; per-image flat pricing ($0.15 ≈ 15 credits, 4K doubles, web-search adds 1.5 credits). |
| fal-ai/bytedance/seedream/v4.5/text-to-image | Aspect: 1:1 (broad set allowed) | Per-image pricing, 4K doubles cost; proxied via Fal queue with safety checker on. |
| fal-ai/kling-video/v2.5-turbo/pro/image-to-video | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 10s | Fal image-to-video queue; per-duration pricing (base 5s + increments) with a required reference image. |
| fal-ai/kling-video/v2.6/pro/text-to-video | Aspect: 16:9 default (allowed: 1:1, 16:9, 9:16); Duration: 10s; `generate_audio: true` by default | Per-second pricing (`$0.14/s` with audio, `$0.07/s` without); defaults to 10s and includes audio. |
| fal-ai/sora-2/text-to-video/pro | Aspect: 16:9 default (allowed: 16:9, 9:16); Duration: 8s default (queue accepts 4/8/12s); Resolution: 1080p; Audio: on | Per-second tiered pricing (uses 10s high-tier rates by default); proxied via Fal queue. |
| fal-ai/veo3.1 | Aspect: 16:9 default (allowed: 16:9, 9:16, 1:1); Duration: 8s; Resolution: 1080p; Audio: on | Per-second pricing (same tiers as before); proxied via Fal queue. |
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
