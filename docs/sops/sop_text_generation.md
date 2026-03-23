# SOP: Text Generation Workflows

This SOP keeps ShortPulse’s text-oriented AI features predictable, debuggable, and easy to tune. It covers both prompt enhancement (Create → Text) and image reverse-prompting so that engineers can trace requests from the UI to OpenAI and back again.
See `docs/sops/sop_ai_studio_index.md` for the shared structure, defaults, and links across AI Studio verticals.
For Create properties panel, model-selector, and submission wiring details, see `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`.

## Audit (strengths, gaps, decisions)
- Strengths: Single canonical prompt source in `frontend/lib/agentPromptsConfig.ts`; strict loader contract (`AgentPromptId`) that the TS compiler can validate; UI state (`useAiStudioState`) auto-wires responses into textareas and Reference Grid without copy/paste; token usage captured for cost visibility.
- Gaps: Imported images do not yet flow through image-describer drag/drop (logged below as a limitation); UI error surfacing must be explicit (toast/modal/banners) rather than silent HTTP errors.
- Decisions: Keep prompts in the TS config only (env overrides for emergencies); keep loader as-is but rename keys only in code if needed (outside this SOP); default direct text refinement to `gpt-5.4` while vision describe stays on `gpt-5-nano`; keep SOP + TS config as the only config artifacts to minimize files.
- Actioned cleanup: Archived redundant prompt docs in `docs/archive/ai-studio-prompts.md` so the TS config remains the only source. Update any links/bookmarks to point to `frontend/lib/agentPromptsConfig.ts`.
- UX change: Added a prominent error banner in AI Studio to surface prompt/describe failures with a dismiss control.
- Credits: The Generate button shows the estimated credits from `computeCostForModel` (or “—” if unknown); image/video charging is enforced server-side at submit time, while prompt-refine/describe flows currently report usage but are not yet debited.


## Scope
- Text refinement inside `/api/ai/generate-prompt` (Agent 1)
- Image description/reverse prompt inside `/api/ai/describe-image` (Agent 2)
- Style descriptor extraction inside `/api/ai/extract-style` (Styles Library create flow)
  - Full style-creator domain contract (intake/state/persistence/telemetry) is documented in `docs/sops/sop_ai_studio_style_creator.md`.
- AI Studio chat orchestration inside `/api/ai/studio-agent` (single enhanced prompt output contract)
- Canonical prompt definitions in `frontend/lib/agentPromptsConfig.ts` (any external agent prompt docs should be retired so the TS file remains the single source of truth)
- Runtime configuration via environment variables (OpenAI keys, model names, emergency overrides)

## Key components

