import { describe, expect, it } from "vitest";
import {
  adminPricingCustomRowsDocumentsEqual,
  compactAdminPricingCustomRowsDocument,
  getDefaultAdminPricingCustomRowsDocument,
} from "../adminPricingCustomRows";

describe("adminPricingCustomRows", () => {
  it("normalizes row labels, specs, overrides, and derives missing variant ids", () => {
    expect(
      compactAdminPricingCustomRowsDocument({
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
      } as unknown)
    ).toEqual({
      schemaVersion: 1,
      rowsByModel: {
        "fal-ai/flux-pro/v1.1": [
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
        ],
      },
    });
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

  it("returns the empty default document for invalid input", () => {
    expect(compactAdminPricingCustomRowsDocument(null)).toEqual(
      getDefaultAdminPricingCustomRowsDocument()
    );
  });

  it("recomputes canonical variant ids from model-aware spec data", () => {
    expect(
      compactAdminPricingCustomRowsDocument({
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
      } as never)
    ).toEqual({
      schemaVersion: 1,
      rowsByModel: {
        "fal-ai/flux-2/klein/9b": [
          {
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
          },
        ],
      },
    });
  });

  it("keeps multiple custom rows that resolve to the same canonical variant when display ids differ", () => {
    expect(
      compactAdminPricingCustomRowsDocument({
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
      } as never).rowsByModel["fal-ai/flux-2/klein/9b"]
    ).toHaveLength(2);
  });
});
