# Character Manager Redesign Plan

## Goal
Redesign the Character page from scratch into a beginner-first workspace that:
- Creates and manages characters.
- Collects a required 10-shot reference sheet (no LoRA training flow).
- Sends structured references to Seedream for consistency-driven generation.
- Reuses Media Library background/card surfaces, with green character accents.

## Naming
- Product/page name: **Character Manager**
- Route title: `Character Manager | ShortPulse`
- Dashboard card label: `Character`

## Decisions Locked
- Required references for v1: **exactly 10 required slots**.
- Activation gate: **only hard errors block activation**; warnings are visible but non-blocking.
- Viewpoint intelligence in v1: **manual guidance + deterministic validation only** (no classifier dependency in first release).
- Generation location: **run generation directly inside Character Manager** (no AI Studio handoff).

## UX Direction
Design priorities:
- One clear path for beginners: create character -> upload 10 required shots -> validate -> activate.
- No ambiguous upload area; each shot has its own labeled drop zone.
- Strong completion feedback: always show `x/10` completed and what is missing.
- Keep advanced options hidden until needed.

Primary page structure:
1. Header + progress summary.
2. Character list rail (manage existing characters).
3. Active character builder (10-slot intake).
4. Validation + activate panel.
5. Reference pack history/version section.

## 10 Required Reference Slots
All slots are required before activation.

| Slot Key | Label | Capture Guidance |
| --- | --- | --- |
| `front_full` | Front Full Body | Neutral front-facing, full body in frame, arms relaxed. |
| `side_profile` | Side Full Body | Perfect side profile, full body visible. |
| `back_full` | Back Full Body | Direct back view, full body visible. |
| `top_down` | Top-Down View | Camera above character, clear silhouette shape. |
| `front_left_34` | 3/4 Front Left | 45-degree front-left angle, full body visible. |
| `front_right_34` | 3/4 Front Right | 45-degree front-right angle, full body visible. |
| `back_left_34` | 3/4 Back Left | 45-degree back-left angle, full body visible. |
| `back_right_34` | 3/4 Back Right | 45-degree back-right angle, full body visible. |
| `portrait_close` | Extreme Portrait Close-up | Tight face framing for facial identity details. |
| `fullbody_wide` | Zoomed-Out Scale Shot | Wider framing to capture proportions and height scale cues. |

Drop-zone behavior per slot:
- Dedicated card with slot name, 1-line helper copy, and accepted file constraints.
- Drag/drop + click upload.
- Preview thumbnail + replace/remove controls.
- Slot state: `empty`, `uploaded`, `needs-review`, `approved`.

## Visual System (Based on Existing Surfaces)
Base surfaces must match Media Library:
- Page background: same as Media Library (`--color-bg` + current workspace body treatment).
- Panel/card styling: reuse `media-panel` / existing panel elevation and border language.
- Header/stat cards: same card treatment used on Media Library.

Character accent system (green):
- Primary gradient reference: dashboard character card + AI Studio canvas button.
- Accent palette:
  - `#0f766e`, `#059669`, `#34d399` (primary action and active states).
  - Hover lift variants matching existing toolbar character button behavior.
- Use green for:
  - Primary CTAs.
  - Active/complete slot outlines.
  - Progress ring and success badges.
  - Focus-visible outlines on character-specific controls.

## Data Model Plan
Use existing user-scoped media model and add character domain tables.

New tables (proposed):
1. `characters`
- `id uuid pk`
- `user_id uuid not null`
- `name text not null`
- `slug text null`
- `status text check ('draft','active','archived')`
- `active_reference_pack_id uuid null`
- timestamps

2. `character_reference_packs`
- `id uuid pk`
- `character_id uuid not null`
- `user_id uuid not null`
- `version integer not null`
- `status text check ('draft','validating','ready','failed')`
- `consistency_score numeric null`
- `seedream_payload jsonb not null default '{}'::jsonb`
- timestamps

3. `character_reference_images`
- `id uuid pk`
- `character_id uuid not null`
- `reference_pack_id uuid not null`
- `user_id uuid not null`
- `slot_key text not null` (10-key enum)
- `media_file_id uuid not null` (links to `media_files`)
- `storage_path text not null`
- `validation_status text check ('pending','pass','warn','fail')`
- `validation_notes jsonb`
- timestamps

4. `character_generation_jobs` (for observability/history)
- `id uuid pk`
- `character_id uuid not null`
- `reference_pack_id uuid not null`
- `user_id uuid not null`
- `provider text` (`fal-seedream`)
- `request_id text`
- `status text`
- `prompt text`
- `output_media_file_id uuid null`
- `metadata jsonb`
- timestamps

RLS:
- Strict `user_id = auth.uid()` for all new character tables.
- Storage paths scoped to `<auth.uid()>/characters/<character_id>/...`.

## Pipeline Plan
### A) Upload Pipeline
1. User uploads into a specific slot.
2. Client validates type/size/dimensions.
3. File stored in private bucket path under character slot.
4. Insert/Upsert `media_files` row with source `character_reference`.
5. Insert/Upsert `character_reference_images` row for slot.

