# 2026-06-21 Generation Runtime / Pricing Watch

Scratch checkpoint only. Not a source of truth.

- Context: user reported a fresh deploy; Copperknot refreshed the P6 generation runtime/provider lane without touching Gear Ball-owned dirty app files.
- Clean checks: branch remained `production`; `shortpulse.allowedBranch=production`; no repo backup artifact directories were found by the safety check.
- Production-safe runtime checks passed: `node scripts/check_vercel_env_contract.mjs --environment production`, `npm -C frontend run fal:routes:check`, and `npm -C frontend run model:doctor`.
- Read-only production app-error aggregate: `150` generation-scope events in the last `24h`, `28` in the last `6h`; fresh `6h` sources were mostly direct Kie submit telemetry plus recovery media-visible telemetry, with one client network event.
- Pricing watch: `api.generation_billing_missing_canonical_video_price` had `2` events in the last `24h`, `0` in the last `6h`, `0` in the last `2h`, `0` in the last `1h`, and `0` in the last `30m`.
- Latest missing canonical video price event: `2026-06-20T17:09:29.157428Z`, model `kie-ai/kling-3.0`, active pricing policy version `5`, pricing params `durationSeconds=10`, `resolution=720p`, `mode=720p`, `audio=true`, `aspect=16:9`.
- Current source plus active production pricing policy version `5` resolves that exact Kling 3.0 variant to `default|res:720p|aspect:16:9|audio:on`, `52` credits, so no source patch is justified from this signal.
- Deployment freshness: a follow-up route-parity check after the user-reported deploy still resolved `https://www.shortpulse.ai` to deployment `shortpulse-kbam1m8m2-kirk-artmans-projects.vercel.app`, created `2026-06-21T14:01:59.680Z`; route parity and secret exposure checks passed, but this does not prove any newer local app-code changes are deployed.
- Classification: P6 remains below floor because credit-consuming generation smoke and authenticated lifecycle behavior are still approval-gated/unproven; P7 remains launchable-with-watch because billing readiness is green and the historical fail-closed price signal is not currently repeating.
