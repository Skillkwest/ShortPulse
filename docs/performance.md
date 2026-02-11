# Performance Operations Guide

Purpose: define operational expectations for frontend and generation-flow performance.

## Frontend performance guardrails
- Keep route entry points lean; push logic into feature modules.
- Avoid large synchronous computations in render paths.
- Keep AI Studio polling loops bounded and cleaned up on unmount.

## Generation workflow performance
- Enforce request payload limits before sending provider calls.
- Prefer URL-based media references over large inline payloads when possible.
- Keep polling intervals and timeout behavior consistent across providers.

## Validation checklist
- Run `npm -C frontend run build` and verify no blocking performance regressions.
- Smoke-test AI Studio generation across text/image/video modes.
- Confirm Media Library remains responsive with realistic item counts.

## Monitoring tie-in
- Track incident spikes related to timeout, fetch failure, and provider latency.
- Use `docs/monitoring.md` for triage and escalation workflow.
