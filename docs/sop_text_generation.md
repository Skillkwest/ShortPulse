# SOP: Text Generation Workflows

This SOP keeps ShortPulse’s text-oriented AI features predictable, debuggable, and easy to tune. It covers both prompt enhancement (Create → Text) and image reverse-prompting so that engineers can trace requests from the UI to OpenAI and back again.

## Audit (strengths, gaps, decisions)
- Strengths: Single canonical prompt source in `frontend/lib/agentPromptsConfig.ts`; strict loader contract (`AgentPromptId`) that the TS compiler can validate; UI state (`useAiStudioState`) auto-wires responses into textareas and Reference Grid without copy/paste; token usage captured for cost visibility.
- Gaps: Imported images do not yet flow through image-describer drag/drop (logged below as a limitation); UI error surfacing must be explicit (toast/modal/banners) rather than silent HTTP errors.
- Decisions: Keep prompts in the TS config only (env overrides for emergencies); keep loader as-is but rename keys only in code if needed (outside this SOP); default all text and vision calls to `gpt-4.1-nano` with env overrides; keep SOP + TS config as the only config artifacts to minimize files.
- Actioned cleanup: Removed redundant prompt docs (`docs/ai-agent-prompts.md`, `docs/openai-agent-system-instructions.md`) so the TS config remains the only source. Update any links/bookmarks to point to `frontend/lib/agentPromptsConfig.ts`.
- UX change: Added a prominent error banner in AI Studio to surface prompt/describe failures with a dismiss control.
- Credits: The Generate button shows the estimated credits from `computeCostForModel` (or “—” if unknown); image/video runs debit immediately on click, while prompt-refine/describe flows debit after the API call using observed or estimated tokens.


## Scope
- Text refinement inside `/api/ai/generate-prompt` (Agent 1)
- Image description/reverse prompt inside `/api/ai/describe-image` (Agent 2)
- Canonical prompt definitions in `frontend/lib/agentPromptsConfig.ts` (any external agent prompt docs should be retired so the TS file remains the single source of truth)
- Runtime configuration via environment variables (OpenAI keys, model names, emergency overrides)

## Key components

| Component | Role |
| --- | --- |
| `frontend/lib/agentPromptsConfig.ts` | Source of truth for system prompts; the main place to edit instructions, so all references and docs should defer to it. |
| `frontend/lib/agentPromptLoader.ts` | Loads a prompt by ID, preferring the config but falling back to an env var emergency override to avoid app breakage. |
| `frontend/pages/api/ai/generate-prompt.ts` | HTTP POST handler that sends `prompt` + system message to OpenAI chat completions and returns the refined prompt. |
| `frontend/pages/api/ai/describe-image.ts` | HTTP POST handler that sends an image + system instructions to OpenAI vision (`gpt-4.1-nano` by default) and returns the reverse prompt. |
| `docs/openai-agent-system-instructions.md` | Legacy/optional doc for quick edits; prefer changing `frontend/lib/agentPromptsConfig.ts` directly and treat this doc as deprecated once the TS source is updated. |

## Environment prerequisites

1. `OPENAI_API_KEY` must be set at runtime for both endpoints.
2. `OPENAI_MODEL`/`OPENAI_VISION_MODEL` default to `gpt-4.1-nano` unless overridden in `.env.local` or the deployment pipeline.
3. Emergency overrides: `OPENAI_PROMPT_SYSTEM` and `OPENAI_PROMPT_IMAGE_DESCRIBE` can be defined in env vars when immediate changes are required without touching source code.

## Text prompt refinement workflow

1. UI sends POST `/api/ai/generate-prompt` with `{ prompt: string }`.
2. Handler guards against non-POST methods and missing/empty prompt bodies.
3. System prompt loads via `loadAgentPrompt("OPENAI_PROMPT_SYSTEM")`. If the config entry is empty, the handler still allows env overrides before returning a 500 error.
4. Request body:
   - Model: `process.env.OPENAI_MODEL ?? "gpt-4.1-nano"`
   - Messages: system prompt + user prompt
   - `temperature: 0.6`, `max_tokens: 2000`
5. Upstream response is parsed for `choices[0]?.message?.content`; absence triggers a 502 error.
6. Successful responses return `{ prompt: string, usage: { inputTokens?, outputTokens? } }`.
7. The Create tool in AI Studio binds the shared `prompt` state to the textarea (`frontend/features/ai-studio/components/CreatePropertiesPanel.tsx:55-214`); once `postGeneratePrompt` replies, `useAiStudioState` sets `prompt` and prepends a `StudioOutput` record to `outputs` (`frontend/features/ai-studio/hooks/useAiStudioState.ts:292-352`). The user never copies a string—the textarea and the Reference Grid card both update with the refined prompt, and the new card is immediately draggable.
8. The system prompt is always loaded directly from `frontend/lib/agentPromptsConfig.ts` via `loadAgentPrompt("OPENAI_PROMPT_SYSTEM")` to enforce one canonical source; avoid duplicating text in markdown files and keep the config keys aligned with the exported `AgentPromptId` type so the TS compiler can help you find the right entry.

## Image description workflow

