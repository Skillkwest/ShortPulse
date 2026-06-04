# Latency Tools

Purpose: reserve a home for Latency-owned helper scripts, checklists, or tool notes that are specific to the latency optimization workflow.

No Latency-specific tools have been created yet.

Prefer existing repo tooling before adding new tools:

- `npm -C frontend run latency:ai-studio-inventory`
- `npm -C frontend run latency:protected-route -- --path ROUTE`
- `npm -C frontend run latency:ai-studio-trace -- --project-id PROJECT_ID --storage-state STORAGE_STATE`
- `npm -C frontend run test:perf:ai-studio`
- `npm -C frontend run test:e2e:media-library-runtime`
- `npm -C frontend run test:e2e:project-persistence`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run build`

Create a new tool only when existing commands cannot prove or rank a latency seam safely.
