# Canvas Behavior Matrix

Baseline matrix for canvas interaction hardening. This document is the contract checkpoint for refactors in the canvas workspace controller.

| Area                               | Behavior                                                    | Contract                                                                 |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Empty-space text create            | `dblclick` on empty viewport                                | Creates one draft text item at pointer world coordinate                  |
| Empty-space text create fallback A | `pointerdown` with `detail >= 2`                            | Creates one draft text item when browser `dblclick` is not dispatched    |
| Empty-space text create fallback B | Double-tap on `pointerup` (time + distance threshold)       | Creates one draft text item when `detail`/`dblclick` path is unavailable |
| Draft dedupe                       | Mixed event paths from one gesture                          | Never creates duplicate drafts from one user gesture                     |
| Text edit                          | Double-click text item                                      | Opens text editor for that item, does not create new draft               |
| Text pin                           | Click pin button on text item                               | Calls `onPinTextReference(text)` and keeps item unchanged                |
| Item drag                          | Left drag selected item                                     | Moves item in canvas world space (camera zoom aware)                     |
| Item drag override                 | Space-pan or middle mouse drag on item                      | Pans camera instead of moving item                                       |
| Background pan                     | Drag empty viewport                                         | Updates camera x/y without modifying scene items                         |
| Wheel zoom                         | Wheel on viewport                                           | Zooms around pointer location                                            |
| Rail wheel isolation               | Wheel in rail viewport                                      | Prevents window scroll and applies viewport zoom only                    |
| Drop internal reference            | Reference-grid payload drop                                 | Resolves via `resolveCanvasDropReference`, inserts canvas item           |
| Drop external text                 | Plain/prompt text drop                                      | Inserts text canvas item with loading placeholder flow                   |
| Image placeholder sizing           | Drop image with known dimensions                            | Placeholder + final item use fitted aspect ratio immediately             |
| Image placeholder sizing fallback  | Drop image with unknown dimensions                          | Placeholder delayed until dimensions resolve, then matches final ratio   |
| Selection delete                   | `Delete`/`Backspace` with selection and no active text edit | Deletes selected scene items                                             |
| Context delete                     | Right click on canvas item                                  | Deletes target item                                                      |

Visual lock:

- Selected text item border is exactly `1px` with no shadow-based thickness.
