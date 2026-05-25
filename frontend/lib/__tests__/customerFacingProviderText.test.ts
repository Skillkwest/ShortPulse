import { describe, expect, it } from "vitest";
import {
  extractCustomerFacingProviderError,
  normalizeCustomerFacingProviderError,
} from "../customerFacingProviderText";

describe("customerFacingProviderText", () => {
  it("extracts readable field validation copy from structured provider payloads", () => {
    expect(
      extractCustomerFacingProviderError({
        detail: [
          {
            loc: ["prompt"],
            msg: "Field required",
            type: "missing",
          },
        ],
      })
    ).toBe("Prompt is required.");
  });

  it("extracts readable field validation copy from JSON error strings", () => {
    expect(
      normalizeCustomerFacingProviderError(
        '{"detail":[{"loc":["prompt"],"msg":"Field required","type":"missing"}]}',
        "Generation failed."
      )
    ).toBe("Prompt is required.");
  });

  it("humanizes simple provider reason codes", () => {
    expect(
      normalizeCustomerFacingProviderError(
        {
          reason: "bad_input",
        },
        "Generation failed."
      )
    ).toBe("bad input");
  });
});
