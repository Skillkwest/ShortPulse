# Prefabs Library

Reusable UI building blocks that sit between feature code and global components. Use these when a control or layout needs to look identical across pages.

## Layout

- `agent/`: Agent/chat prefabs (UI + shared agent types).
  - `buttons/`, `inputs/`, `panels/`
  - `types.ts`: shared agent types
- `index.ts`: single export surface (use a relative import from your file location).
- Styles: `styles/prefabs-agent.css` (core) and `styles/prefabs-agent-variants.css` (compact/variant treatments) are imported via `styles/globals.css`.

## How to add a prefab

1. Create a domain folder (e.g., `prefabs/<domain>/`) with a clear single responsibility.
2. Keep files under ~500 lines; prefer `buttons/`, `inputs/`, `panels/` subfolders.
3. Add a top-of-file comment + doc comments on exports.
4. Co-locate types in the domain folder; export through `index.ts`.
5. Add or extend a dedicated styles file; import it from `globals.css` in the documented order.
