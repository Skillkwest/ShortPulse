# Universal Home Sections

- Branch rule remains active: only work on `codex/brother-dashboard-aesthetics`; production remains off limits.
- The logged-out and logged-in home pages now share the same reusable section components for:
  - tutorial thumbnails: `PublicHomeTutorialShowcase`
  - join community: `PublicHomeCommunitySection`
  - video gallery: `PublicHomeVideoGallery`
- Future edits to those shared components or their `.public-home-*` styles should affect both the logged-out and logged-in home experiences.
- Keep logged-in-only changes limited to authenticated dashboard chrome, hero actions, and signed-in routing behavior.
