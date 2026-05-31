# Ako Trello Operations

Purpose: capture the working rules and practical handling steps for Ako's authorized Trello cleanup work on ShortPulse.

## Authority Rules

- Treat `docs/planning/backlog.md` as the canonical source of truth.
- Update the repo first, then update Trello second.
- Touch Trello only when the user explicitly authorizes the board and list scope.
- Do not infer permission for adjacent boards or unrelated lists.

## Current ShortPulse Board Rules

- Active board: `https://trello.com/b/mEXhsR3d/shortpulse`
- Primary active list for open backlog work: `Agent To Do`
- Primary archive list for pruned or completed backlog work: `Agent Done/Archived`
- Default archive behavior: move pruned/completed cards into `Agent Done/Archived`; do not delete unless the user explicitly asks for deletion.

## Operating Sequence

1. Announce the chosen backlog item in narration before auditing or pruning it.
2. Audit the backlog item against repo truth.
3. Update the canonical backlog first.
4. Only after the repo change is correct, reconcile the matching Trello card.
5. Re-read both affected Trello lists after the move to confirm the correct card moved.

## Drag-And-Drop Guidance

- Prefer direct drag-and-drop between Trello lists over delete/recreate or move-dialog workarounds.
- Match cards by exact visible title before dragging.
- When browser automation is used, verify the source card position instead of assuming a generic drop point.
- After each drag, check both `Agent To Do` and `Agent Done/Archived` so accidental neighboring-card moves are corrected immediately.
- If a drag moves the wrong card, fix the board state right away before reporting completion.

## Communication Rules

- Narration should name the picked item first, then explain the audit or prune path.
- Do not pause for approval unless the user asks for it or the board scope becomes unclear.
- If a Trello action differs from the intended method, report that accurately.

## Stop Conditions

- Stop if the target board or list is not explicitly authorized.
- Stop if repo truth is too weak to justify a prune or completion move.
- Stop if the board action would require cleanup outside the authorized list scope.
