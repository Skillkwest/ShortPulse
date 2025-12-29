# Testing Guide

Purpose: outline how to run and extend tests for ShortPulse.

## Commands
- Backend unit tests (metrics): `cd backend && pytest`
- Add more tests: place under `backend/tests/` mirroring the module under test.

## When to test
- Any change to metrics, ingestion mapping, or percentiles.
- Any new feature logic in `features/<name>/logic` or `utils`.

## Patterns
- Keep helpers pure so they are easy to unit test without app/bootstrap.
- Use small fixtures/factories (see `backend/tests/test_metrics.py` for examples).
- Mock external calls (e.g., Apify) rather than hitting the network.

## Gaps/TBD
- No frontend test setup is present; if added, prefer component-level tests for nontrivial UI logic and keep them co-located (e.g., `__tests__` or `*.test.tsx`).
- Add lint/format commands here if/when tooling is introduced.
