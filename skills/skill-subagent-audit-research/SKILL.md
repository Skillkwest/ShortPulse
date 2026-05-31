---
name: skill-subagent-audit-research
description: Coordinate subagent use for ShortPulse audit, inspection, investigation, and online research requests. Use when the user asks to audit, inspect, investigate, review broadly, research online, compare current facts, or gather evidence, so the agent deliberately decides whether subagents are warranted, delegates bounded sidecar work when allowed, and closes unused subagents.
---

# Subagent Audit Research

## Overview

Use this skill to honor the repo preference for subagent-assisted audit, inspection, and online research work without forcing unnecessary delegation on tiny tasks. The user grants standing repo-level permission for subagents when useful, but the active subagent tool contract still controls whether a current request is authorized. Treat current-task phrases like `you may use subagents for this task`, `use subagents freely where useful`, `delegate as needed`, or equivalent wording as explicit authorization. The agent owns the decision: use subagents when the task has meaningful audit/research scope and subagents are available, allowed, useful, and authorized; record why not when they are unnecessary or unsuitable.

## Decision Rule

1. Classify the request before starting execution.
   - Use this skill for audit, inspect, investigation, broad review, codebase survey, evidence gathering, or online research requests.
   - Treat "online research" as a research lane even when browsing is only one part of the task.
2. Decide whether subagents are needed for the actual scope.
   - Use at least one subagent for substantive audit, inspection, or online research lanes when subagents are available and the active tool contract permits or the current task explicitly authorizes them.
   - Skip subagents for narrow factual checks, single-file edits, one-command answers, or tasks where the immediate next step depends entirely on local context.
   - Skip subagents when the platform/session/tool contract disallows them or requires explicit current-task authorization that the user has not provided, but state that constraint in the final response.
3. Keep the main rollout on the critical path.
   - Do immediate blocking work locally.
   - Delegate bounded sidecar tasks that can run independently and materially reduce risk.
   - Do not duplicate delegated work unless the result is missing or clearly suspect.

## Delegation Patterns

- Code audit: delegate a specific subsystem, risk class, or file set; keep any fix or integration work local unless a worker has a clear disjoint write scope.
- Code inspection: ask explorers for concrete answers about separate modules, call paths, or test coverage gaps.
- Online research: delegate independent source collection, version/current-state checks, or comparison tables; require primary sources where the topic is technical or high-stakes.
- Mixed work: split local repo inspection from web research only when they can proceed independently.

## Subagent Hygiene

- Give each subagent a self-contained prompt with the exact scope, expected output, and relevant paths or sources.
- Tell code-editing workers that they are not alone in the codebase and must not revert others' edits.
- Wait only when the main task is blocked on the subagent result.
- Close subagents when their lane is complete, stale, or no longer useful.
- In the final response, summarize whether subagents were used, what they covered, and any skipped-lane rationale.

## Final Self-Audit

Before closeout, check whether a missed high-value subagent lane remains. Start it only when it has a concrete repo-backed problem statement and better ROI than stopping.
