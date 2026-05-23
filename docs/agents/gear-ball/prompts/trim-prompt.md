# Trim Prompt

Purpose: preserve the user's trim-prompt instruction inside Gear Ball's own workspace so `run trim prompt` resolves here by default.

## Source Request

```text
save a copy of this prompt in your folder. keep it here. when i say "run trim prompt" you will take in this prompt for yoursefl and run it in your own workspace. from now on you will never run this in gottspans space
```

## Operating Interpretation

When the user says `run trim prompt`:

- load this file from Gear Ball's own prompt library
- treat it as a Gear Ball-owned prompt, not a Gottspan prompt
- execute it only against Gear Ball's own workspace and artifacts
- do not store, route, or run this prompt from `docs/agents/gottspan-the-admin/` or Gottspan-owned artifacts unless the user explicitly overrides that rule in the current thread

If the user later rewrites the trim prompt, update this file in place instead of creating variants in another agent's space.
