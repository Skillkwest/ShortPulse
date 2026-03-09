# SOP: AI Studio Expert Edit `@img` Prompt References

Purpose: define the complete behavior contract for Expert Edit prompt-reference tokens (`@img1`, `@img2`, `@img3`), including authoring UX, generate preflight, submission compilation, and maintenance guardrails.

## Scope

- In scope:
  - Expert Edit prompt token authoring in `/ai-studio`.
  - Secondary-slot token mapping (`@img1..@img3`) and drag-to-insert behavior.
  - Submit-time prompt compilation to provider-friendly `Figure N` text.
  - Prompt override plumbing (`displayPromptOverride` vs `submissionPromptOverride`).
  - Error handling and test coverage requirements.
- Out of scope:
  - Beginner Edit panel behavior.
  - Provider payload schema changes.
  - Database migrations or session schema changes.

## Canonical code paths

| Area | Source of truth | Responsibility |
| --- | --- | --- |
| Token domain logic | `frontend/features/ai-studio/logic/expertEditPromptReferences.ts` | Parse/validate tokens, build highlight segments, compile submission prompt, drag payload helpers. |
| Expert Edit prompt UI | `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` | Prompt textarea + mirror highlight, token drag insertion, inline invalid-token message timing, token warning toast trigger. |
| Expert inline generate preflight | `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts` | Blocks generate for invalid tokens, compiles submission prompt overrides, handles flattened reference input assembly. |
| Expert panel prop adapter | `frontend/features/ai-studio/hooks/useAiStudioEditExpertPanelProps.ts` | Threads prompt overrides from panel callback into generation controller options. |
| Generation controller | `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` | Resolves display/submission prompt override precedence and character-mode composition. |
| Prompt composer / submission | `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts` | Applies prompt overrides and submits provider-facing prompt with reference inputs. |
| Prompt highlight styles | `frontend/styles/ai-studio-edit-expert.css` | Mirror layer visuals, token colors, caret visibility, prompt-layer stacking/wrapping sync. |

## User-facing behavior contract

1. Expert Edit prompt accepts `@img1`, `@img2`, `@img3` references to secondary slots 1..3.
2. Users can type token text manually.
3. Users can drag a populated secondary slot into the prompt to insert the corresponding token at caret.
4. Valid tokens are highlighted in the Expert Edit amber color (`rgb(255, 194, 80)`).
5. Invalid tokens are highlighted in warning red.
6. Invalid-token warning feedback is deferred until Generate is attempted.
7. Generate is blocked when invalid token references exist.
8. All populated secondary references are still included in provider `image_urls` even if no token appears in prompt text.

## Token grammar and validation

| Token input | Validity rule | Result |
| --- | --- | --- |
| `@img1`, `@img2`, `@img3` | Valid only if matching secondary slot is populated | Valid reference token. |
| `@img` | Missing numeric suffix | Invalid (`missing_index`). |
| `@img4+` | Out of supported range | Invalid (`out_of_range`). |
| `@imgN` with empty slot | Slot has no image | Invalid (`empty_slot`). |

Normalization rules:
- Token parsing is case-insensitive (`@IMG1` is treated as `@img1` logically).
- Canonical token form for drag payloads is lowercase (`@imgN`).
- Duplicate valid tokens are allowed and preserve their positions in prompt text.

## Prompt authoring and drag behavior

### Typed tokens

1. Prompt text remains plain string state (`editReferenceText`).
2. Mirror highlight layer is computed from token diagnostics and rendered over the textarea.
3. Text and token wrapping must stay aligned between textarea and mirror layer.

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

## Generate preflight and submit compilation

### Preflight sequence (Expert Edit inline Generate)

1. Validate prompt tokens against current secondary slot population.
2. If invalid:
   - block generate before flatten/submit/debit.
   - show warning toast.
   - reveal inline invalid-token message below prompt.
3. If valid:
   - continue flatten flow.
   - build `referenceInputs` with flattened primary first and populated secondaries next.
   - compile provider-facing prompt when token references exist.

### Compilation contract

Input:
- display prompt (raw user text with `@imgN`)
- secondary slots
- final `referenceInputs` order

Output:
- token text replaced with mapped `Figure N` references based on final `referenceInputs` order.
- appended reference-map block:
  - `Figure 1 = primary base image.`
  - `Figure X = @imgN secondary reference.`
  - `Treat all secondary references as edits to Figure 1 unless explicitly overridden.`

If no tokens are present:
- submit behavior remains unchanged.
- no token compilation block is appended.

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

| Condition | Expected behavior |
| --- | --- |
| Invalid token while typing | No immediate inline warning; keep editing uninterrupted. |
| User clicks Generate with invalid token | Block generate, show warning toast, show inline prompt error. |
| Invalid token corrected | Inline token error auto-clears after prompt becomes valid. |
| Missing secondary slot for referenced token | Inline error identifies missing slot number. |

## Testing requirements

Minimum suite coverage:

1. Token logic unit tests:
   - valid/invalid detection (`missing_index`, `out_of_range`, `empty_slot`).
   - submission prompt compile and figure-map append behavior.
   - drag payload encode/decode helpers.
2. Expert Edit component tests:
   - valid token highlight rendering.
   - deferred invalid warning (only after Generate attempt).
   - invalid token blocks generate callback.
   - drag secondary slot inserts token at caret.
   - token generate path sends both display/submission prompt overrides.
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
   - use existing Expert Edit kill switch (`NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false`) to fallback to legacy Edit.

## Verification checklist

1. `npm -C frontend run test -- expertEditPromptReferences`
2. `npm -C frontend run test -- ExpertEditPanelView`
3. `npm -C frontend run test -- useAiStudioGenerationController`
4. `npm -C frontend run test -- useAiStudioGenerationPromptComposer`
5. `npm -C frontend run docs:check`
6. Manual smoke:
   - type valid/invalid tokens in Expert Edit prompt.
   - drag secondary slot into prompt and verify caret insertion.
   - verify Generate blocks on invalid token and succeeds on valid token.
   - verify reference token highlight color and prompt readability are stable.
