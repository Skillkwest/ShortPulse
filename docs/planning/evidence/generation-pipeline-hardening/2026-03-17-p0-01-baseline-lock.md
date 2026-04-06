# Generation Pipeline Hardening Evidence Packet: P0-01 Baseline Lock

- `slice_id`: `P0-01`
- `date_utc`: `2026-03-17`
- `phase`: `P0`
- `surface`: `baseline lock`

## commands_run
1. `git rev-parse HEAD`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`
6. `npm -C frontend run test`
7. repo-local inventory pass over `frontend/lib/model-runtime/modelCatalog.ts` for current `payloadValidation` keysets

## results
1. Repo SHA: `69fe49c445901467990e2baf7cab1ecbbef3cb87`
2. `lint`: pass with baseline `2` warnings and no errors
3. `type-check`: pass
4. `build`: pass
5. `docs:check`: pass
6. `test`: pass (`416` files, `2626` tests)
7. Track P1 baseline is green and ready for `P1-01`

## failure_codes_asserted
1. None in `P0-01`; this slice captures baseline posture only.

## contract_parity_delta
1. No behavior or enforcement change in `P0-01`.
2. Current payload-contract baseline snapshot from `frontend/lib/model-runtime/modelCatalog.ts` includes `25` models with `payloadValidation`.
3. Current model keyset inventory:
   - `fal-ai/flux-2/klein/9b`: `prompt`, `output_format`, `sync_mode`, `enable_safety_checker`, `num_images`, `num_inference_steps`, `seed`, `guidance_scale`
   - `fal/flux-2`: `prompt`, `output_format`, `sync_mode`, `enable_safety_checker`, `num_images`, `num_inference_steps`, `seed`, `guidance_scale`
   - `fal/flux-2/edit`: `prompt`, `image_urls`, `output_format`, `sync_mode`, `enable_safety_checker`, `num_images`, `num_inference_steps`, `seed`, `guidance_scale`
   - `fal/flux-2-pro`: `prompt`, `output_format`, `safety_tolerance`, `sync_mode`, `enable_safety_checker`, `num_images`, `seed`, `guidance_scale`, `num_inference_steps`
   - `fal/flux-2-pro/edit`: `prompt`, `image_urls`, `output_format`, `safety_tolerance`, `sync_mode`, `enable_safety_checker`, `num_images`, `seed`, `guidance_scale`, `num_inference_steps`
   - `fal-ai/flux-pro/v1/fill`: `prompt`, `image_url`, `mask_url`, `output_format`, `safety_tolerance`, `sync_mode`, `enhance_prompt`, `num_images`, `seed`
   - `fal-ai/bria/background/remove`: `image_url`, `sync_mode`
   - `fal-ai/nano-banana`: `prompt`, `aspect_ratio`, `output_format`, `sync_mode`, `limit_generations`, `num_images`, `seed`
   - `fal-ai/nano-banana/edit`: `prompt`, `image_urls`, `aspect_ratio`, `output_format`, `sync_mode`, `limit_generations`, `num_images`, `seed`
   - `fal-ai/nano-banana-2`: `prompt`, `aspect_ratio`, `output_format`, `resolution`, `num_images`, `seed`
   - `fal-ai/nano-banana-2/edit`: `prompt`, `image_urls`, `aspect_ratio`, `output_format`, `resolution`, `num_images`, `seed`
   - `fal-ai/nano-banana-pro`: `prompt`, `aspect_ratio`, `output_format`, `resolution`, `num_images`, `seed`
   - `fal-ai/nano-banana-pro/edit`: `prompt`, `image_urls`, `aspect_ratio`, `output_format`, `resolution`, `num_images`, `seed`
   - `fal-ai/bytedance/seedream/v4.5/text-to-image`: `prompt`, `output_format`, `sync_mode`, `enable_safety_checker`, `num_images`, `max_images`, `seed`
   - `fal-ai/bytedance/seedream/v4.5/edit`: `prompt`, `image_urls`, `sync_mode`, `enable_safety_checker`, `num_images`, `max_images`, `seed`
   - `fal-ai/bytedance/seedream/v5/lite/text-to-image`: `prompt`, `sync_mode`, `enable_safety_checker`, `num_images`, `max_images`, `seed`
   - `fal-ai/bytedance/seedream/v5/lite/edit`: `prompt`, `image_urls`, `sync_mode`, `enable_safety_checker`, `num_images`, `max_images`, `seed`
   - `fal-ai/kling-video/v3/pro/text-to-video`: `prompt`, `aspect_ratio`, `generate_audio`, `duration`, `cfg_scale`
   - `fal-ai/kling-video/v3/pro/image-to-video`: `prompt`, `start_image_url`, `aspect_ratio`, `generate_audio`, `duration`, `cfg_scale`
   - `fal-ai/veo3.1`: `prompt`, `aspect_ratio`, `duration`, `resolution`, `generate_audio`, `auto_fix`, `enable_safety_checker`, `seed`, `safety_tolerance`
   - `fal-ai/veo3.1/image-to-video`: `prompt`, `image_url`, `image_urls`, `aspect_ratio`, `duration`, `resolution`, `generate_audio`, `auto_fix`, `enable_safety_checker`, `seed`, `safety_tolerance`
   - `fal-ai/veo3.1/first-last-frame-to-video`: `prompt`, `first_frame_url`, `last_frame_url`, `aspect_ratio`, `duration`, `resolution`, `generate_audio`
   - `fal-ai/bytedance/seedance/v1.5/pro/text-to-video`: `prompt`, `aspect_ratio`, `resolution`, `generate_audio`, `enable_safety_checker`, `cfg_scale`
   - `fal-ai/bytedance/seedance/v1.5/pro/image-to-video`: `prompt`, `image_url`, `image_urls`, `aspect_ratio`, `resolution`, `generate_audio`, `duration`, `cfg_scale`

## rollback_note
1. Revert this packet and the associated execution-plan/tracker status updates together if Track P1 baseline must be re-captured against a different repo SHA.
2. Treat the captured keyset inventory as historical baseline evidence once `P1-01` introduces the shared contract utility.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - baseline lint warnings remain at `2` outside Track P1 scope
- `deferred`:
  - payload allowlist completeness and unknown-field enforcement are intentionally deferred to `P2-01` and `P3-01`

## parity_check
1. `pass`
2. `P0-01` is baseline-only; no request/queue behavior changed.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: no end-user or operator-facing behavior changed in `P0-01`; defer changelog consideration until the first enforcement slice lands.
