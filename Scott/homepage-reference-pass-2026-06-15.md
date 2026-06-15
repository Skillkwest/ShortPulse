# Homepage Reference Pass - 2026-06-15

Branch: `codex/brother-dashboard-aesthetics`

## Source Direction

Scott provided a dark ShortPulse homepage mockup with:

- compact black nav with ShortPulse mark
- cinematic dark hero
- headline: "A true all-in-one that actually works."
- small "New Project" CTA card
- "top AI models" brand strip
- dense creation/workflow grid
- "Shortpulse replaces all these tools" orbit section

## Implementation Summary

Touched files:

- `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`
- `frontend/features/dashboard/components/GuestDashboardView.tsx`
- `frontend/styles/workspace-dashboard.css`

Current public homepage now includes:

- scoped public homepage class: `public-dashboard-page`
- sparse reference-style hero with generated misty forest background and no body paragraph
- top model/provider strip with muted CSS-built logo marks
- 15-card workflow showcase grid using the real `DashboardTutorialGrid` tutorial media
- orbital replacement-tools section
- no duplicate hidden tutorial grid in the public homepage render path

Generated assets copied into the project:

- `frontend/public/dashboard/homepage-misty-forest-hero-v1.png`

Note: generated collage assets were created during an earlier pass, but the public homepage should not use generated placeholder thumbnails for the tutorial wall. The visible showcase must use the real tutorial thumbnail/video data from `DashboardTutorialGrid`.

## Validation

Passed:

- `npm.cmd run type-check`
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/routes/PublicDashboardRoute.tsx --max-warnings=0`
- `git diff --check`
- Local mobile render check at `http://localhost:3000/` in the in-app browser at `390x844`
- Local desktop render check at `http://localhost:3000/` in the in-app browser at `1280x900`
- Verified generated assets return `200 image/png` locally:
  - `/dashboard/homepage-misty-forest-hero-v1.png`
  - `/dashboard/homepage-ai-output-collage-v1.png`
  - `/dashboard/homepage-ai-output-collage-v2.png`

Observed during render check:

