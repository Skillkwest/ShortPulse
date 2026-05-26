import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CharacterProfileLoadingSkeleton } from "../CharacterProfileLoadingSkeleton";

describe("CharacterProfileLoadingSkeleton", () => {
  it("renders the compact character panel loading shape instead of the retired split shell", () => {
    const { container } = render(<CharacterProfileLoadingSkeleton surface="panel" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading character profile...");
    expect(
      screen.getByText("Pulling your character sheet and references into view.")
    ).toBeInTheDocument();

    expect(container.querySelector('[data-skeleton-row="actions"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-button="characters"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-button="save"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-button="create"]')).not.toBeNull();

    expect(container.querySelector('[data-skeleton-field="name"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-section="looks"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-looks-rail="true"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-looks-tabs="true"]')).not.toBeNull();

    expect(container.querySelector('[data-skeleton-section="description"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-description-box="true"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton-reference-grid="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-skeleton-reference-card="true"]')).toHaveLength(3);

    expect(container.querySelectorAll("[data-layout-region]")).toHaveLength(0);
  });
});
