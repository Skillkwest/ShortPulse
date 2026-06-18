# Logged-Out Homepage Deep Dive

Recorded: 2026-06-17

Branch rule in force: only work on `codex/brother-dashboard-aesthetics`. Production is off-limits in all capacities.

## Scope

This audit covers the logged-out ShortPulse home page rendered by `/` and the anonymous `/dashboard` surface.

Primary files:

- `frontend/pages/index.tsx`
- `frontend/pages/dashboard.tsx`
- `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`
- `frontend/features/dashboard/routes/publicDashboardData.ts`
- `frontend/features/dashboard/components/GuestDashboardView.tsx`
- `frontend/features/dashboard/components/DashboardAppBar.tsx`
- `frontend/features/dashboard/components/DashboardTutorialGrid.tsx`
- `frontend/features/dashboard/components/DashboardTutorialModal.tsx`
- `frontend/features/dashboard/components/PublicHomeFooter.tsx`
- `frontend/styles/workspace-dashboard.css`

Supporting API/data files:

- `frontend/features/dashboard/logic/dashboardTutorialEndpointClient.ts`
- `frontend/features/dashboard/logic/dashboardTutorialPayload.ts`
- `frontend/pages/api/dashboard/tutorials.ts`
- `frontend/pages/api/dashboard/tutorial-thumbnail.ts`
- `frontend/lib/server/api/dashboardTutorials.ts`
- `frontend/lib/server/api/dashboardOffers.ts`

## Route Architecture

- `/` is a pure public route. It uses `getStaticProps`, calls `loadPublicDashboardStaticProps`, and renders `PublicDashboardRoute`.
- `/dashboard` is session-aware but optimized to show the public page immediately for anonymous visitors. It only lazy-loads `DashboardRouteSessionAware` when a Supabase session hint exists.
- `PublicDashboardRoute` owns the public body class, head metadata, skip link, header/app bar, public navigation, and `GuestDashboardView`.
- Static props include billing catalog, dashboard offers, and dashboard tutorials. Failures fall back to empty arrays/snapshots so the logged-out page can still render.
- If no tutorial static props are present, the client hydrates tutorials from `/api/dashboard/tutorials`.

## Visible Page Composition

Current logged-out page order:

1. Transparent absolute app bar with ShortPulse logo and links: Community, Pricing, Login, Sign up.
2. Cinematic hero with local background video, headline, model heading, Launch App CTA, Watch Demo button.
3. Horizontal AI model marquee: Kling 3.0, Seedance 2.0, Nano Banana Pro, Nano Banana 2, Seedream 4.5, Seedream 5, GPT Image 2, Veo 3.1, ElevenLabs.
4. Tutorial showcase grid when tutorials exist.
5. Simple community CTA section: JOIN THE COMMUNITY plus Join Free.
6. Gallery masonry grid from local placeholder WebP assets.
7. Public home footer with brand line, Start links, Resources legal links, and Join Free card.
8. Tutorial modal when hero demo or a tutorial card is opened.

## Visual System

- The page is full-width and dark: `#05070c` / `#03060d` base, with warm coral/orange/pink gradients as the primary brand energy.
- Header floats over the hero with no backdrop blur and no visible card stats; only navigation and the signup pill are visible.
- Hero video is at 70% opacity over a pure dark backing with a continuous overlay gradient and a subtle grid texture. The older bottom pseudo-element seam is disabled.
- Hero typography is centered, tight, and large. The emphasized `AI creators` line uses orange-to-pink gradient text, an underline, and glow.
- CTAs are pill-shaped glass/gradient controls. Launch App is warm and primary; Watch Demo is quieter glass.
- Model marquee is transparent, masked vertically and horizontally, and paused only when offscreen or when modal media is open.
- Tutorial cards form a dense borderless 5-column square mosaic on desktop, 4 columns under 1080px, 3 columns under 760px/480px. Title text sits over a dark bottom gradient with compact type and accent strokes.
- Community/orbit section has been simplified from the earlier solar-system concept into a large typographic CTA with star specks and top fade.
- Gallery is full-width masonry-like CSS grid using 4 columns desktop, 3 under 1080px, 2 under 760px. Current images are placeholders.
- Footer is a full-width dark glass panel with warm afterglow and a compact conversion card.

## Media And Assets

- Hero video sources:
  - `frontend/public/dashboard/homepage-hero-background-perf.mp4`: 1600x900, 23.67s, H.264 High, 24 fps, about 1.63 Mbps, about 4.8 MB.
  - `frontend/public/dashboard/homepage-hero-background-lite.mp4`: 960x540, 23.67s, H.264 Main, 18 fps, about 420 kbps, about 1.2 MB.
- Gallery placeholders are `frontend/public/dashboard/gallery/gallery-01.webp` through `gallery-10.webp`, all 1200x1200 WebP, about 16 KB to 263 KB each.
- Model strip local marks use `/kling-logo.png`, `/google-logo.png`, `/seedream-logo.png`, `/bytedance-logo.svg`, `/elevenlabs-logo.svg`; GPT Image 2 uses CSS-generated OpenAI-style mark.
- Brand logo is `/small good d.png`.
- Next image config allows local assets, Supabase host from env, Pexels, built-in tempfile hosts, configured media hosts, and localhost.

