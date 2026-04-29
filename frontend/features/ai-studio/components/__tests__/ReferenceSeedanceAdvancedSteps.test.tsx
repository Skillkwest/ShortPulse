import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceSeedanceAdvancedSteps } from "../ReferenceSeedanceAdvancedSteps";

describe("ReferenceSeedanceAdvancedSteps", () => {
  it("renders the Seedance 1.5 fixed-lens control", () => {
    const onVideoCameraFixedChange = vi.fn();

    render(
      <ReferenceSeedanceAdvancedSteps
        title="Seedance 1.5 Settings"
        isSeedance15Model
        videoCameraFixed={false}
        onVideoCameraFixedChange={onVideoCameraFixedChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Lock camera" }));

    expect(onVideoCameraFixedChange).toHaveBeenCalledWith(true);
  });
});
