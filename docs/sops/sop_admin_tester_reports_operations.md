# Admin Tester Reports Operations

## Purpose

`/admin/tester-reports` is the operator log for automated tester-agent runs. It is separate from `/admin/reports`, which remains the signed-in customer issue-report queue.

Each tester run stores two report bodies:

- Persona report: written in the voice of the tester persona/account.
- Engineering handoff: written as a technical follow-up packet for Codex or another bounded agent lane.

## Source Of Truth

- Table: `public.tester_report_runs`
- Migration: `sql/migrations/193_add_tester_report_runs.sql`
- Ingest route: `frontend/pages/api/internal/tester-reports/ingest.ts`
- Admin read route: `frontend/pages/api/admin/tester-reports.ts`
- Admin page: `frontend/pages/admin/tester-reports.tsx`

## Ingest Contract

Tester automation posts JSON to `POST /api/internal/tester-reports/ingest` with either:

- `Authorization: Bearer $SHORTPULSE_TESTER_REPORT_INGEST_SECRET`
- `x-shortpulse-tester-report-secret: $SHORTPULSE_TESTER_REPORT_INGEST_SECRET`

Required fields:

- `externalRunId`
- `testerSlug`
- `testerDisplayName`
- `scenario`
- `personaReportBody`
- `engineeringReportBody`
- at least one of `shortpulseUserId` or `shortpulseUserEmail`

Optional fields include `status`, run timing, `creditsSpent`, `productionSurface`, report titles, `reportArtifactPaths`, and structured `evidence`.

`externalRunId` is the idempotency boundary. Reposting the same run id updates the existing row rather than creating a duplicate.

## Admin Review Flow

1. Open `/admin/tester-reports`.
2. Start from the default `Needs Hybervees` review queue. This view lists unreviewed tester runs oldest first so Hybervees can process the earliest report before newer ones.
3. Filter by status, tester slug, or search text when narrowing the queue.
4. Use the `Hybervees review` filter to switch to `Hybervees reviewed` or `All review states` when auditing history.
5. Click a run row to reveal run metadata and the two report cards.
6. Expand `Persona report` or `Engineering handoff` to read the body.
7. Treat the engineering handoff as an input packet for a separate scoped implementation or audit lane.
8. After Hybervees has read and analyzed the local tester report or admin report content, mark the row `Hybervees reviewed` in `/admin/tester-reports` so the admin page reflects insight-review progress separately from the tester-run status.

## Security Boundary

`tester_report_runs` is RLS-enabled and service-role-only. Browser access must stay behind `/api/admin/tester-reports` with `requireAdminUser`, and review-status mutations must stay behind `/api/admin/tester-reports-review` with `requireAdminUser`. Tester automation must use the internal ingest secret route. Do not expose tester reports through customer-facing report surfaces, public routes, or direct Supabase client reads.

## Validation

Targeted checks for this surface:

```bash
cd frontend
npm run test -- --run tests/api/admin-tester-reports.test.ts tests/api/internal-tester-reports-ingest.test.ts features/admin/components/__tests__/AdminTesterReportsPanel.test.tsx features/admin/logic/__tests__/useAdminTesterReportsController.test.tsx tests/pages/admin.tester-reports.test.tsx features/admin/components/__tests__/AdminPageHeader.test.tsx
```