## Tutorial Data And Thumbnail Flow

- `readActiveDashboardTutorials` caps public tutorials at 24 and orders by `display_order`, then `updated_at`.
- Stored thumbnails prefer display variants over originals. With `usePublicDeliveryUrls`, storage paths become stable `/api/dashboard/tutorial-thumbnail?path=...` URLs.
- `/api/dashboard/tutorials` caches tutorial reads for 60 seconds server-side and sets CDN/browser cache headers.
- `/api/dashboard/tutorial-thumbnail` proxies private Supabase thumbnail objects through a stable public path. It supports GET/HEAD, byte ranges, ETags, immutable cache headers, and a small 8 MB in-memory cache.
- Client tutorial fetches are cached for 60 seconds outside tests.
- Tutorial payload normalization rejects missing id/title/youtubeUrl/thumbnailUrl and defaults invalid media type to image.

## Motion And Performance Gates

- `useHomepageMotionLayoutProfile` detects compact layout, medium layout, reduced motion, slow update, save-data, low hardware concurrency, and low device memory.
- Hero video source is not attached until motion profile resolves, hero is near viewport, and the document is visible.
- Compact or lite conditions select the lite hero video.
- Hero video pauses when offscreen, document-hidden, or when a tutorial/demo modal is open.
- Tutorial showcase is lazy-activated by viewport proximity; before activation it renders a placeholder.
- Tutorial videos use poster-first rendering and only attach sources when selected for playback or user-engaged.
- Playback candidate selection prioritizes visible thumbnails, then topmost/nearest thumbnails. Rotation can cycle larger candidate pools.
- Current public-home constants are all set to 15 simultaneous video budget values, so in practice the public grid can run many visible thumbnails at once.
- Offscreen tutorial video sources are released after about 1.6s plus a small stagger.
- Page scroll listeners are batched; thumbnail measurement work is scheduled into animation frames and avoids pausing videos during scroll.
- Orbit/community animations are currently simple; idle and paint-pending classes hard-disable animations/transitions.

## Accessibility And Behavior

- There is a skip link to `#main-content`.
- Header nav links are real links and use `prefetch={false}`.
- Tutorial cards are buttons with aria labels ending in `open tutorial`.
- Tutorial modal uses `role="dialog"`, `aria-modal`, Escape close, guarded backdrop dismiss, YouTube nocookie embed resolution, and Launch AI Studio CTA.
- Hero Watch Demo opens the same `DashboardTutorialModal` using `dashboardHeroDemoTutorial`.
- Reduced-motion disables model marquee and video thumbnail autoplay.

## Tests Covering This Surface

- `frontend/tests/pages/dashboard.guest-route.test.tsx` checks public route rendering, header CTAs, hero video attachment, model marquee active state, telemetry delay, anonymous bootstrap behavior, lite hero source, offers, static/live tutorials, modal behavior, media pause while modal open, and compact thumbnail playback.
- `frontend/tests/pages/dashboard-tutorial-grid.test.tsx` deeply covers tutorial grid media loading, scroll listeners, poster-first behavior, viewport prioritization, rotation, source release, reduced motion, and modal pause.
- `frontend/tests/api/admin-dashboard-tutorial-thumbnail.test.ts` covers thumbnail upload derivative generation contracts used by the admin-managed tutorial asset flow.

## Current Sharp Edges

- `GuestDashboardView` contains `PublicHomeGalleryCard` and `PublicHomeGalleryPromptModal`, but the rendered gallery currently bypasses them and renders a simpler image-only figure grid. Prompt modal state is not wired in the active render path.
- `selectedHeroDemo` uses a `DashboardTutorial` with an empty `thumbnailUrl`; it works because the modal only needs the YouTube URL, but it is not a fully valid tutorial payload if reused elsewhere.
- The public homepage title string appears as `ShortPulse Â· Home` in code/tests, which suggests an encoding artifact around the middle dot.
- The tutorial autoplay/performance constants in `GuestDashboardView` are all `15`, despite older performance notes targeting much lower simultaneous decoder counts. This preserves maximum motion but may cost CPU on weaker machines.
- CSS still contains unused legacy selectors for `.public-home-tool-cloud`, `.public-home-tool-pill`, and `.public-home-quick-row` in responsive blocks.
- Header offer cards can be built from offers but are hidden on the public page; tests still check the offer link can render when supplied, so hidden-but-present semantics should be handled carefully.
- The footer links to `/terms`, `/privacy`, and `/refund-policy`; this assumes those routes exist or will exist.

## Practical Editing Notes

- Most visual edits should land in `GuestDashboardView.tsx` and the public-home sections of `workspace-dashboard.css`.
- Be careful editing `DashboardTutorialGrid.tsx`: it is shared by public and authenticated surfaces, and the CSS has separate public and authenticated overrides.
- Avoid changing API, Supabase, auth, billing, generation, or production deployment config unless Scott explicitly expands scope.
- Preserve stable thumbnail proxy URLs and the 15-card visible tutorial expectation unless Scott changes that direction.
- Use browser verification for any visual change because the page relies heavily on layered CSS masks, negative margins, and media attachment timing.
