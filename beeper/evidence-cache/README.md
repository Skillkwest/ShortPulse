# Beeper Local Evidence Cache

Purpose: hold raw screenshots, JSON packets, storage-state dumps, and other sensitive Beeper evidence locally without committing them to the repo.

## Rules

- This folder is intentionally ignored by git except for this `README.md` and the local `.gitignore`.
- Put raw Playwright screenshots, network captures, storage-state files, and other sensitive payloads here.
- Tracked repo artifacts should reference this cache only through redacted manifests and human-readable reports.
- If a raw artifact contains tokens, signed URLs, or identity-linked request traces, it must stay here or be deleted after synthesis.
