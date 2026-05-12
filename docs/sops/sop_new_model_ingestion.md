# SOP: Adding a New AI Studio Model (Image/Video/Text-to-Image/Video)

Use this checklist to add a new provider model end-to-end (pricing, UI, API proxy, docs). Follow in order to keep pricing/debit/UI consistent.

## Inputs to collect

- API docs: submit/status endpoints, auth header, required/optional fields, defaults (aspect, format, guidance/steps, safety).
- Pricing rule: per-image, per-MP (tiered), per-duration, or per-token; $→credits conversion uses the active credit scale plus per-model markup (`rawCredits = ceil(usd * creditUsdScale * (1 + modelMarkupBps / 10000))`, default `credits = rawCredits`; use explicit per-model markup/rounding overrides in `/admin/pricing` when a model should bill differently).
- Allowed aspects/sizes: enum list and width/height map if MP-based.
- Output schema: result URLs/fields needed for preview/result parsing.

## Implementation steps

1. **Pricing metadata**
   - `frontend/lib/model-runtime/modelSizes.ts`: add/extend aspect → size map if MP-based.
   - `frontend/lib/model-runtime/pricingTypes.ts`: add a pricing strategy id.
   - `frontend/lib/model-runtime/pricingStrategies.ts`: add strategy fn for the pricing rule (per-image/per-MP/per-duration/tiered) and register it.
   - `frontend/lib/model-runtime/pricingCredits.ts`: use shared conversion helper for per-model markup + rounding policy.
2. **Model catalog + UI options**
   - `frontend/lib/model-runtime/modelCatalog.ts`: add/update the catalog entry with payload validation, capability metadata, lifecycle, surfaces, billable intent, display order/family, logo key, and runtime defaults (`defaultDurationSeconds`, `defaultResolution`, `defaultAudio`) when applicable.
   - `frontend/lib/model-runtime/modelRegistry.ts`: keep registry helpers derived from catalog metadata. AI Studio picker options come from `listPickerModelConfigs()`; admin model pricing rows come from `listPricingModelConfigs()`.
   - `frontend/features/ai-studio/constants.ts`: only update aspect clamps/allowed sets or logo asset constants if the new model needs a new UI constraint/asset.
   - `frontend/features/ai-studio/components/ModelModal.tsx`: ensure grouping/order if a new section is needed (cost chips use `computeCostForModel` automatically).
3. **Client + API proxy**
   - Fal/Kie queued models: update the shared route inventory and run `npm -C frontend run fal:routes:sync` instead of hand-authoring wrapper files one by one. The committed wrappers under `frontend/pages/api/fal/` are generated compatibility files, not the source of truth, and they are the intended long-term ownership model unless a future explicit route-architecture phase replaces them.
   - OpenAI/ElevenLabs direct runtime models: update the shared direct-route inventory in `scripts/lib/direct_provider_route_inventory.js` so `model:doctor` and route coverage keep the catalog-to-route contract explicit. `model:scaffold` now prints this snippet when invoked with `--direct-route-path`, `--direct-route-kind`, and `--direct-route-authority`.
   - Add/update client helpers in `frontend/lib/falClient.ts` (submit/status).
   - OpenAI/other providers: add provider-specific helper and server-side proxy routes to keep keys hidden.
4. **Generation flow**
   - `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts`:
     - Add/update aspect/resolution/reference compatibility clamps for the new model/tool/mode.
   - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`:
     - Extend preflight/start-decision gates only if the new model changes submit invariants.
   - `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`:
     - Ensure prompt/reference composition rules cover the new model contract.
   - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts` + `frontend/features/ai-studio/hooks/taskSubmission/routing.ts`:
     - Route the new model id to the correct handler family (`default`/`image`/`video`).
   - `frontend/features/ai-studio/hooks/taskSubmission/{defaultHandlers,imageHandlers,videoHandlers}.ts`:
     - Add provider payload mapping, submit/status helper calls, status normalization, and preview URL extraction for the model.
5. **Docs**
   - Add `docs/api-<provider>-<model>.md` with auth, endpoints, payload, output, defaults, pricing formula, allowed aspects/size map.
   - Link in `docs/README.md` under API Reference.
   - Update `docs/sops/sop_image_generation.md` or relevant SOP table if the model is image/video.
6. **Validation**
   - Ensure `computeCostForModel` returns non-null for the model (tests below).
   - Ensure submission route mapping + payload matrix coverage are updated for the model family.
   - Smoke in dev: select model → see cost on Generate → submit → poll completes → preview/result URLs populate.

## Guardrails / tests

- Add a coverage test to ensure every registry entry with a pricing strategy returns policy-compliant costs across supported settings:
  - `frontend/features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts`.
- Optional lint: script to check every `docs/api-*.md` is listed in `docs/README.md`.

## Templates (copy/paste)

- **Per-image pricing strategy**
  ```ts
  const MY_MODEL_USD = 0.02;
  const computeMyModelCost: StrategyFn = ({ modelId }) => {
    const quantized = convertUsdToCredits({ modelId, usdRaw: MY_MODEL_USD });
    return {
      credits: quantized.credits,
      usd: quantized.billedUsd,
      rawCredits: quantized.rawCredits,
      usdRaw: MY_MODEL_USD,
      megapixels: 0,
      width: 0,
      height: 0,
    };
  };
  ```
- **Per-MP tiered strategy**
  ```ts
  const FIRST_MP_USD = 0.07;
  const ADDITIONAL_MP_USD = 0.03;
  const computeTieredMpCost: StrategyFn = ({ modelId, aspect }) => {
    const config = getModelConfig(modelId);
    if (!config?.sizeMap) return null;
    const size = resolveAspectSize(
      aspect,
      config.sizeMap,
      config.defaultAspect,
    );
    if (!size) return null;
    const mp = (size.width * size.height) / 1_000_000;
    const units = Math.max(1, Math.ceil(mp));
    const usdRaw = FIRST_MP_USD + Math.max(0, units - 1) * ADDITIONAL_MP_USD;
    const quantized = convertUsdToCredits({ modelId, usdRaw });
    return {
      credits: quantized.credits,
      usd: quantized.billedUsd,
      rawCredits: quantized.rawCredits,
      usdRaw,
      megapixels: mp,
      width: size.width,
      height: size.height,
    };
  };
  ```
- **Fal proxy (submit)**
  ```ts
  // frontend/pages/api/fal/<model>-submit.ts
  import type { NextApiRequest, NextApiResponse } from "next";
  const URL = "https://queue.fal.run/<provider-path>";
  export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
  ) {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    const apiKey = process.env.FAL_KEY;
    if (!apiKey)
      return res
        .status(500)
        .json({ error: "FAL_KEY is not set on the server" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const upstream = await fetch(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Fal submit failed", detail: String(error) });
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
  Pricing: <formula>, rawCredits = ceil(usd * creditPerDollar * (1 + perModelMarkupBps/10000)), credits = rawCredits unless a row-specific round-nearest override is configured in `/admin/pricing`
  Defaults we use: aspect fallback, format, safety, steps/guidance (if any)
  ```

## Sub-agent playbook

1. Read this SOP.
2. Collect API/pricing/aspect info.
3. Apply steps 1–5 in order; use templates.
4. Run/describe validation (or note if not run).
5. Update docs links and, if added, tests.
