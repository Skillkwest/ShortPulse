# AI Studio Elements Library UI Spec (2026-04-06)

Status: Superseded historical reference  
Owner: Product + Frontend Engineering  
Depends on: `docs/planning/ai-studio-elements-library-ui-build-plan-2026-04-06.md`

> Historical note: superseded by the Elements decoupling packet dated 2026-04-09. Keep this document as an early UI contract reference only; it is no longer the active source of truth for the live Elements implementation. Any alias-field references below are historical; shipped Elements now derive workflow tokens from element name and do not expose alias authoring in the UI.

## Purpose

Define the concrete UI contract for the new AI Studio Elements library surface so implementation can proceed without reopening product decisions.

## Left Rail Placement

Section:
- `Libraries`

Order:
1. `Media`
2. `Characters`
3. `Elements`
4. `Prompt Presets`
5. `Styles`

Behavior:
- clicking `Elements` opens the dedicated Elements panel
- clicking it while active follows the same active-state rules as the existing `Characters` and `Media` library tools
- visual treatment should match existing secondary library tools
- the new toolbar item should not introduce a one-off active-state pattern or special-case toggle behavior

## Embedded Header

The panel header should mirror the Character Library’s embedded contract:
- eyebrow:
  - `Elements`
- tab row:
  - `Manage Elements`
  - `Element Profile`

Default tab:
- `Manage Elements`

Reason:
- a library should land in browse mode first
- the profile editor is secondary until an element is chosen or created
- this is intentionally different from the embedded Character panel, which currently opens directly into profile/create mode

## Manage Elements View

### Header block

Content:
- heading: `Elements Library`
- helper copy:
  - `Create reusable subjects, props, and scene elements for future Kling workflows.`
- action:
  - `Create New Element`

### Card layout

Preferred layout:
- responsive grid on wide surfaces
- stacked list on narrow panel widths

Each card should include:
- thumbnail
- element name
- short sublabel:
  - asset type
  - optional alias
- selected state
- delete affordance

Card examples:
- `Red Lantern`
- `Vintage Sedan`
- `Street Crowd`

### Manage view states

Empty:
- headline:
  - `No elements yet`
- copy:
  - `Create your first reusable element to build a library for Kling scenes and prompt references.`
- CTA:
  - `Create New Element`

Loading:
- 4 to 6 skeleton cards
- preserve final card rhythm and density

Populated:
- visible card grid/list
- active selection highlight

Delete:
- explicit confirm dialog

## Element Profile View

### Top-level structure

The profile view should be a stacked editor with four sections:
1. Identity
2. Type
3. Reference Assets
4. Notes and Prompt Guidance

### Identity section

Fields:
- `Element Name`
- `Token Alias` or `Prompt Alias`
- `Description`

Rules:
- `Element Name` is required
- alias is optional in the first pass
- description is optional but recommended
- alias should be normalized for future prompt-token compatibility, but the first-pass UI does not expose provider formatting details

Helper copy:
- `This name will later map to prompt references for Kling element binding.`

### Type section

Control:
- segmented selector or pill selector
  - `Image Element`
  - `Video Element`

Rules:
- `Image Element`
  - supports multiple image references
- `Video Element`
  - supports a single reference video
- switching types should preserve local draft state only when it remains valid for the new type; invalid asset fields should be cleared with an explicit confirmation in implementation

Future validation boundary:
- image elements are expected to resolve to `2..4` reference images
- future provider delivery must respect Kie image constraints:
  - JPG/PNG
  - at least `300x300`
  - max `10MB` each
- video elements are expected to resolve to one reference video
- future provider delivery must respect Kie video constraints:
  - MP4/MOV
  - max `50MB`

### Reference Assets section

#### Image element mode

Show:
- primary preview
- image reference slots
- add-image CTA
- remove-image controls

Copy:
- `Add 2 to 4 reference images for this element.`

#### Video element mode

Show:
- one video dropzone or upload surface
- poster/thumbnail preview state
- remove control

Copy:
- `Add one reference video for this element.`

### Notes and Prompt Guidance section

Show:
- short helper note about future prompt use
- example tokenized usage

Example copy:
- `Future Kling prompts can reference this element by name, for example: @RedLantern.`

This section is guidance-only in the first pass.

### Explicit first-pass exclusions

Do not include in this lane:
- provider submission controls
- Kling model settings inside the Elements library shell
- auto-linking to the current video properties panel
- cross-library drag promotion from Media Library or Characters
- any copy implying that Kie-hosted upload URLs are the canonical saved form of an element

## Create vs Edit Modes

### Create mode

Header:
- `Create Element`

Behavior:
- blank form
- no delete action
- primary CTA:
  - `Save Element`

### Edit mode

Header:
- `Element Profile`

Behavior:
- populated form
- delete available
- primary CTA:
  - `Save Changes`

## Interaction Rules

1. Selecting a card in `Manage Elements` switches to `Element Profile`.
2. Clicking `Create New Element` switches to `Element Profile` in create mode.
3. Saving a new element returns the user to the profile view for the newly created element.
4. Deleting an element returns the user to `Manage Elements`.
5. Switching between tabs must preserve unsaved local edits only if we explicitly choose draft retention in implementation. Recommended first pass:
   - keep local edits in-memory until panel close or explicit reset
6. `Create New Element` should be present in `Manage Elements` header and available from empty state. The populated add-tile treatment is optional and should not block the first implementation.

## Responsive Rules

Desktop/wide panel:
- card grid in manage mode
- full stacked profile editor

Medium panel:
- denser list/grid hybrid in manage mode
- profile editor remains stacked

Narrow panel:
- single-column list
- full-width CTAs
- tighter section spacing

Recommended implementation posture:
- start with the simpler deterministic list fallback for narrow widths
- add denser card-grid breakpoints only if they can match existing Character Library readability

## Accessibility Requirements

- tab row uses ARIA-compliant tabs
- every card is keyboard reachable
- upload zones have explicit `aria-label`
- delete buttons announce target names
- helper text stays adjacent to the field it explains

## Visual Direction

Use the Character Library family language:
- dark card surfaces
- subtle border contrast
- compact spacing
- high-contrast typography
- neon-green primary action emphasis

Do not:
- introduce a new unrelated visual system
- make Elements feel like a modal utility instead of a library surface
- mirror the raw Kling settings rows directly

## Durability Note

The first-pass UI should speak in terms of reusable library assets, not provider uploads. Official Kie docs treat uploaded file URLs as integration inputs, while Kie’s general retention policy is finite for hosted task artifacts. The Elements library must therefore remain product-owned in language and structure.

## Definition Of Done

The UI spec should be considered implemented only when:
- the left-rail entry is live
- the embedded shell is reachable from AI Studio without ad hoc routing
- manage and profile tabs behave deterministically
- empty, loading, populated, create, edit, and delete-confirm states are all visually designed
- layout and interaction tests cover the new panel at the same confidence level as adjacent library surfaces
