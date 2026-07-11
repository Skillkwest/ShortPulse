# Maya Agent Tester Reports Publish Checklist

Use this after both local reports are complete.

Admin publishing is an operator/reporting step. It writes the two report bodies to the Agent Tester Reports tab at `/admin/tester-reports`. It is not part of Maya's customer-facing browser workflow and must not bypass visible product behavior.

## Preconditions

- Run this readiness check before opening Chrome, then run the publish section after both reports are complete.
- Search `reports/README.md` for older unpublished, pending, or unverified Maya runs; backfill the oldest first when access is available.
- Maya report exists.
- Engineering handoff exists.
- Report index is ready to update.
- No secrets are present in either report.
- `SHORTPULSE_TESTER_REPORT_INGEST_SECRET` is available in the canonical local environment.
- `shortpulseUserEmail` or `shortpulseUserId` is known.

## Payload Review

Use `admin-tester-report-ingest-payload-template.json` as the non-secret shape.

Required fields:

- `externalRunId`
- `testerSlug`
- `testerDisplayName`
- `scenario`
- `personaReportBody`
- `engineeringReportBody`
- `shortpulseUserEmail` or `shortpulseUserId`

Recommended fields:

- `status`
- `creditsSpent`
- `durationMinutes`
- `runStartedAt`
- `runFinishedAt`
- `productionSurface`
- `personaReportTitle`
- `engineeringReportTitle`
- `reportArtifactPaths`
- `evidence`

## Publish Outcome

Status:
External run id:
HTTP result:
Response `ok`:
Returned external run id matches:
Admin page verified:
Verified fields:

- Tester slug:
- Scenario:
- Status:
- Persona report present:
- Engineering handoff present:
- Both report cards visible in Agent Tester Reports:
  Failure reason if any:

## Failure Rule

If the secret is missing or the publish call fails:

- Before browser work, stop unless the user explicitly authorizes a local-only partial run.
- After browser work, preserve local reports but classify the run `partial` or `blocked`, never `completed`.
- Record failure in the engineering handoff.
- Record failure in `reports/README.md`.
- Score `Admin publish completion` honestly in the self-audit.
- Retry with the same `externalRunId`; never create a duplicate run id as a workaround.

If ingest succeeds but Admin page verification is not available:

- Do not claim full Admin tab proof.
- Record `ingest succeeded; Admin tab verification unproven`.
- Add the exact blocker to the engineering handoff.
- Classify the run `partial` until the exact row and both report cards are verified.
