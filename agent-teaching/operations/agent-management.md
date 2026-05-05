# Agent Management

Purpose: move a trained agent from supervised training into stable operation, automation, and long-term maintenance.

## 1. Remove Training Modules From The Active Runtime

This does not mean delete the teaching system from the repo.

It means the mature agent should stop loading training-only scaffolding by default during normal execution.

Retire from the active runtime unless needed:
- early coaching prompts
- exploratory review prompts
- obsolete SOP drafts
- stale reports used only for training

Keep the durable outputs:
- current SOP
- current contract
- trigger phrase
- KPI baseline
- current artifact area

## 2. Start Running Automation

Automation comes after the manual workflow is stable.

Use this prompt when the workflow is ready:

```text
I want you to run this SOP every wednesday at 5pm. Do what ever you need to do to create that schedule. Create the proper documents for the automation correctly in the repo.
```

Before automating, make sure:
- the SOP is stable
- the trigger phrase is clear
- the baseline KPI exists
- approval boundaries are explicit
- failure and escalation conditions are documented

## 3. Maintain The Agent

Read:
- `../foundations/agent-maintenance-field-guide.md`

Maintenance means:
- watching for drift
- refreshing docs when the workflow changes
- splitting the agent if the scope becomes too wide
- comparing later runs against the baseline KPI

## Management Goal

Training is temporary.

The target state is a small, durable operating system for the agent:
- clear task
- clear boundaries
- clear SOP
- clear trigger
- clear reports
- clear automation rule
- clear maintenance process
