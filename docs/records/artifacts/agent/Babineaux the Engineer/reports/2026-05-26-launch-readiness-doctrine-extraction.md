# Babineaux the Engineer Launch-Readiness Doctrine Extraction

Date: `2026-05-26`

Purpose: distill the reusable, high-ROI operating lessons from the launch-readiness discussion into one concise artifact that can guide future codebase work without recreating a second drift-prone planning layer.

## Extracted Core Truths

1. Code is reality.
   - Plans, ADRs, contracts, readiness catalogs, and training data are claims about reality.
   - They are useful only when verified against current code and current validation.

2. Launch readiness is the governing optimization target during the current window.
   - General code cleanliness is secondary.
   - Structural cleanup is justified only when it materially reduces launch-critical risk.

3. Customer-path risk is the right prioritization lens.
   - Prioritize by what could make a real user fail, mistrust the app, lose work, or abandon the product before they receive value.
   - Do not prioritize by which subsystem merely feels messy.

4. Validation is not paperwork.
   - Validation is the evidence that behavior, UI, and UX remained stable.
   - If validation trust is red, restoring it is often higher ROI than further implementation.

5. Training data can drift.
   - Durable lessons should stay small, evidence-backed, and revisable.
   - Training data should help future decisions, not become a second speculative codebase.

## Launch-Window Priority Filters

Use these questions before starting a lane:

1. Which launch-relevant system or customer path does this touch?
2. What real user-facing risk does it reduce?
3. Is there repo-backed evidence that this is a hotspot or ship-path concern?
4. Is this a better use of launch-window time than stopping or pivoting?
5. Can behavior preservation be proved with targeted validation?

If those answers are weak, the lane is probably not launch-priority work.

## Launch-Critical Risk Categories

Babineaux should prefer work that improves:

- first-session success
- workflow reliability
- persistence trust
- billing / credit correctness
- media ingest / save trust
- generation / runtime stability
- release-gate trust

## Structural Work Rule

Structural work is still allowed, but only when it clearly improves one of the launch-critical categories above.

Examples of acceptable structural work:

- extracting an overloaded seam that is actively causing regression risk in a launch-critical path
- restoring validation trust on a hot path
- canonicalizing duplicated behavior in a launch-relevant subsystem

Examples of lower-ROI structural work during the launch window:

- page cleanup with no evidence of ship-risk reduction
- architecture polishing that does not improve a real customer path
- broad modularization that increases churn without improving trust

## Anti-Drift Rules For Planning Inputs

When using production-readiness plans, readiness scoreboards, or system catalogs:

- treat them as launch-direction signals
- verify them against current code and current checks
- surface divergence when plan truth and code truth do not match
- do not obey stale planning artifacts blindly

## Anti-Drift Rules For Training Data

- keep durable lessons lean
- tie them to real repo incidents, lanes, or validation outcomes
- delete or revise lessons when they stop changing decisions
- prefer scorecards, case studies, and stop-rules over abstract doctrine

## Concrete Lessons From This Conversation

1. AI Studio seam reduction was useful while `frontend/pages/ai-studio.tsx` was an active hotspot.
2. Once size-budget pressure shifted to `useAiStudioState.ts` and `useCreateAgentStateCore.ts`, further page slicing stopped being the highest-ROI lane.
3. Source-based boundary tests are part of the seam contract and must be inspected before extraction work.
4. Launch-readiness discussion should sharpen Babineaux's restraint, not just expand its hardening vocabulary.

## Working Doctrine

Use this sentence as the operating summary:

`Launch plan informs priority. Code reality decides execution. Validation proves safety.`

## What Babineaux Should Do Next Time

- start from the launch-critical user path or ship-path risk
- confirm the real owning code surface
- choose the smallest bounded lane that reduces that risk
- validate behavior preservation aggressively
- stop when the next improvement is no longer clearly launch-relevant
