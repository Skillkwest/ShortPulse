# SOP: AI Studio Expert Edit `@main` and `@img` Prompt References

Purpose: define the complete behavior contract for Expert Edit prompt-reference tokens (`@main`, `@img1`, `@img2`, `@img3`), including authoring UX, generate preflight, submission compilation, and maintenance guardrails.

## Scope

- In scope:
  - Expert Edit prompt token authoring in `/ai-studio`.
  - Primary-slot token mapping (`@main`) and secondary-slot token mapping (`@img1..@img3`) plus drag-to-insert behavior.
  - Submit-time prompt compilation to provider-friendly `Figure N` text.
  - Prompt override plumbing (`displayPromptOverride` vs `submissionPromptOverride`).
  - Error handling and test coverage requirements.
- Out of scope:
  - Retired legacy surfaces.
  - Provider payload schema changes.
  - Database migrations or session schema changes.

## Canonical code paths

| Area                             | Source of truth                                                              | Responsibility                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Token domain logic               | `frontend/features/ai-studio/logic/expertEditPromptReferences.ts`            | Parse/validate tokens, build highlight segments, compile submission prompt, drag payload helpers.                           |
| Expert Edit prompt UI            | `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`        | Prompt textarea + mirror highlight, token drag insertion, inline invalid-token message timing, token warning toast trigger. |
| Expert inline generate preflight | `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts` | Blocks generate for invalid tokens, compiles submission prompt overrides, handles flattened reference input assembly.       |
| Expert panel prop adapter        | `frontend/features/ai-studio/hooks/useAiStudioEditExpertPanelProps.ts`       | Threads prompt overrides from panel callback into generation controller options.                                            |
| Generation controller            | `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`       | Resolves display/submission prompt override precedence and character-mode composition.                                      |
| Prompt composer / submission     | `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`   | Applies prompt overrides and submits provider-facing prompt with reference inputs.                                          |
| Prompt highlight styles          | `frontend/styles/ai-studio-edit-expert.css`                                  | Mirror layer visuals, token colors, caret visibility, prompt-layer stacking/wrapping sync.                                  |

## User-facing behavior contract

1. Expert Edit prompt accepts `@main` for the primary image plus `@img1`, `@img2`, `@img3` references to secondary slots 1..3.
2. Users can type token text manually.
3. Users can drag a populated secondary slot into the prompt to insert the corresponding token at caret.
4. Valid tokens are highlighted in the Expert Edit amber color (`rgb(255, 194, 80)`).
5. Invalid tokens are highlighted in warning red.
6. Invalid-token warning feedback is deferred until Generate is attempted.
7. Generate is blocked when invalid token references exist.
8. Standard and Markup edit lanes always include the primary image first. Secondary reference behavior is lane-aware:
   - when one or more valid `@img1..@img3` tokens are linked, only those linked secondary refs are included in provider `image_urls`;
   - when no valid secondary token is linked, all populated secondary reference slots are included as ambient edit context.
   - `@main` still resolves to the primary figure and does not by itself suppress the no-linked-secondary fallback.
9. Inpaint has two explicit contracts:
   - default FLUX Fill inpaint supports `@main` only because `fal-ai/flux-pro/v1/fill` receives only the flattened base image plus mask.
   - reference-aware inpaint allows `@main` plus exactly one unique secondary token and routes to `fal-ai/flux-kontext-lora/inpaint` with `image_url + mask_url + reference_image_url`.

## Token grammar and validation

| Token input                                       | Validity rule                                      | Result                                     |
| ------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `@main`                                           | Valid when the primary image is available          | Valid primary reference token.             |
| `@img1`, `@img2`, `@img3`                         | Valid only if matching secondary slot is populated | Valid reference token.                     |
| `@img1`, `@img2`, `@img3` in default inpaint      | Invalid for the FLUX Fill lane                     | Invalid (`secondary_tokens_disabled`).     |
| More than one unique `@imgN` in reference inpaint | Exceeds the single-reference masked lane           | Invalid (`too_many_secondary_references`). |
| `@img`                                            | Missing numeric suffix                             | Invalid (`missing_index`).                 |
| `@img4+`                                          | Out of supported range                             | Invalid (`out_of_range`).                  |
| `@imgN` with empty slot                           | Slot has no image                                  | Invalid (`empty_slot`).                    |

Normalization rules:

- Token parsing is case-insensitive (`@IMG1` is treated as `@img1` logically).
- Canonical token form for drag payloads is lowercase (`@imgN`).
- Duplicate valid tokens are allowed and preserve their positions in prompt text.