| Component | Role |
| --- | --- |
| `frontend/lib/agentPromptsConfig.ts` | Source of truth for system prompts; the main place to edit instructions, so all references and docs should defer to it. |
| `frontend/lib/agentPromptLoader.ts` | Loads a prompt by ID, preferring the config but falling back to an env var emergency override to avoid app breakage. |
| `frontend/pages/api/ai/generate-prompt.ts` | HTTP POST handler that sends `prompt` + system message to OpenAI chat completions and returns the refined prompt. |
| `frontend/pages/api/ai/describe-image.ts` | HTTP POST handler that sends an image + system instructions to OpenAI vision (`gpt-5-nano` by default, optional fallback model) and returns the reverse prompt. |
| `frontend/pages/api/ai/extract-style.ts` | HTTP POST handler that sends an image + style-extractor system instructions to OpenAI vision and returns reusable style descriptors plus a normalized style title for Styles Library create flows. |
| `frontend/pages/api/ai/studio-agent.ts` | AI Studio prompt-agent route with flow routing (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`), single-stage prompt-only canonical behavior (`actions.applyPrompt` on success), and canonical prompt continuity. |

## Studio agent hardening alignment

1. Chat turns return one enhanced prompt (`actions.applyPrompt`) on success and never emit question actions.
2. Clarifying-question behavior is disabled in prompt contracts and UI action surfaces.
3. Canonical prompt continuity is durable via Supabase (`ai_agent_conversation_state`) with TTL/cap retention.
4. Chat image attachments are prepared client-side and summarized server-side inside `/api/ai/studio-agent`.

## Environment prerequisites

1. `OPENAI_API_KEY` must be set at runtime for both endpoints.
2. `/api/ai/generate-prompt` uses `OPENAI_DIRECT_PROMPT_MODEL` when set and otherwise defaults to `gpt-5.4`.
3. `OPENAI_MODEL` remains the studio-agent default model chain (`gpt-5-nano` when unset); this keeps the direct prompt lane separate from agent defaults.
4. `OPENAI_VISION_MODEL` and `OPENAI_VISION_FALLBACK_MODEL` default to `gpt-5-nano`.
5. Trusted-host env: `OPENAI_DESCRIBE_ALLOWED_HOSTS` (comma-separated); non-allowlisted external hosts are fail-closed by default.
6. Emergency overrides: `OPENAI_PROMPT_SYSTEM` and `OPENAI_PROMPT_IMAGE_DESCRIBE` can be defined in env vars when immediate changes are required without touching source code.

## Text prompt refinement workflow

1. UI sends POST `/api/ai/generate-prompt` with `{ prompt: string }`.
   - Create `mode=text` with Chat Mode OFF also uses this route directly, bypassing `/api/ai/studio-agent`.
2. Handler guards against non-POST methods and missing/empty prompt bodies.
3. System prompt loads via `loadAgentPrompt("OPENAI_PROMPT_SYSTEM")`. If the config entry is empty, the handler still allows env overrides before returning a 500 error.
4. Request body:
   - Model: `process.env.OPENAI_DIRECT_PROMPT_MODEL ?? "gpt-5.4"`
   - Messages: system prompt + user prompt
   - `temperature: 0.6`, `max_tokens: 2000`
5. Upstream response is parsed for `choices[0]?.message?.content`; absence triggers a 502 error.
6. Successful responses return `{ prompt: string, usage: { inputTokens?, outputTokens? } }`.
7. The Text tool in AI Studio binds the shared `prompt` state to the textarea (`frontend/features/ai-studio/components/CreatePropertiesPanel.tsx:55-214`); once `postGeneratePrompt` replies, `useAiStudioState` sets `prompt` and prepends a `StudioOutput` record to `outputs` (`frontend/features/ai-studio/hooks/useAiStudioState.ts:292-352`). The user never copies a string—the textarea and the Reference Grid card both update with the refined prompt, and the new card is immediately draggable.
8. The system prompt is always loaded directly from `frontend/lib/agentPromptsConfig.ts` via `loadAgentPrompt("OPENAI_PROMPT_SYSTEM")` to enforce one canonical source; avoid duplicating text in markdown files and keep the config keys aligned with the exported `AgentPromptId` type so the TS compiler can help you find the right entry.

## Image description workflow

1. POST `/api/ai/describe-image` expects `{ imageUrl: string }`.
2. Handler validates HTTP method and ensures non-empty `imageUrl`.
3. Loads system prompt via `loadAgentPrompt("OPENAI_PROMPT_IMAGE_DESCRIBE")`.
4. Preflights the URL server-side (HTTPS required, private-network hosts blocked, DNS private-IP resolution blocked, redirect chain validation, and trusted-host allowlist enforcement).
5. Calls OpenAI chat completion with the `visionModel` (default `gpt-5-nano`) and one user message combining text plus image payload.
6. On model-capability 400s, retries once with `OPENAI_VISION_FALLBACK_MODEL` when configured/available.
7. Parses `"choices[0].message.content"` into `description` and returns `{ description, usage }`.
8. The same state update strategy runs here (`useAiStudioState.ts:336-380`), so descriptions appear in the Create textarea, Studio Preview prompt drop zone, and Reference Grid without any manual copy/paste: the handler calls `setPrompt(description)` and inserts a prompt card with `previewText`, then focuses the prompt input so the generated text is already selected for editing or regeneration.
9. When describe mode runs, the describe-image agent (Agent 2) replaces the active prompt with the returned description. Imported images dropped into the Reference Grid or Studio Preview can populate describe context; if an image is missing, the UI error banner prompts the user to add a reference first.

## Studio UX surfaces (Create → Text, Create → Image/Video, Reference Grid)

- **CreatePropertiesPanel** (`frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`) is chat-first for prompt building. The inline prompt card includes a “Primary generation prompt” state block so users can verify the exact prompt Generate will run and whether it came from agent output or manual edits.
- **EditPropertiesPanel/VideoPropertiesPanel** (`frontend/features/ai-studio/components/EditPropertiesPanel.tsx` and `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`) keep drag-and-drop reference behavior for image/video flows while using the same chat-first prompt builder; the active `referenceText` remains shared with Studio Preview.
- **Reference Grid & Studio Preview** show prompt cards and preview text automatically (`frontend/features/ai-studio/components/ReferenceGrid.tsx:13-83` and `frontend/features/ai-studio/components/StudioPreview.tsx:10-89`). New `StudioOutput` rows rendered by `setOutputs` include the generated prompt text in `previewText`, so Reference Grid cards and Studio Preview’s textarea display the generated prompt immediately, ready to be dragged back into Create → Text or Create → Image/Video panels. Prompt cards are reuse-only (select/drag/save/remove); generation is triggered from primary Generate controls, not per-card buttons.
- **UX notes**: `docs/product/shortpulse_ai_studio.md:59-62` explains that the Reference Grid is live (no copy/paste) and that Studio Preview/Reference Grid drag handles support regenerated prompt reuse, consistent with this SOP’s requirement that new prompts populate the text boxes and reference grid instantly.

## Prompt maintenance

1. Always update `frontend/lib/agentPromptsConfig.ts` and treat it as the single source of truth; avoid recreating prompt text in markdown so the instructions live in one place and compile-time checks keep them accurate.
2. For quick revisions, edit `frontend/lib/agentPromptsConfig.ts` and rely on the existing env override fallback only for emergency hotfixes.
3. If a change must land urgently and modifying the TS file is impractical, define the appropriate env var (`OPENAI_PROMPT_SYSTEM` or `OPENAI_PROMPT_IMAGE_DESCRIBE`) and redeploy.
4. After prompt edits, rerun `npm run lint` in `frontend/` and smoke-test via `npm run dev` or the deployed UI to confirm prompts still respond.

## Error handling & observability

- Missing API key, undefined system prompt, or empty user prompt triggers a clear HTTP 500/400 with descriptive text so the UI can show a modal or banner explaining what went wrong.
- Upstream/transport failures are logged server-side; public error payloads avoid leaking internal transport details while the UI still surfaces clear failure messaging.
- `502` is used when the OpenAI response is technically successful but missing a body, making it easy to differentiate from upstream HTTP errors.
- Usage tokens (`prompt_tokens`, `completion_tokens`) are recorded to help monitor cost spikes; surface them in logs or the UI as needed so the error state can show “Request used X tokens” if desired.

## Troubleshooting checklist

1. Confirm the system prompt is present by checking `frontend/lib/agentPromptsConfig.ts` or, in emergencies, the env override (`OPENAI_PROMPT_SYSTEM`/`OPENAI_PROMPT_IMAGE_DESCRIBE`); avoid relying on duplicate markdown copies.
2. Validate request payloads via browser DevTools/network or API tests (verify `prompt` or `imageUrl` is present).
3. Inspect deploy logs for upstream errors and note the `model` field returned in error responses.
4. For image describe failures, ensure the URL is HTTPS, reachable, not private-network scoped, and explicitly present in `OPENAI_DESCRIBE_ALLOWED_HOSTS` (Supabase host is auto-trusted).

## Follow-up responsibilities

- Document any additions to the workflow (new prompts, changed models, rerouting endpoints) inside this SOP and consider updating `docs/README.md` if the change affects product-facing instructions.
- Discuss major prompt shifts (tone, output format) with product/design before deployment to keep the UX consistent.
- If long-lived architectural changes follow (e.g., supporting another provider), add an ADR in `docs/adr/`.
