---
name: palette-normalizer
description: Audit AI Studio palette drift across CSS and inline TSX, detect near-duplicates with strict thresholds, and propose minimal-risk normalization plans that preserve semantic and mode-specific color intent.
---

# Palette Normalizer

Purpose: reduce palette drift with minimal visual risk by detecting near-identical colors first, then applying narrow, reversible replacements that preserve design intent.

## When to use
- You want to standardize colors without a visible redesign.
- You need a dry-run report before touching styles.
- You suspect the palette inventory docs are stale and want a scope/freshness gate before any normalization plan.

## Sources of truth
- `frontend/styles/foundation.css` (runtime token authority, including `--color-panel` and core brand tokens)
- `docs/styles-structure.md` (palette constraints + AI Studio layering/import authority)
- `docs/design/ai-studio-style-inventory.md` (AI Studio baseline inventory snapshot)
- `docs/design/ai-studio-color-inventory.tsv` (CSS color literals inventory)
- `docs/design/ai-studio-inline-color-inventory.tsv` (inline TS/TSX color literals inventory)
- `frontend/styles/ai-studio-*.css` (current AI Studio CSS scope)
- `frontend/features/ai-studio/**/*.tsx` (inline style literals)

## Workflow
1. **Scope + freshness gate (required first)**
   - Run:
     - `node skills/palette-normalizer/scripts/palette_scope_check.mjs --inventory docs/design/ai-studio-style-inventory.md --styles-root frontend/styles --max-age-days 30`
   - If this gate reports stale/mismatched scope, do not apply replacements until the user approves proceeding with stale inventory context.
2. **Inventory (dry-run only)**
   - CSS inventory:
     - `node skills/palette-normalizer/scripts/palette_report.mjs --root frontend/styles --glob 'ai-studio-*.css' --glob 'foundation.css' --rgb-threshold 1 --alpha-threshold 0.03 --json`
   - Inline AI Studio inventory:
     - `node skills/palette-normalizer/scripts/palette_report.mjs --root frontend/features/ai-studio --glob '**/*.tsx' --glob '**/*.ts' --rgb-threshold 1 --alpha-threshold 0.03 --json`
   - Capture totals, top colors, and near-duplicate clusters for both scopes.
3. **Classify semantic groups before mapping**
   - Shared neutral/base surfaces and borders.
   - Shared accent tokens (`--color-teal`, `--ai-accent-base` families).
   - Mode-specific gradients/themes (Create/Edit/Video/Canvas mode palettes).
   - Semantic status colors (success, warning, error, info).
4. **Propose mapping**
   - Propose `from -> to` only for near-identical values inside the same semantic group.
   - Canonical selection order:
     - token-backed value,
     - documented canonical palette value,
     - highest-frequency value (only if the first two are tied).
   - Keep thresholds strict:
     - neutrals: `rgb<=2`, `alpha<=0.03`
     - accents/mode/status: `rgb<=1`, `alpha<=0.02`
5. **Apply minimally**
   - Touch only approved, scoped files.
   - Prefer token aliases and existing CSS vars over new raw literals.
   - Include inline TSX replacements only when user explicitly approves inline changes.
6. **Validate + rollback path**
   - Report changed files, semantic groups touched, and diff size.
   - Provide one-command rollback path (`git restore -- <files...>`).

## Guardrails
- Default mode is report-only until user approves apply.
- Always run the freshness gate before proposing apply plans.
- Do not alter semantic status colors unless explicitly requested.
- Do not collapse intentional mode-specific gradients/themes into the global accent unless explicitly requested.
- Keep replacements local to target surface; avoid sweeping global rewrites.
- Prefer maintaining current luminance/contrast unless user asks for a directional shift.
- Treat CSS + inline inventories as separate scopes in reporting.

## Output format (recommended)
```
Palette normalization report
- Freshness gate: <PASS|WARN|FAIL> (<summary>)
- Scope: <css files + inline files>
- Dry-run thresholds: neutrals rgb<=X alpha<=Y | accents/status rgb<=X alpha<=Y
- Unique colors: <css N> / <inline N>
- Candidate merges: <css N> / <inline N>

Proposed mappings
- <from> -> <to> | group:<semantic-group> refs:<n> files:<list>

Apply plan
1) <file and exact replacements>
2) <file and exact replacements>

Rollback
- git restore -- <files...>
```
