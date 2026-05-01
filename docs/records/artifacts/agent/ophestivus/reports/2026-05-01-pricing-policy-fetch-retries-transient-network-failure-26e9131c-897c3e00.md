# Pricing policy fetch retries transient network failure

- Created: 2026-05-01T17:13:07.179Z
- Status: complete
- Ticket: 26e9131c-c83a-4f76-95ca-ff39bdb1395c
- Incident: 897c3e00-2752-4db9-81a8-88c15a7ae2ab

## Summary

Ran error-grab SOP and review SOP for a high-priority client.api_network Failed to fetch incident on /api/pricing/model-policy.

## Changes

Added shortpulseRetryNetworkOnce to fetchWithAuth, enabled it for AI Studio pricing policy loading, added retry telemetry tests, asserted hook options, and fixed a stale AgentContext test fixture.

## Validation

Vitest targeted suites passed; targeted ESLint passed; npm run type-check passed; git diff --check passed; error-status showed 0 open and 0 fresh same-fingerprint events.

## Residual Risk

Monitor: persistent endpoint outage still logs one final network incident after retry.
