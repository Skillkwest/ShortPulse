import { describe, expect, it } from "vitest";
import {
  adminPricingCustomRowsDocumentsEqual,
  compactAdminPricingCustomRowsDocument,
  getDefaultAdminPricingCustomRowsDocument,
} from "../adminPricingCustomRows";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../falModelIds";

describe("adminPricingCustomRows", () => {
  it("normalizes row labels, specs, overrides, and derives missing variant ids", () => {
    const compacted = compactAdminPricingCustomRowsDocument({
      schemaVersion: 1,
      rowsByModel: {
        "fal-ai/flux-pro/v1.1": [
          {
            displayRowId: " custom-row-1 ",
            label: "  Premium crop  ",
            spec: {
              baseVariantId: "create",
              aspect: "1:1",
              resolution: "1024x1024",
            },
            overrides: {
              markupBps: "4500",
              providerUsdOverride: "0.32",
            },
          },
        ],
      },
    } as unknown);

    expect(compacted.rowsByModel["fal-ai/flux-pro/v1.1"]).toEqual([
      {
        displayRowId: "custom-row-1",
        label: "Premium crop",
        variantId: "create|res:1024x1024|aspect:1:1",
        spec: {
          baseVariantId: "create",
          aspect: "1:1",
          resolution: "1024x1024",
          audio: null,
          videoInput: null,
          inputImageCount: null,
          inputFidelity: null,
          maskPresent: null,
        },
        overrides: {
          markupBps: 4500,
          providerUsdOverride: 0.32,
          providerUsdPerSecondOverride: null,
        },
      },
    ]);
    expect(compacted.rowsByModel[FAL_FLUX_2_KLEIN_9B_MODEL_ID]).toHaveLength(2);
  });

  it("compares documents after normalization", () => {
    expect(
      adminPricingCustomRowsDocumentsEqual(
        {
          schemaVersion: 1,
          rowsByModel: {
            model: [
              {
                displayRowId: "row-1",
                label: null,
                variantId: "default",
                spec: {},
                overrides: {
                  markupBps: null,
                  providerUsdOverride: null,
                  providerUsdPerSecondOverride: null,
                },
              },
            ],
          },
        },
        {
          schemaVersion: 1,
          rowsByModel: {
            model: [
              {
                displayRowId: " row-1 ",
                label: null,
                spec: {},
                overrides: {},
              },
            ],
          },
        } as never
      )
    ).toBe(true);
  });

  it("returns the built-in default document for invalid input", () => {
    expect(compactAdminPricingCustomRowsDocument(null)).toEqual(
      getDefaultAdminPricingCustomRowsDocument()
    );
  });

  it("includes Flux2 Klein semantic rows for audio reference backgrounds and style previews", () => {
    expect(
      getDefaultAdminPricingCustomRowsDocument().rowsByModel[FAL_FLUX_2_KLEIN_9B_MODEL_ID]
    ).toEqual([
      expect.objectContaining({
        displayRowId: "builtin:flux-2-klein-audio-companion-art",
        label: "Sound reference background companion art",
        variantId: `${FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
        spec: expect.objectContaining({
          baseVariantId: FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
          aspect: "1:1",
          resolution: "model_default",
        }),
      }),
      expect.objectContaining({
        displayRowId: "builtin:flux-2-klein-style-preview",
        label: "Text-only style creation generation",
        variantId: `${FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
        spec: expect.objectContaining({
          baseVariantId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
          aspect: "1:1",
          resolution: "model_default",
        }),
      }),
    ]);
  });

  it("keeps built-in Flux2 Klein rows when the persisted document has no custom rows", () => {
    expect(
      compactAdminPricingCustomRowsDocument({
        schemaVersion: 1,
        rowsByModel: {},
      } as never)
    ).toEqual(getDefaultAdminPricingCustomRowsDocument());
  });

  it("recomputes canonical variant ids from model-aware spec data", () => {
    const compacted = compactAdminPricingCustomRowsDocument({
      schemaVersion: 1,
      rowsByModel: {
        "fal-ai/flux-2/klein/9b": [
          {
            displayRowId: "row-1",
            variantId: "bogus",
            spec: {
              baseVariantId: "create",
              aspect: "4:3",
              resolution: "model_default",
            },
          },
        ],
      },
    } as never);

    expect(compacted.rowsByModel["fal-ai/flux-2/klein/9b"]).toContainEqual({
      displayRowId: "row-1",
      label: null,
      variantId: "create|res:model_default|aspect:4:3",
      spec: {
        baseVariantId: "create",
        aspect: "4:3",
        resolution: "model_default",
        audio: null,
        videoInput: null,
        inputImageCount: null,
        inputFidelity: null,
        maskPresent: null,
      },
      overrides: {
        markupBps: null,
        providerUsdOverride: null,
        providerUsdPerSecondOverride: null,
      },
    });
  });

  it("keeps multiple custom rows that resolve to the same canonical variant when display ids differ", () => {
    const rows = compactAdminPricingCustomRowsDocument({
      schemaVersion: 1,
      rowsByModel: {
        "fal-ai/flux-2/klein/9b": [
          {
            displayRowId: "row-1",
            spec: {
              baseVariantId: "create",
              aspect: "4:3",
              resolution: "model_default",
            },
          },
          {
            displayRowId: "row-2",
            variantId: "stale",
            spec: {
              baseVariantId: "create",
              aspect: "4:3",
              resolution: "model_default",
            },
          },
        ],
      },
    } as never).rowsByModel["fal-ai/flux-2/klein/9b"];

    expect(rows?.filter((row) => row.displayRowId.startsWith("row-"))).toHaveLength(2);
  });
});
