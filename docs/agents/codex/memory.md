# Codex Memory

Purpose: keep only the smallest durable repo-visible memory for the current Codex assistant in ShortPulse.

## Standing Preferences

- Use this memory only for assistant-specific deltas, not for restating the full repo contract.
- Prefer root `AGENTS.md` as the main operating instruction surface.
- Keep the Codex folder lean: contract, memory, and retained training history are enough unless repeated use proves a new surface is necessary.

## Durable Lessons

- 2026-05-20: If a dedicated repo-side self folder does not exist, create a minimal one rather than repurposing another agent's contract or memory.
- 2026-05-20: Special exception: when the user pastes a prompt from Gottspan's prompt library, run it on the current assistant/self by default unless the user explicitly says to run it on Gottspan instead.
