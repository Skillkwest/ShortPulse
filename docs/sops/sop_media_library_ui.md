# SOP: Media Library UI (Header, Panels, Storage Card)

## Purpose
Keep the Media Library page visually aligned with Saved Creators and dashboard chrome while preserving storage-state clarity.

## Header Bar
- Background: `frontend/public/media-library-hero.png`.
- Title/lede: “Media Library” / “Upload, organize, and manage your workspace media in one place.”
- Right chips:
  - Media Storage card uses `header-stat-card` + `status-icon compact` with `CloudArrowUp`; value derived from media bytes (`used MB / limit GB`). Hover: teal-outline lift from `workspace-chrome.css`.
  - Plan card reused from Saved Creators (`search-usage-card plan-card`).
- Spacing: 18px below back-link and below the header (`.media-library-body .page-top` / `.saved-header-bar` overrides).

## Panel Styling
- All three main panels (hero drop-zone/upload, filters, gallery) share `media-panel` class to reuse the Saved Creators card treatment: background/border `rgba(201,205,214,0.08)` with shadow `0 16px 38px rgba(0,0,0,0.42)`.
- Body background forced to saved-creators dark via `.media-library-body` class in `workspace-dashboard.css`.

## Upload Card Spacing
- `.upload-side` padding 20px, grid gap 14px for uniform vertical rhythm between eyebrow, title, CTA, status.
- `.upload-storage` padding 14px; uses flex with even spacing between copy and upgrade button.

## Tabs
- Tabs (pill toggles) are: **Uploaded Images**, **Uploaded Videos**, **Private**, **Saved Prompts**, **AI Studio Generations**.
- Private tab stores manual private image uploads under `<auth.uid()>/private/images/...` and uses `media_files.source = private_upload`.
- AI Studio generations appear only in the AI Studio tab (not in uploaded images/videos).
- Saved Prompts is a text-only grid; prompts are saved manually.

## Upgrade Button (Need More Storage?)
- Base color: brand amber `#F5B942` text, amber border/gradient, soft outer shadow.
- Hover: slight lift (`translateY(-2px)`) and warmer amber glow (`rgba(255,190,89,0.28)` shadow, `rgba(255,190,89,0.35)` outer); color remains `#F5B942`.

## Assets
- Hero image lives at `frontend/public/media-library-hero.png` (copied from root Media Library.png reference).

## Implementation Pointers
- Page: `frontend/pages/media-library.tsx` controls header chips and media-panel classes.
- Styles: `frontend/styles/workspace-media.css` (upload spacing, media-panel, upgrade hover), `frontend/styles/workspace-dashboard.css` (body background override), `frontend/styles/workspace-chrome.css` (header-stat hover).
