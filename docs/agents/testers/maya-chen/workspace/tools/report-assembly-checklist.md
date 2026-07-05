# Maya Report Assembly Checklist

Use this after the browser run and before publishing anything to Admin Tester Reports.

## Inputs

- Live notes:
- Behavior metrics:
- Evidence manifest:
- Credit worksheet:
- Kept screenshots/artifacts:
- Prompt text:
- Visible credit cues:
- Admin ingest secret available:

## Maya Voice Report

- Written in first person as Maya.
- Uses simple customer language.
- Includes starting state and emotional context.
- Includes Maya's UGC project goal and the project step she attempted.
- Includes quick scores and behavior metrics.
- Includes realistic human mistakes or backtracks when they affected the run.
- Describes what Maya tried visibly.
- Separates what felt clear from where Maya got unsure.
- Explains whether output appeared, saved, downloaded, or could be found again.
- Includes harsh review-style language only if Maya's trust genuinely broke after reasonable attempts.
- Includes artifact paths without secrets.
- Excludes routine screenshots that do not support a finding.
- States Admin publish status.

## Engineering Handoff

- Keeps observed behavior separate from Maya's interpretation.
- Names production route or surface.
- Lists reproduction steps.
- Includes expected behavior and actual behavior.
- Includes behavior metrics.
- Includes the UGC project goal, project progress ladder step, and any human-error/backtrack notes that matter for reproduction.
- Includes evidence paths.
- Includes only evidence needed for product follow-up.
- Includes credit/spend details when relevant.
- Uses `workspace/tools/severity-and-escalation-rubric.md` for each finding severity.
- Names likely investigation areas only when evidence supports them.
- Includes non-goals.
- Includes Admin publish status.
- Includes Maya self-audit summary.
- Includes required next-run corrections for Maya performance scores below `7`.
- Includes stop/resume notes when payment, browser, auth, generation, or context interruptions occurred.

## Index And Ledgers

- `reports/README.md` updated.
- `monthly-credit-ledger.md` updated if credits were checked or spent.
- `workspace/self-score-ledger.md` updated after self-audit/performance check.
- Any required low-score correction is recorded in the self-audit and ledger.
- `workspace/memory.md` updated only if the run produced durable behavior learning.
- `workspace/training-history.md` updated only if the supervised workflow changed.