## Prompt authoring and drag behavior

### Typed tokens

1. Prompt text remains plain string state (`editReferenceText`).
2. Mirror highlight layer is computed from token diagnostics and rendered over the textarea.
3. Text and token wrapping must stay aligned between textarea and mirror layer.
4. Typing a bare `@` opens an anchored reference picker when at least one reference token is available.
5. Pressing `Tab` while the prompt textarea is focused also opens the anchored picker when it is closed and at least one reference token is available.
6. Picker selection defaults to `@main` when the primary image is available.
7. While picker is open:
   - `Tab` / `Shift+Tab` cycles the primary tile and populated secondary slots.
   - `Enter` inserts the selected `@main` or `@imgN` token by replacing the typed bare `@` or the current caret/selection when the picker was opened by `Tab`.
   - ordinary typing closes the picker and preserves manual prompt entry.
8. Opening the picker adds a visible selection outline to the selected tile, including the primary tile.
9. Default inpaint mode limits the picker to `@main` only.
10. Reference inpaint mode exposes populated secondary slots in the picker, but once one unique secondary reference is already linked, the picker remains constrained to that same linked slot plus `@main`.

### Drag-to-insert tokens

1. Each populated secondary slot is draggable.
2. Drag payload writes both:
   - custom MIME: `text/ai-studio-expert-edit-img-token`
   - fallback MIME: `text/plain`
3. Prompt drop handler:
   - inserts token at current caret/selection when token payload exists.
   - preserves existing fallback prompt-drop behavior when payload is not a token.
4. Token insertion applies spacing-safe insertion:
   - inserts leading/trailing spaces only when needed to avoid merged words.
5. The anchored picker must reuse the same token insertion path as drag-to-insert so caret placement and spacing stay consistent.
6. Default inpaint mode disables secondary-slot token drag insertion because FLUX Fill does not transmit secondary reference images.
7. Reference inpaint mode permits secondary-slot token drag insertion only when the experimental single-reference lane is enabled.

## Generate preflight and submit compilation

### Preflight sequence (Expert Edit inline Generate)

1. Validate prompt tokens against current secondary slot population.
2. If invalid:
   - block generate before flatten/submit/debit.
   - show warning toast.
   - reveal inline invalid-token message below prompt.
3. If valid:
   - continue flatten flow.
   - build `referenceInputs` with flattened primary first, optional markup composite second, and resolved secondary refs after that.
   - for Standard/Markup with no valid secondary links, resolved secondary refs are all populated secondary slots.
   - for Standard/Markup with one or more valid secondary links, resolved secondary refs are only the linked secondary slots.
   - compile provider-facing prompt when token references exist.
4. Inpaint preflight is lane-aware:
   - default FLUX Fill lane: `@main` remains valid, `@img1..@img3` are blocked before flatten/submit/debit, and submit sends only the prepared base image plus prepared mask.
   - reference inpaint lane: exactly one unique `@imgN` is allowed, generate blocks if more than one unique secondary reference is linked, and submit sends the prepared base image, prepared mask, and one prepared `reference_image_url`.

### Compilation contract

Input:

- display prompt (raw user text with `@main` and/or `@imgN`)
- secondary slots
- final `referenceInputs` order

Output:

- token text replaced with mapped `Figure N` references based on final `referenceInputs` order (`@main` -> `Figure 1`).
- slot identity is authoritative for figure numbering. If restored or reused secondary slots point at the same underlying URL, each referenced slot still keeps its own `Figure N` position in submit order.
- appended reference-map block:
  - `Figure 1 = primary base image.`
  - `Figure X = @imgN secondary reference.`
  - `Treat all secondary references as edits to Figure 1 unless explicitly overridden.`

If no tokens are present:

- submit behavior keeps the raw prompt unchanged.
- no token compilation block is appended.
- Standard/Markup still include populated secondary references in the payload when available.

If tokens exist but are invalid:

- compile function returns display prompt unchanged.
- caller must block generate in preflight (authoritative invalid handling).

## Prompt override plumbing contract

Expert Edit regenerate callback options support:

- `displayPromptOverride?: string | null`
- `submissionPromptOverride?: string | null`

Controller precedence:

1. Guardrail/start checks use display prompt override when provided.
2. Character composition uses submission prompt override as base when provided.
3. Final provider submission prompt precedence:
   - character-mode submission override
   - explicit submission prompt override
   - default prompt
4. Final display prompt precedence:
   - explicit display prompt override
   - character-mode display override
   - default prompt

