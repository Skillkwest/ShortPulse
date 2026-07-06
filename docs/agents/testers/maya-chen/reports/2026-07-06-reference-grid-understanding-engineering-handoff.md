# Engineering Handoff: Reference Grid Understanding

Date: 2026-07-06
Tester: Maya Chen
Scenario: Understand Reference Grid.
UGC project goal: Tiny Apartment Reset Kit ladder step 6, reuse saved images before spending more credits.
Production surface: `https://www.shortpulse.ai/ai-studio?projectId=0cc5e653-de94-42ad-b42b-d984ffc27d4e`
Session duration: about 25 minutes including setup, re-entry, and note preservation.
Credits spent: 0
Run status: completed with reuse-workflow clarity concerns

## Summary

Maya successfully reopened the existing renter-reset project, confirmed the account balance remained `342 / 350`, and verified that two generated images persisted across Media and Reference Grid. The saved-work foundation is improving: the images were findable, persisted after a new AI Studio restore, and appeared in both Media and the right rail.

Decision impact: Reference Grid appears functionally useful, but its customer-visible meaning is underexplained. Maya can see saved images, but she cannot tell whether the grid is a permanent library, temporary tray, or active reference input, which blocks confidence before the next paid generation.

## Validation Boundary

- Proved in production Chrome as Maya.
- Fresh real Google Chrome window was used for customer-visible testing.
- No generation was run.
- No credits were spent.
- No media was deleted, removed, downloaded, uploaded, or added.
- No account, billing, subscription, or project mutation was intentionally performed.
- Browser-visible text, controls, and screenshots were used for the live customer findings.
- Hidden database state, direct API reads, local app state, and service-role data were intentionally not used to decide customer-visible outcomes.
- Admin publish status: published and verified after ingest.

## Human Behavior Metrics

| Metric                                       | Value                | Notes                                                                                       |
| -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| Time to first confident next step            | `~2 min`             | Dashboard made `Open Projects` feel obvious.                                                |
| Time to basic mental map                     | `~12 min`            | Media was understandable as saved-work; Reference Grid role remained unclear.               |
| Navigation confidence                        | `3/5`                | Maya could navigate but had to infer section meaning.                                       |
| Clarifying question count                    | `10`                 | Questions centered on saved location, active references, and safe actions.                  |
| Authentic Maya questions before credit spend | `not applicable`     | No credit spend allowed.                                                                    |
| Backtrack count                              | `4`                  | Wrong Google login path, project tile second-click, Media comparison, toggle restore.       |
| Human error/backtrack notes                  | `customer-plausible` | Maya treated top labels as navigation before discovering show/hide behavior.                |
| Human nuance signal                          | `trust shift`        | Saved-work pride increased; reuse confidence dropped around delete/remove/toggle ambiguity. |
| Dead-end count                               | `1`                  | No plain explanation of Reference Grid's role was found.                                    |
| Credit anxiety                               | `2/5`                | No spend, but uncertainty would block future spend.                                         |
| Spend readiness                              | `1/5`                | Maya would not generate from Reference Grid until reference semantics are clearer.          |
| Cost clarity                                 | `clear but not used` | Generate showed `4`; no generation occurred.                                                |
| Prompt confidence                            | `not applicable`     | No prompt.                                                                                  |
| Generation wait trust                        | `not applicable`     | No generation.                                                                              |
| Output usefulness                            | `not applicable`     | Existing images remain potentially useful.                                                  |
| Save confidence                              | `4/5`                | Images restored in Media and Reference Grid.                                                |
| Find-it-again success                        | `partial`            | Saved media yes; prompt/reference role still unclear.                                       |
| Review risk                                  | `mild to moderate`   | Confusing enough for caution, not an outright failure.                                      |
| Customer support risk                        | `medium`             | Maya would ask what Reference Grid does before spending more.                               |
| Retention risk                               | `medium`             | Maya would keep using Media, but hesitate on reference-based generation.                    |
| Product decision signal                      | `reuse-workflow`     | Clarify Reference Grid/Quick Slot semantics before expecting repeat generation workflows.   |
| Repeat finding                               | `yes`                | Continues saved-work/reuse-workflow confusion from prior Maya reports.                      |

## Reproduction Steps

1. Open a fresh real Google Chrome window.
2. Navigate to `https://www.shortpulse.ai`.
3. Sign in as Maya.
   - Observed friction: the login page includes multiple sign-in paths; Maya accidentally triggered Google first, then recovered through email sign-in.
4. On Dashboard, observe:
   - `AI CREDITS 342 / 350`
   - plan `Starter`
   - `Open Projects`
5. Click `Open Projects`.
6. Click/select `5-minute renter reset tests`, then click the project tile again to open AI Studio.
   - Observed friction: first click exposes `Open`; the tile/open affordance can feel like a selection step rather than immediate open.
7. In AI Studio, observe:
   - project name `5-minute renter reset tests`
   - credits `342 / 350`
   - `Quick Slot Inventory`
   - `Reference Grid`
   - `Media: 2/500`
   - two image thumbnails in the right rail
   - `Generate` cost `4`
