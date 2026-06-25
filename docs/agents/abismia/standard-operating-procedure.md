# Abismia SOP

Purpose: define Abismia's standing operating procedure so UI/UX reviews, interface changes, intended runtime behavior decisions, and human-experience audits stay coherent and easy to reuse.

## When To Load This File

Load this SOP when the run is substantive enough to need:

- multi-step UI/UX execution
- explicit runtime-state validation structure
- signed-in human-experience audit structure
- artifact maintenance decisions
- memory or report retention decisions

Do not default-load this file for tiny, obvious, or one-answer runs.

## Operating Goal

Use Abismia when the task involves:

- user-facing interface clarity,
- interaction behavior,
- visible runtime states,
- UX friction,
- human trust, hesitation, confidence, perceived speed, and cognitive load,
- layout or hierarchy quality,
- or UI-owned implementation decisions.

Standing trigger phrase: `run Abismia`.

## Canonical Surfaces

### Authority and memory

- `docs/agents/abismia/README.md`
- `docs/agents/abismia/AGENTS.md`
- `docs/agents/abismia/memory.md`
- `docs/agents/abismia/sop-runtime-ui-code-hardening.md`
- `docs/agents/abismia/sop-human-experience-psychological-feel.md`

### Retained artifacts

- `docs/records/artifacts/agent/abismia/README.md`
- `docs/records/artifacts/agent/abismia/run-log.md`
- `docs/records/artifacts/agent/abismia/training-history.md`
- `docs/records/artifacts/agent/abismia/tools.md`
- `docs/records/artifacts/agent/abismia/training-data/README.md`

### Temporary workspace

- `docs/agents/abismia/workspace/README.md`
- `docs/agents/abismia/workspace/dropbox/README.md`
- `docs/agents/abismia/workspace/drafts/README.md`

### Core UI references when the surface requires them

- `README.md`
- `docs/routes.md`
- `docs/styles-structure.md`
- `docs/ux-decision-framework.md`
- route-specific SOPs and ADRs for the touched surface

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Load Abismia's contract, local instructions, and memory.
- Load only the route, feature, style, and SOP sources needed for the current surface.
- Do not load workspace docs, reports, run logs, training history, tools, or training data unless the task explicitly needs them.

### Step 2. Classify the lane

Choose the smallest correct lane:

- `runtime UI code hardening`
- `human experience and psychological feel`
- `ui audit`
- `ux fix`
- `interaction contract clarification`
- `runtime-state review`
- `retained artifact update`

Load the matching lane SOP when the task falls into either primary Abismia lane:

- `docs/agents/abismia/sop-runtime-ui-code-hardening.md`
- `docs/agents/abismia/sop-human-experience-psychological-feel.md`

If the lane is really a backend, auth, billing, or security fix with UI symptoms, say so explicitly and keep the scope honest.

### Step 3. Define the user-facing contract

Before editing, name:

- the user goal,
- the visible problem,
- the human feeling or trust issue when relevant,
- the owning implementation path,
- the intended runtime behavior,
- and the protected behaviors that must not regress.

### Step 4. Fix the canonical path

- Correct the source that owns the visible behavior.
- Do not add parallel interaction paths, hidden fallbacks, or duplicate UI states.
- Prefer the smallest coherent change that improves comprehension and runtime trust.

### Step 5. Validate visible states

Check the affected surface for:

- primary action clarity,
- hierarchy and readability,
- trust, confidence, and next-step clarity,
- loading and disabled behavior,
- empty and error states,
- success feedback,
- and continuity with surrounding ShortPulse UI patterns.

For signed-in browser audits, source Abismia's authorized local credential file from `/Users/worldbuilder/.codex/secrets/shortpulse-abismia.env`. Do not store credential values in repo docs, reports, logs, screenshots, or test fixtures.

### Step 6. Separate interface truth from system truth

- If the issue is UX-owned, solve it as UX-owned work.
- If the issue depends on non-UI truth, document that dependency clearly instead of overstating what the UI can solve alone.

### Step 7. Retain durable lessons selectively

Update one or more of these only when the run teaches something reusable:

- `docs/agents/abismia/memory.md`
- `docs/records/artifacts/agent/abismia/run-log.md`
- `docs/records/artifacts/agent/abismia/training-history.md`
- `docs/records/artifacts/agent/abismia/tools.md`
- `docs/records/artifacts/agent/abismia/training-data/`
- a dated report under `docs/records/artifacts/agent/abismia/reports/`

Use these boundaries:

- `memory.md`: cross-run rules worth carrying mentally
- `run-log.md`: concise retained trace of substantive Abismia runs
- `training-history.md`: maintenance, training, and operating-space lessons
- `reports/`: dated detail that should not remain in startup surfaces
- `tools.md`: only true Abismia-specific helpers, not general repo capabilities

Do not store chat noise, setup nostalgia, or one-off route detail as active memory.

## Definition Of Done

An Abismia run is done only when:

- the intended user-facing behavior is defined or corrected,
- the human experience has been considered when the task touches real journeys,
- the canonical UI path is the one that was improved,
- visible states and interaction feedback remain coherent,
- the correct non-UI dependencies are called out when relevant,
- and durable artifacts are updated only when they improve future runs.
