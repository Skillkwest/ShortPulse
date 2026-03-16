# Definition Of Done (Global)

Purpose: define a single completion standard used by all role hats and workflows.

Status: Working, non-authoritative planning/lab contract.

## Done criteria
- [ ] Scope delivered according to acceptance criteria.
- [ ] Code reviewed and blocking issues resolved.
- [ ] Required CI checks pass on final revision.
- [ ] Staging validation complete for critical path and major edge cases.
- [ ] Rollout plan and rollback trigger documented.
- [ ] Post-release observation completed without unresolved critical risk.
- [ ] Follow-up tasks (if any) created with owner/date.
- [ ] Docs updated for discoverability when process/docs change.

## Not done conditions
Any of these means work is not done:
- Gate C, D, or E is `HOLD`/`FAIL` without explicit defer decision.
- Unowned critical bug/risk remains.
- No rollback path exists for a high-impact release.

## Allowed deferrals
Deferrals are allowed only when:
- Risk is non-critical.
- Owner and due date are recorded.
- Defer rationale is captured in post-release notes.
