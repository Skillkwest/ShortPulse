---
name: palette-normalizer
description: Inventory CSS color usage, detect near-duplicate palette values, and propose minimal-risk normalization patches using dry-run-first thresholds. Use when standardizing UI palettes, reducing color drift, or preparing safe visual consistency passes.
---

# Palette Normalizer

Purpose: reduce palette drift with minimal visual risk by finding near-identical colors first, then applying narrow, reversible replacements.

## When to use
- You want to standardize colors without visible redesign.
- You need a dry-run report before touching CSS.
- You are preparing a test pass that must be easy to roll back.

## Sources of truth
- `docs/design/ai-studio-style-inventory.md`
- `docs/design/ai-studio-color-inventory.tsv`
- `frontend/styles/ai-studio-*.css`
- `frontend/styles/foundation.css`

## Workflow
1. **Inventory (required first)**
   - Run dry-run inventory and cluster report:
     - `node skills/palette-normalizer/scripts/palette_report.mjs --glob 'ai-studio-*.css' --root frontend/styles --rgb-threshold 1 --alpha-threshold 0.03`
   - Capture: total refs, unique colors, high-frequency colors, near-duplicate clusters.
2. **Select safe scope**
   - Prioritize `background`, `container`, `border`, then `accent`.
   - Prefer replacing low-frequency variants with existing high-frequency values.
3. **Propose mapping**
   - Propose `from -> to` only when values are near-identical.
   - Keep thresholds strict:
     - neutrals: `rgb<=2`, `alpha<=0.03`
     - accents/buttons: `rgb<=1`, `alpha<=0.02`
4. **Apply minimally**
   - Touch only scoped CSS files.
   - Favor token aliases and existing vars over introducing raw new literals.
5. **Validate + rollback path**
   - Report changed files and diff size.
   - Always provide one-command rollback (`git checkout -- <files...>`).

## Guardrails
- Default mode is report-only until user approves apply.
- Do not alter semantic status colors unless explicitly requested.
- Keep replacements local to target surface; avoid sweeping global rewrites.
- Prefer maintaining current luminance/contrast unless user asks for a directional shift.

## Output format (recommended)
```
Palette normalization report
- Scope: <files>
- Dry-run thresholds: rgb<=X alpha<=Y
- Unique colors: N
- Candidate merges: N

Proposed mappings
- <from> -> <to> | refs:<n> files:<list>

Apply plan
1) <file and exact replacements>
2) <file and exact replacements>

Rollback
- git checkout -- <files...>
```
