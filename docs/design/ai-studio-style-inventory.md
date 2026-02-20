# AI Studio Style Inventory

Purpose: provide a single baseline reference for AI Studio colors and typography before rolling palette standards across the whole product.

Last updated: 2026-02-11

## Scope
- CSS sources: all `frontend/styles/ai-studio-*.css` files (13 total).
- Inline style sources: `frontend/features/ai-studio/**/*.tsx` (color/font-size literals only).
- Exhaustive generated inventories:
  - `docs/design/ai-studio-color-inventory.tsv` (all CSS color literals).
  - `docs/design/ai-studio-inline-color-inventory.tsv` (all inline TSX color literals).
  - `docs/design/ai-studio-typography-inventory.tsv` (all CSS font-family and font-size declarations).

## Snapshot
- AI Studio CSS colors: `366` unique values across `748` references.
- AI Studio inline TSX colors: `10` unique values across `12` references.
- AI Studio CSS font-size values: `17` unique values across `134` references.
- Primary text stack in AI Studio: `Inter` (via `--font-primary` / `--font-secondary` from `frontend/styles/foundation.css`).

## Stylesheet List
| Stylesheet | Used For | Dominant Palette Signals | Font Sizes Found |
| --- | --- | --- | --- |
| `frontend/styles/ai-studio-layout.css` | Page shell, hero strip, toolbar, 3-column layout | Neutral dark surfaces + cyan, plus tool-mode gradients (blue/cyan, magenta/warm, emerald, violet) | `10px`, `11px`, `12px`, `14px`, `18px`, `var(--ai-toolbar-font-size)`, `var(--ai-toolbar-label-size)` |
| `frontend/styles/ai-studio-canvas.css` | Reference grid, preview surfaces, canvas cards | `#f5f9ff`, `#ffecec`, cyan accent glows, dark panels | `11px`, `12px`, `13px`, `14px`, `20px` |
| `frontend/styles/ai-studio-controls.css` | Step cards, toggles, aspect/model selectors | Amber/orange action gradients, cyan secondary accents | `10px`, `12px`, `13px`, `14px`, `16px`, `18px`, `19px` |
| `frontend/styles/ai-studio-reference-properties.css` | Reference dropzones, frame/model controls, reference prompt capture | Cyan interaction states + neutral surfaces + amber/success chips | `12px`, `13px`, `14px`, `16px` |
| `frontend/styles/ai-studio-prompts.css` | Prompt mode toggles, prompt inputs, prompt editing | Dark neutral controls, cyan focus states, amber mode pills | `11px`, `12px`, `13px` |
| `frontend/styles/ai-studio-prompt-actions.css` | Prompt CTAs, prompt library/media utility actions | Cyan CTA gradients + dark glass surfaces | `12px`, `12.5px`, `13px`, `18px` |
| `frontend/styles/ai-studio-model-picker.css` | Model picker button, model modal, chips, tooltips | Dark neutrals + cyan borders/glows + light text | `11px`, `12px`, `13px`, `15px`, `18px` |
| `frontend/styles/ai-studio-history.css` | Presets, history cards, status chips, inline errors | Neutral cards + cyan hover + blue info + red error | `12px`, `13px` |
| `frontend/styles/ai-studio-properties.css` | Properties panel scaffolding and controls | Neutral form surfaces + cyan focus rings | `13px`, `14px` |
| `frontend/styles/ai-studio-modals.css` | Reference/detail modal overlays and modal actions | Dark glass overlays + white alpha layers + cyan and red state accents | `10px`, `11px`, `12px`, `13px`, `14px`, `15px`, `16px`, `24px` |
| `frontend/styles/ai-studio-coming-soon.css` | Placeholder cards for templates/workflows/gallery | Neutral dark cards + soft slate text | `11px`, `14px`, `18px` |
| `frontend/styles/ai-studio-text-properties.css` | Text-panel mode toggles/actions/generate row | Reuses neutral dark toggle surface tokens | none |
| `frontend/styles/ai-studio-responsive.css` | AI Studio media-query adjustments only | Layout-only (no palette declarations) | none |

