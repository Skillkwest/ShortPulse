# SOP: Account Health Snapshot

Purpose: run a consistent read-only health check for one account and interpret the result without improvising ad hoc Supabase queries.

## Scope
- Single-account generation / queue / reservation / ledger snapshot checks.
- Drainage visibility through the existing admin health read model.
- Schema/compatibility warnings surfaced by the shared diagnostics path.
- Human-readable or JSON operator output.

## Source Of Truth
- Snapshot loader: `frontend/lib/server/adminUserHealth/snapshot.ts`
- Admin route: `frontend/pages/api/admin/user-health.ts`
- Operator CLI: `scripts/account_health_snapshot.ts`
- Shared report builder: `frontend/lib/server/adminUserHealth/deepReport.ts`

## Prerequisites
- Local repo env loaded, or explicit `--env-file` path provided.
- Supabase service-role access in the environment:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Lookup target:
  - `--lookup <email-or-user-id>` or `--account <email-or-user-id>`

## Command
```bash
npx tsx scripts/account_health_snapshot.ts --lookup kirkartman00@gmail.com
```

Helpful variants:
```bash
npx tsx scripts/account_health_snapshot.ts --lookup kirkartman00@gmail.com --json
npx tsx scripts/account_health_snapshot.ts --lookup <user-id> --lookup-mode user_id --strict
npm -C frontend run account-health:snapshot -- --lookup kirkartman00@gmail.com
```

## Output Interpretation
- `credits.availableCents`, `reservedCents`, `spendableCents`: current balance posture.
- `generations.*`: total generation volume and fail rates across the lookback window.
- `reservations.*`: active hold posture and provider-attached hold age counts.
- `queue.*`: queue backlog and exhausted-row visibility.
- `drainage.costWithoutSuccessfulGeneration`: debit volume linked to non-success or missing-linkage outcomes.
- `compatibility.warnings`: schema drift / partial-read signal.
- `findings[]`: operator-facing findings from the shared policy.
- `nextSteps[]`: deduplicated recommended actions from the shared policy.

## Strict Verification
- Use `--strict` after any cleanup or reconciliation step.
- `--strict` fails the command if:
  - a critical finding is present, or
  - compatibility warnings are present.
- This is intentionally conservative and is meant for verification, not routine monitoring.

## Workflow
1. Run the snapshot command for the target account.
2. Review the human summary, or capture `--json` for later comparison.
3. If the report shows only healthy baseline signals, stop.
4. If the report shows critical findings, use the existing admin health / generation-trace surfaces to investigate before mutating anything.
5. Re-run the snapshot after any manual cleanup to verify the end state.

## Error Handling
- `User not found.` means the lookup target did not resolve through Supabase Auth.
- Schema/compatibility warnings mean the snapshot is partially degraded, not authoritative enough for cleanup decisions.
- Route or auth failures should be treated as environment problems, not as account health signals.

## Maintenance
- Keep the snapshot script and this SOP in sync whenever the report shape changes.
- If the report gains new stable fields, document them here before operator rollout.
- Prefer expanding the shared loader in `frontend/lib/server/adminUserHealth/snapshot.ts` instead of creating a second query path.
