# Dave Security Reports Index

Purpose: conditional-load index for Dave the Security Guy's sanitized retained security reports.

This index helps future Dave runs find relevant prior evidence without loading old reports by default. Reports remain non-authoritative retained artifacts; current repo code, SQL, canonical docs, and live provider/environment evidence outrank these notes.

## Load Policy

- Do not load this folder during ordinary Dave startup.
- Load this index when a current security lane may overlap prior Dave evidence.
- Open only the report that matches the current asset, trust boundary, or environment.
- Do not carry old route targets, hunches, or remediation plans forward unless current repo evidence re-proves them.

## Reports

| Report | Primary boundary | Use when |
| --- | --- | --- |
| `2026-05-23-prod-storage-state-exposure.md` | secret/session artifact exposure | Reviewing tracked credential/session evidence, storage-state files, or secret-scanner coverage. |
| `2026-05-23-security-remediation-prep.md` | initial security remediation planning | Checking historical prep context only; do not treat as current target authority. |
| `2026-05-30-generated-image-admitted-variant-security-review.md` | private media variants and service-role derivative helpers | Reviewing admitted generated-image derivatives, variant storage, or signed derivative URL scope. |
| `2026-06-01-account-isolation-billing-credit-audit.md` | account, billing, credit, storage entitlement RPCs | Reviewing user account isolation, Stripe/customer state, credits, or hosted storage entitlement grants. |
| `2026-06-02-media-storage-signed-url-isolation-audit.md` | media rows, private storage paths, signed URLs | Reviewing cross-user media leakage, media-list hydration, upload staging, or storage-path signing. |
| `2026-06-02-project-workspace-account-isolation-audit.md` | project rows, workspace snapshots, project API errors | Reviewing project/workspace isolation, snapshot reference sanitization, or sensitive project-route error disclosure. |
| `2026-06-02-provider-request-ownership-audit.md` | provider request IDs and service-role settlement | Reviewing Fal/Kie status polling, provider result hydration, generation settlement, or request ownership. |