## Core Palette Tokens
### Foundation tokens consumed by AI Studio
| Token | Value | Typical Use in AI Studio |
| --- | --- | --- |
| `--color-bg` | `#0f1115` | Global AI Studio page background (`.ai-studio-body`) |
| `--color-panel` | `#1c1f20` | Base panel tone shared across workspace styling |
| `--color-teal` | `#25a9bf` | Brand accent base feeding AI accents |
| `--color-amber` | `#f5b942` | Warm action/warning family anchor |
| `--color-ash` (+ alpha variants) | `#c9cdd6`, `rgba(...)` | Neutral text, borders, and soft separators |
| `--font-primary` | `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | Default UI font stack |
| `--font-secondary` | same as primary | Secondary input/prompt text where explicitly set |

### AI Studio local tokens
| Token | Value | Use |
| --- | --- | --- |
| `--ai-accent-base` | `#25a9bf` | Global AI Studio accent knob |
| `--ai-accent-start` / `--ai-accent` / `--ai-accent-strong` | `var(--ai-accent-base)` | CTA and chip gradients |
| `--ai-accent-shadow` | `rgba(52, 201, 255, 0.176)` | Accent glow/shadow layer |
| `--ai-card-text` | `#7c828a` | Primary muted body text in studio chrome |
| `--ai-card-text-muted` | `#666c74` | Secondary helper text |
| `--ai-card-text-faint` | `#555b63` | Faint/inactive text |
| `--ai-container-card-bg` | `rgba(201, 205, 214, 0.02)` | Card surface overlay |
| `--ai-container-card-border` | `rgba(201, 205, 214, 0.02)` | Low-contrast card border |
| `--ai-dropzone-bg` | `rgb(14, 16, 19)` | Dropzone base fill |
| `--ai-dropzone-bg-hover` | `rgba(22, 26, 30, 0.95)` | Dropzone hover fill |
| `--ai-toolbar-font-size` | `12px` | Toolbar copy size |
| `--ai-toolbar-label-size` | `14px` | Toolbar label size |
| `--ai-toolbar-font-weight` | `100` | Toolbar label weight |

### Reference panel tokens
| Token | Value | Use |
| --- | --- | --- |
| `--reference-drop-border` | `1px dashed rgba(160, 170, 182, 0.45)` | Default reference dropzone border |
| `--reference-drop-border-hover` | `rgba(37, 169, 191, 0.55)` | Hover border |
| `--reference-drop-border-active` | `rgba(37, 169, 191, 0.95)` | Active border |
| `--reference-drop-shadow-active` | `0 0 0 2px rgba(37, 169, 191, 0.25)` | Active glow ring |
| `--reference-drop-bg` | `#101215` | Dropzone background |
| `--reference-drop-bg-hover` | `#16181b` | Hover background |

## Semantic Palette Groups
| Palette Group | Representative Colors | Used For |
| --- | --- | --- |
| Neutral surfaces/text | `#0f1115`, `#131518`, `rgba(12, 15, 22, 0.9)`, `rgba(201, 205, 214, 0.12)`, `#f5f9ff` | Panels, cards, modals, text, outlines |
| Brand accent (cyan/teal) | `#25a9bf`, `rgba(37, 169, 191, 0.25/.35/.6)`, `#22d3ee`, `#06b6d4` | Focus, selected states, CTA gradients, toolbar emphasis |
| Warm action (amber/orange) | `rgba(245, 185, 66, 0.9)`, `rgba(255, 140, 66, 0.8/.9)`, `#f4921f`, `#f5b754`, `#f6a637` | Generate actions, highlight chips, warm callouts |
| Error/destructive | `#f15454`, `#ffecec`, `#ffb6b6`, `rgba(241, 84, 84, ... )`, `rgba(255, 90, 90, ... )` | Error banners, destructive buttons, inline failure states |
| Success/ready | `#6ee7b7`, `rgba(4, 183, 135, 0.96)`, `rgba(14, 213, 100, 0.658)` | Success chips and confirmation cues |
| Info/secondary highlight | `rgba(76, 140, 255, 0.12/.35)`, `#cfe4ff`, `rgba(76, 225, 255, 0.08)` | History/info chips and secondary status tags |
| Tool-mode gradients (toolbar) | Create/Kling: `#2563eb -> #06b6d4 -> #22d3ee`; Edit: `#e10328 -> #f43f5e -> #fbbf24`; Video: `#992ac9 -> #433aa9`; Canvas: `#0f766e -> #059669 -> #34d399` | Primary mode buttons and active/hover differentiation |

