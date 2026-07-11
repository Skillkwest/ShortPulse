# Engineering Handoff: Quick Slot Inventory Understanding

Date: 2026-07-10
Tester: Maya Chen
Scenario: Understand Quick Slot Inventory.
UGC goal: Tiny Apartment Reset Kit, understand whether a saved image can stay ready for reuse.
Production surface: `https://www.shortpulse.ai/ai-studio`
Session duration: about 25 minutes including setup, sign-in, project restore, persistence check, and notes.
Credits spent: 0
Run status: partial - browser scenario, local reports, and Admin ingest completed; Admin-page verification remains blocked by missing operator session

## Summary

Maya reopened the renter-reset project in production Chrome. Two generated images remained in Media and Reference Grid, while one image remained in Quick Slot Inventory after the section was hidden, reopened, and the project page was reloaded. No generation, deletion, removal, upload, download, billing change, or credit spend occurred.

Decision impact: Quick Slot behaves like a persistent curated tray, but the customer-visible contract is not discoverable. The UI does not explain why one image is curated, how to add another saved image, whether curated items affect generation, or why `Quick Slot Inventory` changes to `curated` and `Pin text reference` inside image actions.

## Validation Boundary

- Proved through visible production Chrome behavior as Maya.
- Fresh Chrome browser surface was used.
- Project restore, Quick Slot show/hide, Media comparison, and page reload were exercised.
- Visible balance stayed `1,542 / 1,200`; no credits were spent.
- No destructive, billing, subscription, generation, upload, download, or account-setting action was performed.
- No hidden state, database read, API inspection, or code inspection decided the customer-visible finding.
- Media plan with Starter scheduled for August 8 was observed but not treated as a bug because this run did not establish prior-state proof.
- Admin publish status: ingest succeeded; Admin tab verification unproven.

## Reproduction Steps

1. Open production ShortPulse in a fresh Chrome window and sign in as Maya.
2. Click `Open Projects` on Dashboard.
3. Click `5-minute renter reset tests`; observe the tile changes to `Open` instead of opening.
4. Click it again to enter AI Studio.
5. Click `Quick Slot Inventory`, then open `Media`.
6. Observe two Media items, two Reference Grid items, and one Quick Slot item.
7. Select one Media image; observe `Delete from library` and no clear `Add to Quick Slot` or `Use as reference` action.
8. Click the Quick Slot image; observe `Remove from curated`, download, re-roll, and `Pin text reference to reference grid`.
9. Hide and reopen Quick Slot, then reload the project page.
10. Observe that the Quick Slot item and both Reference Grid items persist.

## Findings

### QSI-01: Quick Slot purpose and activation contract are not explained

- Severity: `P2 UX / spend-confidence friction`
- Customer impact: Maya cannot tell whether Quick Slot is favorites, active generation context, recent output, or a curated tray.
- Product risk: customers may avoid paid generations because they cannot tell what context will be used.

### QSI-02: Terminology is inconsistent and image actions are mislabeled

- Severity: `P2 UX / terminology defect`
- Customer impact: `Quick Slot Inventory` becomes `curated`, and an image exposes `Pin text reference to reference grid`.
- Product risk: customers must translate internal concepts and may mistrust actions around paid media.

### QSI-03: Saved Media exposes deletion more clearly than reuse

- Severity: `P2 UX / workflow discoverability`
- Customer impact: selecting a saved image exposes `Delete from library`, but no clear Quick Slot or reference reuse action.
- Product risk: reuse feels risky and support-heavy even though persistence works.

## Agent Fix Packet: Quick Slot Reuse Contract

- Issue tags: `quick-slot-inventory`, `reference-grid`, `media-library`, `reuse-workflow`, `terminology`, `support-risk`
- Repeat finding: yes; extends `2026-07-06-reference-grid-understanding-engineering-handoff.md`.
- Customer impact: Maya can recover saved media but cannot confidently curate or reuse it before another paid generation.
- Product decision impact: trust, repeat usage, support burden, and credit-spend readiness.
- Suspected owning surface: AI Studio global right rail, Quick Slot item actions, and Media reuse affordances.
- Likely source boundary: unknown from customer-visible testing; trace the canonical global right-rail implementation before editing.
- Canonical fix expectation: explain Quick Slot purpose, persistence, add/remove path, and effect on generation using one consistent vocabulary.

Acceptance criteria:

- A new customer can state what Quick Slot does without destructive experimentation.
- The UI distinguishes saved Media, Reference Grid items, and Quick Slot curated items.
- A saved image has a discoverable non-destructive route to Quick Slot, or the UI explains intentional automatic curation.
- Image actions do not use text-reference labels.
- `Quick Slot Inventory` and `curated` are reconciled or explicitly connected.
- The UI states whether Quick Slot membership affects the next generation.
- Existing project restore and right-rail persistence continue to work.

Validation steps:

1. Use a fresh production Chrome session with a project containing two saved images.
2. Verify a first-time customer can discover Quick Slot's purpose and add/use path.
3. Add or identify one Quick Slot item without deletion, removal, download, or generation.
4. Hide/reopen Quick Slot and reload the project; verify persistence.
5. Verify image actions have image-appropriate visible and accessible names.
6. Confirm Reference Grid and Quick Slot remain workspace-global across workflows and Create modes.
7. Run focused right-rail and Media interaction tests owned by the canonical implementation.

Protected behavior:

- Quick Slot and Reference Grid remain workspace-global right-rail surfaces.
- Curated item persistence across reload remains intact.
- Saved Media and Reference Grid persistence remain intact.
- Show/hide behavior remains available.
- Delete/remove actions remain distinct.
- Generation cost, credit debit, billing, and project persistence contracts do not change without approval.

Stop/escalation condition:

- Stop before changing whether Quick Slot influences generation, curation persistence, delete/remove semantics, project/global ownership, or billing/credit behavior without owner approval.

## Issue Pattern And Prior Reports

- Prior report: `docs/agents/testers/maya-chen/reports/2026-07-06-reference-grid-understanding-engineering-handoff.md`
- Current run adds: Quick Slot persistence through close/reopen and reload, plus visible `Remove from curated` and image `Pin text reference` proof.
- Do not re-prove unless the UI changes, a deploy claims a fix, or the user requests regression testing.

## Product Strengths To Protect

- The project restored successfully.
- Both generated images remained saved and findable.
- Reference Grid retained both images.
- Quick Slot retained its curated image after reload.
- The balance remained visible and no spend occurred.

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-10-quick-slot-inventory/01-quick-slot-one-vs-reference-grid-two.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-10-quick-slot-inventory/evidence-manifest.md`

## Admin Publish Status

Ingest succeeded; Admin tab verification unproven.

- External run id: `2026-07-10-quick-slot-inventory`
- Ingest proof: production returned HTTP `200`, `ok: true`, and the expected external run id.
- Admin verification blocker: the available Chrome session was authenticated as Maya's non-admin account and the Admin page showed `Access restricted`.
- Required next proof: open `/admin/tester-reports` in an operator-authenticated Chrome session, locate the exact run id, and expand both report cards.
