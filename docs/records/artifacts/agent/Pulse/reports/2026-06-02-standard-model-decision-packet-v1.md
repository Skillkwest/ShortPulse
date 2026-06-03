# Standard Model Decision Packet V1

Date: 2026-06-02
Owner: Pulse
Scope: AI Studio Create Standard-mode model policy
Status: implemented for Standard chat and shared OpenAI vision defaults

## Purpose

Record the Phase 1 model-selection decision for Standard mode using current official OpenAI guidance, current repo wiring, and the locked Standard proof surface.

## Current Repo Reality

- Standard default chat model currently resolves to `gpt-5.4-nano` through `frontend/lib/model-runtime/modelCatalog.ts`.
- Standard default vision model currently also resolves to `gpt-5.4-nano`.
- Standard route/runtime proof surface passed at this checkpoint with:
  - `8` test files passed
  - `89` tests passed
- Standard is still a one-turn Chat Completions runtime, so this packet evaluates the best immediate default model for the current runtime, not the later Responses migration target in full.

## Decision Question

What should Standard use as its default main chat model if the product goal is a much more ChatGPT-like general assistant?

## Candidate Comparison

| Candidate | Model type | Conversational quality | Image capability | Latency / cost | Production availability | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `gpt-5.5` | flagship GPT-family model slug | strongest current official recommendation for complex reasoning and professional work | supports image input | highest cost of the practical candidates, but still the official starting point for quality | public docs say yes; production org not yet verified from this environment | **recommended winner for Standard chat** |
| `chat-latest` | moving ChatGPT-linked alias | likely good chat behavior, but upstream behavior can shift | supports image input | same price tier as flagship chat surface | public docs say yes, but docs explicitly recommend `gpt-5.5` for production API usage instead | not recommended as Standard default |
| `gpt-5.4-nano` | cost-optimized small model | too weak for the stated parity target | supports image input | cheapest and fastest | already wired and proven in repo | baseline only, not the target |

## Why `gpt-5.5` Wins

- Official OpenAI model guidance currently says to start with `gpt-5.5` when unsure which model to use for complex reasoning and coding.
- Official GPT-5.5 migration guidance recommends switching the model slug to `gpt-5.5` and using the Responses API for reasoning, tool-calling, and multi-turn work.
- `chat-latest` is positioned as the latest ChatGPT-linked instant model, but OpenAI explicitly recommends `gpt-5.5` for production API usage instead of using `chat-latest` as the main production default.
- `gpt-5.4-nano` remains a valid cost-sensitive baseline, but it does not match the quality target for a Standard assistant meant to feel much closer to ChatGPT.

## Chat Versus Vision Policy

- Chat and vision should remain separable decisions.
- This packet recommends `gpt-5.5` as the preferred Standard chat default.
- It does **not** automatically force the Standard vision default to change in the same slice.
- The current runtime already distinguishes text-only and mixed-turn routing, and the vision default should be re-evaluated explicitly once production availability and latency are verified.

## Fixed Slug Versus Moving Alias

Recommended policy:

- prefer `gpt-5.5` over `chat-latest` for the Standard default chat model
- do not use `chat-latest` as the Standard default

Reason:

- `chat-latest` is intentionally moving
- Standard needs a more deliberate production contract than "whatever ChatGPT changed to most recently"
- `gpt-5.5` is the official flagship recommendation for production API usage in current docs

## Production Verification Gate

Production verification is now complete.

Verified at this checkpoint:

- Vercel production currently pinned `OPENAI_MODEL=gpt-5.4`, `OPENAI_VISION_MODEL=gpt-5.4`, and `STUDIO_AGENT_PULSE_MODEL=gpt-5.4`
- the production OpenAI key accepted `gpt-5.5` as a valid model slug on the live API path
- the Standard model upgrade can proceed without guessing about production org availability

## Repo Change Recommendation

Implemented at this checkpoint:

1. change Standard default chat role resolution from `gpt-5.4-nano` to `gpt-5.5`
2. change the shared OpenAI vision default from `gpt-5.4-nano` / `gpt-5.4` env pins to `gpt-5.5`
3. keep `STUDIO_AGENT_PULSE_MODEL` pinned to `gpt-5.4` so Pulse does not drift in production as part of this Standard phase
4. rerun the locked Phase 0 proof command
5. if latency, cost, refusal quality, or test behavior degrades unacceptably, roll back to the prior default and keep the evidence

## Stop Boundary

This packet no longer stops at the availability gate.

The new stop boundary for this checkpoint is proof plus live env update completion.
