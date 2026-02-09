# Prefabs (Shared UI Kits)

Purpose: centralize pre-styled UI elements that multiple features/pages rely on so we avoid cross-feature imports.

## Where prefabs live
- `frontend/prefabs/<domain>/`: domain-scoped prefabs (starting with `agent/`).
  - Suggested subfolders: `buttons/`, `inputs/`, `panels/`, `types.ts`, and `index.ts` for exports.
- Styles: `styles/prefabs-agent.css` (core) and `styles/prefabs-agent-variants.css` (compact/variant tweaks) are imported via `styles/globals.css`.

## When to add a prefab
- A control/layout appears in more than one feature or page.
- Visual/interaction consistency matters (e.g., chat controls, generate buttons).
- The element would otherwise force a feature-to-feature dependency.

## Guidelines
- Aim to keep each file under ~500 lines; if it grows beyond that, document why and plan a split.
- Add top-level comments plus doc comments on exported components.
- Co-locate domain types; export everything through `index.ts` and use relative imports from the current file location.
- Prefer extending existing prefab styles before adding new files; update `globals.css` import order when introducing new sheets.
