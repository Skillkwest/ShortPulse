# AI Studio Model Pricing Audit Checklist (2026-03-14)

Purpose: track model-by-model pricing research and inspection as we audit and update credits.

## Policy Snapshot (Locked)
- Credit conversion: `1 credit = $0.01`.
- Markup: `+3%` on provider cost converted to credits.
- Default rounding: round up to nearest `5` credits.
- Rounding exceptions (no nearest-5 step):
  - `fal-ai/flux-2/klein/9b` (FLUX.2 Lite)
  - `fal-ai/bria/background/remove` (Bria background remove)

## Calculation Rules
- Default models:
  - `finalCredits = ceil(((providerUsd * 100) * 1.03) / 5) * 5`
- Exception models (no 5-credit rounding):
  - `finalCredits = ceil((providerUsd * 100) * 1.03)`

## Family Order
1. FLUX
2. Bria
3. Google Image (Nano Banana family)
4. ByteDance Image (Seedream family)
5. ByteDance Video (Seedance family)
6. Kling (Fal + Kie)
7. Veo (Fal + Kie)
8. Sora
9. OpenAI Text Helper

## Tracker Template
Use this per model:
- Official pricing URL(s):
- Provider pricing input (USD):
- Current repo strategy:
- Current repo credits (default params):
- Recalculated credits (new policy):
- Delta:
- Decision/notes:

---

## 1) FLUX Family
### Checklist
- [x] `fal-ai/flux-2/klein/9b` (FLUX.2 Lite, exception: no nearest-5 rounding)
- [x] `fal/flux-2`
- [x] `fal/flux-2/edit`
- [x] `fal/flux-2-pro`
- [x] `fal/flux-2-pro/edit`
- [x] `fal-ai/flux-pro/v1/fill`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/flux-2/klein/9b` | https://fal.ai/models/fal-ai/flux-2/klein/9b/playground | `$0.006/MP` (playground: "Your request will cost $0.006 per megapixel.") | `1` | `1` (default 4:3 -> `1.08 MP * $0.006 = $0.00648`; policy: `ceil(($0.00648*100)*1.03)=1` via exception rounding) | `0` | Keep exception rounding (`ceil(markedCredits)`), no nearest-5. |
| `fal/flux-2` | https://fal.ai/models/fal-ai/flux-2/playground | `$0.012/MP` | `5` | `5` (default 4:3 -> `1.08 MP * $0.012 = $0.01296`; policy: nearest-5 after +3%) | `0` | No default-lane change; keep dynamic MP-based behavior. |
| `fal/flux-2/edit` | https://fal.ai/models/fal-ai/flux-2/edit/playground | `$0.012/MP` input + output; input resized to `1 MP` | `5` | `5` (default basis: `($0.012 * (1.0 + 1.08)) = $0.02496`; policy: nearest-5 after +3%) | `0` | Formula basis changes from output-only to input+output (with 1 MP normalized input). Default credits stay 5. |
| `fal/flux-2-pro` | https://fal.ai/models/fal-ai/flux-2-pro/playground | `$0.03` first MP output + `$0.015` per extra MP of input/output (rounded up per MP) | `5` | `5` (default 4:3 output `1.08 MP -> ceil=2 MP`; provider USD = `$0.045`) | `0` | Keep rounded-MP tier formula; apply +3% then nearest-5 policy conversion. |
| `fal/flux-2-pro/edit` | User-provided provider pricing evidence (2026-03-14), https://fal.ai/models/fal-ai/flux-2-pro/edit/playground | `$0.03` first MP of output + `$0.015` per extra rounded MP of input/output; runtime uses normalized `1 MP` input for deterministic edit-lane parity | `5` | `10` (default `4:3` output -> `ceil(1.08)=2 MP`; provider USD = `$0.03 + $0.015*(1 output extra + 1 input normalized) = $0.06`; policy applies +3% then nearest-5) | `+5` | Unblocked via user evidence; apply shared markup/rounding policy. |
| `fal-ai/flux-pro/v1/fill` | https://fal.ai/models/fal-ai/flux-pro/v1/fill/playground | `$0.05/MP`, "Images are billed by rounding up to the nearest megapixel." | `5` | `15` (default 1:1 `1024x1024 -> 1.048576 MP -> ceil=2 MP`; provider USD=`$0.10`; policy nearest-5 after +3%) | `+10` | Major underpricing in current strategy; requires formula update. |

## 2) Bria Family
### Checklist
- [x] `fal-ai/bria/background/remove` (exception: no nearest-5 rounding)

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/bria/background/remove` | https://fal.ai/models/fal-ai/bria/background/remove/playground | `$0.018` per generation (`endpointBilling`: `billing_unit=generations`, `price=0.018`) | `1` | `2` (policy: `ceil(($0.018*100)*1.03)` via exception rounding) | `+1` | Reprice to 2 credits; keep exception rounding (`ceil(markedCredits)`) and no nearest-5 step. |

