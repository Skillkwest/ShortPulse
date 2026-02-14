# SOP: Character Identity Pipeline (ShortPulse)

Archive status: moved from `docs/sops/sop_character_identity.md` on 2026-02-14; superseded by `docs/sops/sop_character_manager_operations.md`.

> Status: Legacy pipeline reference. For the active `/character` surface, use `docs/sops/sop_character_manager_operations.md`.

Purpose: operational steps to create, validate, and persist character identities for the Character tool. This SOP enforces the architectural guardrails: identity token for generation; embeddings only for analysis/validation.

## Pipeline (MVP)
1) Ingest references
- User drops or uploads images (target 5–20).
- Store object URLs in-memory; persist to IndexedDB after vetting.

2) Detect + align + score (analysis only)
- Run face detector (RetinaFace/BlazeFace ONNX via onnxruntime-web).
- Align faces; reject frames below quality thresholds (blur/occlusion/face count != 1).
- Compute ArcFace/AdaFace embeddings per accepted frame.

3) Vet references
- Keep top N (e.g., 6) based on quality score + embedding variance.
- Persist vetted refs + embeddings + quality metrics in IndexedDB (`characterId` key).

4) Create identity token
- Generate opaque token (UUID-like) after vetting completes.
- Persist `{identityToken, vettedRefs, quality}` locally (and mirror to Supabase if signed-in).

5) Generation contract
- Every generation request MUST include:
  - `identityToken`
  - 3–6 vetted reference URLs (or signed URLs if Fal rejects data:)
  - Optional `pose_keypoints` (ControlNet) for structure only
  - Style prompt
- Embeddings are NOT sent to the generator.

6) Reinforcement (star flow)
- User stars an output.
- Compute embedding for the output; compare to identity embeddings.
- Only if similarity passes threshold (tunable) -> append to vetted refs or update EMA embedding; token remains unchanged.

7) Storage rules
- Local-first (IndexedDB) for tokens, refs, embeddings, metrics, recent results.
- Supabase mirror is optional and never authoritative.
- Revoke object URLs on unmount; evict stale results per character.

## Phase 2 (adapter path)
- Train per-character LoRA/adapter off the vetted ref set.
- Store adapter handle alongside identity token; keep token stable.
- Generation uses adapter + token + refs (backward compatible).

## Required files/modules to wire
- `frontend/features/character/logic/identity.ts`: detection, scoring, token creation.
- `frontend/features/character/logic/storage.ts`: IndexedDB helpers (tokens/refs/embeddings/results).
- `frontend/features/character/hooks/useCharacterWorkflow.ts`: pass `identityToken` + refs in every payload; enforce vetting before generate.
- `frontend/lib/falClient.ts`: accept identityToken in payload; add pose-aware route when ready.
- `frontend/features/character/components/*`: show identity status, quality badge, token pill; star → reinforcement flow.

## Testing checklist
- References below quality thresholds are rejected; quality badge updates.
- Identity token created only after vetting; generate is disabled until then.
- Fal calls always include identity token + refs; pose optional.
- Starred output only reinforces when similarity check passes.
- Local-first persistence survives reload; Supabase mirror does not overwrite local state.
