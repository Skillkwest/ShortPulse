# Building AI Employees

Purpose: mirror the final Notion teaching system inside the repo so agent onboarding, training, maintenance, and automation can be taught from one local folder.

This folder is the repo-side teaching copy of the completed Notion curriculum. When there is drift, the Notion workspace is the final source of truth and this folder should be updated to match it.

## Read First

- `foundations/how-to-decide-what-your-agent-can-do.md`

## Core Setup

- `setup/new-codex-project-setup.md`
- `setup/codex-app-settings.md`
- `setup/define-agent-identity.md`
- `prompts/agent-setup-prompt.md`
- `prompts/agent-contract.md`

## Training Loop

1. Start a new project.
2. Define the agent identity and guardrails.
3. Teach the agent with one real task.
4. Create or update the SOP from the successful run.
5. Run the post-run performance analysis interview.
6. Run the agent again with the trigger phrase.
7. Repeat the loop until the workflow is stable.
8. Freeze a baseline KPI.
9. Move the stable workflow into automation.

## Folder Map

- `foundations/`
  - durable principles that apply to any project or agent
- `setup/`
  - step-by-step environment, project, and identity setup
- `prompts/`
  - reusable teaching prompts and contract prompts
- `operations/`
  - repeatable training-loop, KPI, and automation guidance
- `assets/`
  - local screenshots and teaching visuals

## Working Rules

- Conversation is execution, not durable memory.
- Durable behavior belongs in SOPs, contracts, prompts, reports, and training history.
- Agent-specific contracts live under `docs/agents/<agent-name>/` when the agent needs durable local state.
- Agent-specific reports and training history live under `docs/records/artifacts/agent/<agent-name>/`.
- Training documents stay in `agent-teaching/`; agent runtime memory stays outside it.

## Step-By-Step Path

### 1. Decide whether the task deserves an agent

Read `foundations/how-to-decide-what-your-agent-can-do.md`.

Do not create an agent for a task that has no real SOP, no clear trigger, or no clear done state.

### 2. Start the project correctly

Read `setup/new-codex-project-setup.md`.

That doc covers:
- repo bootstrapping
- Codex app settings
- the initial project bootstrap prompt

### 3. Define the agent identity

Read `setup/define-agent-identity.md`.

That doc covers:
- identity
- authority
- guardrails
- artifact area
- training-history expectations

### 4. Use the setup prompts

Use:
- `prompts/agent-setup-prompt.md`
- `prompts/agent-contract.md`

Use the contract prompt only when SOPs already exist and you are formalizing an established workflow.

### 5. Teach the first real task

Use this training prompt:

```text
We are going to begin training you on your task. Make note of our starting state.

If you are unable to complete any of your tasks for these reasons:
<reason>
<reason>
<reason>
Don't keep working. Make a note in your training report and escalate for human review.

Talk through what you are doing at each step and interval so I have full transparency to monitor your performance.

Maintain a training-history.md record in your artifact area.
After each supervised run, append the prompt used, behavior learned, SOP or template updates, tool changes, remaining friction, and the next training focus.
```

Do not pollute the training thread with unrelated work. Start a new conversation for unrelated tasks.

### 6. Turn the successful run into an SOP

Use this prompt immediately after the workflow reaches the done state:

```text
Great. The step we just finished achieves our done state for this task. Go through our entire workflow and create (or update) an SOP for what we just did.
```

### 7. Run the post-run analysis

Read `operations/post-run-performance-analysis-interview.md`.

Use this prompt to launch the review:

```text
Run through the Post-run Performance Analysis Interview. Let's discuss.
```

Then use:

```text
Utilize all the details we have discussed and create everything you need. Update any relevant docs or artifacts. Make sure your SOPs reflect the correct changes we need to achieve 10/10 performance on this task. Audit and update your SOPs.
```

### 8. Run the loop again

Use the agent's trigger phrase:

```text
We are doing another training run. <your trigger phrase>.
```

Repeat the loop until the workflow is consistent. If the agent keeps failing after repeated supervised runs, split the workflow into multiple agents or restart with a new agent and preserve the failure report.

### 9. Freeze the KPI baseline

Read `operations/create-baseline-kpi.md`.

Use this prompt:

```text
Let's create a baseline KPI to monitor your performance overtime. We need a static and frozen measurement of how you are performing today and completing your tasks. Make sure this KPI document captures a good snapshot of you. The goal of this KPI doc is to have historical data to compare your performance over a long period of time.
```

### 10. Move to automation and maintenance

Read:
- `operations/agent-management.md`
- `foundations/agent-maintenance-field-guide.md`

Automation starts only after the manual loop is stable and the KPI is frozen.

## Troubleshooting

- `prompts/agentic-research-prompt-pattern.md`
- `foundations/agent-maintenance-field-guide.md`

If the agent never successfully completes the SOP after repeated supervised runs, start over with a new agent and preserve a detailed failure report.
