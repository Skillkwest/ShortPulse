# SOP: Adding a New AI Studio Model (Image/Video/Text-to-Image/Video)

Use this checklist to add a new provider model end-to-end (pricing, UI, API proxy, docs). Follow in order to keep pricing/debit/UI consistent.

## Inputs to collect
- API docs: submit/status endpoints, auth header, required/optional fields, defaults (aspect, format, guidance/steps, safety).
- Pricing rule: per-image, per-MP (tiered), per-duration, or per-token; $→credits conversion (`credits = ceil(usd / 0.01)`, min 1).
- Allowed aspects/sizes: enum list and width/height map if MP-based.
- Output schema: result URLs/fields needed for preview/result parsing.

## Implementation steps
1) **Pricing metadata**
   - `frontend/features/ai-studio/logic/modelSizes.ts`: add/extend aspect → size map if MP-based.
   - `frontend/features/ai-studio/logic/pricingTypes.ts`: add a pricing strategy id.
   - `frontend/features/ai-studio/logic/pricingStrategies.ts`: add strategy fn for the pricing rule (per-image/per-MP/per-duration/tiered) and register it.
2) **Model registry + UI options**
   - `frontend/features/ai-studio/logic/modelRegistry.ts`: add `ModelConfig` with `id`, `label`, `provider`, `mediaType`, `defaultAspect`, `allowedAspects`, `pricingStrategy`, optional `sizeMap`, and any default runtime params (`defaultDurationSeconds`, `defaultResolution`, `defaultAudio`).
   - `frontend/features/ai-studio/constants.ts`: add `modelOptions` entry (UI label) and aspect clamps/allowed sets if needed.
   - `frontend/features/ai-studio/components/ModelModal.tsx`: ensure grouping/order if a new section is needed (cost chips use `computeCostForModel` automatically).
3) **Client + API proxy**
   - Fal models: add Next proxies `frontend/pages/api/fal/<model>-submit.ts` and `<model>-status.ts`; add client helpers in `frontend/lib/falClient.ts` (submit/status).
   - Kie/OpenAI/other: reuse `createKeiTask` or add provider-specific helper; proxy server-side to keep keys hidden.
4) **Generation flow**
   - `frontend/features/ai-studio/hooks/useAiStudioState.ts`:
     - Aspect clamp in the effect for the new model.
     - Submit branch routing to the correct helper with provider defaults (format, safety, steps/guidance).
     - Polling: add provider key to use the correct status helper.
     - Preview seeds: set `previewUrl` if needed (e.g., image→video).
5) **Docs**
   - Add `docs/api-<provider>-<model>.md` with auth, endpoints, payload, output, defaults, pricing formula, allowed aspects/size map.
   - Link in `docs/README.md` under API Reference.
   - Update `docs/sops/sop_image_generation.md` or relevant SOP table if the model is image/video.
6) **Validation**
   - Ensure `computeCostForModel` returns non-null for the model (tests below).
   - Smoke in dev: select model → see cost on Generate → submit → poll completes → preview/result URLs populate.

## Guardrails / tests
- Add a coverage test to ensure every registry entry with a pricing strategy returns a cost:
  - `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts`:
    - Iterate `listModelConfigs()`, call `computeCostForModel(id, { aspect: config.defaultAspect })`, assert non-null when a strategy exists.
- Optional lint: script to check every `docs/api-*.md` is listed in `docs/README.md`.

## Templates (copy/paste)
- **Per-image pricing strategy**
  ```ts
  const MY_MODEL_USD = 0.02;
  const computeMyModelCost: StrategyFn = () => {
    const credits = Math.max(1, Math.ceil(MY_MODEL_USD / CREDIT_VALUE_USD));
    return { credits, usd: credits * CREDIT_VALUE_USD, megapixels: 0, width: 0, height: 0 };
  };
  ```
- **Per-MP tiered strategy**
  ```ts
  const FIRST_MP_USD = 0.07;
  const ADDITIONAL_MP_USD = 0.03;
  const computeTieredMpCost: StrategyFn = ({ modelId, aspect }) => {
    const config = getModelConfig(modelId);
    if (!config?.sizeMap) return null;
    const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
    if (!size) return null;
    const mp = (size.width * size.height) / 1_000_000;
    const units = Math.max(1, Math.ceil(mp));
    const usdRaw = FIRST_MP_USD + Math.max(0, units - 1) * ADDITIONAL_MP_USD;
    const credits = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
    return { credits, usd: credits * CREDIT_VALUE_USD, megapixels: mp, width: size.width, height: size.height };
  };
  ```
- **Fal proxy (submit)**
  ```ts
  // frontend/pages/api/fal/<model>-submit.ts
  import type { NextApiRequest, NextApiResponse } from "next";
  const URL = "https://queue.fal.run/<provider-path>";
  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) return res.status(500).json({ error: "FAL_KEY is not set on the server" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const upstream = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (error) {
      return res.status(500).json({ error: "Fal submit failed", detail: String(error) });
    } finally {
      clearTimeout(timeoutId);
    }
  }
  ```
- **Doc skeleton**
  ```
  # <Provider> <Model> API Reference
  Auth: ...
  Submit: ...
  Status: ...
  Input: prompt, aspect/size, format, safety, defaults
  Output: result URLs, fields
  Pricing: <formula>, credits = ceil(usd/0.01)
  Defaults we use: aspect fallback, format, safety, steps/guidance (if any)
  ```

## Sub-agent playbook
1. Read this SOP.
2. Collect API/pricing/aspect info.
3. Apply steps 1–5 in order; use templates.
4. Run/describe validation (or note if not run).
5. Update docs links and, if added, tests.
