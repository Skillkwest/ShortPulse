# Media Rendering Hardening v2 Contract Matrix (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Purpose
Define and lock contract ownership across media list/upload/sign/resolve/adaptive surfaces.

## Contract Matrix
| domain | producer | primary consumers | locked contract | parity lock type |
| --- | --- | --- | --- | --- |
| List | `/api/media/list` | route, modal, panel, prompt flows | cursor pagination, profile mode, folder semantics | request/response schema + pagination characterization |
| Sign | `/api/media/sign-batch` | route, modal, panel | user-scoped signing, preview profile headers | signed URL shape + failure fallback tests |
| Resolve previews | `/api/media/resolve-previews` | panel/reference consumers | deterministic source preference and fallback order | resolver behavior tests + surface smoke |
| Upload canonical | `/api/media/upload` | media-library uploads | destination validation, signature validation, persisted row semantics | upload contract tests + adapter parity |
| Legacy upload adapter | `/api/upload-image`, `/api/upload-video` | ai-studio agent and media upload utility paths | compatibility response contract during sunset window | adapter parity + usage telemetry |
| Adaptive preview | adaptive resolver modules | route/modal/panel/reference-grid | deterministic preview/full URL selection and error taxonomy | cross-surface resolver parity tests |
| Metadata authority | upload + copy-from-url + list/resolve | all media render surfaces | canonical dimension fields and fallback policy | metadata invariant tests |

## Rule
Any contract edit requires same-slice update to this matrix and decision-log entry.
