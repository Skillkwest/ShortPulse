# Session Hand-Off

Purpose: give the next Create Workflow run a concise operational hand-off.

## Where We Left Off

- The repo now has a dedicated Create attachment runtime capture helper.
- The helper is integrated into:
  - composer drop + attachment state transitions
  - chip preview source changes and image error/repair events
- A summarizer script and capture skill now exist.

## What Not To Repeat

- Do not start with another blind preview fallback patch if production is still failing.
- Do not treat local test passes as proof that the production symptom is gone.
- Do not widen the lane into unrelated media panel or deployment work unless the runtime capture points there.

## What To Do First Next Time

1. Enable `createWorkflowDebug`.
2. Capture one failing repro.
3. Save the JSON.
4. Run the summarizer.
5. Add the retained artifact.
6. Only then decide the next fix.

## Likely Remaining Failure Class

Most likely if the issue still exists:

- a second write or cleanup is replacing or nulling the visible chip preview after initial render

The runtime helper was created to prove that directly.
