# AI Studio Elements Library Wireframes (2026-04-06)

Status: Superseded historical reference  
Owner: Product + Frontend Engineering

> Historical note: superseded by the Elements decoupling packet dated 2026-04-09. Retain this document only as a first-pass wireframe reference for the original embedded Elements surface shape. Any alias-field copy below is historical; shipped Elements now derive workflow tokens from element name and do not expose alias authoring in the live UI.

## Purpose

Provide implementation-facing wireframes for the first-pass Elements library UI inside the AI Studio embedded panel.

## Artifact 1: Manage Elements

```text
+-----------------------------------------------------------+
| Elements                                                  |
| [Manage Elements] [Element Profile]                       |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Elements Library                       [Create New Element]|
| Create reusable subjects, props, and scene elements for   |
| future Kling workflows.                                   |
+-----------------------------------------------------------+

+------------------+  +------------------+  +------------------+
| [thumb]          |  | [thumb]          |  | [thumb]          |
| Red Lantern      |  | Vintage Sedan    |  | Street Crowd     |
| Image element    |  | Image element    |  | Video element    |
| alias: lantern   |  | alias: sedan     |  | alias: crowd     |
|             [x]  |  |             [x]  |  |             [x]  |
+------------------+  +------------------+  +------------------+

+------------------+  +------------------+  +------------------+
| [thumb]          |  | [Add New Tile]   |  |                  |
| Market Stall     |  | + Create Element |  |                  |
| Image element    |  |                  |  |                  |
|             [x]  |  |                  |  |                  |
+------------------+  +------------------+  +------------------+
```

### Notes

- The `Create New Element` CTA exists both in the header and as a trailing add tile when populated.
- The header CTA is required; the add tile is optional sugar for a later polish pass.
- Cards use the same compact visual rhythm as the Character Library cards.
- The selected card should show a stronger border and label treatment.

## Artifact 2: Element Profile

```text
+-----------------------------------------------------------+
| Elements                                                  |
| [Manage Elements] [Element Profile]                       |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Element Profile                                           |
| Define reusable element identity and reference assets.    |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Identity                                                  |
| Element Name                                              |
| [ Red Lantern                                      ]      |
| Prompt Alias                                              |
| [ lantern                                          ]      |
| Description                                               |
| [ Small glowing paper lantern used in night scenes ]      |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Type                                                      |
| [Image Element] [Video Element]                           |
| Choose how this element will be represented later in      |
| Kling workflows.                                          |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Reference Assets                                          |
| Add 2 to 4 reference images for this element.             |
|                                                           |
| +-------------+ +-------------+ +-------------+           |
| |   image 1   | |   image 2   | |  add slot   |           |
| |    [x]      | |    [x]      | |      +      |           |
| +-------------+ +-------------+ +-------------+           |
|                                                           |
| [Add Image]                                               |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Notes and Prompt Guidance                                 |
| Future Kling prompts can reference this element by name.  |
| Example: @RedLantern                                      |
+-----------------------------------------------------------+

                     [Delete Element]   [Save Changes]
```

### Video element variant

```text
+-----------------------------------------------------------+
| Type                                                      |
| [Image Element] [Video Element]                           |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Reference Assets                                          |
| Add one reference video for this element.                 |
|                                                           |
| +-------------------------------------------------------+ |
| |                  video dropzone / poster              | |
| |          Drop video or click to upload                | |
| +-------------------------------------------------------+ |
|                                                           |
| [Replace Video]                                           |
+-----------------------------------------------------------+
```

## Artifact 3: Narrow Panel Adaptation

```text
+-------------------------------------------+
| Elements                                  |
| [Manage Elements] [Element Profile]       |
+-------------------------------------------+

+-------------------------------------------+
| Elements Library                          |
| Create reusable elements for Kling.       |
| [Create New Element]                      |
+-------------------------------------------+

+-------------------------------------------+
| [thumb] Red Lantern                  [x]  |
| Image element                              |
+-------------------------------------------+

+-------------------------------------------+
| [thumb] Vintage Sedan                [x]  |
| Image element                              |
+-------------------------------------------+
```

### Narrow-panel rules

- cards collapse into one column
- CTAs become full width
- delete remains visible and accessible
- no hover-only dependency
