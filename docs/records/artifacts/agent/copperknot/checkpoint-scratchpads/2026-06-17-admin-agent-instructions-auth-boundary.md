# 2026-06-17 Admin Agent Instructions Auth Boundary

- Selected clean admin control-plane seam supporting Create/Pulse and Creative Library runtime catalogs.
- Touched admin routes for built-in Styles, Create Pulse built-ins, Expert Edit presets, Standard system prompt, and style extraction prompt.
- Added route-owned admin auth verifier exception handling with `*.auth` labels before catalog or prompt reads/writes.
- Added focused tests proving auth verifier exceptions log and stop before downstream control-plane work.
- Validation passed: focused admin agent-instruction Vitest slice `36/36`, `npm -C frontend run type-check:touched`, `npm -C frontend run docs:check`, and `git diff --check` for touched files.
- Remaining proof boundary: production route parity still fails on retired-route exposure until deploy/alias surface changes.