8. Click left-nav `Media`.
9. Observe Media panel:
   - `2 SAVED`
   - two saved images
   - right rail still shows `Reference Grid` and `Media: 2/500`
10. Click first saved media tile.
11. Observe selection state and `Delete from library`.
12. Click top `Reference Grid`.
13. Observe Reference Grid hides.
14. Click `Reference Grid` again.
15. Observe Reference Grid reappears.
16. Reopen AI Studio in a fresh Chrome session.
17. Observe project restore checklist, then AI Studio with the same two reference images.
18. Click top `Quick Slot Inventory`.
19. Observe Quick Slot hides while Reference Grid remains visible.

## Expected Behavior

Maya expected customer-visible answers to these questions:

- Is Reference Grid a saved library, a temporary tray, or active generation input?
- Are the two images in Reference Grid the same two saved Media items?
- If I select a Media item, how do I use it as a reference?
- Do the top `Reference Grid` and `Quick Slot Inventory` controls navigate, focus, or hide/show sections?
- Are remove/delete actions destructive to saved media or only to the current reference grid?

## Actual Behavior

The two images persisted and appeared in both Media and Reference Grid. The AI Studio restore checklist explained the saved-project restore process. However, Reference Grid's customer-facing purpose was not explained. The top `Reference Grid` and `Quick Slot Inventory` labels behaved as show/hide toggles, but looked like navigation labels. Selecting a Media image surfaced `Delete from library`, while an obvious `Use as reference` or `Add to Reference Grid` path was not visible to Maya.

## Findings

### Finding 1: Saved media and Reference Grid persisted across project re-entry

Severity: positive

Issue tags: `saved-work`, `reference-grid`, `project-restore`, `positive`

Observed behavior:

- Dashboard and AI Studio showed the same `342 / 350` credit balance.
- The `5-minute renter reset tests` project reopened.
- Two images appeared in Media as `2 SAVED`.
- The same two images appeared in Reference Grid as `Media: 2/500`.
- On fresh AI Studio re-entry, a restore checklist appeared and the right-rail items returned.

Protected behavior:

- Preserve project restore messaging.
- Preserve saved media persistence.
- Preserve right-rail restoration across AI Studio re-entry.
- Preserve visible credit balance before generation.

### Finding 2: Reference Grid role is not explained clearly enough for paid reuse workflows

Severity: workflow confusion / trust damage / support risk

Issue tags: `reference-grid`, `reuse-workflow`, `media-library`, `saved-work`, `support-risk`

Customer risk:

- Maya can see her images but cannot confidently use them as references.
- She will avoid spending another `4` credits because she does not know which images will influence generation.
- She may contact support to ask what Reference Grid does before continuing.

Visible customer question:

- "Are these saved images active references for my next generation, or are they just visible here?"

Observed behavior:

- Right rail shows `Reference Grid`, `Media: 2/500`, thumbnails, and `Add files`.
- No plain helper copy explains whether these are active generation references, saved media, or temporary workspace items.
- Media shows the same two images as `2 SAVED`, but the relationship is inferred from matching thumbnails/counts.
- Selecting a Media tile surfaces `Delete from library` before any obvious reuse action.

#### Fix Packet: Explain Reference Grid as a reuse workflow

- Issue tags: `reference-grid`, `reuse-workflow`, `media-library`, `saved-work`, `support-risk`
- Repeat finding: `yes`; related to earlier prompt/context and find-it-again reports.
- Customer impact: Maya cannot tell how to reuse paid images as references, so she stops before spending more credits.
- Product decision impact: trust / retention / support / credits
- Suspected owning surface: AI Studio right rail, Reference Grid UI, Media panel selection actions.
- Likely source boundary: UI copy/controls for shared AI Studio right rail and Media Library interaction; exact component boundary should be audited before edits.
- Canonical fix expectation: The product should clearly tell customers what Reference Grid contains, whether items are active references for generation, how saved Media enters/leaves the grid, and what remove/delete actions affect.
- Acceptance criteria:
  - In AI Studio, a customer can understand in plain language that Reference Grid contains current generation references or saved media references, whichever is canonical.
  - Media selection exposes a non-destructive reuse path when reuse is intended, or clearly explains that selection is only for library management.
  - Remove-from-grid language is distinguishable from Delete-from-library language.
  - After reloading/re-entering the project, the grid's restored state remains understandable.
  - Existing saved media persistence and right-rail restoration remain unchanged.
- Validation steps:
  - Fresh Chrome as Maya, open existing project.
  - Observe Reference Grid helper/label state before any click.
  - Open Media, select a saved image, and confirm the visible actions explain reuse versus deletion.
  - Toggle/reopen Reference Grid and confirm restored items remain understandable.
  - Do not spend credits or delete media during validation.
- Protected behavior:
  - Do not fork Reference Grid into workflow-local state.
  - Do not regress the global right-rail contract.
  - Do not change credit costs, generation submit behavior, media persistence, or project restore semantics.
  - Do not make destructive media actions easier to click accidentally.
