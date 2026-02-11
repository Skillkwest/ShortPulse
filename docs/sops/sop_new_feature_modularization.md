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

## When to split files
- Approaching 300–500 lines or combining multiple responsibilities (e.g., data + UI + logic together).
- Shared logic used by multiple components belongs in `utils/` or `logic/`, not in pages.

## Updating docs
- If you add a new domain (feature or style family), append a short note to the relevant architecture doc.
