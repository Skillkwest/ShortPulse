# SOP: Character Generation Workflow

Purpose: document the frontend-triggered character workflow so consistent identity generation can ship without backend dependencies.

## Scope
- Character tool in Pulse: identity ingest, embedding build, pose/style selection, and generation calls.
- Frontend-first; uses Fal edge proxy for inference by default with a Local WebGPU toggle planned for high-end devices.

## Flow
1) **Reference ingest**: user uploads 5–20 images. We store object URLs locally (IndexedDB planned) and show quality hints.  
2) **Identity build**: run embedding builder (stubbed in `features/character/logic/identity.ts`; swap for ArcFace ONNX/WebGPU). Status badges show idle → building → ready.  
3) **Pose/style**: optional pose preset + prompt text for styling.  
4) **Generation**: call Fal FLUX 2 Pro with safety off (`enable_safety_checker: false`, `safety_tolerance: 5`). If references exist, use the edit endpoint with `image_urls`; otherwise, text-to-image. Poll until URLs are returned, surface errors inline.  
5) **Feedback**: latest output is displayed; references stay available for the next run. Planned: star/rate to reweight embeddings, export/import “character bundles”.

## Data structures (client)
- `CharacterIdentity`: `{ id, name, embedding, embeddingStatus, references[], createdAt }`.
- `CharacterReference`: `{ id, url, name?, source }` where source is `upload|generated`.
- `CharacterGenerationResult`: `{ id, imageUrl, createdAt, modelId, requestId? }`.

## Models & engines
- Models: `fal/flux-2-pro`, `fal/flux-2-pro/edit`.
- Control: future ControlNet OpenPose hook (pose JSON placeholder exists).
- Safety: disabled/minimal on all Fal calls.
- Engines: `fal-edge` (default) and `local-webgpu` (beta placeholder).

## Files touched
- Feature scaffold: `frontend/features/character/*`.
- Page: `frontend/pages/character.tsx`.
- Styles: `frontend/styles/character.css` (imported via `globals.css`).
- Build-out guide: `docs/product/character_workflow_build_guide.md` (living checklist for next milestones).

## Next steps
- Replace stub embedding with ArcFace ONNX via `onnxruntime-web` (WebGPU EP).
- Persist identity and generations in IndexedDB + optional Supabase mirror.
- Add pose editor + ControlNet payload when backend/local runner is ready.
- Wire export/import of character bundles for portability.
