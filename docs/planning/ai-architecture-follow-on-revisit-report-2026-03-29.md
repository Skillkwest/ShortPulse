# AI Architecture Follow-On Revisit Report (2026-03-29)

Purpose: preserve one easy-to-find source of truth for the external architecture-research takeaways, the current ShortPulse interpretation of them, and the date/criteria for when broader follow-on work should be reconsidered.

## Snapshot
- Recorded on: `2026-03-29`
- Earliest revisit date: `2026-04-12`
- Current posture: `defer broad AI architecture follow-on work`
- Default action before revisit date: continue active rebuild lanes and avoid opening a new architecture program

## Bottom Line
ShortPulse already has the right broad product and systems shape for an AI-powered creative application:
- a serious AI workspace (`/ai-studio`)
- an async generation/control plane
- a first-class media pipeline
- strong security and operator telemetry

The useful follow-on work is narrow:
1. tighten AI Studio state boundaries
2. finish Media Library runtime consolidation
3. add explicit boot-path and media-readiness performance gates

The useful takeaway from external architecture research is not to copy external stacks. It is to keep finishing the repo's existing separation of concerns between:
- AI Studio workspace/editor state
- generation job state
- media delivery/runtime state

## What The Repo Already Has
### 1. Async generation as a real control plane
ShortPulse already treats image/video generation as asynchronous infrastructure instead of synchronous UI work.

Evidence:
- [README.md](../../README.md)
- [frontend/lib/server/generationControlPlane/runCycle.ts](../../frontend/lib/server/generationControlPlane/runCycle.ts)
- [docs/planning/generation-pipeline-rebuild-master-roadmap-2026-03-27.md](./generation-pipeline-rebuild-master-roadmap-2026-03-27.md)
- [docs/monitoring.md](../monitoring.md)

Signals already present:
- queued submit + recovery
- webhook ingestion
- control-plane scheduling
- explicit lifecycle metrics
- operator health and trace surfaces

### 2. Media delivery is already treated as a subsystem
ShortPulse already has the important media-system behaviors the external reports emphasized.

Evidence:
- [README.md](../../README.md)
- [frontend/pages/api/media/list.ts](../../frontend/pages/api/media/list.ts)
- [frontend/features/media-library/runtime/useMediaLibraryRouteRuntime.ts](../../frontend/features/media-library/runtime/useMediaLibraryRouteRuntime.ts)
- [docs/planning/media-library-runtime-rebuild-master-plan-2026-03-28.md](./media-library-runtime-rebuild-master-plan-2026-03-28.md)

Signals already present:
- server-authoritative uploads
- signed previews
- derivative-first posture
- folder-aware organization
- route/modal/panel surface awareness
- runtime rebuild plan already in motion

### 3. Product surfaces are already explicit
The repo already has intentional surface separation rather than one overloaded shell.

Evidence:
- [docs/routes.md](../routes.md)
- [docs/product/shortpulse_ai_studio.md](../product/shortpulse_ai_studio.md)
- [README.md](../../README.md)

Signals already present:
- workspace hub
- creative workspace
- media organization
- billing/profile
- admin diagnostics
- separate planning tracks for generation and media runtime

### 4. Telemetry, security, and operational posture are already strong
ShortPulse is already ahead of what most external architecture summaries can usefully teach on these topics.

Evidence:
- [docs/monitoring.md](../monitoring.md)
- [docs/security-checklist.md](../security-checklist.md)
- [frontend/lib/appErrorReporter.ts](../../frontend/lib/appErrorReporter.ts)
- [frontend/lib/authGuard.ts](../../frontend/lib/authGuard.ts)

Signals already present:
- authenticated client/server incident telemetry
- operator triage surfaces
- strict route/API auth posture
- user-scoped storage and RLS
- cron-secret internal routes
- explicit media-scope and provider-ownership contracts

## Valuable Follow-On Opportunities
### Lane 1: AI Studio boundary cleanup
Problem:
- AI Studio still mixes too much workspace/editor state with generation job state and persistence concerns.

Primary evidence:
- [frontend/pages/ai-studio.tsx](../../frontend/pages/ai-studio.tsx)
- [frontend/features/ai-studio/hooks/useAiStudioState.ts](../../frontend/features/ai-studio/hooks/useAiStudioState.ts)

