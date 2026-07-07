# Hybervees Training History

Purpose: preserve supervised training notes, prompt changes, SOP improvements, tool changes, remaining friction, and next training focus for Hybervees.

## Training Log

### 2026-07-06 - Initial Setup

Prompt used:

> Initialize Hybervees as the tester-insights agent. Create the workspace folder with instructions, memories, training history, SOPs, and related docs. Hybervees' duty is to read Admin Tester Reports and synthesize app insights, product improvements, tester thoughts, feelings, and decision-grade analysis.

Behavior learned:

- Hybervees is a second-order analysis agent, not a tester persona.
- The primary input source is Admin Tester Reports, backed by `tester_report_runs`.
- The output is product insight and decision support, not automatic implementation.
- Hybervees must understand the app through current docs, report content, and targeted source inspection before making recommendations.

SOP or template updates:

- Created Hybervees contract, scoped instructions, memory, SOP, workspace, retained artifact index, insight ledger, product-decision log, and first report template.

Tool changes:

- No custom scripts yet.
- First real run should reveal whether Hybervees needs a helper for exporting or normalizing Admin Tester Reports.

Remaining friction:

- Hybervees has not yet reviewed a real report batch.
- Live admin access and report-fetch method will need to be confirmed per run.
- The report scoring rubric may need tightening after the first supervised insight review.

Next training focus:

- Run the first Hybervees review against recent Admin Tester Reports.
- Compare persona-report signal against engineering-handoff signal.
- Update the insight ledger only for reusable product patterns.

### 2026-07-06 - Gottspan Onboarding Verification

Prompt used:

> onboard hybervees

Behavior reinforced:

- Hybervees must start from the root repo contract plus its local contract, scoped instructions, SOP, memory, and ownership manifest.
- Hybervees is a bounded AI authority surface for second-order tester insight, not a tester persona, debugger, implementation owner, or evidence of a larger human team.
- Hybervees inherits the solo-owner model, pre-launch `production` branch rule, `shortpulse.allowedBranch=production`, production URL validation expectations, desktop-first scope, communication economy, canonical-path/no-workaround policy, and launch-trust standard.
- Retained artifacts support report history, pattern comparison, product-decision context, and training continuity; they are not default runtime authority.

Remaining friction:

- Hybervees has not yet completed a real Admin Tester Reports review, so its first production-quality insight report remains the next training proof.

### 2026-07-06 - SOP Step 1: Admin Report Reading And Analysis

Prompt used:

> You don't need to confirm it. You need to see it, then read it, then analyze it, then infer insights and provide suggestions on how we can improve the app based on the tester data.

Behavior learned:

- Hybervees' first task is not a visibility confirmation.
- Hybervees must open `Agent Tester Reports`, read actual persona and engineering report bodies, analyze tester data, infer product insights, and suggest app improvements.
- A blocked admin route is only an access blocker; when reports are available, the work continues into synthesis.

SOP or template updates:

- Reframed the first capability gate from visibility to report reading and analysis.
- Updated `docs/agents/hybervees/workspace/admin-tester-reports-access-checklist.md`.
- Updated Hybervees memory and ownership manifest.

Tool changes:

- No custom tooling yet.
- Future training may add a report export helper if browser/API review becomes repetitive.

Remaining friction:

- Hybervees has not yet completed a live admin-panel report-reading run in this thread.
- Admin credentials/session availability must be established during the first live run.

Next training focus:

- Open `https://www.shortpulse.ai/admin/tester-reports` in an authorized admin session.
- Read the available recent tester report rows.
- Produce a first Hybervees product-insight report with improvement suggestions.

### 2026-07-06 - First Live Admin Attempt Blocked By Login

Prompt used:

> You need to see it, then read it, then analyze it, then infer insights and provide suggestions on how we can improve the app based on the tester data.

Behavior learned:

- Hybervees should attempt the live production admin panel first when the user asks for Admin Tester Reports.
- A redirect to `/log-in?next=%2Fadmin%2Ftester-reports` means the browser session is not authorized for report reading.
- Hybervees must not invent insights when no report content was read.

SOP or template updates:

- Preserved access-status evidence in `docs/records/artifacts/agent/hybervees/reports/2026-07-06-admin-tester-reports-access-status.md`.

Tool changes:

- Browser inspection can identify the auth blocker without exposing credentials.

Remaining friction:

- Hybervees still needs an authenticated admin browser session before it can read and analyze live Admin Tester Reports.

Next training focus:

- User signs in as admin in the in-app browser.
- Hybervees opens Agent Tester Reports, reads report bodies, and produces the first product-insight analysis.

### 2026-07-06 - Source-First Report Access Correction

Prompt used:

> It doesn't make sense that you need to use the browser. You should be able to access the admin page in code.

Behavior learned:

- Hybervees should not treat the browser as the primary report-access gate.
- Report analysis should use the strongest canonical source available: local tester artifacts, authenticated admin API data, or an admin-authorized data path.
- The browser is useful for deployed UI proof, manual review-state confirmation, and visual admin-page behavior, but it is not required when report bodies are available through code/data sources.
- Local tester artifacts are not a lesser source when they are the durable report output created by tester agents.

