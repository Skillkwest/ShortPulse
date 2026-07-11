# Maya Report: Quick Slot Remembered My Image, But I Had To Guess What It Was For

Date: 2026-07-10
Scenario: Understand Quick Slot Inventory.
UGC goal: Tiny Apartment Reset Kit, understand whether a saved image can stay ready for reuse.
Session duration: about 25 minutes including setup, sign-in, project restore, persistence check, and notes.
Credits spent: 0
Run status: partial - browser scenario, local reports, and Admin ingest completed; Admin-page verification remains blocked by missing operator session

## My Quick Scores

| Metric                | Value      | Notes                                                                                              |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| Navigation confidence | `3/5`      | I reached the project and Quick Slot, but the project modal and right rail needed trial and error. |
| Credit anxiety        | `1/5`      | I did not generate, and the visible account balance stayed `1,542 / 1,200`.                        |
| Spend readiness       | `2/5`      | I would hesitate to generate until I know what Quick Slot actually controls.                       |
| Save confidence       | `4/5`      | The project, two Media items, two Reference Grid items, and one Quick Slot item persisted.         |
| Reuse confidence      | `2/5`      | I can see a curated image, but I cannot find a plain way to add or use another one.                |
| Review risk           | `moderate` | The feature seems to work underneath, but it makes a basic reuse task feel mysterious.             |

## Customer Journey Snapshot

| Journey moment        | My customer read                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting intent       | I wanted to know whether Quick Slot helps me keep a renter-reset image ready to reuse.                                                             |
| First confidence lift | My saved project and two generated images were still there.                                                                                        |
| First doubt           | Clicking the saved project selected it first and only then changed the tile to `Open`.                                                             |
| Trust win             | One image stayed in Quick Slot after I hid it, reopened it, and reloaded the project.                                                              |
| Trust break           | The app says `Quick Slot Inventory`, but the item says `Remove from curated`, and I found no clear `Add to Quick Slot` or `Use this image` action. |
| End decision          | I would leave the tray alone until I understood what it controls.                                                                                  |

## What I Tried

I opened ShortPulse in a fresh Chrome window and signed in again. The dashboard showed my saved project, a Media plan, and `1,542 / 1,200` credits. AI Studio also said Starter is scheduled for August 8, but I did not change any account setting.

I opened Projects and clicked `5-minute renter reset tests`. The first click selected the project and changed the tile to `Open`; the second click actually opened AI Studio. I recovered, but I briefly thought the first click had done nothing.

In AI Studio, `Quick Slot Inventory` and `Reference Grid` looked like navigation labels. Clicking Quick Slot made it active, but I could not initially see what changed. After I opened Media, the relationship became visible: Quick Slot contained one image, Reference Grid contained both images, and Media contained both images.

I selected a saved Media image because I expected a reuse action. The obvious action that appeared was `Delete from library`, so I stopped. Clicking the image already in Quick Slot exposed actions including `Remove from curated`, download, re-roll, and `Pin text reference to reference grid`. The item is an image, and I did not want to remove or re-roll paid work just to learn the interface.

I hid and reopened Quick Slot, then reloaded the project. The same image remained. That helped me understand it as a persistent curated tray rather than a temporary selection. I still do not know how the image got there, how to add the second image, or whether Quick Slot changes the next generation.

## What Felt Clear

- My project and two generated images are still saved.
- Quick Slot can be shown and hidden from the header.
- One image persisted in Quick Slot through hide, reopen, and reload.
- Reference Grid still contains both images.
- No credits were spent.

## What Felt Unclear

- Why one image is in Quick Slot while both are in Reference Grid.
- How to add a saved Media image to Quick Slot.
- Whether Quick Slot affects generation or only keeps favorites nearby.
- Why `Quick Slot Inventory` becomes `curated` in its item actions.
- Why an image action says `Pin text reference to reference grid`.
- Why Media selection exposes deletion more clearly than reuse.

## Product Decision Signal

- `Trust`: Persistence is strong; meaning and control are weak.
- `Retention`: I would return because my work is saved, but avoid changing Quick Slot without guidance.
- `Support`: I would ask how an image enters Quick Slot and whether it affects generation.
- `Revenue/Credits`: Unclear reference state lowers my willingness to spend again.
- `Launch readiness`: The state works, but the terminology and entry path are not self-explanatory.

## Customer Service Simulation

Support email I might send:

```text
Hi, one of my images is in Quick Slot Inventory and both are in Reference Grid, but I cannot tell how the first image got there or how to add the second one. Does Quick Slot affect my next generation, or is it just a favorites area? I do not want to remove or re-roll anything while I am still trying to understand it.
```

Bad review / public complaint risk:

```text
ShortPulse saved my images, but the workspace makes me guess what Quick Slot and Reference Grid do. I should not have to click around remove and delete controls just to understand how to reuse an image.
```

What would calm me down:

- One sentence explaining Quick Slot's purpose.
- A visible `Add to Quick Slot` or `Use as reference` action on saved Media.
- Consistent naming between `Quick Slot` and `curated`.
- Image-specific action labels instead of `Pin text reference`.
- A clear indication of whether an item affects the next generation.

## What I Would Do Next

I would continue cautiously, leave the current Quick Slot image alone, and avoid spending credits from this setup. I would ask support or wait for clearer controls before curating the second image.

## Behavior Metrics

| Metric                            | Value           | Notes                                                                            |
| --------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| Time to first confident next step | `~2 min`        | `Open Projects` was obvious.                                                     |
| Time to basic mental map          | `~14 min`       | Media revealed the one-versus-two relationship.                                  |
| Clarifying question count         | `9`             | Purpose, persistence, add/use behavior, and safety.                              |
| Backtrack count                   | `3`             | Project select/open, Quick Slot show/hide, and Media comparison.                 |
| Dead-end count                    | `1`             | No clear path to add the second image to Quick Slot.                             |
| Human nuance signal               | `trust shift`   | Persistence raised trust; remove/delete wording made me protective of paid work. |
| Credit anxiety                    | `1/5`           | No spend and no visible balance change.                                          |
| Spend readiness                   | `2/5`           | Low until active reference behavior is clear.                                    |
| Save confidence                   | `4/5`           | Project and right-rail items persisted after reload.                             |
| Find-it-again success             | `successful`    | Existing project and images were found.                                          |
| Review risk                       | `moderate`      | The feature feels unnecessarily hard to interpret.                               |
| Customer support risk             | `medium`        | I would ask how Quick Slot works before spending.                                |
| Retention risk                    | `low to medium` | Persistence helps; reuse ambiguity slows work.                                   |
| Repeat finding                    | `yes`           | Extends the July 6 Reference Grid finding with Quick Slot persistence proof.     |

## Issue Tags

- `quick-slot-inventory`
- `reference-grid`
- `media-library`
- `reuse-workflow`
- `terminology`
- `saved-work`
- `support-risk`
- `repeat-finding`

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-10-quick-slot-inventory/01-quick-slot-one-vs-reference-grid-two.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-10-quick-slot-inventory/evidence-manifest.md`

## Admin Publish Status

Ingest succeeded; Admin tab verification unproven.

- External run id reserved: `2026-07-10-quick-slot-inventory`
- Production ingest returned HTTP `200`, `ok: true`, and the expected external run id.
- The available Chrome session was Maya's non-admin account and `/admin/tester-reports` correctly showed `Access restricted`.
- Overall run remains `partial` until an operator-authenticated Admin session verifies both report cards.
