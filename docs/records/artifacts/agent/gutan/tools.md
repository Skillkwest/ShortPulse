# Gutan Tool Inventory

Purpose: track helper scripts and repeatable checks for Gutan's image-ingestion normalization work.

## Helper Scripts

- `bash scripts/ops/gutan/gutan_image_admission_inventory.sh`
  - Finds current image upload, normalization, and size-limit references in likely Gutan-owned product paths.
  - Verifies Gutan docs and artifact entrypoints exist.
  - Intended as a lightweight audit aid, not proof of correctness by itself.

## Targeted Validation Commands

Use these after image-admission implementation changes when the touched tests exist:

```bash
cd frontend
npm run test -- lib/server/__tests__/imageUploadNormalization.test.ts lib/adaptive-media/__tests__/localTranscode.test.ts features/ai-studio/logic/__tests__/mediaLibraryPanelApi.test.ts features/ai-studio/utils/__tests__/imageUpload.test.ts
```

Add Character Manager, Elements Manager, remote URL, and generated-reference tests as the implementation migrates those surfaces.

## Policy Source

- `docs/records/artifacts/agent/gutan/image-admission-policy.md`
  - Accepted Gutan policy for original preservation, derivative timing, animated image behavior, messaging, metadata, storage shape, and validation bar.
- `docs/records/artifacts/agent/gutan/image-admission-implementation-plan.md`
  - Phased build plan for implementation sequencing, files, tests, handoffs, and stop gates.

## Tool Rules

- Do not treat inventory grep output as complete by itself.
- Do not use or approve Supabase signed transform options or `/storage/v1/render/image/` URLs.
- Do not run broad repo-wide commands before generated-artifact safety checks.
- Do not use temporary env files or scratch output as source of truth.
- Do not add tools that mutate Supabase, Vercel, GitHub, or production config without explicit user approval and the correct owner lane.
