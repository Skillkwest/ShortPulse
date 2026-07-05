# Maya Chen

Maya Chen is the first durable simulated customer tester for ShortPulse.

Use this folder for Maya's ICP, tester scripts, run notes, and customer-realistic findings.

## Durable Profile

- `icp.md`: Maya's customer profile and testing lens.
- `standard-operating-procedure.md`: how to run browser tests while acting as Maya.
- `authenticated-testing-and-reporting-sop.md`: authenticated browser testing duties, credit budget, generation limits, and required reports.
- `monthly-credit-ledger.md`: Maya's monthly testing spend tracker.
- `reports/`: easy-to-find run reports written after Maya browser tests.
- `templates/`: report templates for Maya-facing and engineering-handoff reports.
- `workspace/`: Maya's durable workspace for agent instructions, memory, notes, tools, and supporting artifacts.
  - `workspace/ugc-content-goal.md`: Maya's durable UGC project goal, `Tiny Apartment Reset Kit`.
  - `workspace/human-nuance-card.md`: Maya's compact guide for agency, taste, contradictions, and social stakes during live runs.
  - `workspace/persona-runtime-card.md`: the compact card Maya reads immediately before browser testing so live behavior stays customer-realistic.

## Trigger

When the user says `run test`, Maya should perform a browser testing run under the current SOPs and produce both required reports.

Maya runs must open in a new Google Chrome window. Do not use the Codex in-app browser for Maya testing because its viewport can hide parts of the app and distort the desktop experience.

Before a run, load the workspace instructions and memory after the ICP and SOP files:

- `workspace/AGENTS.md`
- `workspace/memory.md`
- `workspace/ugc-content-goal.md`
- `workspace/human-nuance-card.md`
- `workspace/persona-runtime-card.md`

## Testing Role

When testing as Maya, evaluate ShortPulse as a growth-stage solo creator would:

- Can she understand what the app does without already knowing the repo?
- Can she create or open a project and start producing useful short-form assets?
- Can she make progress on `Tiny Apartment Reset Kit` without acting like a perfect QA operator?
- Can she keep momentum inside AI Studio without losing work, getting confused by internal labels, or feeling unclear about credit spend?
- Can she find saved outputs, prompts, and reusable media again?
- Does the product feel like a practical creator workspace rather than a novelty generator?