## Typography Inventory
### Font family usage in AI Studio CSS
| Font Family Value | Occurrences | Files | Used For |
| --- | --- | --- | --- |
| `var(--font-primary)` | 1 | `frontend/styles/ai-studio-modals.css` | Explicit modal text inheritance from global primary stack |
| `var(--font-secondary)` | 1 | `frontend/styles/ai-studio-prompts.css` | Prompt input styling |
| `var(--font-mono, monospace)` | 1 | `frontend/styles/ai-studio-modals.css` | Code/metadata-like modal field |
| `inherit` | 5 | prompts/modals/canvas stylesheets | Reuse parent stack (generally Inter) |

### Font size scale in AI Studio CSS
| Font Size | Declarations | Files Using It | Typical Use |
| --- | --- | --- | --- |
| `10px` | 5 | 3 files | Micro metadata, badges, smallest helper labels |
| `11px` | 12 | 6 files | Tiny labels, subtler hints, compact metadata |
| `12px` (`+ !important`) | 40 | 8 files | Chips, control labels, compact action text |
| `12.5px` | 1 | 1 file | One CTA variant (`ai-studio-prompt-actions.css`) |
| `13px` | 32 | 9 files | Core body/control copy across AI Studio |
| `14px` (`+ !important`) | 21 | 7 files | Standard panel text and control rows |
| `15px` | 4 | 2 files | Emphasized modal/model card text |
| `16px` (`+ !important`) | 6 | 3 files | Section titles/subheadings |
| `18px` | 5 | 5 files | Stat values, larger CTA/title lines |
| `19px` | 1 | 1 file | Large primary action button text |
| `20px` | 1 | 1 file | Prominent canvas heading treatment |
| `24px` | 2 | 1 file | Modal hero/close treatment |
| `var(--ai-toolbar-font-size)` | 1 | 1 file | Toolbar body text |
| `var(--ai-toolbar-label-size)` | 3 | 1 file | Toolbar labels |

## Inline Style Exceptions (TSX)
These are AI Studio component literals outside the CSS modules and should be folded into tokens/classes during standardization.

| File | Literal Colors / Sizes | Current Use |
| --- | --- | --- |
| `frontend/features/ai-studio/components/CharacterPanel.tsx` | `#06b6d4`, `rgba(6, 182, 212, 0.08)`, `rgba(6, 182, 212, 0.2)`, `16px/14px/13px` | Placeholder Character card icon and info callout |
| `frontend/features/ai-studio/components/KlingComingSoonCard.tsx` | `#22d3ee`, `rgba(6, 182, 212, 0.08)`, `rgba(6, 182, 212, 0.2)`, `13px` | Kling coming-soon icon and callout |
| `frontend/features/ai-studio/components/ReferenceGenerateStep.tsx` | `#FEF3C7`, `#FCD34D`, `#92400E`, `12px` | Inline warning banner in generate step |
| `frontend/features/ai-studio/components/AiStudioPageContent.tsx` | `11px` | Inline eyebrow text sizing |

## Full Inventory Files
- Full CSS color list (all values, counts, file coverage): `docs/design/ai-studio-color-inventory.tsv`
- Full inline TSX color list: `docs/design/ai-studio-inline-color-inventory.tsv`
- Full CSS typography list: `docs/design/ai-studio-typography-inventory.tsv`
