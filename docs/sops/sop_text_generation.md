# SOP: Text Generation Workflows

This SOP keeps ShortPulse’s text-oriented AI features predictable, debuggable, and easy to tune. It covers Create-panel prompt enhancement through the mode-owned studio-agent routes plus image/style analysis so engineers can trace requests from the UI to OpenAI and back again.
See `docs/sops/sop_ai_studio_index.md` for the shared structure, defaults, and links across AI Studio verticals.
For Create properties panel, model-selector, and submission wiring details, see `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`.

## Audit (strengths, gaps, decisions)

- Strengths: Single canonical prompt source in `frontend/lib/agentPromptsConfig.ts`; strict loader contract (`AgentPromptId`) that the TS compiler can validate; UI state (`useAiStudioState`) auto-wires responses into textareas and Reference Grid without copy/paste; token usage captured for cost visibility.
- Gaps: Imported images do not yet flow through image-describer drag/drop (logged below as a limitation); UI error surfacing must be explicit (toast/modal/banners) rather than silent HTTP errors.
- Decisions: Keep prompts in the TS config only (env overrides for emergencies); keep loader as-is but rename keys only in code if needed (outside this SOP); keep Create prompt enhancement and describe actions on the mode-owned studio-agent routes; keep SOP + TS config as the only config artifacts to minimize files.
- Actioned cleanup: Archived redundant prompt docs in `docs/archive/ai-studio-prompts.md` so the TS config remains the only source. Update any links/bookmarks to point to `frontend/lib/agentPromptsConfig.ts`.
- UX change: Added a prominent error banner in AI Studio to surface prompt/describe failures with a dismiss control.
- Credits: The Generate button shows the estimated credits from `computeCostForModel` (or “—” if unknown); image/video charging is enforced server-side at submit time, while prompt-refine/describe flows currently report usage but are not yet debited.

## Scope

- Text refinement inside `/api/ai/studio-agent-standard` or `/api/ai/studio-agent-pulse`
- Image description/reverse prompt inside `/api/ai/studio-agent-standard` or `/api/ai/studio-agent-pulse`
- Style descriptor extraction inside `/api/ai/extract-style` (Styles Library create flow)
  - Full style-creator domain contract (intake/state/persistence/telemetry) is documented in `docs/sops/sop_ai_studio_style_creator.md`.
- AI Studio chat orchestration inside the mode-owned studio-agent routes (single enhanced prompt output contract)
- Canonical prompt definitions in `frontend/lib/agentPromptsConfig.ts` (any external agent prompt docs should be retired so the TS file remains the single source of truth)
- Runtime configuration via environment variables (OpenAI keys, model names, emergency overrides)

## Key components

| Component                                                                                        | Role                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/lib/agentPromptsConfig.ts`                                                             | Source of truth for system prompts; the main place to edit instructions, so all references and docs should defer to it.                                                                                                                                      |
| `frontend/lib/agentPromptLoader.ts`                                                              | Loads a prompt by ID, preferring the config but falling back to an env var emergency override to avoid app breakage.                                                                                                                                         |
| `frontend/pages/api/ai/extract-style.ts`                                                         | HTTP POST handler that accepts a base64 image data URL, sends it through the style-extractor system instructions to the structured OpenAI vision lane, and returns reusable style descriptors plus a normalized style title for Styles Library create flows. |
| `frontend/pages/api/ai/studio-agent-standard.ts` / `frontend/pages/api/ai/studio-agent-pulse.ts` | AI Studio prompt-agent routes with flow routing (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`) and lane-owned continuity. Standard Create treats returned assistant text as explicit user-directed input, not an auto-applied prompt mutation.                         |

## Studio agent hardening alignment

1. Chat turns return one assistant response payload and never emit question actions into the Standard Create UX.
2. Clarifying-question behavior is disabled in prompt contracts and UI action surfaces.
3. Canonical prompt continuity is durable via Supabase (`ai_agent_conversation_state`) with TTL/cap retention.
4. Chat image attachments are prepared client-side and summarized server-side inside the active mode-owned studio-agent route.