- Page rendered with expected title, hero headline, 15 showcase cards, and the orbit tools.
- The mobile pass was compressed so the nav, hero, model strip, dense grid, orbit heading, and top of the orbital tool wheel fit the mockup's first-screen rhythm more closely.
- The CTA card was moved higher into the hero and reduced in width to better match the reference's compact top-right project card.
- The mobile provider strip was compressed so area, Veo, Ideogram, Runway, Gemini, and a peek of Flux are visible across the first row, closer to the reference logo band.
- The mobile nav was tightened to a `36px` bar with smaller auth controls, matching the reference's compact black header more closely.
- The mobile hero image was brightened slightly with a reduced grid-overlay opacity so it reads more like the misty grey forest in the reference while desktop keeps its original darker treatment.
- Corrected the top orbit tool label from `Highfield` to `Higgsfield` to match the reference.
- Matched the model-strip heading copy to the reference by using `worlds` without an apostrophe.
- Matched the visible New Project helper copy to the reference-style wording: `Compare plans to unlock your first project`; mobile render confirmed it wraps inside the compact card.
- Forced the mobile New Project title into a compact two-line `New` / `Project` label and tightened the card typography so the card returns to a `54px` height.
- Strengthened the New Project card's cyan edge/glow so the top-right hero card reads closer to the reference's teal-outlined project tile.
- Centered the `actually works.` gradient punchline under the first hero line so the mobile headline matches the reference composition more closely without crowding the top-right project card.
- Added a subtle warm drop-shadow to the `actually works.` accent so the gradient underline feels closer to the reference's red/orange hero emphasis.
- Increased provider/model logo-strip contrast so the mobile logo band reads closer to the mockup instead of disappearing into the black section.
- Added a subtle mobile right-edge fade to the provider/model strip so the visible `Flux` peek feels intentional like the reference logo band.
- Tightened the public mobile nav action cluster with darker secondary pills and a crisper cyan signup button, closer to the compact black header in the reference.
- Updated the 15 showcase tile labels to more closely mirror the mockup's task-specific examples, including clone yourself, image-to-prompt-to-image, face swap, image-to-video, voice design, and SFX/music/voiceover.
- Adjusted the mobile showcase labels to allow compact multi-word captions instead of hard one-line truncation, while preserving the dense grid height.
- Added a standards-track `line-clamp` companion to the mobile showcase captions so the compact two-line behavior is more robust alongside the WebKit clamp.
- Strengthened the orbit section's center/ring glow so the replacement-tools wheel reads more like the reference's luminous circular system without changing layout.
- Added orbit-stage conic/radial instrumentation overlays plus glassier core/tool icon treatments so the replacement-tools wheel reads closer to the mockup's layered AI-system dial.
- Polished the compact public nav with an obsidian glass gradient, subtle red-to-cyan bottom hairline, beveled Login/Pricing pills, and cyan gradient Sign up treatment while preserving the mobile header footprint.
- Restored the missing model route inventory helper modules under `frontend/scripts/lib`, which brought the full TypeScript verification gate back to green.
- Added a warm 3px glowing gradient underline to the hero's `actually works.` phrase so the headline accent reads closer to the reference mockup.
- Polished the AI-output showcase wall with a section vignette, glossy card surface, tiny accent strips in the title bars, richer media contrast, and per-card accent glows without changing the grid footprint.
- Refined the hero `New Project` tile with creation-oriented helper copy, a glassy cyan radial surface, inset border detail, a tiny top-right cyan streak, and a stronger icon glow while preserving its mobile footprint.
- Softened the provider/model strip into muted badge-like marks with subtle capsule padding, faint text glow, and radial mark highlights so the row reads more like premium platform logos.
- Polished the orbit section header with a glassier `All-in-one AI platform` pill, stronger heading glow, and a warm 2px underline under `all these tools.` without moving the wheel.
- Latest `390x844` layout measurements:
  - nav height: `36px`
  - nav action cluster: `108px` wide; Login/Pricing pills `48px` by `14px`; Sign up button `56px` by `30px`
  - nav polish verified at `390px`: logo remains `52px` wide, auth cluster remains `108px`, header gradient/underline are active, and Login/Sign up gradients are active
  - hero: `36px` to `152px`
  - hero accent phrase remains `67px` to `213px`; new underline pseudo-element is `3px` tall with warm gradient/glow applied
  - CTA card: `63px` to `117px`
  - CTA card remains `112px` by `54px` with the stronger cyan border/glow applied
  - CTA card helper now reads `Prompts, images, video, audio, agents`; icon pill is `26px` square and cyan-glass layers are active
  - centered hero punchline: `67px` to `213px`, with project card starting at `244px`
  - hero accent glow verified in DOM without changing headline dimensions
  - model section: `158px` to `227px`
  - model band glow verified at `390px`: radial red haze, top separator, `32px` lower fade, and `UX` text glow are applied without changing section height
  - model strip color: `rgba(244, 245, 247, 0.46)` on mobile with logo opacity `0.82`
  - model strip fade mask verified in DOM; `Flux` peeks at the right edge
  - model strip badge treatment verified at `390px`: strip remains `332px` by `22px`, first logo remains `58px` by `18px`, fade mask and radial mark highlight are active
  - showcase grid: `227px` to `471px`
  - showcase titles verified in DOM: `15` rendered task labels
  - showcase title bands remain `16px` tall with compact `5.25px` mobile captions
  - showcase polish verified at `390px`: grid remains `380px` wide and `244px` tall, cards remain `72px` by `70px`, title strips/vignette/media contrast are active
  - orbit section starts at `471px`
  - orbit header verified at `390px`: kicker is `141px` by `27px`, heading remains `243px` by `54px`, stage still starts at `613px`, and the new underline/glow styles are active
  - orbit wheel stage starts at `613px`
  - orbit wheel verified at `390px`: stage remains `336px` square, core remains `118px`, conic/radial overlays are applied, and icon glass/shadow treatment is active
  - orbit tool nodes verified in DOM: `10`, including the hidden mobile float node
- Browser console included dev/runtime resource warnings from the local environment, including `_clientMiddlewareManifest.js` MIME handling and sandboxed resource fetch denials.
- Later mobile DOM verification succeeded after the logo-strip contrast pass, but screenshot capture timed out in the browser runtime during that pass.
- Full `npm.cmd run type-check` is green again after restoring `scripts/lib/fal_route_inventory` and `scripts/lib/direct_provider_route_inventory`; targeted eslint and diff checks also pass.
- Corrected the homepage showcase after Scott called out the placeholder-thumbnail mistake:
  - removed the generated showcase card array from `GuestDashboardView`
  - moved the real `DashboardTutorialGrid` into the reference-style showcase section
  - removed the duplicate hidden tutorial grid render path
  - verified at `1920x900` that the page/hero/showcase are viewport-wide, the real tutorial grid is `1500px` wide, `15` tutorial cards render, and no duplicate hidden tutorial cards remain
- Desktop full-width direction:
  - public homepage shell should fill the browser width instead of behaving like a centered `1180px` poster
  - full-bleed sections should use the public page gutter, with inner content capped only where readability/composition needs it
- Desktop-first direction from Scott:
  - dial in the desktop/full-screen homepage first
  - do not spend the current pass optimizing mobile; mobile polish comes after the desktop composition is right
- Latest desktop header treatment:
  - header should feel like a slim premium glass strip, not a heavy utility app bar
  - measured app bar after polish: `60px` tall on desktop
  - logo is larger (`86px` wide) with subtle warm/pink glow
  - public homepage should hide the dashboard/account card; the `testing` account card made the header feel like an internal dashboard
  - auth area should be a simple `Login` / `Pricing` / bright cyan `Sign up` cluster
  - latest measured auth cluster: `242px` wide; Sign up remains the bright cyan callout (`86px` by `48px`)
  - logo side gets a soft red/orange aura; header bottom uses a subtle red-to-cyan hairline
