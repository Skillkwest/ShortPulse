/**
 * Character route tests for page-owned shell wiring and lifecycle behavior.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const shellPropsSpy = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../features/character-manager/components/CharacterManagerShell", () => ({
  CharacterManagerShell: (props: Record<string, unknown>) => {
    shellPropsSpy(props);
    return <main id="main-content">Character shell</main>;
  },
}));

import CharacterPage from "../../pages/character";

describe("Character route behavior", () => {
  afterEach(() => {
    shellPropsSpy.mockReset();
    document.body.classList.remove("character-manager-body");
    document.documentElement.classList.remove("character-manager-body");
  });

  it("adds and removes character-manager body classes", () => {
    const { unmount } = render(<CharacterPage />);

    expect(document.body.classList.contains("character-manager-body")).toBe(true);
    expect(document.documentElement.classList.contains("character-manager-body")).toBe(true);

    unmount();

    expect(document.body.classList.contains("character-manager-body")).toBe(false);
    expect(document.documentElement.classList.contains("character-manager-body")).toBe(false);
  });

  it("renders the skip link and wires the shell with the route runtime policy", () => {
    render(<CharacterPage />);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content"
    );
    expect(screen.getByText("Character shell")).toBeInTheDocument();
    expect(shellPropsSpy).toHaveBeenCalledWith({
      beginnerModeOverride: false,
      showBeginnerModeToggle: false,
    });
  });
});
