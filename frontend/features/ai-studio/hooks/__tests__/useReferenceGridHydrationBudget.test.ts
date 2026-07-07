import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridHydrationBudget } from "../useReferenceGridHydrationBudget";

type MockMediaQueryList = {
  matches: boolean;
  media: string;
  onchange: ((event: MediaQueryListEvent) => void) | null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
  emitChange: (matches: boolean) => void;
};

type MockNavigatorConnection = {
  saveData: boolean;
  effectiveType: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  emitChange: () => void;
};

const createMockMediaQueryList = (query: string, initialMatches = false): MockMediaQueryList => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    matches: initialMatches,
    media: query,
    onchange: null,
    addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    emitChange(matches: boolean) {
      this.matches = matches;
      const event = {
        matches,
        media: query,
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
      this.onchange?.(event);
    },
  };
};

const createConnection = (
  overrides: Partial<MockNavigatorConnection> = {}
): MockNavigatorConnection => {
  const listeners = new Set<EventListenerOrEventListenerObject>();
  return {
    saveData: false,
    effectiveType: "4g",
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.delete(listener);
    }),
    emitChange() {
      listeners.forEach((listener) => {
        if (typeof listener === "function") {
          listener(new Event("change"));
          return;
        }
        listener.handleEvent(new Event("change"));
      });
    },
    ...overrides,
  };
};

describe("useReferenceGridHydrationBudget", () => {
  const originalNavigator = window.navigator;
  let mediaQueryList: MockMediaQueryList;
  let resizeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mediaQueryList = createMockMediaQueryList("(max-width: 900px)");
    resizeSpy = vi.spyOn(window, "addEventListener");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => mediaQueryList),
    });
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  afterEach(() => {
    resizeSpy.mockRestore();
    vi.restoreAllMocks();
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  it("derives constrained profile from media query and connection changes without a resize listener", async () => {
    const connection = createConnection();
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        deviceMemory: 8,
        connection,
      },
    });

    const { result } = renderHook(() =>
      useReferenceGridHydrationBudget({
        enabled: true,
        pressureLevel: 0,
      })
    );

    expect(result.current.constrainedProfile).toBe(false);
    expect(result.current.smallScreen).toBe(false);
    expect(result.current.maxInflightHydrations).toBe(6);
    expect(resizeSpy).not.toHaveBeenCalledWith("resize", expect.any(Function), undefined);

    act(() => {
      mediaQueryList.emitChange(true);
    });

    await waitFor(() => {
      expect(result.current.smallScreen).toBe(true);
    });

    act(() => {
      connection.effectiveType = "2g";
      connection.emitChange();
    });

    await waitFor(() => {
      expect(result.current.constrainedProfile).toBe(true);
      expect(result.current.maxInflightHydrations).toBe(2);
    });
  });

  it("keeps pressure-level caps layered on top of constrained profiles", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        deviceMemory: 2,
        connection: createConnection({ saveData: true }),
      },
    });

    const { result } = renderHook(() =>
      useReferenceGridHydrationBudget({
        enabled: true,
        pressureLevel: 2,
      })
    );

    expect(result.current.constrainedProfile).toBe(true);
    expect(result.current.maxInflightHydrations).toBe(1);
    expect(result.current.priorityRows).toBe(1);
  });
});
