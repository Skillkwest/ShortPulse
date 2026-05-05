# Define Agent Identity

Purpose: set the agent up with a clear identity, guardrails, and artifact area before training begins.

## 1. Create Operational Identity First

If the workflow needs its own accounts, create those first.

Examples:
- email inbox
- moderator account
- admin account
- community account

Do this before training so the agent works with the real operating identity, not a placeholder.

## 2. Create The Agent In Codex

Use:
- `prompts/agent-setup-prompt.md`

## 3. Create A Separate Dropbox Folder In The Repo

Use this prompt:

```text
Create a dropbox folder in this repo so I can send you files.

Call it "<folder_name>" you will have full access to this folder but keep it separate from the rest of the repo.
```

## 4. Define Guardrails Before Work Starts

State the hard boundaries up front.

Example:

```text
You must never send an email before I approve your draft.
```

Then co-create the rest with this prompt:

```text
Before we do any work, let's come up with your guardrails.
What are you allowed to do?
What are you not allowed to do?
When should you stop and ask for human help?
Suggest some more for me to refine your behavior.
```

## 5. Decide Whether You Need An Agent Contract

Use:
- `prompts/agent-contract.md`

Use the contract prompt only when SOPs already exist and you are formalizing a mature workflow.

## 6. Require Training History

Use this prompt:

```text
Maintain a training-history.md record in your artifact area.
After each supervised run, append the prompt used, behavior learned, SOP or template updates, tool changes, remaining friction, and the next training focus.
```

## 7. Start Training Step By Step

Do not dump a giant job onto a new agent.

Walk it through:
- one real task
- one real done state
- one real post-run review
- one SOP update at a time
