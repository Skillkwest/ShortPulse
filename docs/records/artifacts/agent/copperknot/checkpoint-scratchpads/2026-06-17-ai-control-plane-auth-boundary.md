# 2026-06-17 AI Control Plane Auth Boundary

- Selected clean row-4/row-13 seam after route parity stayed deploy-gated.
- Touched AI routes: built-in Styles, Expert Edit system presets, Create Pulse built-ins, style extraction, and style preview generation.
- Added route-owned auth verifier exception handling with `.auth` labels before catalog, extraction, billing, or provider work.
- Added focused tests proving auth verifier exceptions log and stop before protected downstream work.
- Validation passed: focused Vitest slice `30/30`, `npm -C frontend run type-check:touched`, `npm -C frontend run docs:check`, and `git diff --check` for touched files.
- Remaining proof boundary: production route parity still fails on retired-route exposure until deploy/alias surface changes.
