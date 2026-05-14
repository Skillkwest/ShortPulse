# Ledger Run Log

Purpose: append-only ledger of substantive Ledger runs.

## 2026-05-13: Agent Setup

- Established Ledger as the ShortPulse commerce billing steward.
- Created the contract, repo-visible memory, source-of-truth map, and retained artifact area.
- Seeded the initial training/history/tooling surfaces so future billing runs have a durable memory path.

| Date | Run Type | Lane | Outcome | Validation | Report |
| --- | --- | --- | --- | --- | --- |
| 2026-05-13 | truth-alignment | subscriptions | Public pricing truth, Stripe customer repair safety, profile resync, annual renewal worker coverage, and pricing telemetry were hardened | Focused billing route tests, Stripe/admin safety tests, profile return-flow tests, annual renewal tests, route posture checks | `docs/records/artifacts/agent/ledger/reports/2026-05-13-subscription-truth-alignment.md` |
| 2026-05-13 | audit | credit packages | Verified checkout/grant flow health and identified historical transaction drift risk when package names or prices change later | Targeted route/helper/test audit | `docs/records/artifacts/agent/ledger/reports/2026-05-13-credit-package-history-audit.md` |
| 2026-05-13 | implementation | credit packages | Added immutable package name/price snapshots to checkout/webhook history fallback so old top-up history no longer drifts after repricing/renaming | Focused checkout, webhook, and transactions tests | `docs/records/artifacts/agent/ledger/reports/2026-05-13-credit-package-history-snapshot-fix.md` |
| 2026-05-13 | implementation | storage add-ons | Hardened self-serve recurring storage add-on changes to fail closed on incomplete payment states and block duplicate add charges when local sync is stale | Focused storage mutation, storage history, and profile storage action tests | `docs/records/artifacts/agent/ledger/reports/2026-05-13-storage-addon-payment-safety-fix.md` |
