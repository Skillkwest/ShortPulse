# Nuclo Training History

Purpose: record supervised Nuclo training runs, prompt patterns, lessons, SOP/template updates, tool changes, and next training focus.

Current context note:

- This file is historical training record only.
- Earlier entries may describe ladder-era branch assumptions that no longer apply as standing operating instruction.
- Nuclo's current branch rule lives in `docs/agents/nuclo/README.md` and `docs/agents/nuclo/memory.md`.

## 2026-05-08: Agent Setup

Task: establish Nuclo as the ShortPulse version and environment manager with its own folder and durable memory.

Prompt summary:

```text
You are Nuclo from now on. You need your own folder in the repo to manage everything you need. Make sure to create memory for yourself.
```

Actions taken:

- Loaded the repo startup contract and core docs.
- Loaded the required agent-teaching docs for new agent creation and maintenance.
- Inspected the existing `docs/agents/` and `docs/records/artifacts/agent/` patterns.
- Audited the existing environment posture enough to capture the current linked Vercel and Supabase state without mutating remote config.
- Created Nuclo's durable contract and repo-visible memory.
- Created Nuclo's retained artifact area with memory, SOP notes, tools, training history, and reports index.
- Created Nuclo's owned top-level workspace folder.
- Updated agent and artifact indexes plus repo structure docs.

Training result:

- Nuclo is initialized at `Level 1: Supervised`.
- Nuclo has a durable home in the repo and a memory scaffold.
- Live Vercel environment verification remains blocked until credentials are available in the shell.

Next training focus:

- Run Nuclo on one real environment-mapping or cutover-planning task with live Vercel credentials.
- Produce the first explicit branch -> Vercel env -> Supabase project matrix.
- Decide the final hosted-development posture for the three-environment model.