1. POST `/api/ai/describe-image` expects `{ imageUrl: string }`.
2. Handler validates HTTP method and ensures non-empty `imageUrl`.
3. Loads system prompt via `loadAgentPrompt("OPENAI_PROMPT_IMAGE_DESCRIBE")`.
4. Calls OpenAI chat completion with the `visionModel` (default `gpt-4.1-nano`), `temperature: 0.9`, `max_tokens: 8000`, and a single user message combining text plus image payload (high-detail inference).
5. Parses `"choices[0].message.content"` into `description` and returns `{ description, usage }`.
6. The same state update strategy runs here (`useAiStudioState.ts:336-380`), so descriptions appear in the Create textarea, Studio Preview prompt drop zone, and Reference Grid without any manual copy/paste: the handler calls `setPrompt(description)` and inserts a prompt card with `previewText`, then focuses the prompt input so the generated text is already selected for editing or regeneration.
7. When Image-to-Text Mode is toggled on, the describe-image agent (Agent 2) always runs even if the prompt textarea has text; user input is ignored for the call, and the textarea is replaced by the describe result. Imported images dropped into the Reference Grid or Studio Preview will populate the describe flow; if an image is missing, the UI error banner prompts the user to add a reference first.

## Studio UX surfaces (Create, Recreate, Reference Grid)

- **CreatePropertiesPanel** (`frontend/features/ai-studio/components/CreatePropertiesPanel.tsx:29-214`) makes the user journey linear: select mode → optional image reference toggle → aspect/model (when not in enhance) → prompt textarea → Generate. The bound textarea shows whatever `prompt` state holds (user text or API response), and the Save Prompt button is a convenient way to add the current prompt directly into the Reference Grid without hitting Generate again.
- **RecreatePropertiesPanel** (`frontend/features/ai-studio/components/RecreatePropertiesPanel.tsx:36-320`) brings drag-and-drop reference behavior to regen flows. Its prompt textarea is tied to `referenceText`, which is shared with Studio Preview, so when a Reference Grid card is dragged into the prompt dropzone or a generated prompt card auto-populates `referenceText`, the backend sees the fresh text without a copy-paste step.
- **Reference Canvas & Studio Preview** show prompt cards and preview text automatically (`frontend/features/ai-studio/components/ReferenceCanvas.tsx:13-83` and `frontend/features/ai-studio/components/StudioPreview.tsx:10-89`). New `StudioOutput` rows rendered by `setOutputs` include the generated prompt text in `previewText`, so Reference Grid cards and Studio Preview’s textarea display the generated prompt immediately, ready to be dragged back into Create or Recreate panels.
- **UX notes**: `docs/shortpulse_ai_studio.md:59-62` explains that the Reference Grid is live (no copy/paste) and that Studio Preview/Reference Canvas supply drag handles for regenerated prompts, consistent with this SOP’s requirement that new prompts populate the text boxes and reference grid instantly.

## Prompt maintenance

1. Always update `frontend/lib/agentPromptsConfig.ts` and treat it as the single source of truth; avoid recreating prompt text in markdown so the instructions live in one place and compile-time checks keep them accurate.
2. For quick revisions, edit `frontend/lib/agentPromptsConfig.ts` and rely on the existing env override fallback only for emergency hotfixes.
3. If a change must land urgently and modifying the TS file is impractical, define the appropriate env var (`OPENAI_PROMPT_SYSTEM` or `OPENAI_PROMPT_IMAGE_DESCRIBE`) and redeploy.
4. After prompt edits, rerun `npm run lint` in `frontend/` and smoke-test via `npm run dev` or the deployed UI to confirm prompts still respond.

## Error handling & observability

- Missing API key, undefined system prompt, or empty user prompt triggers a clear HTTP 500/400 with descriptive text so the UI can show a modal or banner explaining what went wrong.
- Upstream OpenAI failures propagate the raw response text for debugging, and the UI surfaces a winning message (“Text generation failed” or “Image describer failed”) in a visually prominent toast or error panel.
- `502` is used when the OpenAI response is technically successful but missing a body, making it easy to differentiate from upstream HTTP errors.
- Usage tokens (`prompt_tokens`, `completion_tokens`) are recorded to help monitor cost spikes; surface them in logs or the UI as needed so the error state can show “Request used X tokens” if desired.

## Troubleshooting checklist

1. Confirm the system prompt is present by checking `frontend/lib/agentPromptsConfig.ts` or, in emergencies, the env override (`OPENAI_PROMPT_SYSTEM`/`OPENAI_PROMPT_IMAGE_DESCRIBE`); avoid relying on duplicate markdown copies.
2. Validate request payloads via browser DevTools/network or API tests (verify `prompt` or `imageUrl` is present).
3. Inspect deploy logs for upstream errors and note the `model` field returned in error responses.
4. For image describe failures, ensure the provided URL is reachable and less than 4MB (Next.js body parser limit).

## Follow-up responsibilities

- Document any additions to the workflow (new prompts, changed models, rerouting endpoints) inside this SOP and consider updating `docs/README.md` if the change affects product-facing instructions.
- Discuss major prompt shifts (tone, output format) with product/design before deployment to keep the UX consistent.
- If long-lived architectural changes follow (e.g., supporting another provider), add an ADR in `docs/adr/`.
