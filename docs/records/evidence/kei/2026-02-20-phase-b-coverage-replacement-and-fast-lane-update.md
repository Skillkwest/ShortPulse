# STG-04 Phase B Evidence (2026-02-20)

## Scope
- Replaced KEI-specific fast-lane auth-context dependency with non-KEI coverage.
- Kept tombstone disabled-route behavior coverage while compatibility window is active.

## CI fast lane update
Updated in `.github/workflows/ci.yml`:

```bash
npm run test -- auth-helper proxy-internal-utils auth-guarded-ai-kei-routes fal-status.auth-context fal-status.ownership auth-latency-benchmark
```

## Coverage mapping
| Risk area | Coverage suite |
| --- | --- |
| Auth guard behavior | `auth-helper`, `proxy-internal-utils`, `auth-guarded-ai-kei-routes` |
| Ownership checks | `fal-status.ownership` |
| Status-poll safety logic with middleware context | `fal-status.auth-context` |
| Disabled-route behavior parity | `auth-guarded-ai-kei-routes` |
| Auth-boundary latency regression | `auth-latency-benchmark` |

## Verification commands
| Command | Result |
| --- | --- |
| `npm -C frontend run test -- auth-helper proxy-internal-utils auth-guarded-ai-kei-routes fal-status.auth-context fal-status.ownership auth-latency-benchmark` | pass |
| `npm -C frontend run test` | pass |
| `npm -C frontend run docs:check` | pass |

## Stage status impact
- STG-04 Phase B: complete.
- STG-04 Phase C: pending compatibility hold window + low/no traffic confirmation.
