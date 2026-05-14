# D-Bug Tools

Purpose: record helper commands, inspection patterns, and validation habits that support D-Bug's debugging workflow.

## Preferred commands

- Fast text search:
  - `rg "<pattern>" frontend docs`
- Fast file discovery:
  - `rg --files frontend docs`
- Targeted type or lint/build checks:
  - `cd frontend && npm run test -- <file-or-pattern>`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
- Frontend startup:
  - `cd frontend && npm run dev`

## Debugging habits

- Prefer targeted commands over repo-wide sweeps when the failing surface is known.
- Prefer targeted test files or patterns before full-suite reruns when the failing lane is narrow.
- Distinguish observed evidence from root-cause inference in reports.
- Validate the exact failing path when practical instead of relying only on static inspection.

## Future additions

- Capture recurring repro commands and focused scripts after real runs establish them.
