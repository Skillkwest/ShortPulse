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
- [ ] `fal-ai/flux-2/klein/9b` (FLUX.2 Lite, exception: no nearest-5 rounding)
- [ ] `fal/flux-2`
- [ ] `fal/flux-2/edit`
- [ ] `fal/flux-2-pro`
- [ ] `fal/flux-2-pro/edit`
- [ ] `fal-ai/flux-pro/v1/fill`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/flux-2/klein/9b` |  |  |  |  |  |  |
| `fal/flux-2` |  |  |  |  |  |  |
| `fal/flux-2/edit` |  |  |  |  |  |  |
| `fal/flux-2-pro` |  |  |  |  |  |  |
| `fal/flux-2-pro/edit` |  |  |  |  |  |  |
| `fal-ai/flux-pro/v1/fill` |  |  |  |  |  |  |

## 2) Bria Family
### Checklist
- [ ] `fal-ai/bria/background/remove` (exception: no nearest-5 rounding)

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/bria/background/remove` |  |  |  |  |  |  |

## 3) Google Image Family (Nano Banana)
### Checklist
- [ ] `fal-ai/nano-banana`
- [ ] `fal-ai/nano-banana/edit`
- [ ] `fal-ai/nano-banana-2`
- [ ] `fal-ai/nano-banana-2/edit`
- [ ] `fal-ai/nano-banana-pro`
- [ ] `fal-ai/nano-banana-pro/edit`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/nano-banana` |  |  |  |  |  |  |
| `fal-ai/nano-banana/edit` |  |  |  |  |  |  |
| `fal-ai/nano-banana-2` |  |  |  |  |  |  |
| `fal-ai/nano-banana-2/edit` |  |  |  |  |  |  |
| `fal-ai/nano-banana-pro` |  |  |  |  |  |  |
| `fal-ai/nano-banana-pro/edit` |  |  |  |  |  |  |

## 4) ByteDance Image Family (Seedream)
### Checklist
- [ ] `fal-ai/bytedance/seedream/v4.5/text-to-image`
- [ ] `fal-ai/bytedance/seedream/v4.5/edit`
- [ ] `fal-ai/bytedance/seedream/v5/lite/text-to-image`
- [ ] `fal-ai/bytedance/seedream/v5/lite/edit`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/bytedance/seedream/v4.5/text-to-image` |  |  |  |  |  |  |
| `fal-ai/bytedance/seedream/v4.5/edit` |  |  |  |  |  |  |
| `fal-ai/bytedance/seedream/v5/lite/text-to-image` |  |  |  |  |  |  |
| `fal-ai/bytedance/seedream/v5/lite/edit` |  |  |  |  |  |  |

## 5) ByteDance Video Family (Seedance)
### Checklist
- [ ] `fal-ai/bytedance/seedance/v1.5/pro/text-to-video`
- [ ] `fal-ai/bytedance/seedance/v1.5/pro/image-to-video`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/bytedance/seedance/v1.5/pro/text-to-video` |  |  |  |  |  |  |
| `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` |  |  |  |  |  |  |

## 6) Kling Family (Fal + Kie)
### Checklist
- [ ] `fal-ai/kling-video/v3/pro/text-to-video`
- [ ] `fal-ai/kling-video/v3/pro/image-to-video`
- [ ] `kie-ai/kling-3.0`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/kling-video/v3/pro/text-to-video` |  |  |  |  |  |  |
| `fal-ai/kling-video/v3/pro/image-to-video` |  |  |  |  |  |  |
| `kie-ai/kling-3.0` |  |  |  |  |  |  |

## 7) Veo Family (Fal + Kie)
### Checklist
- [ ] `fal-ai/veo3.1`
- [ ] `fal-ai/veo3.1/image-to-video`
- [ ] `fal-ai/veo3.1/first-last-frame-to-video`
- [ ] `kie-ai/veo-3.1-fast-i2v`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/veo3.1` |  |  |  |  |  |  |
| `fal-ai/veo3.1/image-to-video` |  |  |  |  |  |  |
| `fal-ai/veo3.1/first-last-frame-to-video` |  |  |  |  |  |  |
| `kie-ai/veo-3.1-fast-i2v` |  |  |  |  |  |  |

## 8) Sora Family
### Checklist
- [ ] `fal-ai/sora-2/text-to-video/pro`

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/sora-2/text-to-video/pro` |  |  |  |  |  |  |

## 9) OpenAI Text Helper
### Checklist
- [ ] `gpt-5-nano` (prompt refine / describe helper lane)

### Notes
| Model | Official Pricing URL(s) | Provider Pricing Input (USD) | Current Repo Credits | Recalculated Credits | Delta | Decision/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `gpt-5-nano` |  |  |  |  |  |  |

---

## Final Validation Gate
- [ ] Every active model has a filled pricing URL and input basis.
- [ ] Every model has current vs recalculated credits documented.
- [ ] Exceptions were applied only to approved models.
- [ ] Family-by-family approvals completed.
- [ ] Implementation diffs prepared from approved checklist values only.
