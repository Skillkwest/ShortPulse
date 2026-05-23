# Handoff: Holomony Default-Load Material Prune

Owner: Holomony

## Problem

Holomony has a strong current/archive split and a good artifact README, but JSON packet files and a sibling HTML identity file can still look like normal retained material. The cleanup lane is to keep default load tight and make packet/HTML material explicitly non-default.

## Evidence

- `docs/records/artifacts/agent/holomony/README.md` defines a recommended read order and says to ignore several surfaces by default.
- JSON packet files exist under:
  - `docs/records/artifacts/agent/holomony/reports/current/*.json`
  - `docs/records/artifacts/agent/holomony/reports/archive/*.json`
- `docs/agents/holomony/Kirk.html` exists alongside `docs/agents/holomony/Kirk.md`.
- `docs/agents/holomony/ownership-manifest.md` currently lists both `Kirk.md` and `Kirk.html` as directly owned.

## Requested Cleanup

1. Decide whether `Kirk.html` is still needed in Git or should be regenerated/on-demand outside default load.
2. Make JSON packet retention explicit:
   - current packets are machine evidence, not human default-load context
   - archived packets are historical evidence only
3. Update Holomony README or ownership manifest if needed to prevent future agents from loading packet JSON by default.
4. Preserve current KPI/report truth; this is a load-pruning task, not a performance rerate.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm the default Holomony read order remains compact.