## Styling and rendering guardrails

1. Textarea remains source of truth for cursor, selection, and input behavior.
2. Text content is visually rendered via mirror highlight layer.
3. Textarea text color remains transparent, with visible caret color.
4. Mirror layer and textarea must stay synchronized for:
   - font family/size/line-height/letter-spacing
   - padding
   - wrapping rules
   - scroll offsets
5. Layering order invariant:
   - mirror highlight above textarea background
   - textarea caret remains visible and interactive
6. Spellcheck/autocorrect artifacts are disabled for this field to avoid false overlays in mirrored mode.

## Error handling UX contract

| Condition                                   | Expected behavior                                             |
| ------------------------------------------- | ------------------------------------------------------------- |
| Invalid token while typing                  | No immediate inline warning; keep editing uninterrupted.      |
| User clicks Generate with invalid token     | Block generate, show warning toast, show inline prompt error. |
| Invalid token corrected                     | Inline token error auto-clears after prompt becomes valid.    |
| Missing secondary slot for referenced token | Inline error identifies missing slot number.                  |

## Testing requirements

Minimum suite coverage:

1. Token logic unit tests:
   - valid/invalid detection (`missing_index`, `out_of_range`, `empty_slot`, `secondary_tokens_disabled`, `too_many_secondary_references`).
   - submission prompt compile and figure-map append behavior.
   - drag payload encode/decode helpers.
2. Expert Edit component tests:
   - valid token highlight rendering.
   - deferred invalid warning (only after Generate attempt).
   - invalid token blocks generate callback.
   - drag secondary slot inserts token at caret.
   - bare `@` opens anchored picker with `@main` selected first.
   - `Tab` opens anchored picker at the current caret when a reference token is available.
   - picker `Tab` cycling updates the selected primary/secondary tile.
   - picker `Enter` inserts the selected token and closes the picker.
   - ordinary typing after picker open closes the picker and preserves manual text entry.
   - token generate path sends both display/submission prompt overrides.
   - Standard/Markup generate without linked `@imgN` sends all populated secondary refs.
   - Standard/Markup generate with linked `@imgN` keeps linked-only secondary refs in the payload.
   - default inpaint picker limits token choices to `@main`.
   - reference inpaint picker exposes populated secondary refs when the flag is enabled.
   - default inpaint generate blocks secondary tokens with the lane-specific error.
   - reference inpaint generate blocks prompts that link more than one unique secondary reference.
3. Controller/composer tests:
   - prompt override precedence.
   - character-mode precedence compatibility.
4. Regression tests:
   - existing Edit/Create/Video prompt behavior outside Expert Edit remains unchanged.

## Operational runbook for future changes

1. If changing token grammar:
   - update `expertEditPromptReferences.ts` first.
   - update this SOP token table and preflight contracts.
   - update all token logic + Expert Edit tests.
2. If changing prompt compilation wording:
   - update compiler output in token logic module.
   - update tests asserting `Figure N` and reference map block.
   - confirm provider prompt remains plain text (no structured payload dependency).
3. If changing prompt UI rendering:
   - preserve textarea source-of-truth model.
   - preserve scroll and wrapping parity with mirror.
   - run manual caret/selection QA in browser before merge.
4. If disabling feature:
   - verify behavior directly in the canonical Expert Edit surface.

## Verification checklist

1. `npm -C frontend run test -- expertEditPromptReferences`
2. `npm -C frontend run test -- ExpertEditPanelView`
3. `npm -C frontend run test -- useAiStudioGenerationController`
4. `npm -C frontend run test -- useAiStudioGenerationPromptComposer`
5. `npm -C frontend run docs:check`
6. Manual smoke:
   - type valid/invalid tokens in Expert Edit prompt.
   - drag secondary slot into prompt and verify caret insertion.
   - type `@` with populated references and verify anchored picker open + `@main` default highlight.
   - press `Tab` in the prompt with references available and verify anchored picker opens at the current caret.
   - press `Tab` / `Shift+Tab` to cycle the primary and secondary selections.
   - press `Enter` to insert selected `@main` or `@imgN` token and close the picker.
   - verify Generate blocks on invalid token and succeeds on valid token.
   - verify reference token highlight color and prompt readability are stable.
   - default inpaint mode: verify picker only offers `@main` and `@img1..@img3` are rejected before submit.
   - reference inpaint mode: verify picker offers populated secondary refs, exactly one unique `@imgN` is allowed, and submit uses the reference-aware masked lane.
