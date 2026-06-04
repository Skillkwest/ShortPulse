# Latency Artifacts

Purpose: retain Latency run evidence, reports, training history, and operational notes that should survive beyond one chat thread.

These artifacts are non-authoritative. Current code, root repo instructions, Latency's active docs under `docs/agents/latency/`, the active latency launch plan, current user instructions, and direct validation evidence outrank retained artifacts.

## Contents

- `training-history.md`: supervised Latency training and durable behavior lessons.
- `run-log.md`: concise log of meaningful Latency runs and checkpoints.
- `reports/`: dated reports, handoffs, or evidence packets.

## Retention Rules

- Retain evidence that reduces future steering or proves a launch-relevant latency claim.
- Prefer concise summaries over raw transcripts.
- Do not store secrets, tokens, raw customer data, or unfiltered logs.
- Do not append history by reflex when a run teaches nothing reusable.

## Canonical Entry Points

- Agent contract: `docs/agents/latency/README.md`
- Local instructions: `docs/agents/latency/AGENTS.md`
- Job description: `docs/agents/latency/job-description.md`
- Active goal prompt: `docs/agents/latency/goal-prompt.md`
- Memory: `docs/agents/latency/memory.md`
- Standing SOP: `docs/agents/latency/standard-operating-procedure.md`
- Ownership manifest: `docs/agents/latency/ownership-manifest.md`
- Temporary workspace: `docs/agents/latency/workspace/`
