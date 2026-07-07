# Admin Tester Reports Review Checklist

Purpose: first-run checklist for Hybervees to access tester reports through canonical data/artifact paths, read actual report content, analyze tester data, infer product insights, and suggest app improvements.

## Review Steps

1. Load Hybervees startup docs and Admin Tester Reports SOP.
2. Confirm the task authorizes report inspection.
3. Select the strongest available canonical source:
   - local tester artifacts under `docs/agents/testers/<tester>/reports/`,
   - authenticated `/api/admin/tester-reports`,
   - an admin-authorized data path,
   - or `https://www.shortpulse.ai/admin/tester-reports` when UI proof is needed.
4. Identify the available report set:
   - requested run is found,
   - earliest or latest run is found,
   - earliest unreviewed run is found,
   - rows are visible in admin UI,
   - empty state is visible,
   - loading/error state is visible,
   - or access is blocked.
5. Open each requested run, or the earliest/highest-value run when no set is specified.
6. Skip reports already marked `Hybervees reviewed` unless the user explicitly asks for a re-review.
7. For every reviewed run, read both report bodies:
   - `Persona report`
   - `Engineering handoff`
8. Extract tester data:
   - what the tester tried,
   - what confused them,
   - what felt trustworthy,
   - what reduced trust,
   - what felt valuable,
   - what felt like waste,
   - what broke or blocked the task,
   - what engineering evidence was supplied.
9. Infer product insights:
   - likely user mental model,
   - recurring friction,
   - abandonment risk,
   - support burden,
   - product-value gap,
   - owner lane for follow-up.
10. Suggest app improvements:

- user-facing UX/copy/workflow changes,
- technical follow-up candidates,
- tester retests,
- issues to watch instead of changing now.

11. Record the evidence boundary in the run notes:

- local tester artifact,
- authenticated admin API,
- admin-authorized data path,
- live admin browser,
- or blocked.

## Stop Conditions

Stop before insight analysis only when:

- all canonical report sources require credentials that are not available,
- local artifacts do not exist and authenticated/admin-authorized data access is unavailable,
- opening a report would expose private data the user did not authorize Hybervees to review.

## Done State

This capability step is done when Hybervees has:

- opened the Agent Tester Reports source or documented the access blocker,
- read the available persona and engineering report bodies,
- summarized tester data,
- inferred product insights,
- suggested app improvements,
- marked successfully analyzed reports as `Hybervees reviewed` when an authenticated admin review path is available,
- separated evidence from inference,
- and named what blocks fuller report review, if anything.
