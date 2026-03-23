# Thresholds And Workflow

Use this file when running palette normalization passes that must stay visually stable.

## Recommended thresholds
- Ultra-safe pass (default): `rgb<=1`, `alpha<=0.03`
- Safe pass: `rgb<=2`, `alpha<=0.03`
- Accent/status strict pass: `rgb<=1`, `alpha<=0.02`

## Practical ordering
1. Background/container surfaces
2. Borders and subtle separators
3. Scrollbar thumbs and muted UI chrome
4. Shared accent borders and buttons (token-backed surfaces)
5. Inline TSX literals (only after CSS scope review)
6. Status chips (only if explicitly requested)
7. Mode-specific gradients/themes (only if explicitly requested)

## Canonical value selection rules
- Prefer token-backed values over raw literals.
- For panel/base tones, use runtime `--color-panel` authority from `frontend/styles/foundation.css`.
- Preserve intentionally distinct mode/theme palettes (Create/Edit/Video/Canvas) unless the user explicitly requests convergence.
- Prefer existing high-frequency values only after token and semantic checks pass.
- Keep semantic status colors (`success`, `warning`, `error`, `info`) in their own groups.

## Risk controls
- Replace in one file at a time.
- Keep diffs small.
- Re-check report after each pass before continuing.
- Keep CSS and inline replacement plans reported separately.
