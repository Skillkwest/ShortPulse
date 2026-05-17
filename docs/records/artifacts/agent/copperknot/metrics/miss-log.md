# Miss Log

Purpose: record under-ranked blockers, over-trusted systems, weak reports, and other mistakes so the Copperknot can improve its future measurement and queue choices.

| Date | Type | System or lane | What was missed | Severity | Evidence path | Correction made | Learning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `2026-05-15` | `process miss` | `generation-recovery-settlement-hardening` | The first completed external lane did not produce a dedicated closeout in the required intake folder. | `medium` | `docs/records/artifacts/agent/copperknot/reports/2026-05-15-production-launch-state-refresh.md` | Strengthened the closeout schema, intake docs, and handoff packets. | Tool quality depends heavily on incoming evidence quality; missing closeouts should be treated as a real measurement failure. |
| `2026-05-15` | `timing miss` | `Copperknot review loop` | The first completed lane sat too long before Copperknot review. | `medium` | `docs/agents/copperknot/catalog-tool-health-metrics.md` | Added time-based learning logs and kept rerating lead time as a standing metric. | A good catalog can still underperform if review latency is too slow during prelaunch. |