## Environment prerequisites

1. `OPENAI_API_KEY` must be set at runtime for the retained text and image-analysis endpoints.
2. `OPENAI_MODEL` governs shared OpenAI defaults and falls back to `gpt-5.5` when a retained helper path uses it.
3. `OPENAI_VISION_MODEL` defaults to `gpt-5.5`, and `OPENAI_VISION_FALLBACK_MODEL` defaults to `gpt-5.4` for retained style-extraction vision calls.
4. The direct style-extraction lane no longer depends on remote-image URL allowlists because `/api/ai/extract-style` accepts `imageDataUrl` directly; any retained `OPENAI_DESCRIBE_ALLOWED_HOSTS` usage is limited to older remote-image analysis lanes outside the Styles Library create flow.
5. Emergency overrides: `OPENAI_PROMPT_SYSTEM` and `OPENAI_PROMPT_IMAGE_DESCRIBE` can be defined in env vars when immediate changes are required without touching source code.

## Text prompt refinement workflow

1. UI sends the request through the Standard Create runtime hook to `/api/ai/studio-agent-standard`.
2. Refine actions use isolated history so the request behaves like a specialized one-shot refinement, not a full chat continuation.
3. System prompt loads via `loadAgentPrompt("OPENAI_PROMPT_SYSTEM")`, keeping prompt instructions in one canonical source.
4. The route returns visible assistant text plus a reusable prompt artifact for the refinement turn. Standard Create still does not auto-apply it into the live generation composer.
5. The Text tool in AI Studio binds the shared `prompt` state to the textarea (`frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`). Users move assistant text into that prompt surface explicitly, for example by dragging a returned prompt into the composer.

## Standard agent workflow

1. The Create chat surface posts through `/api/ai/studio-agent-standard` for Standard mode.
2. The route uses the Standard-owned OpenAI runtime and returns visible assistant text for the UI chat surface plus a reusable prompt artifact on generation-ready success; Standard Create still requires explicit UI actions instead of hidden prompt mutation.
3. Provider and contract failures return explicit error payloads, so Create does not silently continue on synthetic assistant recovery text.
4. The system prompt is always loaded directly from `frontend/lib/agentPromptsConfig.ts` via `loadAgentPrompt("OPENAI_PROMPT_SYSTEM")` to enforce one canonical source; avoid duplicating text in markdown files and keep the config keys aligned with the exported `AgentPromptId` type so the TS compiler can help you find the right entry.

## Image description workflow

1. Manual describe actions and attachment-driven describe requests route through the active mode-owned studio-agent route. Standard uses `/api/ai/studio-agent-standard`; Pulse uses `/api/ai/studio-agent-pulse`.
2. The client prepares a safe HTTPS image URL first, then stages it as an image attachment on the request context.
3. Describe actions also use isolated history so they remain one-shot transforms and do not contaminate the main chat transcript.
4. The studio-agent route classifies the turn as `IMAGE_ONLY` or `MIXED`, runs retained image safety preflight, and returns visible assistant text plus a reusable prompt artifact when the reply is generation-ready.
5. That text can then be reused explicitly through the Create composer and other prompt surfaces instead of being auto-applied into shared generation state.

## Studio UX surfaces (Create → Text, Create → Image/Video, Reference Grid)

- **CreatePropertiesPanel** (`frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`) is chat-first for prompt building. The inline prompt card includes a “Primary generation prompt” state block so users can verify the exact prompt Generate will run and whether it came from agent output or manual edits.
- **ExpertEditPanelView/VideoPropertiesPanel** (`frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` and `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`) keep drag-and-drop reference behavior for image/video flows while using the same chat-first prompt builder; the active `referenceText` remains shared with Studio Preview.
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
