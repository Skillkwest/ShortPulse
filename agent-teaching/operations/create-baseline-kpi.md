# Create Baseline KPI

Purpose: freeze a historical performance baseline once an agent is consistently completing its task well.

## When To Create It

Create the baseline only after:
- the agent has completed real supervised runs
- the SOP is stable enough to repeat
- the post-run analysis is no longer exposing major workflow confusion

Do not create the KPI too early. It should capture a good version of the agent, not the first version.

## Launch Prompt

```text
Let's create a baseline KPI to monitor your performance overtime. We need a static and frozen measurement of how you are performing today and completing your tasks. Make sure this KPI document captures a good snapshot of you. The goal of this KPI doc is to have historical data to compare your performance over a long period of time.
```

## Freeze Rules

Once created:
- do not rewrite the baseline to make the agent look better later
- treat it as a historical snapshot
- append observations or create a new dated baseline if the workflow changes materially

## What The KPI Should Contain

At minimum:
- baseline date
- scope of workflow measured
- fixed KPI categories
- weights or scoring logic
- pass threshold
- degradation warning threshold
- critical failure conditions
- evidence anchors from representative runs
- a comparison template for future runs

## Good KPI Categories

Choose categories that measure real workflow performance, such as:
- SOP order fidelity
- evidence quality
- validation quality
- scope control
- communication clarity
- report quality
- residual risk handling
- tool discipline

Avoid vague categories like "felt smart" or "was helpful."

## Non-Negotiable Failure Conditions

A strong baseline should include failure conditions that override the score.

Examples:
- skipped review gate
- claimed success without evidence
- ignored approval rules
- leaked sensitive data
- touched unrelated files or systems without authorization

## Comparison Prompt

Use this prompt on later runs:

```text
Audit this document and rewrite it. Organize it correctly in repo.
```

Then compare the new run against the frozen baseline instead of rewriting baseline history.

## Practical Rule

The KPI baseline is not for training the first successful run.

It is for detecting drift after the workflow already works.
