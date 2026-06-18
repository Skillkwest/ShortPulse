# Modal Video Lag Fix Handoff - 2026-06-17

Branch confirmed before work: `codex/brother-dashboard-aesthetics`.

Production guardrail: no production branch, deployment, or production environment was touched.

## What Changed

- `DashboardTutorialGrid` now treats its own open tutorial modal as an effective video pause state.
- `DashboardTutorialGrid` exposes `onModalOpenChange` so parent surfaces can pause their own background media while a grid-owned modal is open.
- `GuestDashboardView` now pauses homepage media when either:
  - `Watch Demo` is open, or
  - a tutorial-card modal is open.
- While a tutorial modal is open:
  - hero background video is paused,
  - tutorial thumbnail videos are paused,
  - thumbnail autoplay/preload drops out of the active state,
  - model marquee animation is idled.

## Runtime Verification

Checked locally at `http://127.0.0.1:3000/` with the in-app browser.

### Watch Demo

Before opening modal:
- Local videos playing: `13`
- Tutorial thumbnails playing: `12`
- Hero videos playing: `1`

After opening modal:
- Modal iframe: `https://www.youtube-nocookie.com/embed/k1-J78JLsMs?rel=0&modestbranding=1&playsinline=1`
- Local videos playing: `0`
- Tutorial thumbnails playing: `0`
- Hero videos playing: `0`
- Tutorial videos with `preload="auto"`: `0`

### Tutorial Card Modal

Before opening modal:
- Local videos playing: `13`
- Tutorial thumbnails playing: `12`
- Hero videos playing: `1`

After opening modal:
- Modal iframe: `https://www.youtube-nocookie.com/embed/-65Vh2-4hoQ?rel=0&modestbranding=1&playsinline=1`
- Local videos playing: `0`
- Tutorial thumbnails playing: `0`
- Hero videos playing: `0`
- Tutorial videos with `preload="auto"`: `0`

## Test Verification

Commands:

```powershell
npm.cmd test -- tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx
npm.cmd run type-check
```

Results:

- `31` focused tests passed across `2` files.
- `tsc --noEmit` passed.
- `npm.cmd run type-check:touched` was attempted first, but the helper failed on Windows with `spawn EINVAL`; the full type-check was used as the stronger fallback.

## Notes

- The existing local thumbnail proxy remains in place and was not the primary bottleneck.
- The fix preserves the visible modal/homepage design. It removes hidden decode/composite pressure while a tutorial is being watched.
- The working tree already contained unrelated homepage/footer/gallery edits before this fix. Those were left intact.