### B) Validation Pipeline
Validation levels:
- Hard block: invalid format, unreadable image, missing required slot.
- Warning: low resolution, poor framing confidence, excessive blur.

Phase 1 validation:
- Deterministic checks only (format, dimensions, aspect sanity, duplicates by hash).
- Manual user override for warnings.
- Warning states never block activation when all hard checks pass.

Phase 2 validation:
- Add viewpoint classifier for slot confidence scoring.

### C) Reference Pack Assembly
1. Ensure all 10 slots are present.
2. Build ordered manifest (`slot_key` canonical order).
3. Generate signed URLs for the 10 images.
4. Persist `seedream_payload` snapshot in `character_reference_packs`.
5. Mark pack `ready` and set as character active pack.

### D) Seedream Consistency Pipeline
For character-consistent generation:
1. Pull active reference pack (10 ordered images).
2. Submit to `/api/fal/seedream-edit-submit` with `image_urls` and user prompt.
3. Poll `/api/fal/seedream-status`.
4. Persist output into `media_files` (source `character_generation`).
5. Link output in `character_generation_jobs`.

Notes:
- Current API supports up to 10 reference images, matching the 10-slot sheet.
- No LoRA training step is introduced.
- Reference pack versioning enables rollback and iteration.
- Generation and polling live inside Character Manager UX.

## Integration Safeguards (Added by Audit)
1. `media_files.source` migration update is required before build.
- Current constraint only allows `upload`, `private_upload`, and `ai_studio`.
- Add `character_reference` and `character_generation` values before first insert path ships.

2. Fal billing/idempotency must be first-class in Character Manager submits.
- Use existing charged Fal proxy pattern.
- Send `x-shortpulse-request-id` on submits to avoid duplicate credit charges.

3. Seedream edit payload validation must be added at API route.
- Enforce `image_urls.length` between 1 and 10.
- Enforce URL shape + required `prompt`.
- Reject malformed payloads before upstream Fal call.

4. Route/docs transition must be included in rollout.
- Dashboard character card currently points to `/character-soon`; switch to `/character`.
- Update route/docs surfaces when Character Manager replaces placeholder.

5. Generation pricing UX needs an explicit pass in Character Manager.
- Show estimated credits before submit.
- Handle insufficient-credit `402` response cleanly in page UX.

6. Output-media delete policy for v1 is **RESTRICT**.
- Keep generation job history referentially intact by default.
- Add explicit unlink/archive flow before allowing destructive media deletion.

## Beginner-First Interaction Model
Mode split:
1. **Create Character** (guided builder wizard).
2. **Manage Characters** (list, edit, duplicate, archive, set active).

Wizard steps:
1. Character basics (name + optional short descriptor).
2. Upload 10 required views.
3. Review and fix warnings.
4. Activate character reference pack.

Management actions:
- Create new version from current pack.
- Replace single slot image and revalidate.
- Duplicate character to branch variants.
- Archive/restore.

## States and Feedback
Per-slot states:
- Empty: neutral card with upload prompt.
- Uploaded: thumbnail + green check.
- Warning: amber helper and fix suggestion.
- Error: red state with exact reason.

Global states:
- `Draft` (`0-9/10`)
- `Ready for activation` (`10/10`, no hard errors)
- `Active`
- `Update available` (new draft exists over active pack)

## Accessibility and Responsive Requirements
- Keyboard-operable drop zones and replace/remove actions.
- Screen-reader labels include slot purpose and completion state.
- Mobile: 1-column slot stack.
- Tablet: 2-column grid.
- Desktop: 2x5 or 5x2 slot matrix with sticky progress sidebar.

## Phased Delivery Plan
### Phase 0: Product + Schema Finalization
- Lock naming, IA, slot taxonomy, and status model.
- Create migration spec + ADR for reference-pack architecture.
- Add migration updates for `media_files.source` enum and character tables.
- Add payload validator contract for `/api/fal/seedream-edit-submit`.

### Phase 1: New UI Shell + Slot Uploads
- Replace current `/character` UI with new layout.
- Implement 10 fixed slot cards, upload/replace/remove, progress meter.
- Save draft characters and slot assets.

### Phase 2: Validation + Pack Activation
- Add deterministic validation and warning UX.
- Activate reference packs and versioning model.

### Phase 3: Seedream Integration
- Wire active pack to Seedream edit submit/status flow.
- Persist generation outputs and history.
- Add in-page credit estimate + error handling for insufficient credits.

### Phase 4: Management + Iteration Enhancements
- Character list management actions.
- Pack version compare/rollback.
- Telemetry and performance polish.
- Update dashboard route and docs (`README.md`, `docs/routes.md`, SOP index) from placeholder to live route.

## Acceptance Criteria
- User can create a character only after all 10 required slots are filled.
- Each slot is explicitly labeled and beginner-readable.
- Active reference pack is versioned and reproducible.
- Seedream requests use the active ordered 10-image pack.
- Media and character data remain user-isolated (RLS + private paths).
- Visual language matches Media Library base surfaces and character green accents.
- Character Manager handles provider billing failures and duplicate submit protection safely.

## Deferred Decisions
1. Whether to allow optional extra references beyond the required 10 in a later release.
2. Whether to add automatic viewpoint classification after v1 ships stable.
