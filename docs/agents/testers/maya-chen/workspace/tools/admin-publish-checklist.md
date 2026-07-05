# Maya Agent Tester Reports Publish Checklist

Use this after both local reports are complete.

Admin publishing is an operator/reporting step. It writes the two report bodies to the Agent Tester Reports tab at `/admin/tester-reports`. It is not part of Maya's customer-facing browser workflow and must not bypass visible product behavior.

## Preconditions

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

- Do not block local reports.
- Record failure in the engineering handoff.
- Record failure in `reports/README.md`.
- Score `Admin publish completion` honestly in the self-audit.

If ingest succeeds but Admin page verification is not available:

- Do not claim full Admin tab proof.
- Record `ingest succeeded; Admin tab verification unproven`.
- Add the exact blocker to the engineering handoff.