SOP or template updates:

- Updated Hybervees SOP source hierarchy to prefer local artifacts and authenticated/admin-authorized data paths before browser UI.
- Updated the Admin Tester Reports access checklist to remove browser-first wording.
- Updated Hybervees README and ownership manifest to separate report analysis from live UI proof.

Tool changes:

- Future work should consider a small report-fetch/normalization helper if authenticated admin API or Supabase access becomes repetitive.

Remaining friction:

- Marking a deployed admin row reviewed still requires a safe authenticated admin API/data path or manual admin-page action.
- Hybervees must avoid extracting or exposing browser tokens just to bypass normal admin access boundaries.

Next training focus:

- Continue reviewing tester reports from local artifacts first.
- Add an admin-authorized report-fetch helper only if the user wants Hybervees to pull directly from production data outside the browser.

### 2026-07-06 - Completed SOP Loop

Prompt used:

> This completes your SOP. Look for earliest agent tester report in admin, analyze it, write full detailed report on the insight you gleaned, write summary for me, save them in your workspace.

Behavior learned:

- The default Hybervees review loop is now settled.
- When no specific report is named, Hybervees should start with the earliest agent tester report from the canonical source.
- Hybervees should produce two outputs every time: a full detailed insight report and a short owner summary.
- Both outputs should be saved in Hybervees' workspace.
- Marking the admin row reviewed is part of the loop only when a safe authenticated admin API/data path or admin UI action is available.

SOP or template updates:

- Added `Completed Standard Loop` to `docs/agents/hybervees/standard-operating-procedure.md`.

Next training focus:

- Repeat this loop for the next earliest unreviewed tester report.

### 2026-07-06 - Backlog Promotion Added To SOP

Prompt used:

> From the report you need to choose the highest ROI items that would make a real positive impact for this app based on customer psychology and real runtime improvements, pick the items and add them smartly to the backlog.

Behavior learned:

- Hybervees does not stop at report writing when the findings contain clear product value.
- Hybervees should select only the highest-ROI findings for backlog promotion.
- Backlog promotion should balance customer psychology with concrete runtime/product improvements.
- Hybervees should inspect the existing backlog first, avoid duplicates, and place new items under the correct program.

SOP or template updates:

- Added backlog-promotion step to the completed standard loop.
- Added `Step 11. Add Highest-ROI Backlog Items` to the Hybervees SOP.

Next training focus:

- Keep backlog additions sparse and decision-grade. Do not turn every tester observation into a backlog item.

### 2026-07-06 - Superseded Surface Correction

Prompt used:

> My generation has already been dealt with actually.

Behavior learned:

- Tester reports can contain valid historical evidence that is no longer active product work.
- Hybervees must reconcile backlog promotion against owner corrections and current backlog/source posture.
- If a surface has already been handled, retired, or superseded, Hybervees should not reopen it from old tester evidence.
- The remaining highest-ROI work should be narrowed to still-live customer psychology and runtime issues.

SOP or template updates:

- Updated backlog-promotion SOP rules to respect owner corrections and avoid reopening retired/superseded surfaces.

Outcome:

- Removed `My Generations` from the active Hybervees backlog item and narrowed the item to the current Reference Grid / Media Library saved-work path.
- Updated Hybervees reports, owner summary, insight ledger, and product-decision log to treat `My Generations` as historical/superseded for this signal.

### 2026-07-06 - Admin Reviewed Marker Is Duplicate-Prevention

Prompt used:

> You also mark reports you have already viewed so you don't analyze them again. These get marked correctly in the admin page.

Behavior learned:

- Hybervees must use the admin `Hybervees reviewed` marker to avoid duplicate analysis.
- Earliest-report runs should choose the earliest unreviewed report, not simply the earliest historical report.
- After reading, analyzing, writing the detailed report, writing the owner summary, saving both in the workspace, and promoting any high-ROI backlog items, Hybervees must mark the source report reviewed when an authenticated admin review path is available.
- If the review marker cannot be written, Hybervees must say so clearly and not claim the admin page was updated.

SOP or template updates:

- Updated the completed standard loop, report-source step, admin review-state step, access checklist, and memory with duplicate-prevention behavior.

### 2026-07-07 - First `run sop` Admin-Authorized Review

Prompt used:

> run sop

Behavior learned:

- `run sop` successfully triggers the completed Hybervees review loop.
- The production Supabase admin-authorized data path can identify the earliest unreviewed Admin Tester Reports row without browser login.
- Local tester artifacts remain the right full-body report source when the production row points to retained report paths.
- Backlog promotion should account for current repo/source truth: if workflow reload and generated prompt metadata already exist, the recommendation should target discoverability and production validation rather than rebuilding prompt storage.

Outcome:

- Reviewed `2026-07-05-find-generated-image-context`.
- Saved a detailed insight report and ADHD-friendly owner summary.
- Added one high-ROI backlog item for generated-media context recovery.
- Marked the production tester report row `Hybervees reviewed` through Hybervees-owned review metadata.
