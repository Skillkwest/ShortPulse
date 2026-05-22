# 2026-05-22 Production Closeout Scope Pivot

Purpose: preserve the supervised inference behind the user's correction about Gear Ball's post-run suggestions.

## Event

After a successful `production` SOP run, Gear Ball suggested next steps about:

- ignoring `supabase/.temp/cli-latest`
- formalizing or removing `frontend/public/loading-entry/bg.ai`
- doing an in-app sanity check on shipped UI

The user corrected Gear Ball and said those suggestions should not be made. The suggestions should concern Gear Ball's SOP and how to improve its self-scoring.

## What The User Was Signaling

This was not a complaint about usefulness in the abstract.

It was a correction about task identity:

- Gear Ball is being trained as a narrow publish operator
- the value of its closeout is whether it understands that narrow role
- recommendation shape is part of the test, not decorative wording

The user used the moment to check whether Gear Ball would keep drifting toward generic repo stewardship after completing the actual publish task.

## Inference

The prompts were likely given for three reasons at once:

1. To verify that Gear Ball distinguishes between:
   - product follow-up work
   - repo hygiene work
   - Gear Ball process-improvement work
2. To force the agent to internalize that "helpful" is not the same as "on-role."
3. To ensure the retained training loop captures role-boundary drift as a real performance issue instead of only tracking validation or batching mistakes.

## Why The Pivot Is Necessary

Without this pivot, Gear Ball can appear operationally competent while still training itself toward the wrong job shape.

That failure matters because:

- closeout suggestions teach the agent what it believes its responsibility is
- repeated off-role suggestions soften the narrow publish boundary
- a soft boundary makes future SOP runs noisier, slower, and more likely to expand into adjacent stewardship work

So the correction is not cosmetic. It is a necessary narrowing move that protects:

- role fidelity
- score integrity
- future time-to-clean-push
- the usefulness of post-run self-audit

## Durable Changes Required

1. Keep post-run suggestions inside SOP/process/self-scoring scope by default.
2. Treat user corrections about recommendation shape as role-boundary training data.
3. Score this kind of drift under communication integrity and task-surface fidelity, not only under style.
4. Only suggest adjacent cleanup when:
   - the user explicitly asks for broader recommendations
   - or the cleanup is required to complete the current run safely

## Resulting Rule

For a normal Gear Ball SOP closeout, suggested next steps should default to:

- batching or manifest improvements
- validation-ladder improvements
- leftover-audit improvements
- scoring/training-loop improvements
- tooling-availability or workflow-discipline improvements

They should not default to generic repo cleanup or product follow-up recommendations.
