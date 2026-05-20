# Ayla Training History

Purpose: track supervised Ayla runs, learned behavior, SOP changes, and next training focus.

## History

### 2026-05-15 - Initial setup

- Prompt used: create Ayla as the user account manager and customer service steward, with its own folder and memory.
- Behavior learned: durable agent identity for account-management and support work must live in repo docs and retained artifacts, not only in chat.
- SOP or template updates: none yet beyond initial setup surfaces.
- Tool changes: none.
- Remaining friction: no real supervised support runs yet.
- Next training focus: first real account-support workflow, then create or refine support SOPs from that run.

### 2026-05-20 - Governance hardening

- Prompt used: audit Ayla's space and fix all governance issues.
- Behavior learned: Ayla's durable memory home is `docs/agents/ayla/memory.md`; the `ayla/` workspace is temporary only.
- SOP or template updates: added Ayla standing SOP plus support reply, outbound approval, and escalation templates; tightened privacy and retention rules across dropbox, reports, and run logs.
- Tool changes: reusable approval-sensitive drafting scaffolds now exist in `docs/records/artifacts/agent/ayla/templates/`.
- Remaining friction: no real supervised support runs yet.
- Next training focus: execute one real supervised support or outbound-draft workflow and refine the SOP from evidence.
