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

- `/`
- signed-out `/dashboard`

Working expectation:

- Scott will provide designs, mockups, references, and ideas.
- The agent translates those into homepage UI changes.
- Memories, artifacts, and instructions for this lane live under `Scott/`.

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
- Section copy such as "Shortpulse replaces all these tools" should be screen-reader-only for now. Do not show the small visible intro block above the orbit unless Scott asks to restore it.
- The orbit section can use huge low-opacity serif background words, currently "CREATE" and "ANYTHING", as an atmospheric layer behind the solar-system orbit.
- The orbit system should be vertically centered against the large `CREATE / ANYTHING` background words, not sit low beneath them.
- The `CREATE / ANYTHING` background words should sit centered directly behind the ShortPulse core, not high above it.
- Orbiting app logos should fade into darkness as they pass upward toward the thumbnail card section above.
- Orbiting items should represent ShortPulse capabilities/workflows, not third-party vendor app names. Current direction replaces items like Magnific, Higgsfield, Suno, Eleven Labs, Free Pick, and Voice with many ShortPulse actions such as Generate Images, Clone Yourself, Image to Video, SFX, VFX, Viral Ads, Product Ads, Voiceovers, and Generate Scripts.
- The capability orbit should use polished mini-icons and compact labels across multiple rings so it reads like an ecosystem of creative powers around the ShortPulse core, not a vendor replacement logo list.

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
