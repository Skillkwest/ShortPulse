/**
 * Standard message renderer tests.
 * Verifies Standard presentation policy stays separate for assistant and user messages.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PulseGuidedMessageBody } from "../../PulseGuidedMessageBody";
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

  it("promotes a trailing section label into a heading when the next block is a list", () => {
    render(
      <StandardMessageRenderer
        content={
          "Lighting should feel ceremonial and silhouette-first. Avoid:\n\n- bright frontal fill\n- over-revealed skin"
        }
        tone="assistant"
      />
    );

    expect(
      screen.getByText("Lighting should feel ceremonial and silhouette-first.", { exact: true })
    ).toBeInTheDocument();
    expect(screen.getByText("Avoid")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.queryByText("Lighting should feel ceremonial and silhouette-first. Avoid:")
    ).not.toBeInTheDocument();
  });

  it("renders Standard assistant bare URLs as clickable links", () => {
    render(
      <StandardMessageRenderer
        content={"Here’s the Instagram link:\n\nhttps://www.instagram.com/kirk_artman/"}
        tone="assistant"
      />
    );

    const link = screen.getByRole("link", {
      name: "https://www.instagram.com/kirk_artman/",
    });
    expect(link).toHaveClass("agent-message-rich-link");
    expect(link).toHaveAttribute("href", "https://www.instagram.com/kirk_artman/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Standard assistant bare domains as clickable https links", () => {
    render(
      <StandardMessageRenderer
        content={"Go directly by entering this in your browser: `instagram.com/kirkartman`."}
        tone="assistant"
      />
    );

    const link = screen.getByRole("link", {
      name: "instagram.com/kirkartman",
    });
    expect(link).toHaveAttribute("href", "https://instagram.com/kirkartman");
  });

  it("renders Standard assistant source domains as clickable links", () => {
    render(
      <StandardMessageRenderer
        content={"Closest result was a creator page. (nextlevelpfc.com)"}
        tone="assistant"
      />
    );

    const link = screen.getByRole("link", { name: "nextlevelpfc.com" });
    expect(link).toHaveAttribute("href", "https://nextlevelpfc.com");
  });

  it("renders Standard assistant markdown URLs as clickable links", () => {
    render(
      <StandardMessageRenderer
        content={"Closest confirmed profile: [Skool profile](https://www.skool.com/@kirkartman)."}
        tone="assistant"
      />
    );

    const link = screen.getByRole("link", { name: "Skool profile" });
    expect(link).toHaveAttribute("href", "https://www.skool.com/@kirkartman");
  });

  it("renders Standard assistant markdown links without a scheme as clickable https links", () => {
    render(
      <StandardMessageRenderer
        content={"Try [the direct Instagram handle](instagram.com/kirkartman)."}
        tone="assistant"
      />
    );

    const link = screen.getByRole("link", { name: "the direct Instagram handle" });
    expect(link).toHaveAttribute("href", "https://instagram.com/kirkartman");
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

  it("does not linkify Standard user URLs", () => {
    render(<StandardMessageRenderer content="Check https://example.com/user-input" tone="user" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Check https://example.com/user-input")).toBeInTheDocument();
  });

  it("does not leak Standard assistant linkification into Pulse guided messages", () => {
    render(<PulseGuidedMessageBody content="Check https://example.com/pulse" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Check https://example.com/pulse")).toBeInTheDocument();
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
