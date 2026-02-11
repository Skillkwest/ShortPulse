# Thresholds And Workflow

Use this file when running palette normalization passes that must stay visually stable.

## Recommended thresholds
- Ultra-safe pass (default): `rgb<=1`, `alpha<=0.03`
- Safe pass: `rgb<=2`, `alpha<=0.03`
- Accent-only strict pass: `rgb<=1`, `alpha<=0.02`

## Practical ordering
1. Background/container surfaces
2. Borders and subtle separators
3. Scrollbar thumbs and muted UI chrome
4. Accent borders and button gradients
5. Status chips (only if explicitly requested)

## Canonical value selection rules
- Prefer existing high-frequency values in current scope.
- Prefer token-backed values over raw literals.
- Prefer single base accent family (`#25a9bf` and variants) for AI Studio.

## Risk controls
- Replace in one file at a time.
- Keep diffs small.
- Re-check report after each pass before continuing.
