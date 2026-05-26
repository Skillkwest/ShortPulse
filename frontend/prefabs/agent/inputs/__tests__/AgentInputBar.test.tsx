import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentInputBar } from "../AgentInputBar";

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  private static callbacks = new Set<ResizeObserverCallback>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.callbacks.add(callback);
  }

  observe() {
    return undefined;
  }
  disconnect() {
    MockResizeObserver.callbacks.delete(this.callback);
    return undefined;
  }

  static trigger() {
    for (const callback of MockResizeObserver.callbacks) {
      callback([], {} as ResizeObserver);
    }
  }

  static reset() {
    MockResizeObserver.callbacks.clear();
  }
}

describe("AgentInputBar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    MockResizeObserver.reset();
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

  it("caps textarea height at maxHeightPx and enables vertical scrolling when content exceeds it", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 900,
    });

    try {
      render(
        <AgentInputBar value="Long composer draft" onChange={() => undefined} maxHeightPx={520} />
      );

      expect(screen.getByRole("textbox")).toHaveStyle({
        height: "520px",
        overflowY: "auto",
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
    }
  });

  it("caps Create composer height against the available properties-panel space", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 900,
    });
    rectSpy.mockImplementation(function () {
      if (this instanceof HTMLTextAreaElement) {
        return {
          x: 0,
          y: 420,
          top: 420,
          bottom: 456,
          left: 0,
          right: 400,
          width: 400,
          height: 36,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if ((this as HTMLElement).classList?.contains("create-composer-right-panel-inner")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          bottom: 580,
          left: 0,
          right: 420,
          width: 420,
          height: 580,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 720,
        left: 0,
        right: 1280,
        width: 1280,
        height: 720,
        toJSON: () => ({}),
      } as DOMRect;
    });

    try {
      render(
        <div className="ai-properties">
          <div className="create-composer-panel">
            <div className="create-composer-right-panel-inner">
              <AgentInputBar
                value="Long composer draft"
                onChange={() => undefined}
                maxHeightPx={520}
              />
            </div>
          </div>
        </div>
      );

      expect(screen.getByRole("textbox")).toHaveStyle({
        height: "128px",
        overflowY: "auto",
      });
    } finally {
      rectSpy.mockRestore();
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
    }
  });

  it("collapses to min height on blur and re-expands on focus when collapse mode is enabled", async () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 220,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      render(
        <AgentInputBar
          value="Existing draft"
          onChange={() => undefined}
          maxHeightPx={520}
          collapseToMinHeightWhenBlurred
        />
      );

      const textbox = screen.getByRole("textbox");
      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "36px", overflowY: "hidden" });
      });

      fireEvent.focus(textbox);
      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });

      fireEvent.blur(textbox);
      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "36px", overflowY: "hidden" });
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

  it("collapses back to min height when the focused draft is cleared", async () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return (this as HTMLTextAreaElement).value.length === 0 ? 36 : 220;
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      const { rerender } = render(
        <AgentInputBar
          value="Existing draft"
          onChange={() => undefined}
          maxHeightPx={520}
          collapseToMinHeightWhenBlurred
        />
      );

      const textbox = screen.getByRole("textbox");
      fireEvent.focus(textbox);

      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });

      rerender(
        <AgentInputBar
          value=""
          onChange={() => undefined}
          maxHeightPx={520}
          collapseToMinHeightWhenBlurred
        />
      );

      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "36px", overflowY: "hidden" });
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

  it("reports the textarea visual row count from measured content height", async () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const onVisualRowCountChange = vi.fn();
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const lineHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "lineHeight"
    );
    const paddingTopDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingTop"
    );
    const paddingBottomDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingBottom"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 204,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", {
      configurable: true,
      get() {
        return "24px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", {
      configurable: true,
      get() {
        return "6px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingBottom", {
      configurable: true,
      get() {
        return "6px";
      },
    });

    try {
      render(
        <AgentInputBar
          value="Measured rows"
          onChange={() => undefined}
          onVisualRowCountChange={onVisualRowCountChange}
        />
      );

      await waitFor(() => {
        expect(onVisualRowCountChange).toHaveBeenLastCalledWith(8);
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
      if (lineHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", lineHeightDescriptor);
      }
      if (paddingTopDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", paddingTopDescriptor);
      }
      if (paddingBottomDescriptor) {
        Object.defineProperty(
          CSSStyleDeclaration.prototype,
          "paddingBottom",
          paddingBottomDescriptor
        );
      }
    }
  });

  it("shrinks the textarea when a wider layout reduces wrapping", async () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    let isWideLayout = false;
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        const currentHeight = (this as HTMLTextAreaElement).style.height;
        if (isWideLayout) {
          return currentHeight === "0px" ? 140 : 220;
        }
        return 220;
      },
    });

    try {
      render(
        <AgentInputBar value="Long composer draft" onChange={() => undefined} maxHeightPx={520} />
      );

      const textbox = screen.getByRole("textbox");
      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });

      isWideLayout = true;
      MockResizeObserver.trigger();

      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "140px", overflowY: "hidden" });
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
    }
  });
});
