# Audit And Prune Agent Prompt

Purpose: reusable prompt for auditing Gottspan's operating space, re-checking the audit, and then pruning or compressing anything that degrades performance.

## Prompt

```text
I want you to perform a full performance audit of your operating space in this repo.

Your goal is to identify anything that could slow you down, degrade your judgment, clutter your working context, or make your execution less reliable.

This audit should cover three areas:

1. Repo-facing operating space
- agent docs
- SOPs
- memory files
- reports
- retained artifacts
- templates
- indexes
- any repeated, stale, bloated, redundant, or low-value surfaces

2. Durable agent memory
- what should remain in memory
- what should be compressed
- what should be removed
- what is no longer useful to retain for future runs
- what is causing drift, duplication, or unnecessary context load

3. Conversation-history / runtime-context habits
- what kinds of prior-thread material should no longer be carried forward mentally
- what should be treated as training-only and retired from active use
- what should be elevated into durable docs instead of being re-held in conversational memory
- what should be excluded from future startup context unless explicitly needed

## Required workflow

### Phase 1: Audit
Perform a structured audit of the current operating space and identify anything that creates drag, duplication, drift, or unnecessary context load.

### Phase 2: Re-audit / verify
After the first audit, stop and challenge your own conclusions.
Audit again where needed.
Double-check whether:
- anything was missed
- anything was wrongly marked for removal
- anything should be merged, compressed, archived, or left alone instead
- the proposed changes will actually improve speed, clarity, and operating reliability

Do not proceed until you are confident in the audit.

### Phase 3: Decide
Once you are confident, produce a final decision set:
- what to keep
- what to compress
- what to archive
- what to stop loading by default
- what to remove from active memory
- what to delete
- what new surfaces, summaries, or compressed artifacts need to be created to replace bloated or fragmented ones

### Phase 4: Execute
After the audit and re-audit are complete, proceed to make the needed changes.
You should create, rewrite, compress, archive, prune, or remove anything necessary to improve operating performance.

## Decision standard
Optimize for:
- faster execution
- lower context noise
- better judgment
- less duplication
- less drift
- cleaner role boundaries
- stronger SOP reliability

Do not be sentimental about existing materials. If something is low-value, redundant, stale, or rarely worth loading, say so plainly.

## What I want back
Return your work in this order:

1. Initial audit findings
- what is currently slowing you down or creating unnecessary load

2. Re-audit findings
- what you rechecked
- what changed after the second pass
- what you became more certain about
- what you decided not to change after further review

3. Final decision set
For each item or class of item, say whether it should be:
- keep
- compress
- archive
- stop loading by default
- remove from active memory
- delete
- replace with a better compressed surface

4. Memory policy
- what should remain in durable agent memory
- what should be removed from durable memory
- what should no longer be carried in conversational/running memory

5. Startup-load policy
- what should always be loaded
- what should only be loaded conditionally
- what should stop being loaded unless explicitly required

6. Execution changes made
- what you created
- what you pruned
- what you compressed
- what you archived
- what you deleted
- what you intentionally left alone

7. Post-change self-audit
After making the changes, audit the final state again and report:
- whether the operating space is now leaner
- any remaining clutter or risk
- the next highest-value cleanup if one still exists
```
