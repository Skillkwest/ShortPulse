# Tooling & Framework Audit — 2026-02-16

Status: draft

Purpose: identify gaps in the current ShortPulse dependency set that can be filled with targeted, high-value packages. This document is a **research reference**, not an implementation plan. Each recommendation links to the codebase area it addresses and includes evaluation criteria so future agents can pick up any item without re-auditing.

Related docs:
- `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md` — existing ADR for media grid performance.
- `docs/planning/backlog.md` — backlog items referencing this audit.

---

## Current tech stack snapshot

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6, React 18.3.1, TypeScript 5.3.3 |
| Styling | Plain CSS modules + CSS custom properties (no Tailwind, no CSS-in-JS) |
| State | React hooks + SWR 2.2.4 (no global store) |
| Database | Supabase PostgreSQL + Supabase Auth + Supabase Storage |
| Payments | Stripe |
| AI providers | fal.ai (12+ models), OpenAI GPT-4.1 |
| Icons | Phosphor React 1.4.1 |
| Charts | Recharts 2.7.2 |
| Testing | Vitest 4.0.18, Testing Library, Playwright |
| ML (browser) | onnxruntime-web |

---

## Recommendations

### 1. Masonry layout — `react-masonry-css`

**Priority: High**
**Backlog reference: `docs/planning/backlog.md` → Research / Spikes → masonry layout engine**

