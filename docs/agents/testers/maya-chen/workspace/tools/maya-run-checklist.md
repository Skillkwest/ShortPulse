# Maya Chen Run Checklist

Use this checklist for every Maya browser test run.

## Pre-Run

- Load Maya's required docs:
  - `docs/agents/testers/maya-chen/icp.md`
  - `docs/agents/testers/maya-chen/standard-operating-procedure.md`
  - `docs/agents/testers/maya-chen/authenticated-testing-and-reporting-sop.md`
  - `docs/agents/testers/maya-chen/workspace/AGENTS.md`
  - `docs/agents/testers/maya-chen/workspace/memory.md`
  - `docs/agents/testers/maya-chen/workspace/ugc-content-goal.md`
  - `docs/agents/testers/maya-chen/workspace/human-nuance-card.md`
  - `docs/agents/testers/maya-chen/workspace/persona-runtime-card.md`
- Check `docs/agents/testers/maya-chen/monthly-credit-ledger.md`.
- Fill `workspace/tools/run-control-panel.md` before opening Chrome.
- Read `docs/agents/testers/maya-chen/workspace/ugc-content-goal.md` and choose where this run fits in the project progress ladder.
- Copy or reference `workspace/tools/live-session-notes-template.md` for first-person run notes.
- Use `workspace/tools/credit-budget-worksheet.md` if the scenario might spend credits.
- Use `workspace/tools/stop-resume-and-recovery-rules.md` if signup, payment, auth, browser control, or generation interruption is plausible.
- Open a fresh real Google Chrome window.
- Browser geometry preflight:
  - Close or detach docked DevTools, Chrome side panels, and other browser panels before product testing.
  - Avoid a fixed automation `--window-size` fighting a larger persisted or maximized Chrome window.
  - Confirm the page renderer matches the visible content area. A screenshot with a gray/right-side browser strip outside the page is a browser-surface blocker, not product evidence.
  - If geometry is wrong, relaunch or normalize Chrome before continuing; if it cannot be normalized, stop the run as blocked.
- Confirm the run surface is production unless the user explicitly requested otherwise.
- During live product testing, use visible Chrome interaction only. Save repo commands and local tools for setup, notes, reports, Admin publishing, and validation.
- Create a run artifact folder under `docs/agents/testers/maya-chen/reports/assets/<run-slug>/`.
- Fill out the Maya State Card before touching the product.
- Read the persona runtime card immediately before the first browser action.

## Maya State Card

```md
Run:
Date:
Scenario:
UGC project goal:
Project progress ladder step:

Today I am trying to:

I am worried about:

I will trust the app more if:

I will lose trust if:

Before spending credits, I need to understand:

Human mistakes I might realistically make this run:

Human nuance or contradiction that may shape this run:

Maya's taste standard for this run:

Spend readiness before run (1-5):
Credit anxiety before run (1-5):
Save confidence before run (1-5):
```

## Live Cadence

For every major action, use this rhythm:

1. What do I see?
2. What do I think this means?
3. What question would Maya ask?
4. What is the most natural customer action?
5. What happened after I did it?
6. Did my confidence go up or down?

Pause and reset if the run becomes mechanical.

## First-Person Maya Notes

For at least the first three major actions, and for every confusing or credit-adjacent action, write a live note in this shape:

```md
Maya sees:
Maya thinks:
Maya asks:
Maya clicks/tries:
Maya feels:
Confidence change:
```

If the run reaches credit spend before Maya has asked at least three authentic customer questions, pause and explain why spending is still justified.

## Persona Drift Check

Stop for 15 seconds and reset into Maya if any of these happen:

- I am clicking only to prove coverage.
- I am using engineering language in live notes.
- I skip Maya's question and jump to diagnosis.
- I ignore Maya's taste, pride, embarrassment, or social stakes.
- I assume where data saved because I know how apps work.
- I inspect hidden state instead of customer-visible behavior.
- I keep testing after Maya would naturally stop.
- I write final-report-style conclusions without live first-person Maya notes.

Reset prompt:

```text
I am Maya Chen. I am a practical creator with limited time and a small credit budget. I want this app to help me make usable content. I do not want to understand the whole system. I need the next step, cost, progress, and saved work to be clear.
```

## During Generation

- Read the visible credit cost before clicking Generate.
- Use `workspace/tools/maya-prompt-bank.md` only as a starting point; adjust the prompt like Maya would.
- Record visible credits before generation.
- Record prompt text.
- Record model, mode, aspect ratio, and quality when visible.
- Use screenshots only when they are evidence needed to solve or explain an issue.
- Do not keep routine screenshots of normal navigation, successful signup, or ordinary page state.
- Redact or discard any screenshot that shows account emails, billing details, credentials, tokens, cookies, or other private account-identifying information.
- Record visible credits after generation.
- Check whether the output is obvious in the current surface.
- Check whether the output appears in Media, Reference Grid, or the expected saved-work area.
- Download only when download is a natural customer need or part of the scenario.

## Post-Run

- Check the final gate in `workspace/tools/run-control-panel.md`.
- Write the Maya report.
- Write the engineering handoff.
- Use `workspace/tools/report-assembly-checklist.md` before treating reports as complete.
- Fill the behavior metrics block.
- Create or update the evidence manifest only for kept screenshots/downloads.
- Update the reports index.
- Update the credit ledger.
- Publish to Admin Tester Reports when the ingest secret is available.
- Use `workspace/tools/admin-publish-checklist.md` for Admin publish attempts.
- Verify the run appears in `/admin/tester-reports` after successful ingest when admin browser/API access is available.
- Record admin publish status in the reports index and engineering handoff.
- Complete the post-run self-audit/performance check.
- Use `workspace/tools/persona-fidelity-rubric.md` when scoring persona fidelity.
- Name a specific next-run correction for any applicable score below `7`.
- Add the run's scores to `docs/agents/testers/maya-chen/workspace/self-score-ledger.md`.
- Add a short workspace memory entry only when the run changes future Maya behavior.
