import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../AppErrorBoundary";

vi.mock("../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(async () => undefined),
}));

const ThrowOnRender = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe("AppErrorBoundary", () => {
  it("shows generic user-facing recovery copy instead of raw render errors", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <ThrowOnRender message="Maximum update depth exceeded" />
      </AppErrorBoundary>
    );

    expect(screen.getByText("We hit a rendering error")).toBeInTheDocument();
    expect(
      screen.getByText("Please reload the page or try again in a moment.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Maximum update depth exceeded")).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
