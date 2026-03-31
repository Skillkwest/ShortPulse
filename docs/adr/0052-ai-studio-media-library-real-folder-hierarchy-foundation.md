# ADR 0052: AI Studio Media Library Real Folder Hierarchy Foundation

## Status
Accepted

## Context
The AI Studio Media Library panel currently presents a folder browser, but the persisted folder model is flat. Custom folders are user-scoped rows with no ancestry, and the panel simulates depth through creation-order proxies and local navigation state.

That proxy model is not strong enough for the target product direction:
- users should be able to browse nested folders like a normal file browser,
- breadcrumbs should represent real ancestry,
- the back/up control should move to a real parent,
- the folder strip should show direct children of the current folder,
- the current folder should not appear in its own child list.

The existing folder-canvas domain is a separate persistence model. It can remain temporarily, but it should not define the core folder-navigation contract.

## Decision
We are introducing real hierarchy support for Media Library folders in the backend contract.

The foundation rules are:
- `All Media` remains a virtual root and is not persisted as a `media_folders` row.
- Custom folders may reference a real parent folder through `parent_folder_id`.
- Folder name uniqueness is sibling-scoped, not global per user.
- Folder ancestry must be same-user only.
- Folder hierarchies must reject self-parenting and cycles.
- Folder CRUD APIs and service contracts should carry explicit parent references (`parentFolderId`) even before the panel UI fully cuts over to real ancestry.

This ADR covers the hierarchy foundation only. It does not require the panel UI to cut over in the same slice.

## Consequences
- Positive:
  - The backend can support real breadcrumb ancestry and parent/child navigation without another schema rewrite.
  - Future nested-folder UX can be implemented against explicit parent references instead of creation-order proxies.
  - Sibling-scoped uniqueness matches normal file-browser expectations better than global per-user folder-name uniqueness.
- Negative:
  - Current panel runtime will remain temporarily inconsistent with the new backend model until the UI cutover lands.
  - Delete semantics now need explicit subtree policy in future UI flows because nested descendants can exist.
  - Folder-canvas becomes more clearly secondary to the normal folder browser and will need a deliberate follow-up decision.
- Follow-ups:
  - Replace proxy folder navigation with real ancestry-based breadcrumb/back-button logic.
  - Add move/reparent APIs with cycle prevention.
  - Decide whether folder-canvas remains an advanced secondary mode or is retired from the default folder-browsing flow.

## Alternatives considered
- Option A: Keep the current flat folder model and improve the proxy UI.
  - Rejected because it cannot support real nested browsing semantics cleanly.
- Option B: Delay backend hierarchy until the full UI redesign is ready.
  - Rejected because it keeps the repo in a contradictory state longer and blocks clean API/UI evolution.
