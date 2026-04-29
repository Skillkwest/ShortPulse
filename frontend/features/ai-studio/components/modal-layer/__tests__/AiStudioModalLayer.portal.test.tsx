/**
 * Regression coverage for unconditional AI Studio modal portal mounting.
 * Verifies modal z-order is not tied to the modal activity perf flag.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logic/perfProfileFlags", () => ({
  PERF_FLAG_MODAL_STABILITY_V1: false,
}));

import { AiStudioModalLayer } from "../AiStudioModalLayer";

const MODAL_LAYER_ROOT_ID = "ai-studio-modal-layer-root";

afterEach(() => {
  document.getElementById(MODAL_LAYER_ROOT_ID)?.remove();
});

describe("AiStudioModalLayer portal mounting", () => {
  it("mounts modal content through the shared portal root when activity tracking is disabled", async () => {
    render(
      <AiStudioModalLayer>
        <div data-testid="portal-child">Portal child</div>
      </AiStudioModalLayer>
    );

    const portalChild = await screen.findByTestId("portal-child");
    const portalRoot = document.getElementById(MODAL_LAYER_ROOT_ID);

    expect(portalRoot).not.toBeNull();
    expect(portalRoot?.contains(portalChild)).toBe(true);
  });
});
