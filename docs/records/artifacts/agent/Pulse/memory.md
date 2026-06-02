# Pulse Training Memory

Purpose: retain non-authoritative training notes for Pulse's Standard-mode and Pulse-mode agent behavior workflow.

## Current Training State

- Maturity: `Level 1: Supervised`.
- Contract created: 2026-05-01.
- First durable scope: AI Studio Standard-mode and Pulse-mode agent behavior ownership plus the runtime boundary between them.
- First task surface: mode-owned agent runtime docs/code referenced by `docs/agents/Pulse/README.md`.

## Guardrail Summary

- Standard and Pulse are separate runtime modes.
- Pulse mode is a guided agent-first Create lane, not a visible prompt-paste helper.
- Hidden Pulse instructions must not leak into visible Standard composer state or Standard route payloads.
- Pulse intermediate guidance turns are not final artifacts.
- Final Pulse artifacts route by explicit artifact target.

## Notes

- Keep durable operating preferences in `docs/agents/Pulse/memory.md`.
- Keep run-specific evidence and lessons in this artifact namespace.