## 3) Google Image Family (Nano Banana)
### Checklist
- [x] `fal-ai/nano-banana`
- [x] `fal-ai/nano-banana/edit`
- [x] `fal-ai/nano-banana-2`
- [x] `fal-ai/nano-banana-2/edit`
- [x] `fal-ai/nano-banana-pro`
- [x] `fal-ai/nano-banana-pro/edit`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/nano-banana` | https://fal.ai/models/fal-ai/nano-banana/api | `$0.039` per image (`pricingInfoOverride`; `endpointBilling price=0.0398`) | `5` | `5` (default policy conversion from `$0.039`) | `0` | Keep flat per-image pricing behavior for default lane. |
| `fal-ai/nano-banana/edit` | https://fal.ai/models/fal-ai/nano-banana/edit/api | `$0.039` per image (`pricingInfoOverride`; `endpointBilling price=0.0398`) | `5` | `5` | `0` | Keep edit lane aligned with text-to-image lane. |
| `fal-ai/nano-banana-2` | https://fal.ai/models/fal-ai/nano-banana-2/api | Base `$0.08` per image; resolution multipliers: `0.5K x0.75`, `2K x1.5`, `4K x2`; web search `+$0.015`; high thinking `+$0.002` (provider note) | `10` | `10` (default `1K`, no web search) | `0` | Keep dynamic resolution + web-search behavior; document provider high-thinking surcharge as out-of-runtime unless surfaced later. |
| `fal-ai/nano-banana-2/edit` | https://fal.ai/models/fal-ai/nano-banana-2/edit/api | Base `$0.08` per image; resolution multipliers: `0.5K x0.75`, `2K x1.5`, `4K x2`; web search `+$0.015`; high thinking `+$0.002` (provider note) | `10` | `10` (default `1K`, no web search) | `0` | Keep edit lane formula parity with Nano Banana 2 text-to-image lane. |
| `fal-ai/nano-banana-pro` | https://fal.ai/models/fal-ai/nano-banana-pro/api | Base `$0.15` per image; `4K` is double rate; web search `+$0.015` | `15` | `20` (default `1K`, no web search; policy applies +3% then nearest-5) | `+5` | Current default undercharges under locked markup policy. |
| `fal-ai/nano-banana-pro/edit` | https://fal.ai/models/fal-ai/nano-banana-pro/edit/api | Base `$0.15` per image; `4K` is double rate; web search `+$0.015` | `15` | `20` (default `1K`, no web search) | `+5` | Align edit lane with Nano Banana Pro text-to-image recalibration. |

## 4) ByteDance Image Family (Seedream)
### Checklist
- [x] `fal-ai/bytedance/seedream/v4.5/text-to-image`
- [x] `fal-ai/bytedance/seedream/v4.5/edit`
- [x] `fal-ai/bytedance/seedream/v5/lite/text-to-image`
- [x] `fal-ai/bytedance/seedream/v5/lite/edit`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/bytedance/seedream/v4.5/text-to-image` | https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image/api | `$0.04` per image (`endpointBilling`: `billing_unit=images`, `price=0.04`) | `5` | `5` | `0` | Provider surface currently indicates flat per-image billing (no explicit resolution surcharge in pricing metadata). |
| `fal-ai/bytedance/seedream/v4.5/edit` | https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api | `$0.04` per image (`endpointBilling`: `billing_unit=images`, `price=0.04`) | `5` | `5` | `0` | Keep edit lane parity with text-to-image pricing input basis. |
| `fal-ai/bytedance/seedream/v5/lite/text-to-image` | https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image/api | `$0.035` per image (`endpointBilling`: `billing_unit=images`, `price=0.035`) | `5` | `5` | `0` | Provider surface indicates flat per-image billing across runtime-exposed defaults. |
| `fal-ai/bytedance/seedream/v5/lite/edit` | https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit/api | `$0.035` per image (`endpointBilling`: `billing_unit=images`, `price=0.035`) | `5` | `5` | `0` | Keep edit lane parity with Seedream 5 Lite text-to-image basis. |

