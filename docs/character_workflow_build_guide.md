# Character Workflow Build-Out Guide (ShortPulse)

Purpose: living checklist to take the current Character tool from rough UI to production-ready, identity-stable generation.

## Current baseline
- Frontend page at `/character` with properties panel + preview.
- References upload (drag/drop + file picker), minimal safety (disabled) to FLUX 2 Pro via Fal proxy.
- Identity builder stub (random embedding) with ready/building/error states.
- Results list + preview; styles aligned to AI Studio panels.

## Next steps (detailed)

1) Identity token pipeline (ArcFace ONNX for analysis, token for generation)
   - Add `onnxruntime-web` (WebGPU EP) and place ArcFace + face-detector weights in `public/models/character/`.
   - `buildEmbeddingFromReferences`: detect+align faces, compute embeddings per image, score quality, and filter low-quality refs.
   - Create a **character identity token** (opaque string/id) after reference vetting; DO NOT inject embeddings into generation. Persist token + vetted refs in IndexedDB.
   - Store embeddings only for analysis/validation (similarity checks, scoring, reinforcement), never as generation conditioning.
   - Show quality badge (faces counted, variance) beside identity status.

2) Pose control + ControlNet payload
   - Add a simple pose editor/viewer (skeleton picker + draggable keypoints).
   - Store pose JSON alongside generation request.
   - When backend/local runner supports keypoints: include `pose_keypoints` in payload and call a ControlNet OpenPose-enabled endpoint (SDXL/FLUX-compatible).
   - UI: show pose preview thumbnail and allow “lock pose” toggle.

3) Fal image payload compatibility
   - Verify Fal edit endpoints accept `data:` URLs; if not:
     - Add lightweight upload helper that writes dropped blobs to Supabase storage (private bucket) and returns signed URLs.
     - Swap `image_urls` to signed URLs before Fal submit.
   - Add retry/error UX if Fal rejects data URLs.

4) Export/import “character bundles” + identity reinforcement
   - Define bundle schema: `{identity, embedding, references (urls or data blobs), metadata, version}`.
   - Export: serialize to JSON + optional compressed binary for embeddings; download as `.sp-character`.
   - Import: parse, store in IndexedDB, and hydrate UI.
   - Add “star” action on results; before reinforcement, run similarity check (embedding vs identity) and only promote if high-confidence. Reinforcement updates reference set (or EMA), not the identity token.

5) Local WebGPU capability gate
   - Detect WebGPU + required features; hide “Local WebGPU” engine when unsupported.
   - Lazy-load local diffusion runner (MLC/wasm) only when toggled.
   - Fallback to Fal edge automatically on error; surface a toast explaining the fallback.

6) Storage + resilience
   - Add IndexedDB persistence for references, embeddings, and recent results (per character id).
   - Sync to Supabase when online; keep local-first to support offline prep.
   - Add cleanup of object URLs and eviction policy for cached generations.

7) UX polish
   - Add inline quality meter (face count, blur score).
   - Model/engine pill showing safety=off state and which identity token is applied.
   - Per-result metadata (model, seed, pose id) in the reel; add “similarity OK/Needs review” chips.

## Architectural guardrails (must-follow)
- Embeddings are for analysis/validation only; generation conditioning uses the identity token + a small vetted reference set (+ optional pose).
- Pose controls change structure, never identity.
- Local-first: characters, tokens, embeddings, refs live in IndexedDB; cloud sync is an optional mirror.
- Preserve forward compatibility: character objects must remain valid if/when we add per-character LoRA/adapter training.
- Follow the operational steps in `docs/sop_character_identity.md` for vetting, token creation, and reinforcement.

## File map to extend
- `frontend/features/character/logic/identity.ts`: swap stub for ArcFace detection+analysis, create identity token, vet references, store embeddings for validation only.
- `frontend/features/character/hooks/useCharacterWorkflow.ts`: wire pose, storage, capability gate, local/edge switch, identity token propagation in generation payloads.
- `frontend/features/character/components/CharacterPropertiesPanel.tsx`: add quality meter, pose picker, bundle export/import controls, identity-token pill.
- `frontend/features/character/components/CharacterPreview.tsx`: star/feedback actions, similarity status, metadata rail.
- `frontend/lib/falClient.ts`: add pose-aware payload once backend route exists (ControlNet/OpenPose).
- Storage helpers (new): `frontend/features/character/logic/storage.ts` (IndexedDB + Supabase mirror) for tokens/refs/embeddings/results.

## Testing checklist
- Drag/drop and upload references work; object URLs are revoked on unmount.
- Identity build succeeds with multiple images; shows “ready”.
- Fal edit calls succeed with references; text-only calls fall back to text-to-image endpoint.
- Capability gate hides local engine on unsupported browsers.
- Export/import round-trips a character bundle without data loss.
