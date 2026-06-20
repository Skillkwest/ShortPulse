/**
 * StylesControl tests.
 * Verifies selected-style previews come from the active runtime catalog, not static seed fallback.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StylesControl } from "../StylesControl";

describe("StylesControl", () => {
  it("does not resolve a selected style from the legacy seeded catalog when runtime styles are provided", () => {
    render(<StylesControl selectedStyleId="cinematic" styles={[]} />);

    const stylesButton = screen.getByRole("button", { name: "Styles" });

    expect(stylesButton).not.toHaveClass("has-selected-style");
    expect(stylesButton.querySelector(".edit-expert-styles-btn-preview")).toBeNull();
  });

  it("uses the active runtime catalog for selected style previews", () => {
    render(
      <StylesControl
        selectedStyleId="admin-style"
        styles={[
          {
            id: "admin-style",
            title: "Admin Style",
            previewUrl: "/Styles/Admin.png",
            placeholder: false,
          },
        ]}
      />
    );

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    const preview = stylesButton.querySelector(
      ".edit-expert-styles-btn-preview"
    ) as HTMLSpanElement | null;

    expect(stylesButton).toHaveClass("has-selected-style");
    expect(preview?.style.backgroundImage).toContain("/Styles/Admin.png");
  });
});
