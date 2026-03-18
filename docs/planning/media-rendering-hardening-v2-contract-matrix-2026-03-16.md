# Media Rendering Hardening v2 Contract Matrix (2026-03-16)

Last updated: 2026-03-18
Status: Active

## Purpose
Define and lock producer/consumer ownership across media list/upload/sign/resolve/adaptive surfaces and the new supporting policy docs.

## Contract Matrix
| domain | producer | primary consumers | locked contract | parity lock type |
| --- | --- | --- | --- | --- |
| Surface inventory | image surface inventory lock | all later slices | authoritative callsite IDs, owner, render type, surface class | inventory lock review + docs check |
| Surface policy | surface policy matrix | Foundation, Pipeline, Surface lanes | renderer, optimizer, signing, fallback, telemetry rule per surface | decision-log alignment + policy review |
| Telemetry baseline truth | telemetry baseline truth spec | baseline packets, rollout, perf evidence | trustworthy metrics, blocked metrics, capture rules | telemetry review + baseline packet validation |
| List | `/api/media/list` | route, modal, panel, prompt flows | cursor pagination, profile mode, folder semantics | request/response schema + pagination characterization |
| Sign | `/api/media/sign-batch` | route, modal, panel, reference, character, detail | user-scoped signing, preview profile headers, failure semantics | signed URL shape + failure fallback tests |
| Resolve previews | `/api/media/resolve-previews` | panel/reference/selection consumers | deterministic source preference and fallback order | resolver behavior tests + surface smoke |
| Upload canonical | `/api/media/upload` | media-library uploads | destination validation, signature validation, persisted row semantics | upload contract tests + adapter parity |
| Legacy upload adapter | `/api/upload-image`, `/api/upload-video` | AI Studio utilities and legacy callers | compatibility response contract during sunset window | adapter parity + usage telemetry |
| Adaptive preview | adaptive resolver modules | route/modal/panel/reference-grid/quick-slot/character-grid/quick-swap/detail | deterministic preview/full URL selection and error taxonomy | cross-surface resolver parity tests |
| Metadata authority | upload + copy-from-url + list/resolve | all media render surfaces | canonical dimension fields and fallback policy | metadata invariant tests |
| Test realignment | test realignment matrix | all implementation slices | classify characterization locks vs drift-locking tests | test-matrix review + rewritten tests |

## Rule
Any contract edit requires same-slice update to this matrix and a decision-log entry.
