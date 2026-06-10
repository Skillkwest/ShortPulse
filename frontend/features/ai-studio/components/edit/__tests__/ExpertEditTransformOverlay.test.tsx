import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpertEditTransformOverlay } from "../ExpertEditTransformOverlay";

describe("ExpertEditTransformOverlay", () => {
  it("publishes inverse handle scale while the overlay follows the selected layer scale", () => {
    render(
      <ExpertEditTransformOverlay
        scope="inline"
        viewportWidth={400}
        viewportHeight={400}
        imageAspectRatio={1}
        transform={{
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 0.25,
          rotationDeg: 0,
        }}
      />
    );

    const overlay = screen.getByTestId("edit-expert-transform-overlay-inline");

    expect(overlay.style.transform).toContain("scale(0.25)");
    expect(overlay.style.getPropertyValue("--edit-expert-transform-handle-counter-scale")).toBe(
      "4"
    );
  });
});
