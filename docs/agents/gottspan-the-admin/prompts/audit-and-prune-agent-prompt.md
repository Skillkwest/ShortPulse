# Audit and Prune Current Agent Prompt

Purpose: reusable prompt for auditing the current receiving agent's own operating space, re-checking the audit, and then pruning or compressing anything that degrades that agent's performance.

## Prompt

```text
I want you to perform a full performance audit of your own operating space in this repo.

Important target rule: this prompt applies to the agent receiving it in the current conversation. Do not run this prompt against Gottspan's folder, prompt library, reports, or memory unless you are explicitly operating as Gottspan in this conversation.

Before auditing, identify your own agent identity and owned repo surface:
- your canonical agent name,
- your agent folder or contract file,
- your durable memory/report/artifact area, if one exists,
- and any scoped instructions that define your lane.

If you cannot identify your own owned agent surface, pause and ask for the correct target instead of auditing or editing another agent's folder.

Your goal is to make your own agent workspace leaner, clearer, and more reliable without changing product UI, UX, intended behavior, launch posture, security posture, commit/push state, or any other agent's workspace.

This audit should cover:

1. Repo-facing operating space:
- your own agent docs
- your own SOPs
- your own memory files
- your own reports
- your own retained artifacts
- your own templates
- your own indexes
- any repeated, stale, bloated, redundant, or low-value surfaces inside your owned agent lane

2. Durable agent memory:
- what should remain in memory
- what should be compressed
- what should be removed
- what is no longer useful to retain for future runs
- what is causing drift, duplication, or unnecessary context load

3. Runtime-context habits:
- what kinds of prior-thread material should no longer be carried forward mentally
- what should be treated as training-only and retired from active use
- what should be elevated into durable docs instead of being re-held in conversational memory
- what should be excluded from future startup context unless explicitly needed

## Required workflow

### Phase 1: Audit
Perform a structured audit of your own current operating space and identify anything that creates drag, duplication, drift, stale authority, or unnecessary context load.

Stay inside your owned agent surface. If you discover another agent's workspace has problems, record a handoff or follow-up instead of editing it.

### Phase 2: Re-audit
Challenge your own conclusions before editing. Re-check whether:
- anything was missed
- anything was wrongly marked for removal
- anything should be merged, compressed, archived, or left alone instead
- the proposed changes will actually improve speed, clarity, and operating reliability

### Phase 3: Decide
Produce a short decision set:
- what to keep
- what to compress
- what to archive
- what to stop loading by default
- what to remove from active memory
- what to delete
- what new surfaces, summaries, or compressed artifacts need to be created to replace bloated or fragmented ones

Prefer compression or default-load policy changes over deletion. Delete only when the item is clearly obsolete, duplicate, non-authoritative, and safe to remove inside your owned agent surface.

### Phase 4: Execute
After the audit and re-audit are complete, proceed to make the needed changes.
You should create, rewrite, compress, archive, prune, or remove anything necessary to improve your own operating performance, limited to your owned agent surface.

Do not edit Gottspan's prompt library, Gottspan's reports, or any other agent's workspace unless that workspace is the explicitly identified target for this conversation.

### Phase 5: Self-audit
After editing, audit the final state. Confirm the workspace is leaner, the default-load path is clearer, and no authority boundary or unrelated surface was changed.

## Decision standard
Optimize for:
- faster execution
- lower context noise
- better judgment
- less duplication
- less drift
- cleaner role boundaries
- stronger SOP reliability

Do not be sentimental about existing materials. If something is low-value, redundant, stale, or rarely worth loading, say so plainly. Do not create new documents unless they replace bloated or fragmented truth with a clearly better surface.

## What I want back

Keep the closeout concise. Include:
- the agent identity and owned surface audited
- the highest-value drag found
- the changes made
- anything intentionally left alone
- the final default-load or memory policy if it changed
- remaining risk or the next cleanup boundary, if one exists
```
