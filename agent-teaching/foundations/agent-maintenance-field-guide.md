# Agent Maintenance Field Guide

Purpose: generic reference for keeping any trained agent reliable over time.

## The Core Problem

Long-running agent threads degrade.

The failure is structural, not emotional. As context grows, signal gets buried, earlier instructions lose weight, and the model starts relying more on recent patterns than durable rules.

## Common Failure Modes

- Context dilution: too much text competes for attention.
- Lost-in-the-middle: important SOP details buried mid-context get missed.
- Instruction drift: newer turns quietly override older rules.
- Hidden compression: precise rules get reduced to vague intent.
- State fragmentation: multiple conflicting "truths" build up across prompts, SOPs, and artifacts.

## Correct Mental Model

- Conversation = execution surface
- Docs and artifacts = durable memory

Do not rely on one giant thread to hold the whole trained agent.

## What Should Be Durable

Keep durable behavior in:
- agent contract
- SOPs
- prompt templates
- reports
- training-history
- KPI baselines
- helper inventories

## What Should Stay Out Of Runtime By Default

Do not keep injecting everything on every run.

Avoid loading:
- old brainstorming
- superseded SOP versions
- long uncurated report histories
- contradictory notes
- training prompts that are no longer active

## Maintenance Workflow

### 1. Canonicalize

Move stable behavior out of chat and into:
- the agent contract
- the current SOP
- the current prompts
- the training-history record

### 2. Retrieve Selectively

Load only what the run needs:
- governing instructions
- the relevant SOP
- the relevant contract
- the few supporting artifacts needed for this run

### 3. Execute Cleanly

Treat each meaningful run as a fresh execution against curated context, not as continuation of a giant historical thread.

### 4. Audit

After the run, ask:
- what drift showed up
- what was unclear
- what should move from chat into docs
- what training-only scaffolding can be retired

### 5. Reset

When the thread gets noisy or stale, start a new thread and re-inject the clean materials.

## Practical Maintenance Rules

- Keep the active SOP short and operational.
- Keep the contract scoped to the real task surface.
- Append durable learning to training-history after supervised runs.
- Freeze KPI baselines instead of rewriting them.
- Start a new thread when training noise starts competing with execution.

## Signs The Agent Needs Maintenance

- it stops following SOP order consistently
- it forgets escalation conditions
- it uses stale tools or stale prompts
- it becomes verbose but less precise
- it performs differently on near-identical runs

## When To Split One Agent Into Several

Split when:
- one workflow now contains multiple distinct done states
- one agent mixes research, execution, approval, and publishing
- one SOP is growing into several separate SOPs
- training improvements help one task surface but hurt another

## Maintenance Goal

The goal is not to preserve one immortal conversation.

The goal is to preserve a clean, inspectable operating system for the agent:
- clear identity
- clear SOP
- clear trigger
- clear reports
- clear escalation
- clear baseline for drift detection
