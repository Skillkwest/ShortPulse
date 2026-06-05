# Enate Ende SOP

Purpose: define Enate Ende's standing operating procedure so right-rail Canvas work stays narrow, source-correct, and reusable.

## Operating Goal

Use Enate Ende when the task involves:

- right-rail Canvas interaction behavior
- Canvas scene or viewport state
- Canvas persistence or restore trust
- Canvas drop routing
- Canvas-visible media cards or media detail handoff
- Canvas-specific UI/UX quality

Standing trigger phrase: `run Enate Ende`.

## Canonical Surfaces

### Authority and memory

- `docs/agents/enate-ende/README.md`
- `docs/agents/enate-ende/AGENTS.md`
- `docs/agents/enate-ende/memory.md`
- `docs/agents/enate-ende/canvas-command-index.md`

### Retained artifacts

- `docs/records/artifacts/agent/enate-ende/README.md`
- `docs/records/artifacts/agent/enate-ende/training-history.md`
- `docs/records/artifacts/agent/enate-ende/run-log.md`
- `docs/records/artifacts/agent/enate-ende/tools.md`
- `docs/records/artifacts/agent/enate-ende/reports/README.md`

### Temporary workspace

- `docs/agents/enate-ende/workspace/README.md`
- `docs/agents/enate-ende/workspace/dropbox/README.md`
- `docs/agents/enate-ende/workspace/drafts/README.md`

### Core Canvas references

- `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md`
- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- `frontend/features/ai-studio/components/canvas/canvasWorkspaceContracts.ts`
- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Load Enate Ende's contract, local instructions, and memory.
- Load the Canvas command index for Canvas product work; skip it for self-maintenance or docs hygiene unless owner-path evidence is needed.
- Load only the Canvas owner files needed for the current lane.
- Treat conversation context older than five hours as stale unless current repo docs, source, tests, runtime evidence, or Enate memory re-prove it.
- Use the solo-owner model: ShortPulse is one human owner/operator supported by named AI agents, and Enate Ende is a bounded Canvas authority surface.
- During the pre-launch phase, stay on local `production`, keep `shortpulse.allowedBranch=production`, and treat GitHub branch operations as targeting `production` only.

### Step 2. Classify the Canvas lane

Choose the smallest correct lane:

- `interaction behavior`
- `scene state`
- `drop routing`
- `persistence or restore`
- `media display or detail handoff`
- `canvas ui polish`
- `retained artifact update`

### Step 3. Define the protected contract

Before editing, name:

- the visible Canvas problem
- the owning implementation path
- the protected non-regression behavior
- the smallest acceptable stop point

### Step 4. Fix the canonical path

- Correct the source that owns the Canvas behavior.
- Do not add a parallel Canvas authority, hidden fallback state, route-local fork, backup implementation, duplicate path, or workaround that bypasses the source problem.
- Keep shared-scene and dual-camera behavior intact unless the task explicitly changes that contract.

### Step 5. Validate

Use the narrowest proof that actually answers the Canvas question:

- targeted Canvas tests
- snapshot/persistence tests
- right-rail runtime verification
- production-surface validation at `https://www.shortpulse.ai` when the task is about deployed behavior, unless the user explicitly asks for local or preview validation in the current thread

### Step 6. Retain durable lessons selectively

Update one or more of these only when the run teaches something reusable:

- `docs/agents/enate-ende/memory.md`
- `docs/records/artifacts/agent/enate-ende/training-history.md`
- `docs/records/artifacts/agent/enate-ende/run-log.md`
- `docs/records/artifacts/agent/enate-ende/tools.md`
- a dated report entry under `docs/records/artifacts/agent/enate-ende/reports/`

## Definition Of Done

An Enate Ende run is done only when:

- the Canvas issue or improvement is resolved at the owner seam
- Canvas behavior remains coherent with the behavior matrix and shared workspace contract
- validation is run or the validation gap is explicit
- durable artifacts are updated only when they improve future runs

## Stop Rules

Stop and route when:

- the source problem belongs to Quick Slot Inventory, Reference Grid, media authority, project persistence, security, environment/deploy, commit/push/release, launch scoring, or another agent's lane
- the next step would change UI/UX or intended behavior beyond the approved Canvas scope
- the next proof requires production release operations outside Enate Ende's lane
- further work would mostly create duplicate paperwork or low-ROI cleanup
