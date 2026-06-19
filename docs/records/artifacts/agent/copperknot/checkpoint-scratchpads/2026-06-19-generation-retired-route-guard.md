# 2026-06-19 Generation Retired-Route Guard

- Lane: Generation runtime/provider route hygiene after fresh deploy.
- Found: current Video SOP still described the retired `/api/upload-video` path as an older compatibility contract.
- Changed: Video SOP now names only the canonical motion-reference route pair.
- Hardened: `scripts/check_generation_pipeline_legacy_paths.mjs` now bans active generation code/docs from reintroducing `/api/upload-image`, `/api/upload-video`, or `/api/upload-audio`.
- Boundary: no UI/UX or runtime behavior change; this is source-of-truth and guardrail hardening only.
