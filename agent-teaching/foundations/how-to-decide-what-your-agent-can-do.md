# How To Decide What Your Agent Can Do

Purpose: decide whether a workflow is ready to become an agent before you spend time training one.

## Core Rule

Only automate SOPs.

If the task does not have a clear workflow, a clear trigger, and a clear done state, it is not ready for an agent yet.

## Required Task Definition

Before creating an agent, define all three:

- Trigger: what starts the work
- Steps: what the agent must do in order
- Outcome: what done looks like

If any of these are vague, keep refining the workflow manually first.

## Run It Manually First

Run the workflow yourself before training the agent.

That manual run should answer:
- what inputs the workflow actually needs
- what tools are required
- what evidence proves success
- where the confusing or brittle parts are

If you cannot run it manually in a repeatable way, the agent will not run it reliably either.

## Use The Hiring Filter

Ask:

```text
Would I hire someone to do this exactly as written?
```

If the answer is no, the workflow is still underdefined.

Common reasons the answer is no:
- steps are missing
- quality bar is subjective
- the task changes shape every time
- the task mixes strategy work and execution work with no boundary

## No SOP, No Agent

This is the final rule:

```text
No SOP = no agent
```

You can start training before the SOP is fully polished, but you still need a real workflow you are trying to capture and refine.

## Good Candidate Signals

An agent is a good fit when:
- the task repeats
- the inputs are inspectable
- the done state can be checked
- mistakes can be caught in review
- the workflow can be improved run by run

## Bad Candidate Signals

Do not start with an agent when:
- the task is mostly undefined exploration
- the task changes meaning every run
- the work has hidden approval rules
- the work requires constant unstructured judgment with no review rubric
- failure is expensive and there is no safe dry-run mode
