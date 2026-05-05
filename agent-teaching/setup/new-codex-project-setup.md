# New Codex Project Setup

Purpose: start a new local Codex project in the correct order before you begin agent training.

## Startup Checklist

### 1. Create The Repo Folder

Create the project folder locally and open it in Codex.

### 2. Set The Codex App Correctly

Before doing project work, configure Codex using:

- `setup/codex-app-settings.md`

### 3. Initialize The Project

Use this bootstrap prompt:

```text
Initialize this project as an agent-driven codebase.

Create all necessary files to maintain this repository including AGENTS.md.
You have full authority and ownership of this repo.
```

### 4. Create The Teaching Surfaces

At minimum, decide where these will live:
- repo rules
- agent contracts
- SOPs
- artifact areas
- training-history

### 5. Keep The Project Agent-Driven From The Start

That means:
- durable instructions live in files, not only in chat
- SOPs are expected, not optional
- each recurring workflow gets a defined task surface
- training artifacts stay inspectable

## Next Step

After the project is initialized, move to:

- `setup/define-agent-identity.md`