- Latest desktop composition check at `1920x900`:
  - nav/app bar: `66px` tall and full-width
  - hero: full-width, `338px` tall, from `66px` to `404px`
  - model band: full-width, from `404px` to `519px`
  - hero forest background should continue through the model band and fade out before the tutorial cards
  - do not place the forest background behind or on top of the thumbnail cards; cards need a clean dark stage
  - latest background pass keeps the forest image in `.public-home-models`, removes it from `.public-home-showcase`, and uses black fades before the card grid
  - model/provider strip should be larger and slowly marquee left, with faded edges
  - latest measured model strip: `1320px` wide, `38px` tall, `23px` text, `27px` marks, `34s` left-scroll animation, `10%` edge fade
  - tutorial showcase header should not be capped in a centered lane; it should expand close to full desktop width
  - real tutorial grid should expand close to full desktop width, not stay in a `1500px` lane
  - latest measured tutorial grid: `1862px` wide on a `1920px` viewport, with a `24px` gutter
  - first tutorial card: `367px` by `364px`, poster-first/static at rest
  - public homepage tutorial videos keep their signed poster frames at rest; video `src` is not set until interaction
- Latest desktop thumbnail-card treatment:
  - cards should feel like large rounded poster tiles, not tiny title-bar thumbnails
  - card aspect ratio should be `4:5`
  - media should remain `1:1` square at the top of the card
  - title sits in the bottom black/fade zone, not above the image
  - latest measured first card: `373px` by `466px`, card ratio `0.8`
  - latest measured first media: `371px` by `371px`, media ratio `1`
  - latest title typography pass: calmer balanced labels, font about `25.34px`, weight `800`, line-height about `25.85px`
  - title zone includes a subtle accent rule and layered black fade for readability instead of oversized blocky text
  - preserve real tutorial poster/media data; do not replace with generated placeholder thumbnails
- Latest desktop hero-lockup direction:
  - do not anchor the main headline far left or the New Project card far right; they should read as one intentional center composition
  - the headline should be smaller and pulled inward, with the New Project card smaller and close beside it
  - the model headline belongs inside the hero image area under that lockup, not as a large duplicate band below
  - the logo marquee remains below as the transition into the tutorial cards, with the forest fade ending before the clean card stage
- Latest desktop header direction:
  - header should match Scott's cinematic reference, not merely be inspired by it
  - ShortPulse logo should be present in the upper left of the cinematic overlay header
  - top-right nav should be readable `Login`, `Pricing`, and warm `Sign Up` pill in that visual order
  - text links should stay simple and transparent rather than boxed glass buttons, but must not be too tiny to read
  - Sign up should use a warm coral/red/orange glow pill, not the cyan dashboard callout
  - hero should use a centered stack: large headline, small model sentence, readable centered `Launch App` pill, then marquee across the lower fade
  - do not use the previous floating `New Project` card in the reference-style public hero
- Latest desktop hero media direction:
  - hero background should play the supplied YouTube video `https://youtu.be/5BWrEmAqun8`
  - the video must autoplay muted and loop continuously
  - keep the misty forest image as a fallback/base behind the video
  - preserve dark cinematic overlays and bottom fade over the video so headline, buttons, and marquee stay readable
- Latest replacement-tools/orbit direction:
  - the "Shortpulse replaces all these tools" section should feel like a solar system, not a static badge wheel
  - ShortPulse is the central sun/core
  - external tools should orbit around the ShortPulse core on visible orbital paths
  - orbiting tools should maintain even solar-system spacing around the core; do not let independent durations drift them into a clump
  - use shared orbit timing with staggered starting angles so the whole constellation visibly circles ShortPulse
  - labels/icons should stay readable while orbiting by counter-rotating against their path animation
  - keep the warm red/orange/pink planetary glow language consistent with the hero

## Image Generation Prompts

Hero background prompt summary:

- Dark misty cinematic evergreen forest ridge background for a premium AI creator SaaS homepage hero.
- Wide 16:9, strong negative space for white headline text, no people, no buildings, no logos, no text.

Removed direction:

- Do not replace live tutorial thumbnails with generated placeholder/collage imagery. Scott wants the actual workflow thumbnails preserved while we reshape the surrounding homepage aesthetic.

## Remaining Fidelity Gap

The layout now follows the mockup's structure and dark/red-orange/cyan styling while preserving real tutorial thumbnails. The remaining gap is fine tuning rather than missing visual primitives:

- provider/model logo treatments are CSS-built approximations, not official logo assets
- exact vertical spacing can be tuned after Scott reviews the rendered page; mobile hero has already been compressed to move the model strip higher like the reference, and the showcase grid now uses a dense 5-column mobile wall
- top nav uses the existing dashboard auth/action structure, restyled to match the reference
