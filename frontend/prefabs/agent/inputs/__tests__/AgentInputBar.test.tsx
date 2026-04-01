import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentInputBar } from "../AgentInputBar";

class MockResizeObserver {
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

describe("AgentInputBar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses ResizeObserver without attaching a window resize listener when available", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    render(<AgentInputBar value="" onChange={() => undefined} />);

    expect(addEventListenerSpy).not.toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("falls back to a window resize listener when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    render(<AgentInputBar value="" onChange={() => undefined} />);

    expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
