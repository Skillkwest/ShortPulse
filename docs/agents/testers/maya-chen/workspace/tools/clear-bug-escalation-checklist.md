# Maya Clear Bug Escalation Checklist

Purpose: help Maya stop softening objective product breakage into vague customer confusion. Use this during or after a run when the app is visibly broken.

## When To Invoke

Invoke `BUG OVERRIDE` when Maya sees:

- crash, freeze, blank surface, or visible error,
- stuck loading or generation after a reasonable wait,
- missing output after apparent spend or completion,
- credit, billing, plan, payment, or balance mismatch,
- saved work disappearing, saving to the wrong place, or showing wrong-account data,
- repeated customer-visible controls that do nothing,
- destructive action, deletion risk, or account mutation that happens unexpectedly,
- any workflow where Maya cannot proceed because behavior is broken rather than merely unclear.

Do not invoke this for ordinary confusion, preference, unclear copy, unfamiliar navigation, or Maya's incomplete mental model unless the visible behavior itself is broken.

For a reportedly missing panel, picker, popover, drawer, or rail, `BUG OVERRIDE` is prohibited until Chrome is re-maximized to full width, browser zoom is checked, the expected target region is confirmed inside the viewport, and the visible action is retried once. A clipped or off-screen target is invalid test evidence, though poor discoverability may still be recorded as UX friction.

## Required Sequence

1. Write one Maya customer note:
   - what she expected,
   - what happened,
   - how trust, spend readiness, support likelihood, or harsh-review risk changed.
2. Mark `BUG OVERRIDE` in the notes.
3. Stop treating the issue as only customer confusion.
4. Capture objective evidence.
5. Decide whether continuing is safe.

## Bug Packet Template

```md
## BUG OVERRIDE

- Run:
- Tester:
- Account:
- Route/surface:
- Browser:
- Timestamp:
- Scenario goal:
- Visible steps:
- Expected behavior:
- Actual behavior:
- Customer impact:
- Severity:
- Credit/account impact:
- Evidence kept:
- Reproducibility:
- Protected behavior:
- Validation boundary:
- Stop/resume condition:
- Suspected owner or investigation area:
```

Use `unknown` instead of guessing. Name suspected owner or investigation area only when evidence supports it.

## Stop Gates

Stop before continuing when the bug affects:

- credits or billing,
- payment or plan state,
- auth or account identity,
- saved work or generated output reliability,
- destructive controls,
- privacy or wrong-account data,
- repeated generation failures that could spend more credits.

If continuing is safe, explain why in the engineering handoff.

## Evidence Rules

- Keep screenshots only when they diagnose or prove the broken state.
- Prefer notes for private account details.
- Do not include credentials, cookies, tokens, full payment data, service-role keys, or ingest secrets.
- If credit spend might have happened, record visible balance before and after when possible.
- If output is missing, record every visible place Maya checked before calling it missing.

## Report Placement

- Maya report: include the customer impact, likely support message, and harsh-review risk.
- Engineering handoff: include the full bug packet, acceptance criteria, protected behavior, validation steps, and whether the run became partial, blocked, or failed.
- Admin Tester Reports: publish both report bodies when ingest is available and note the bug status in the engineering report.
