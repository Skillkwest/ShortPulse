# Handoff: Beeper Non-Security Retention Diet

Owner: Beeper

## Problem

Beeper's retained artifact area is useful but heavy. It has a large training stack, many dated production reports, and long memory/history surfaces. The security-sensitive raw-evidence cleanup belongs to Dave, but Beeper still owns the non-security retention shape: keeping future Beeper runs reloadable without forcing agents through raw packet archaeology or oversized training history by default.

## Evidence

- Active Beeper contract files:
  - `docs/agents/beeper/README.md`
  - `docs/agents/beeper/memory.md`
  - `docs/agents/beeper/standard-operating-procedure.md`
- Retained Beeper artifact area has about 45 tracked files under `docs/records/artifacts/agent/beeper/`.
- `docs/records/artifacts/agent/beeper/training-history.md` is around 45 KB.
- Many dated reports live under `docs/records/artifacts/agent/beeper/reports/`.
- The current report set is useful, but future agents need a clear active/archive/default-load distinction.

## Do Not Do

- Do not work security cleanup, session revocation, secret scanning, storage-state files, or signed URL exposure. Route those to Dave the Security Guy.
- Do not delete useful product findings without replacing them with a compact manifest or index.

## Requested Cleanup

1. Define Beeper's default-load packet:
   - contract
   - memory
   - SOP
   - compact current findings or next-run queue
   - open retest debt
2. Mark older dated reports as archive/reference-only unless they are active retest evidence.
3. Compress repeated training-history lessons into durable rules in memory/SOP, then leave detailed chronology out of default load.
4. Ensure every retained report either:
   - supports an open retest/debt item,
   - records a durable product finding,
   - or is clearly archive-only.
5. Produce a short closeout report listing what remains default-load versus archive-only.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm no Beeper docs instruct future runs to load raw evidence or full historical reports by default.