Why it matters:
- the external reports reinforce separating interactive workspace concerns from slower AI job orchestration
- the repo already did this successfully on the generation control-plane side
- AI Studio page/state boundaries remain the clearest place where the separation is still too soft

Recommended direction:
- split AI Studio state into explicit domains:
  - workspace/editor state
  - generation job state
  - asset/library state
- keep the page as a composition boundary instead of a systems boundary

### Lane 2: finish Media Library runtime consolidation
This is not a new idea from external research. It is a repo-confirmed lane that should be finished instead of reopened conceptually.

Primary evidence:
- [docs/planning/media-library-runtime-rebuild-master-plan-2026-03-28.md](./media-library-runtime-rebuild-master-plan-2026-03-28.md)
- [frontend/features/media-library/runtime/useMediaLibraryRouteRuntime.ts](../../frontend/features/media-library/runtime/useMediaLibraryRouteRuntime.ts)

Why it matters:
- the design-app reports correctly treat media delivery and preview readiness as their own subsystem
- ShortPulse already has the right substrate and planning docs
- the route adapter is explicitly transitional, which implies the main value is follow-through, not strategy change

Recommended direction:
- continue consolidating route/modal/panel media state, preview hydration, aspect metadata, and invalidation into one shared runtime
- do not reopen solved backend transport contracts while doing this

### Lane 3: boot-path and media-readiness performance gates
The operational lesson here is valuable as instrumentation/governance work rather than infrastructure imitation.

Primary evidence:
- [docs/performance.md](../performance.md)
- [docs/monitoring.md](../monitoring.md)
- [frontend/lib/appErrorReporter.ts](../../frontend/lib/appErrorReporter.ts)

Why it matters:
- current performance guidance is directionally correct but still generic
- the repo already has enough telemetry plumbing to support tighter budgets

Recommended direction:
- define measurable budgets for:
  - AI Studio boot readiness
  - Media Library first usable paint
  - sign-batch latency
  - resolve-preview latency
  - time-to-first-visible-asset on heavy media surfaces
- wire those into existing monitoring and validation flows

## Explicit Non-Goals Right Now
These ideas are not justified implementation lanes for the current repo:
- no Figma-style realtime collaboration system
- no Wasm/WebGPU renderer rewrite
- no Triton/TensorRT/custom inference-serving program
- no broad vendor-stack mimicry

Reason:
- none of these are backed by a concrete repo bottleneck or product requirement today
- the repo is primarily integrating external model APIs, not operating its own large inference fleet
- the highest-ROI work is still internal boundary cleanup and performance gating

## Revisit Gate
Do not start the broader follow-on architecture work before checking both:
1. The current date is `2026-04-12` or later.
2. The active rebuild lanes are materially further along, especially:
   - generation-pipeline rebuild
   - media-library runtime rebuild

If the current date is still earlier than `2026-04-12`, the default answer is:
- keep deferring broad architecture follow-on work
- only make narrow changes that directly de-risk the active rebuilds

## What Can Start Earlier
These are allowed before the revisit date only if they directly support active lanes:
- identity cleanup that reduces current generation-pipeline ambiguity
- operator traceability improvements that help debug live runtime issues
- narrow client/server lifecycle cleanup tied to active bugs

These are not approved before the revisit date unless a concrete repo blocker appears:
- broad AI Studio state-domain redesign
- generalized workflow-manifest/framework work
- provider-routing sophistication beyond current operational need

## What To Re-Evaluate On Or After 2026-04-12
When this note is revisited, check whether it is time to open one or more of these lanes:
1. AI Studio boundary cleanup
2. Media Library runtime consolidation follow-through
3. Boot-path and media-readiness performance gates

At that point, prefer opening one lane at a time instead of all of them together.

## Future-Agent Check Instruction
When this document is read in a future session:
1. Compare the current date to `2026-04-12`.
2. If the current date is earlier, treat this report as a hold.
3. If the current date is `2026-04-12` or later, review the current status of:
   - `docs/planning/generation-pipeline-rebuild-master-roadmap-2026-03-27.md`
   - `docs/planning/media-library-runtime-rebuild-master-plan-2026-03-28.md`
   - this document
4. Only open the broader follow-on lane if the active rebuild work has stabilized enough that the new lane will reduce risk more than it adds churn.

## One-Line Rule
Before `2026-04-12`, do not turn the external architecture takeaways into a broad implementation program unless a concrete repo blocker forces it.