| | |
|---|---|
| Package | [`react-masonry-css`](https://github.com/paulcollett/react-masonry-css) |
| Size | ~1.2 KB gzipped |
| License | MIT |

**Problem it solves:**
The media library packed grid (`frontend/styles/workspace-media.css`, class `.media-grid-packed`) uses CSS `column-width` + `break-inside: avoid`. This produces column-first ordering (items 1, 4, 7 in column 1; items 2, 5, 8 in column 2) instead of left-to-right reading order. For a chronologically-sorted media library this breaks user expectations — newest items don't flow naturally across the top row.

**What it replaces:**
- `.media-grid-packed` CSS column layout in `frontend/styles/workspace-media.css:465-504`
- `.media-library-body .media-grid-packed` overrides at lines 1422-1490

**Codebase touchpoints:**
- retired standalone Media Library page gallery grid component
- retired standalone Media Library page gallery-section wrapper applying `.media-gallery-packed`
- `frontend/styles/workspace-media.css` — packed grid CSS

**Why this package specifically:**
- Zero dependencies, SSR-safe (works with Next.js).
- CSS-driven — compatible with existing plain CSS approach.
- Responsive breakpoint config maps directly to existing `--media-preview-width` variable pattern.
- Distributes items in reading order (left→right, top→bottom) while preserving packed density.

**Alternative for later:**
If ADR-0009 virtualized grid lands and item counts grow into the thousands, evaluate `@tanstack/react-virtual` with a custom masonry measurer instead. The current IntersectionObserver load-more pattern (page size 30-60) does not require virtualization yet.

---

### 2. Image thumbnail optimization — `next/image` with custom Supabase loader

**Priority: High**

| | |
|---|---|
| Package | `next/image` (built-in) + `sharp` (bundled with Next.js) |
| Size | 0 KB additional (already in Next.js) |
| License | MIT |

**Problem it solves:**
Media gallery thumbnails render as plain `<img>` tags with full-resolution signed Supabase URLs. Every card in the packed grid downloads the original-size asset even at thumbnail display size. This wastes bandwidth and slows initial paint, especially on the media library page with 30-60 visible cards.

**What it replaces:**
- Raw `<img>` elements in the retired standalone Media Library page media cards
- Manual aspect-ratio sizing via `style={{ aspectRatio }}`

**Codebase touchpoints:**
- retired standalone Media Library page card thumbnail rendering
- `frontend/lib/mediaPreviewPath.ts` — variant path resolution (already supports thumb/poster variants)
- `frontend/lib/mediaSignedUrlCache.ts` — URL signing cache
- `next.config.js` — image optimization config

**What it provides:**
- Automatic WebP/AVIF transcoding at the edge.
- Responsive `srcset` generation — serves appropriately-sized thumbnails per viewport.
- Native lazy loading with optional blur-up placeholder.
- Pairs with the ADR-0009 derivative variants plan (thumb_240, thumb_480 variants feed directly into `next/image` sizes).

**Evaluation note:**
Requires a custom image loader function that maps `next/image` size requests to Supabase signed URLs or Supabase transform parameters. Scoping that loader is the main implementation work.

---

### 3. Drag-and-drop — `@dnd-kit/core` + `@dnd-kit/sortable`

**Priority: Medium**

| | |
|---|---|
| Package | [`@dnd-kit/core`](https://dndkit.com/) + `@dnd-kit/sortable` |
| Size | ~12 KB gzipped (core + sortable) |
| License | MIT |

**Problem it solves:**
The AI Studio reference canvas and agent chat panel have drag-and-drop interactions built on native pointer events. Native pointer-based DnD works but lacks:
- Keyboard/screen-reader accessibility for drag operations.
- Reliable touch behavior on iOS Safari (pointer events have known edge cases).
- Drop animations and visual affordances during drag.

**Codebase touchpoints:**
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx` — reference grid with drag-drop
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx` — drop zone handling
- `frontend/prefabs/agent/panels/AgentChatPanel.tsx` — agent message drag-to-grid

**What it provides:**
- Modular: only import core + sortable (no unused overhead).
- Accessible drag-and-drop (keyboard navigation, ARIA live regions).
- Sortable preset for reference grid card reordering.
- Collision detection algorithms for multi-zone drops (agent panel → reference grid).
- Spring-based drop animations.

---

### 4. Toast notifications — `sonner`

**Priority: Medium**

| | |
|---|---|
| Package | [`sonner`](https://sonner.emilkowal.dev/) |
| Size | ~1.2 KB gzipped |
| License | MIT |

**Problem it solves:**
Success/error feedback is currently managed through inline state variables rendered as conditional text blocks. Examples:
- `bulkMoveError` / `bulkMoveNotice` in `MediaGalleryActions`
- Generation completion/failure states in AI Studio
- Upload progress and errors in the retired standalone Media Library page upload-stage component
- Credit deduction confirmations

This means each feature independently manages its own notification rendering, and notifications disappear when the component re-renders or the user navigates away.

**Codebase touchpoints:**
- `frontend/features/media-library/components/MediaGalleryActions.tsx` — bulk move/delete feedback
- retired standalone Media Library page upload-stage feedback
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx` — generation status
- `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts` — task lifecycle events

**What it provides:**
- Stacking toasts with auto-dismiss timers.
- Promise-based toasts: `toast.promise(generateImage(), { loading: 'Generating...', success: 'Done!', error: 'Failed' })` — maps directly to the submit→poll→complete generation lifecycle.
- Dark theme support via CSS variables.
- No context providers needed — import and call from anywhere.

---

### 5. Media lightbox / viewer — `yet-another-react-lightbox`

**Priority: Medium**

| | |
|---|---|
| Package | [`yet-another-react-lightbox`](https://yet-another-react-lightbox.com/) |
| Size | ~7 KB gzipped (core) |
| License | MIT |

**Problem it solves:**
`MediaFileModal` has a custom-built image viewer with zoom/pan logic (scale transform, pointer tracking, wheel events). This custom code lives across:
- `useMediaModalImageZoom` hook — zoom state machine, pointer math, wheel handling
- `MediaFileModal` component — zoom/pan event wiring
- Modal CSS — transform/translate positioning

The custom solution works but lacks pinch-to-zoom on touch, gallery browsing between items, fullscreen mode, and robust edge-case handling (bounds clamping, momentum, multi-touch).

**Codebase touchpoints:**
- `frontend/features/media-library/components/MediaFileModal.tsx` — modal with zoom/pan
- `frontend/features/media-library/hooks/useMediaModalImageZoom.ts` — zoom state management
- `frontend/styles/workspace-media.css` — modal preview styling (lines ~520-800)

**What it provides:**
- Zoom, pan, and pinch-to-zoom with proper bounds and momentum.
- Video playback support (native `<video>` element within lightbox).
- Gallery navigation (prev/next arrows, thumbnail strip) for browsing across media items.
- Keyboard shortcuts (arrow keys, escape, zoom hotkeys).
- Fullscreen mode.
- Plugin-based: only load zoom/video/thumbnails plugins if needed.

---

### 6. Date formatting — `date-fns`

**Priority: Low**

| | |
|---|---|
| Package | [`date-fns`](https://date-fns.org/) |
| Size | Tree-shakeable (import only what you use, typically 2-5 KB) |
| License | MIT |

**Problem it solves:**
A `formatDate` function is threaded as a prop through media library components. Without a date library, this is likely a custom formatter using `Date` methods. As the app grows (performance analytics timestamps, generation history, billing events), consistent date formatting becomes more important.

**Codebase touchpoints:**
- retired standalone Media Library page gallery-section `formatDate` prop
- `frontend/features/media-library/components/MediaPromptGrid.tsx` — prompt card dates
- `frontend/features/performance/` — analytics timestamp display

**What it provides:**
- `formatDistanceToNow` — "2 hours ago" relative timestamps for media library cards.
- `format` — consistent absolute date display across all features.
- Tree-shakeable — no bloat from unused locale/function code.
- Locale support for future internationalization.

---

### 7. Global state management — `zustand`

**Priority: Low (future investment)**

| | |
|---|---|
| Package | [`zustand`](https://zustand-demo.pmnd.rs/) |
| Size | ~1 KB gzipped |
| License | MIT |

**Problem it solves:**
AI Studio state is distributed across ~8 interconnected custom hooks that pass data through prop drilling. This works today but creates friction when:
- A new feature needs to read state from a different hook (e.g., agent conversation accessing generation controller state).
- Debugging requires tracing prop flow through multiple hook layers.
- Persisting user preferences (selected model, aspect ratio, video settings) requires manual `sessionStorage` code.

**Codebase touchpoints:**
- `frontend/features/ai-studio/hooks/useAiStudioState.ts` — core studio state
- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts` — derived data
- `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts` — task lifecycle
- `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts` — agent flows
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` — generation control
- `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts` — computed panel props

**What it provides:**
- No context providers — import the store hook directly in any component.
- Slices pattern — each existing hook becomes a slice in one store, preserving separation of concerns.
- `persist` middleware — saves user preferences (model selection, video settings) without manual sessionStorage.
- Redux DevTools integration for debugging complex generation state flows.
- `subscribeWithSelector` — fine-grained re-render control for performance-sensitive components.

**Evaluation note:**
This is a refactor-scale change. Only pursue if prop-drilling friction becomes a real bottleneck or if a major new feature (e.g., workflows/templates system) needs cross-feature state access.

---

### 8. Schema validation — `zod`

**Priority: Low (future investment)**

| | |
|---|---|
| Package | [`zod`](https://zod.dev/) |
| Size | ~13 KB gzipped |
| License | MIT |

**Problem it solves:**
API route input validation is done with manual conditional checks (`if (!body.prompt)`, `if (!userId)`, etc.) scattered across 38+ API routes. Generation parameter validation (aspect ratios, durations, resolutions per model) is done with custom logic in each route.

**Codebase touchpoints:**
- `frontend/pages/api/fal/*.ts` — 38+ model submit/status routes
- `frontend/pages/api/ai/*.ts` — agent and prompt enhancement routes
- `frontend/pages/api/upload-*.ts` — upload handlers
- `frontend/features/ai-studio/logic/` — generation parameter validation

**What it provides:**
- Declarative schemas for API request bodies — replace scattered `if` checks with `.parse()`.
- TypeScript type inference from schemas — single source of truth for types and validation.
- Composable model-specific parameter schemas (e.g., Kling duration range vs. Veo duration range).
- Useful error messages for debugging malformed requests.

**Evaluation note:**
Highest value at the API route boundary. Could be adopted incrementally — start with new routes, backfill existing routes as they're touched.

---

## Packages explicitly NOT recommended

These were considered and rejected during the audit:

| Package | Reason not recommended |
|---|---|
| Tailwind CSS | Project uses a mature plain CSS + design tokens system. Migration cost outweighs benefit at this stage. |
| Redux / Redux Toolkit | Overkill for current state complexity. Zustand covers the same need at 1/10th the boilerplate. |
| Framer Motion | Animation needs are currently minimal and CSS-driven. Adding a 30KB animation library is not justified. |
| react-beautiful-dnd | Deprecated in favor of `@dnd-kit`. |
| SWR alternatives (React Query) | SWR is already in use and working well. No justification to migrate. |
| Full component library (Radix, shadcn) | Project has a custom design system. Adopting a component library would conflict with existing UI patterns. |

---

## How to use this document

1. **Pick a recommendation** from the table above.
2. **Read the "Codebase touchpoints"** section to understand what files are affected.
3. **Create a spike branch** and install the package to validate the integration.
4. **If adopting**, write an ADR (next available: `0013`) capturing the decision and update `docs/planning/backlog.md`.
5. **If rejecting**, add a note to the "Packages explicitly NOT recommended" table above with the reason.
