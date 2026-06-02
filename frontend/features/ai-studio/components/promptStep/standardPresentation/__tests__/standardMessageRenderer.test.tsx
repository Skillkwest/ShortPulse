/**
 * Standard message renderer tests.
 * Verifies Standard presentation policy stays separate for assistant and user messages.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StandardMessageRenderer } from "../standardMessageRenderer";
import { parseStandardMessagePresentation } from "../standardMessageParser";

describe("StandardMessageRenderer", () => {
  it("keeps Standard assistant formatting on the standard rich contract", () => {
    render(
      <StandardMessageRenderer
        content={"# Direction\n\n1. Lock the tone\n2. Clarify the reveal"}
        tone="assistant"
      />
    );

    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("keeps Standard user content on the basic contract", () => {
    render(
      <StandardMessageRenderer
        content={
          "Note:\nKeep the tone grounded.\n\n---\n\nIf you want, save the reveal for the end."
        }
        tone="user"
      />
    );

    expect(
      screen.getByText((_, node) => node?.textContent === "Note:\nKeep the tone grounded.")
    ).toBeInTheDocument();
    expect(screen.queryByText("If you want, save the reveal for the end.")).toBeInTheDocument();
  });

  it("parses the Standard presentation policy without changing message content", () => {
    expect(
      parseStandardMessagePresentation({
        content: "Hello there",
        tone: "assistant",
      })
    ).toEqual({
      content: "Hello there",
      formatMode: "standard_rich",
      tone: "assistant",
    });
    expect(
      parseStandardMessagePresentation({
        content: "Hello there",
        tone: "user",
      })
    ).toEqual({
      content: "Hello there",
      formatMode: "basic",
      tone: "user",
    });
  });
});