## 5) ByteDance Video Family (Seedance)
### Checklist
- [x] `fal-ai/bytedance/seedance/v1.5/pro/text-to-video`
- [x] `fal-ai/bytedance/seedance/v1.5/pro/image-to-video`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/bytedance/seedance/v1.5/pro/text-to-video` | https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/text-to-video/api | Pricing narrative: `1M` video tokens with audio = `$2.4`; without audio = `$1.2`; `tokens = (height * width * FPS * duration) / 1024`; endpoint billing base `1m tokens @ $1.2` | `120` | `125` (default `10s`, `1080p`, audio on) | `+5` | Reprice default lane upward under +3% policy while preserving token-based dynamic behavior. |
| `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` | https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/api | Pricing narrative: `1M` video tokens with audio = `$2.4`; without audio = `$1.2`; `tokens = (height * width * FPS * duration) / 1024`; endpoint billing base `1m tokens @ $1.2` | `60` | `65` (default `5s`, `1080p`, audio on) | `+5` | Apply same Seedance v1.5 Pro token schedule to I2V lane under locked policy conversion. |

## 6) Kling Family (Fal + Kie)
### Checklist
- [x] `fal-ai/kling-video/v3/pro/text-to-video`
- [x] `fal-ai/kling-video/v3/pro/image-to-video`
- [x] `kie-ai/kling-3.0`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/kling-video/v3/pro/text-to-video` | https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video/api | `pricingInfoOverride`: per-second pricing = `$0.112` (audio off), `$0.168` (audio on), `$0.196` (audio+voice control) | `340` | `175` (default `10s`, audio on, no voice control) | `-165` | Current runtime is materially overpriced versus current provider rates. |
| `fal-ai/kling-video/v3/pro/image-to-video` | https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api | `pricingInfoOverride`: per-second pricing = `$0.112` (audio off), `$0.168` (audio on), `$0.196` (audio+voice control) | `340` | `175` (default `10s`, audio on, no voice control) | `-165` | Align I2V lane with same Kling v3 Pro per-second schedule. |
| `kie-ai/kling-3.0` | User-provided Kie pricing dashboard evidence (2026-03-14), https://docs.kie.ai/market/kling/kling-3.0 | Kie rates from evidence: `1080p` `$0.20/s` (audio on), `$0.135/s` (audio off); `720p` `$0.15/s` (audio on), `$0.10/s` (audio off); Kie conversion in evidence: `1 credit ~= $0.005` | `340` | `210` (default `10s`, `1080p`, audio on; policy applies +3% then nearest-5) | `-130` | Unblocked via user evidence; runtime now uses resolution+audio-aware Kie rates with standard markup/rounding policy. |

## 7) Veo Family (Fal + Kie)
### Checklist
- [x] `fal-ai/veo3.1`
- [x] `fal-ai/veo3.1/image-to-video`
- [x] `fal-ai/veo3.1/first-last-frame-to-video`
- [x] `kie-ai/veo-3.1-fast-i2v`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/veo3.1` | https://fal.ai/models/fal-ai/veo3.1/api | `pricingInfoOverride`: `$0.20/s` (no audio) / `$0.40/s` (audio) for 720p/1080p; 4K `$0.40/s` (no audio) / `$0.60/s` (audio) | `320` | `330` (default `8s`, `1080p`, audio on) | `+10` | Rates match existing formula basis; delta driven by locked +3% markup policy. |
| `fal-ai/veo3.1/image-to-video` | https://fal.ai/models/fal-ai/veo3.1/image-to-video/api | Same per-second schedule as Veo 3.1 base lane (`pricingInfoOverride`) | `320` | `330` (default `8s`, `720p`, audio on) | `+10` | Keep dynamic resolution/audio schedule; apply locked markup/rounding conversion. |
| `fal-ai/veo3.1/first-last-frame-to-video` | https://fal.ai/models/fal-ai/veo3.1/first-last-frame-to-video/api | Same per-second schedule as Veo 3.1 base lane (`pricingInfoOverride`) | `320` | `330` (default `8s`, `720p`, audio on) | `+10` | Keep keyframe lane on same Veo schedule and policy conversion. |
| `kie-ai/veo-3.1-fast-i2v` | User-provided Kie pricing dashboard evidence (2026-03-14), https://docs.kie.ai/veo3-api/generate-veo-3-video | Kie evidence rows (Fast): `text-to-video`, `image-to-video`, `reference-to-video` each `60 credits / video`, `Our Price = $0.30`; conversion: `1 credit ~= $0.005` | `200` | `35` (fixed `$0.30` per video; policy applies +3% then nearest-5) | `-165` | Unblocked via user evidence; ShortPulse `FIRST_AND_LAST_FRAMES_2_VIDEO` keyframes path is priced on the same fixed Fast lane basis under shared conversion policy. |

## 8) Sora Family
### Checklist
- [x] `fal-ai/sora-2/text-to-video/pro`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/sora-2/text-to-video/pro` | https://fal.ai/models/fal-ai/sora-2/text-to-video/pro/api | Provider metadata: endpoint billing `second @ $0.5` with `pricingInfoOverride` `$0.30/s` for 720p and `$0.50/s` for 1080p | `330` | `415` (default `8s`, `1080p`) | `+85` | Existing tiered runtime schedule is materially stale versus provider’s current per-second resolution rates. |

## 9) OpenAI Text Helper
### Checklist
- [x] `gpt-5-nano` (out of scope per locked assumption)

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `gpt-5-nano` | https://platform.openai.com/docs/models/gpt-5-nano | Out of scope for this recalibration pass | `N/A` | `N/A` | `N/A` | Locked assumption: OpenAI model cost recalculation is excluded. |

---

## Final Validation Gate
- [x] Every active model has a filled pricing URL and input basis.
- [x] Every model has current vs recalculated credits documented.
- [x] Exceptions were applied only to approved models.
- [x] Family-by-family approvals completed.
- [x] Implementation diffs prepared from approved checklist values only.
