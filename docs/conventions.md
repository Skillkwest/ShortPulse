# Code Conventions

Purpose: unify coding standards across the refactored codebase.

## File size and structure

- Aim to keep each file under ~500 lines; if it grows beyond that, note the reason and plan a split.
- Temporary exceptions above ~500 are allowed only with explicit rationale and a follow-up split plan.
- One responsibility per file; avoid mixed concerns (UI + data + logic).
- Pages should orchestrate; business logic lives in feature `logic/` or `utils/`.

## Comments and docs

- Every file: top-level comment with purpose/responsibility.
- Public exports: doc-style comment with purpose, inputs, outputs, and side effects.
- Inline comments: only for intent/edge cases, not restating code.

## Naming and organization

- Types/constants first, helpers next, components last within features.
- Prefer explicit, readable code over cleverness; small pure functions > large monoliths.
- Keep sample/fixture data in `data/`; avoid embedding in components/pages.

## Styling

- Use the modular CSS files under `styles/`; do not add rules to the aggregator.
- Choose the correct domain file; split when approaching size limits.
- Maintain import order in `globals.css`.

## Testing and safety

- Avoid destructive commands (resets) without explicit user request.
- Keep behavior identical during refactors unless requirements change.
- Fix defects in the canonical implementation path. Do not add workaround branches, shadow components, duplicate route surfaces, backup copies, fallback systems that mask failures, or legacy variants unless a documented migration or platform constraint requires them.
- Any temporary compatibility path must have a clear owner, removal condition, and validation that the canonical path remains the default behavior. Any durable alternate transport must have an authority contract that makes it the canonical path for that constraint.
- Add or run tests when touching business logic where feasible; document gaps.
