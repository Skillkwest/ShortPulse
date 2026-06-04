# Media Library Organization Split Handoff

Date: 2026-06-03
Source: Copperknot media-library organization launch-readiness handoff as relayed in the active Holomony thread. The originally cited Copperknot handoff path was not present during this split pass, so this packet preserves the actionable scope from the thread context.

## Decision

Do not assign the full Media Library and organization launch-readiness packet to one agent.

Split the lane:

- Datserok owns project persistence, autosave, project association, and restore semantics.
- Holomony owns media display, preview signing, browse/detail correctness, and media reuse behavior across owned surfaces.
- Backend/storage/folder authority should remain bounded proof work only unless a source audit finds a concrete server-side blocker.

This split prevents Copperknot's broad packet from turning into patch-chasing while preserving launch-readiness proof.

## Datserok Lane

Datserok should handle:

- autosave-off behavior and proof that automatic Media Library persistence is blocked when expected;
- project association for saved media and prompts when an active project exists;
- reopen/restore durability for project-associated media and prompt references;
- duplicate-prevention between global Media Library rows and project-linked references;
- restore contracts for media in Quick Slot, Canvas, and project workspace state when the symptom is persistence or association;
- persistence validation caveats around `mediaLibraryPersistence.test.ts` if they become reproducible in a bounded persistence path.

Datserok should not own:

- media card preview rendering quality;
- detail modal URL selection;
- preview signing performance;
- wrong-asset display;
- Supabase image transformation enforcement except as it affects persisted project state.

Suggested Datserok proof:

- source audit of project association and autosave-off persistence paths;
- focused tests around `mediaLibraryPersistence`, project workspace restore, and autosave-off media persistence;
- explicit blocker/watch-item classification for any persistence validation instability.

## Holomony Lane

Holomony will handle:

- preview signing and browse-grid correctness for AI Studio Media Library;
- media display correctness in Reference Grid, Quick Slot Inventory, Canvas media drops/display, Character media carriage, and Elements media carriage;
- Detail Modal and Media Library preview modal media URL authority;
- video poster-vs-playable-source correctness;
- no wrong assets, no broken-media UI as normal state, and no Supabase image transformations;
- performance of first-visible media previews where it affects display reliability.

Holomony should not own:

- autosave-off persistence semantics beyond diagnosing display symptoms;
- project association source-of-truth decisions;
- folder membership persistence unless the symptom is visible media display or media handoff;
- broad server rewrite or UI/UX redesign.

Suggested Holomony proof:

- focused media display/signing tests;
- source audit for no Supabase transform usage in owned display paths;
- browser/manual production validation after deploy for Media Library, Reference Grid, Quick Slot, Detail Modal, Canvas, Character carriage, and Elements carriage.

## Backend / Folder Authority Boundary

The following items are not automatically Holomony or Datserok implementation work:

- direct upload prepare/finalize server contracts;
- compatibility upload route behavior;
- copy-from-url server authority;
- folder CRUD, nested hierarchy, membership move/remove, and ownership validation;
- character-scoped media exclusion from global folder membership.

If these need work, first produce a bounded source audit and decide whether the owner is Datserok, Holomony, Nuclo, Bactuo, or Copperknot. Do not absorb the whole folder/server lane by default.

## Shared Stop Rules

- Do not change UI/UX by default.
- Do not make Media Library folders project-local.
- Do not weaken private storage, ownership, RLS, or signed-preview boundaries.
- Do not use Supabase image transformations.
- Do not run credit-consuming generation proof.
- Do not keep expanding the lane after a couple focused passes; return a narrower handoff instead.

## Return To Copperknot

Copperknot should receive two evidence packets:

1. Datserok persistence/project-association packet.
2. Holomony media-display/preview-signing packet.

Each packet should separate:

- launch blockers;
- watch items;
- post-launch polish;
- validation instability caveats.

The Media Library and organization lane should move out of `Below Bar - Handed Off` only after Copperknot accepts both packets under the active launch evidence ladder.
