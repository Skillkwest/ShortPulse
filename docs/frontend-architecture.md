# Frontend Architecture

Purpose: describe how the frontend is structured after modularization so new work follows the same patterns.

## Top-level layout
- `pages/`: Route entry points. Keep them lean; orchestrate data + composed components.
- `components/`: Reusable UI elements shared across features (e.g., `PerformanceScatter`).
- `prefabs/{domain}/`: Prefab UI kits that need consistent styling across features (current: `prefabs/agent`).
- `features/{featureName}/`: Feature-scoped folders. Each feature owns its types, data, logic, utils, and components.
- `styles/`: Modular CSS files imported via `styles/globals.css`.
- `lib/`: Cross-cutting clients/helpers (e.g., `supabaseClient`).

## Feature module pattern (example: `features/performance`)
- `types.ts`: Shared TypeScript types/enums for the feature.
- `constants.ts`: Thresholds, labels, sample assets.
- `data/`: Fixtures or seed data (`data/sampleVideos.ts`).
- `utils/`: Pure helpers (`formatters.ts`, `statistics.ts`).
- `logic/`: Pure business logic (`scoring.ts`, `analytics.ts`).
- `components/`: Feature-scoped UI building blocks (`FilterBars`, `CompactVideoCard`, etc.).
- Page layer imports from these folders; no business logic should live directly in `pages/`.

## Prefabs (shared UI kits)
- Purpose: concentrate reusable, pre-styled building blocks so features don’t depend on each other.
- Location: `frontend/prefabs/<domain>/` with `buttons/`, `inputs/`, `panels/`, `types.ts`, and `index.ts` for exports (start with `prefabs/agent`).
- Styling: use `styles/prefabs-agent.css` (core) and `styles/prefabs-agent-variants.css` (compact/variant tweaks) imported in `styles/globals.css`.
- When to add: the same control/layout is used by multiple features or pages; aim for ~500 lines or less and document intent with top-level comments.

## Page responsibilities
- Import feature modules and shared components; avoid embedding data or helpers.
- Maintain small state orchestration; delegate rendering to feature components.
- Aim to keep files under ~500 lines by extracting new concerns into feature modules when practical.

## Adding a new feature
1) Create `features/<feature>/` with the folders above.
2) Define types/constants first, then utils/logic, then components.
3) Keep components presentational; let pages orchestrate state/fetching.
4) Add doc comments to new files and exported functions/components.

### AI Studio page (current state)
- Page remains the orchestration boundary (`frontend/pages/ai-studio.tsx`) and ongoing seam extraction continues to move prop composition and controller wiring into focused hooks under `frontend/features/ai-studio/hooks/`.
- Feature module includes types/constants, a state hook (`hooks/useAiStudioState`), and scoped components (toolbar, create/regen panels, aspect picker, Reference Grid surface, preview, anchored model modal, detail modal).
- CSS is split across `styles/ai-studio-*.css` (layout, canvas, controls, dropzones, properties, prompts, prompt-actions, model-picker, history, modals, responsive) imported via `globals.css`.
- Preview column remains hidden by CSS (`.studio-column { display: none; }`) so the Reference Grid can expand until the preview experience is finalized.
- Image regen/Image-to-video steps keep the primary + three secondary dropzones, each with hover “×” clear buttons and a header-level “Clear” action; prompt textarea stays drop-enabled and matches Create step sizing.
