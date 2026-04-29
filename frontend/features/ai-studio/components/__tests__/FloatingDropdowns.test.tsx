/**
 * Regression coverage for AI Studio floating dropdown menus.
 * Ensures menus escape local stacking and overflow contexts by mounting through document.body.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import type { AspectOption } from "../../types";

const aspectOptions: AspectOption[] = [
  { value: "9:16", ratioLabel: "9:16", name: "Vertical", orientation: "vertical" },
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
];

const mockElementRect = (element: Element, rect: Partial<DOMRect>) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: rect.left ?? 200,
        y: rect.top ?? 700,
        left: rect.left ?? 200,
        top: rect.top ?? 700,
        right: rect.right ?? 320,
        bottom: rect.bottom ?? 740,
        width: rect.width ?? 120,
        height: rect.height ?? 40,
        toJSON: () => ({}),
      }) as DOMRect,
  });
};

describe("AI Studio floating dropdowns", () => {
  it("mounts the aspect menu through document.body with modal-level z-order", async () => {
    render(
      <div data-testid="local-host">
        <AspectDropdown aspect="9:16" onSelect={() => undefined} options={aspectOptions} />
      </div>
    );

    const trigger = screen.getByRole("button", { name: /9:16/i });
    mockElementRect(trigger, { left: 480, top: 900, bottom: 940, width: 160, right: 640 });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("listbox");

    expect(screen.getByTestId("local-host").contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
    expect(menu).toHaveStyle({ position: "fixed", zIndex: "1230" });
  });

  it("mounts the resolution menu through document.body with modal-level z-order", async () => {
    render(
      <div data-testid="local-host">
        <ResolutionDropdown
          value="medium"
          options={[
            { value: "low", label: "low" },
            { value: "medium", label: "medium" },
            { value: "high", label: "high" },
          ]}
          onSelect={() => undefined}
        />
      </div>
    );

    const trigger = screen.getByRole("button", { name: /image resolution/i });
    mockElementRect(trigger, { left: 760, top: 900, bottom: 940, width: 120, right: 880 });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("listbox", { name: /image resolution/i });

    expect(screen.getByTestId("local-host").contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
    expect(menu).toHaveStyle({ position: "fixed", zIndex: "1230" });
  });
});
