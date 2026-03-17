# SOP: Adding a New Feature or Module

Purpose: repeatable checklist to keep new work consistent with modular architecture and size limits.

## Checklist
1) **Scope**: Define the feature’s responsibility; avoid mixing concerns with existing modules.
2) **Create structure**: `features/<name>/types.ts`, `constants.ts`, `data/`, `utils/`, `logic/`, `components/`.
3) **Types first**: Add shared types/enums. Document each file’s purpose.
4) **Logic next**: Implement pure helpers in `utils/` or `logic/`; no React dependencies.
5) **UI last**: Build feature components; keep them presentational. Pages orchestrate state/fetching only.
6) **Styling**: Place CSS in the correct domain file under `styles/` (add a new file and import from `globals.css` if needed).
7) **Docs/comments**: Add top-level file comments and doc comments for public exports. Note side effects.
8) **Size guardrails (guideline)**: Aim for <500 lines; if a file grows beyond that, document why and plan a split.
9) **Tests**: Add or update tests for non-trivial logic; document gaps if skipping.
10) **Run/verify**: Basic lint/build as available; ensure imports are from feature modules (no circular deps).

## Extraction and modularization checklist (no-regression)
Use this section when splitting existing large files or refactoring hotspot seams.

1) **Lock contracts first**: Identify public props, API payload/response shapes, and event contracts that must not change.
2) **Characterize before refactor**: Add/confirm targeted behavior tests for the seam before extraction if coverage is weak.
3) **Slice narrowly**: One seam per PR; no cross-domain extraction in the same PR.
4) **Preserve behavior**: Refactor structure only; no intentional UX/API/behavior changes in modularization slices.
5) **Reduce coupling explicitly**: Record LOC/coupling reduction in PR notes or lane evidence packet.
6) **Run required gates**:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run check:architecture-boundary`
   - `npm -C frontend run check:size-budget`
   - `npm -C frontend run build`
   - targeted tests for touched seam
7) **Document rollback**: Include a clear revert path and trigger conditions before merge.
8) **Sync governance docs**: Update planning tracker/evidence artifacts and any impacted SOP/ADR references in the same slice.

## When to split files
- Approaching 300–500 lines or combining multiple responsibilities (e.g., data + UI + logic together).
- Shared logic used by multiple components belongs in `utils/` or `logic/`, not in pages.

## Updating docs
- If you add a new domain (feature or style family), append a short note to the relevant architecture doc.