- Stop/escalation condition:
  - Stop before materially changing right-rail product semantics, saved-media ownership, reference persistence rules, generation input semantics, or destructive media behavior without explicit product approval.

### Finding 3: Right-rail top labels behave as toggles but read like section navigation

Severity: visual/copy friction / workflow confusion

Issue tags: `reference-grid`, `quick-slot-inventory`, `right-rail`, `workflow-confusion`

Observed behavior:

- Clicking `Reference Grid` hid the Reference Grid section.
- Clicking it again restored the section.
- Clicking `Quick Slot Inventory` hid Quick Slot Inventory and left Reference Grid visible.
- The labels look like section names/tabs, not visibility toggles.

Customer risk:

- Maya can recover by clicking again, but only after learning through trial and error.
- A new user may think the panel vanished or that they navigated to the wrong area.

Suggested investigation:

- Audit whether these controls have visible active/collapsed affordances, aria-expanded state, and tooltip/copy that matches their behavior.
- Preserve the existing show/hide functionality if it is intentional.

### Finding 4: Project tile open flow creates a minor "did I click right?" moment

Severity: visual/copy friction

Issue tags: `projects`, `dashboard`, `workflow-confusion`

Observed behavior:

- Clicking the project tile exposed an `Open` affordance instead of immediately opening the project.
- Clicking the tile again opened AI Studio.

Customer risk:

- Minor only. Maya recovered quickly, but the flow adds one unnecessary uncertainty on return.

Suggested investigation:

- Audit whether the project card should have a clearer visible `Open` button or immediate-open behavior. Preserve any intentional selection/delete affordance if the card supports project management actions.

## Issue Pattern And Prior Reports

Repeat pattern:

- Prior report: `docs/agents/testers/maya-chen/reports/2026-07-05-find-generated-image-context-engineering-handoff.md`
- Prior report: `docs/agents/testers/maya-chen/reports/2026-07-05-prompt-detail-recovery-engineering-handoff.md`
- Prior report: `docs/agents/testers/maya-chen/reports/2026-07-06-find-both-assets-later-engineering-handoff.md`
- Current run adds: right-rail Reference Grid and Quick Slot toggle proof, plus Media/Reference Grid relationship ambiguity.
- Do not keep re-proving unless: right-rail copy/controls change, media reuse behavior changes, or user requests a regression run.

Pattern summary:

Maya increasingly trusts that images are saved and recoverable. She still does not trust the broader reuse workflow because prompt/context recovery and reference-grid semantics are unclear.

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-reference-grid-understanding/01-reference-grid-starting-state.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-reference-grid-understanding/02-reference-grid-hidden-after-toggle.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-reference-grid-understanding/03-quick-slot-hidden-reference-grid-visible.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-reference-grid-understanding/evidence-manifest.md`
- `docs/agents/testers/maya-chen/workspace/notes/2026-07-06-reference-grid-understanding-live-notes.md`

## Non-Goals

- No generation.
- No prompt drafting.
- No credit spend.
- No media deletion/removal.
- No upload/download.
- No account, billing, subscription, or project cleanup.
- No direct database/API inspection during the live customer journey.

## Admin Publish Status

- Status: published
- External run id: `2026-07-06-reference-grid-understanding`
- Admin tab verification: production `tester_report_runs` row verified after ingest; row has status `completed`, `credits_spent` 0, both report bodies, 6 artifact paths, and evidence payload
- Notes: Published through the internal tester-report ingest handler after local report completion.

## Baseline Comparison

Run: Reference Grid Understanding
Date: 2026-07-06
Compared against: `baseline-kpi-2026-07-05.md`

Overall score: `8.9`
Delta from baseline: `+0.5`

Categories improved:

- Maya preserved first-person questions and realistic customer mistakes.
- Screenshots were diagnostic and limited to right-rail/reference confusion.

Categories degraded:

- Browser duration was shorter than the target 45-minute work block because the no-spend scenario reached a safe stop condition early.

Non-negotiable fail conditions triggered:

- None.

What changed in Maya's behavior:

- Maya stayed goal-directed and stopped before destructive media actions or credit spend.

Correction to carry into next run:

- When a no-spend scenario finishes early, continue natural exploration around the same customer goal before ending the browser session.

## Maya Self-Audit Summary

- Persona fidelity: 9
- Human realism: 9
- Question-first behavior: 9
- Natural customer navigation: 8
- Credit discipline: 10
- Evidence quality: 9
- Behavior metrics quality: 9
- Report usefulness: 10
- Admin publish completion: 9
- Workspace memory hygiene: 9
- Stop/resume discipline: 8
- Overall: 8.9
- Coach question answer: I stayed customer-like in the visible browser flow: wrong first login path, project open recovery, Media comparison, and cautious stopping before delete/remove/generate actions were plausible Maya behaviors. I became slightly tester-like when reading accessible labels for icon-only controls, but I used that only to describe visible UI meaning for the engineering handoff.
- Correction for next run: keep same-goal exploration going longer before ending narrow no-spend scenarios, as long as the extra clicks remain natural and do not drift into coverage.
