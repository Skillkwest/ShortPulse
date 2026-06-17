# ShortPulse Homepage Aesthetic Memory

Purpose: durable working memory for Scott's homepage aesthetic lane.

## Temporary Branch Rule

These temporary rules were explicitly set by the user on 2026-06-14 and override conflicting repo-level branch instructions for this lane until the user says otherwise:

- Never touch `production`.
- Never apply changes to `production`.
- Never switch to `production`.
- Never use `production` for validation, edits, commits, or branch operations.
- Only work on branch `codex/brother-dashboard-aesthetics`.
- Only stay on branch `codex/brother-dashboard-aesthetics`.

## Lane Scope

This lane is for aesthetic work on the ShortPulse home page and related signed-out dashboard surface.

Primary surfaces:

- signed-in `/dashboard` as the logged-in home page

Off-limits unless Scott explicitly changes the rule:

- `/`
- logged-out `/dashboard`
- logged-out homepage components, data, copy, media, and public-home CSS rules

Working expectation:

- Scott will provide designs, mockups, references, and ideas.
- The agent translates those into homepage UI changes.
- Memories, artifacts, and instructions for this lane live under `Scott/`.

## Logged-In Homepage Direction

- Current 2026-06-16 priority from Scott: build the logged-in version of the home page.
- Interpret the logged-in home page as the signed-in `/dashboard` surface.
- Keep the signed-in dashboard visually connected to the public homepage aesthetic while preserving authenticated dashboard behavior.
- Do not copy unnecessary sales/acquisition elements into the logged-in page. Specifically, the logged-in page does not need the public header background video, scrolling model strip, or sales-oriented acquisition chrome.
- Keep tutorial thumbnails on signed-in `/dashboard`.
- Preserve the current tutorial thumbnail behavior: clicking a tutorial opens the existing tutorial modal experience and keeps the same launch path behavior.
- Production remains fully off-limits; all logged-in homepage work stays on `codex/brother-dashboard-aesthetics`.

## Current Canonical Homepage Files

The current public homepage is routed through the dashboard feature:

- `frontend/pages/index.tsx`
- `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`
- `frontend/features/dashboard/components/GuestDashboardView.tsx`
- `frontend/styles/workspace-dashboard.css`

Related signed-out dashboard entry:

- `frontend/pages/dashboard.tsx`

## Video Source Note

- The hero background video should be self-hosted as a direct `.mp4` or `.webm` public asset.
- Do not use a YouTube iframe for the hero background. YouTube can return a "Sign in to confirm you're not a bot" challenge inside the iframe, which becomes visible as part of the background layer.
- Current desktop hero video asset: `frontend/public/dashboard/homepage-hero-background.mp4`, copied from Scott's raw `background trailer.mp4` file on 2026-06-15.

## Orbit Section Direction

- The center core should be textless.
- The ShortPulse logo should read like the sun/planet at the center of the system.
- The waveform logo should span the inner core edge-to-edge and be clipped by the circular core, not float as a small badge.
- If animated, the connected core logo itself should wipe/fade from 100% opacity to 0% opacity from left to right in a heartbeat rhythm. The core background may remain, but the logo layer should visibly erase left-to-right with the pulse.
- The core logo wipe should use a feathered two-phase life-support mask: one layer erases the logo left-to-right from full opacity to invisible, then a restore layer brings it back left-to-right. Avoid hard vertical mask edges and avoid abrupt logo popping.
- Section copy such as "Shortpulse replaces all these tools" should be screen-reader-only for now. Do not show the small visible intro block above the orbit unless Scott asks to restore it.
- The orbit section can use huge low-opacity serif background words, currently "CREATE" and "ANYTHING", as an atmospheric layer behind the solar-system orbit.
- The orbit system should be vertically centered against the large `CREATE / ANYTHING` background words, not sit low beneath them.
- The `CREATE / ANYTHING` background words should sit centered directly behind the ShortPulse core, not high above it.
- Orbiting app logos should fade into darkness as they pass upward toward the thumbnail card section above.
- Orbiting items should represent ShortPulse capabilities/workflows, not third-party vendor app names. Current direction replaces items like Magnific, Higgsfield, Suno, Eleven Labs, Free Pick, and Voice with many ShortPulse actions such as Generate Images, Clone Yourself, Image to Video, SFX, VFX, Viral Ads, Product Ads, Voiceovers, and Generate Scripts.
- The capability orbit should use polished mini-icons and compact labels across multiple rings so it reads like an ecosystem of creative powers around the ShortPulse core, not a vendor replacement logo list.
- Labels should remain visible at all times. Depth should be expressed through dimming, blur, saturation, and brightness changes as satellites pass the upper/back arc, not through hiding labels.
- Capability labels may use a subtle dark glass backing to preserve readability over the orbit, but avoid heavy blocks that make the system feel like a tag cloud.
- Visible orbit lanes should be generated from the same radii as the orbiting capability satellites, so the rings and labels line up like an intentional solar system.
- Orbit icons should scale by lane: compact near the core, larger on middle and outer lanes, while labels remain relatively restrained. Current direction favors visibly larger icon circles for stronger readability without enlarging the label text.
- Scott is now okay with orbiting capability icons overlapping each other if it makes the cluster feel denser and more energetic. Prefer bigger icon circles pulled closer to the ShortPulse core over overly safe, sparse spacing.
- Orbit lanes may animate with subtle shooting-star/comet tails and leading dots. Keep this effect restrained so it adds motion and realism without overpowering labels or becoming heavy neon rings.
- The `CREATE / ANYTHING` background needs a strong left optical nudge to feel centered behind the core because the giant serif letterforms and tracking create uneven right-heavy visual weight.
- Core visual direction should avoid cymbal, speaker, vinyl, or record reads. Prefer a translucent dark-glass energy lens with soft plasma/signal glow, feathered edges, and minimal hard concentric rings.
- The core can have a subtle stage-level aura radiating outward into the nearby orbit lanes. Keep the aura soft and atmospheric, not a hard halo, so labels remain readable.
- The core can use a pulsing plasma-energy rim/border that radiates outward in sync with the life-support pulse. Keep it energy-like and feathered, not a jagged hand-drawn ring.
- Avoid broad fog/haze overlays in the orbit section that make the rings read like a vinyl record. Keep the orbit rings visible on a cleaner dark field.
- A revert reference for the orbit before the premium depth pass is saved at `Scott/orbit-before-premium-pass.diff`.

