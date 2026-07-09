# Badearsai Workspace

Purpose: Badearsai-owned intake and scratch workspace for error-monitoring packets, classification drafts, and temporary analysis notes.

Use this folder for:

- copied triage packet manifests,
- scratch classification tables,
- non-sensitive parsed packet summaries,
- draft owner handoffs,
- temporary proof checklists,
- helper-script outputs.

Do not treat this folder as source of truth. Source of truth comes from current triage packets, current repo files, current production-safe proof, and authenticated Admin/Event Detail evidence when available.

Do not store secrets, API keys, cookies, raw env values, provider credentials, signed URLs, private customer content, payment data, or large raw packet archives here unless the user explicitly asks for a safe retained artifact.

## Layout

- `intake/`: safe copied-packet summaries and manifests.
- `scratch/`: temporary working notes that may be deleted or promoted later.
- `handoffs/`: draft owner handoffs for Bactuo, Gutan, Money Stuff, Datserok, Dave, Gear Ball, Nuclo, or other lanes.
- `watch-list.md`: lightweight working index of watched signatures and their reopen conditions.
