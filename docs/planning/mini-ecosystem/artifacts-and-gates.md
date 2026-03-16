# Artifacts And Gates

Purpose: define minimum artifacts and quality gates required for reliable delivery in a real engineering environment.

## Minimum artifact set per feature
1. Ticket with acceptance criteria and scope boundaries.
2. PR description with change summary, risk notes, and test evidence.
3. CI evidence (required checks passing on final commit).
4. Staging verification notes (core path + edge cases).
5. Release notes and rollout plan (including rollback trigger).
6. Post-release observation notes and follow-up actions.

## Gate checklist by stage

### Gate A: Ready for implementation
Pass conditions:
- Backlog item is prioritized.
- Acceptance criteria are specific and testable.
- Dependencies are identified.

### Gate B: Ready for review
Pass conditions:
- Implementation complete for scoped requirements.
- PR includes context, screenshots/logs where relevant, and known tradeoffs.
- Local validation completed.

### Gate C: Ready to merge
Pass conditions:
- Required reviewers approved.
- Required CI checks passed.
- No unresolved blocker comments.

### Gate D: Ready for production rollout
Pass conditions:
- Staging QA passed.
- Rollout strategy chosen (flag/canary/ring).
- Rollback path documented.

### Gate E: Release complete
Pass conditions:
- Observability signals are healthy after rollout window.
- Incidents (if any) are resolved or actively owned.
- Follow-up backlog items are created for remaining gaps.

## Maturity levels (quick self-assessment)
- Level 1 (Ad hoc): process exists mostly in people’s heads.
- Level 2 (Documented): stages and ownership are written, inconsistently enforced.
- Level 3 (Enforced): merge/release gates are required and auditable.
- Level 4 (Measured): DORA and reliability metrics influence planning.
- Level 5 (Optimized): continuous improvement loop is routine and data-driven.

## Suggested next promotions for ShortPulse
1. Promote Gate D and Gate E into an SOP under `docs/sops/` once validated across several releases.
2. Add explicit evidence links in PR template (CI run, staging notes, rollout decision).
3. Define target release observation window by change risk (for example 30-120 minutes).

## External source references
- GitHub Flow: https://docs.github.com/en/get-started/using-github/github-flow
- Pull requests: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests
- Pull request reviews: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews
- Protected branches and required checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Deployment environments and review gates: https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments
- Review deployments: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments
- Google code review standard: https://google.github.io/eng-practices/review/reviewer/standard.html
- Acceptance criteria primer: https://www.atlassian.com/work-management/project-management/acceptance-criteria
- Azure staging slots reference: https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots
- LaunchDarkly release controls: https://launchdarkly.com/docs/home/flags/release
- SRE monitoring workbook: https://sre.google/workbook/monitoring/
- SRE incident management guide: https://sre.google/resources/practices-and-processes/incident-management-guide/
- DORA metrics guide: https://dora.dev/guides/dora-metrics/