## Tutorial Thumbnail Direction

- Public homepage tutorial video thumbnails should begin playing automatically on page load, not wait for hover. Continue respecting reduced-motion and save-data preferences.
- Public homepage tutorial cards should have no visible outer borders or inset strokes. Preserve the rounded corners and clean clipping, but keep the media tiles borderless.
- Thumbnail media should fade strongly into the black title well with no visible seam between the 1:1 media area and the title area.
- If a horizontal seam appears above tutorial titles, intensify the full-card fade and title-well background so the gradients overlap into solid black before the title text area begins.
- Tutorial thumbnail titles should feel compact and premium, tucked into the lower-left like small workflow labels rather than oversized card headlines. Favor smaller bold text, tight two-line wrapping, and a subtle short accent line above the label.
- Performance rule: visible/near-viewport tutorial videos should autoplay, but offscreen tutorial videos should not decode/play until they approach the viewport. This preserves the moving-card feel while avoiding every thumbnail video burning CPU at once.

## Performance Direction

- Current 2026-06-16 priority from Scott: focus on speed, lag, and latency.
- All performance work remains constrained to branch `codex/brother-dashboard-aesthetics`; production remains fully off-limits.
- Keep the homepage visually premium, but avoid expensive always-on effects when possible.
- Prefer transform/opacity animation over animating CSS filters across many elements.
- Use `content-visibility` for heavy below-the-fold public homepage sections so the browser can skip offscreen layout/paint work.
- Avoid `backdrop-filter` on many orbit labels; it is too expensive for a dense animated solar system.
- Use adaptive lite motion for older/weaker computers, save-data, reduced-motion, low-memory, low-core, or slow-update environments. Lite mode should preserve the page composition while capping autoplay videos, rendering fewer orbit satellites, disabling comet/core micro-animations, and slowing nonessential motion.
- For smoothness, cap public tutorial thumbnail video playback to a small number of simultaneous active videos instead of allowing every visible card to decode/play at once.
- Pause the orbit animation while the orbit section is offscreen so the hero and tutorial sections do not pay for hidden solar-system animation work.
- The public hero must use optimized no-audio background loops, not the raw trailer upload. The current intended desktop sources are `frontend/public/dashboard/homepage-hero-background-perf.mp4` for normal mode and `frontend/public/dashboard/homepage-hero-background-lite.mp4` for lite/weak-device mode.
- As of 2026-06-16, the hero background source is Scott's `background video 2.mp4`, encoded into the optimized no-audio `perf` and `lite` hero files plus the hero poster.
- Pause the hero video when the hero is offscreen or the document is hidden. Do not keep decoding a full-width background video after the user scrolls away.
- Public tutorial motion previews should use display derivatives sized for the card, not full original uploads. Current target profile is 540px max dimension, CRF 30, and max 5 MB for motion display variants.
- Keep simultaneous public tutorial thumbnail video decoders very low. Current desktop target is two nearby videos at once, with lite mode reduced to one.

