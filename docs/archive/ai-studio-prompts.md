# AI Studio Prompt Generation (Text Mode)

Archive status: superseded by `docs/sops/sop_text_generation.md` and `frontend/lib/agentPromptsConfig.ts`.

Purpose: In Create → Text mode, the Generate button sends the user’s prompt to a server-side OpenAI endpoint, receives a refined prompt, updates the input, and stores that prompt as a text reference (no image/video generation).

## Environment
- `OPENAI_API_KEY`: secret key for OpenAI.
- `OPENAI_PROMPT_SYSTEM`: system prompt to guide prompt refinement.
- `OPENAI_MODEL` (optional): defaults to `gpt-4o-mini`.

## Flow
1) Client calls `/api/ai/generate-prompt` with `{ prompt }`.
2) API applies the system prompt + user prompt via OpenAI Chat Completions.
3) Client replaces the input with the refined prompt (if returned) and saves a text reference card.
4) No image/video tasks are dispatched in text mode.

## Implementation
- Client: `frontend/features/ai-studio/logic/promptGeneration.ts` + `useAiStudioState` text-mode branch.
- API: `frontend/pages/api/ai/generate-prompt.ts` (keeps keys server-side).
