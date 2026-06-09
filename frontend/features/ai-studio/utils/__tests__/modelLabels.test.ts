/**
 * Unit coverage for compact AI Studio model selector display labels.
 */
import { describe, expect, it } from "vitest";

import { stripEditLabel } from "../modelLabels";

describe("stripEditLabel", () => {
  it("removes edit and provider suffixes from compact selector labels", () => {
    expect(stripEditLabel("GPT Image 2 Edit (Kie)")).toBe("GPT Image 2");
    expect(stripEditLabel("GPT Image 2 Edit (Chi.ai)")).toBe("GPT Image 2");
    expect(stripEditLabel("Nano Banana 2 Edit")).toBe("Nano Banana 2");
    expect(stripEditLabel("GPT Image 2 (Kie)")).toBe("GPT Image 2");
  });
});
