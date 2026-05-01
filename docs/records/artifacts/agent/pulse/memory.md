# Pulse Training Memory

Purpose: retain non-authoritative training notes for Pulse's Create panel and agent-runtime workflow.

## Current Training State

- Maturity: `Level 1: Supervised`.
- Contract created: 2026-05-01.
- First durable scope: AI Studio Create panel ownership plus Standard/Pulse agent-runtime inner workings.
- First task surface: Create panel and mode-owned agent runtime docs/code referenced by `docs/agents/pulse/README.md`.

## Guardrail Summary

- Standard and Pulse are separate runtime modes.
- Pulse mode is a guided agent-first Create lane, not a visible prompt-paste helper.
- Hidden Pulse instructions must not leak into visible Standard composer state or Standard route payloads.
- Pulse intermediate guidance turns are not final artifacts.
- Final Pulse artifacts route by explicit artifact target.

## Notes

- Keep durable operating preferences in `docs/agents/pulse/memory.md`.
- Keep run-specific evidence and lessons in this artifact namespace.