## Hero Model Strip Direction

- The AI model marquee should not sit on a visible black band. Keep the strip transparent over the hero/video fade, with only subtle edge fading if needed for readability.
- The AI model marquee should continue moving during mouse-wheel/page scrolling. It may pause when genuinely offscreen, but do not pause it merely because the page is scrolling.
- Do not use a visible `.public-home-models::before` haze overlay above/behind the model marquee. That pseudo-element created a harsh horizontal band over the hero video; keep it transparent.
- The transition below the AI model marquee into the thumbnail cards should be soft and seamless. Avoid sharp horizontal lines; use a transparent-to-dark fade before the cards.
- The transition above the AI model marquee should also be soft. Avoid a fast top mask ramp on `.public-home-models`; use a long feather so the model strip does not create a horizontal seam against the hero video fade.
- Tutorial thumbnail cards should fade into their title area without a visible media/title seam, but the bottom fade should not feel overly heavy or muddy. Keep the ramp feathered and readable while letting more of the media show through above the title.
- Current hero AI model marquee roster should be: Kling 3.0, Seedance 2.0, Nano Banana Pro, Nano Banana 2, Seedream 4.5, Seedream 5, GPT Image 2, Veo 3.1, and ElevenLabs. Current local logo assets used in the strip are Kling, Google, Seedream, ByteDance/Seedance, and ElevenLabs; GPT Image 2 uses a polished OpenAI-style CSS mark unless an approved OpenAI asset is added.
- Hero CTAs should present as a centered pill row below the model heading, with `Launch App` as the warmer primary button and `Watch Demo` as a quieter glass/outline secondary pill.
- The hero `Watch Demo` pill should open the same `DashboardTutorialModal` experience as thumbnail demos. Current hero demo video is `https://youtu.be/k1-J78JLsMs`.
- The lower simple CTA section should read `JOIN THE COMMUNITY` with one pill button underneath labeled `Join Free`. The old visible tool-cloud pills should not appear in that section.
- The lower community CTA should be visible immediately while scrolling. Do not hide this simple section behind orbit idle/paint-pending lazy-loading rules, and avoid reserving a tall blank block above the headline.
- The public homepage top-right nav should include `Community`, `Pricing`, and `Login` before the `Sign up` pill. `Community` should jump to the lower `JOIN THE COMMUNITY` CTA section.
- The public hero background video should sit at about 70% opacity over a pure black backing. Do not place a poster image or old background image behind the playing video, because it creates an unwanted double-exposure/ghosting effect.
- The harsh seam above the AI model marquee was caused by `.public-home-hero-bg::after`, a full-opacity bottom fade overlay that overlapped the model strip. Keep that pseudo-element transparent/disabled and use one soft continuous gradient on `.public-home-hero-bg::before` instead.
- A second seam source was `.public-home-showcase` overlapping upward into the hero/model transition. Keep the top of `.public-home-showcase` and `.public-home-showcase::before` transparent so it does not paint a rectangular shelf over the video and marquee.

## Footer Direction

- The homepage footer should feel like a cinematic afterglow: ShortPulse logo, one concise positioning line, useful navigation, and a compact `Join Free` conversion card.
- Avoid fake legal/footer links until real policy pages exist. Prefer real destinations already available on the page: `Launch App`, `Pricing`, `Login`, `Workflows`, `Watch Demo`, and `Join Free`.
- Keep the footer dark, glassy, and warm with a subtle coral/orange glow so it feels connected to the hero and orbit sections without competing with them.
- The main footer glass panel should span the full available homepage width rather than sitting as a capped narrow card. Keep internal padding for readability, but avoid large empty side gutters.

Current implementation audit on 2026-06-15:

- `.public-home-orbit-core` is an empty visual element with no visible text.
- The core clips overflow so the large logo connects to both sides of the circular core.
- The animated logo layer is `.public-home-orbit-core::after` using `public-home-core-life-sweep`.
- The background words are rendered by `.public-home-orbit-backdrop-text` behind the orbit stage.

## Working Rules For This Lane

- Keep homepage memories, notes, and implementation instructions inside `Scott/`.
- Treat Scott-provided design direction as the authority for the homepage aesthetic lane.
- Preserve existing app behavior unless Scott explicitly asks for behavioral changes.
- Stay focused on visual design, layout, spacing, typography, media presentation, and responsive behavior unless Scott expands scope.

## Artifact Convention

Use `Scott/` for durable homepage collaboration artifacts such as:

- design memory
- mockup implementation notes
- pass-by-pass change summaries
- pending visual decisions
- handoff notes

## Status

Lane initialized on 2026-06-14.
