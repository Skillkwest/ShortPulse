/**
 * Saved creators route tests for auth redirects, route-owned list orchestration, and body state.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SavedCreatorsPage from "../../pages/saved-creators";

const replaceMock = vi.hoisted(() => vi.fn());
const fetchCreatorsMock = vi.hoisted(() => vi.fn());
const insertCreatorMock = vi.hoisted(() => vi.fn());
const deleteCreatorMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({
  replace: replaceMock,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("../../features/saved-creators/logic/supabase", () => ({
  AUTH_REQUIRED_ERROR: "AUTH_REQUIRED",
  fetchCreators: (...args: unknown[]) => fetchCreatorsMock(...args),
  insertCreator: (...args: unknown[]) => insertCreatorMock(...args),
  deleteCreator: (...args: unknown[]) => deleteCreatorMock(...args),
}));

const initialCreators = [
  {
    id: "creator-1",
    handle: "alphaeditor",
    platform: "Instagram",
    followers: 42000,
    avgViews: 130000,
    videosTracked: 18,
    avatarUrl: null,
  },
  {
    id: "creator-2",
    handle: "betafitness",
    platform: "TikTok",
    followers: 98000,
    avgViews: 310000,
    videosTracked: 26,
    avatarUrl: null,
  },
] as const;

describe("Saved creators route behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCreatorsMock.mockResolvedValue([...initialCreators]);
    insertCreatorMock.mockResolvedValue({
      id: "creator-3",
      handle: "newcreator",
      platform: "YouTube",
      followers: 1200,
      avgViews: 8700,
      videosTracked: 3,
      avatarUrl: null,
    });
    deleteCreatorMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.classList.remove("saved-creators-body");
    document.documentElement.classList.remove("saved-creators-body");
  });

  it("adds and removes the saved-creators body classes", async () => {
    const { unmount } = render(<SavedCreatorsPage />);

    await screen.findByText("@alphaeditor");

    expect(document.body.classList.contains("saved-creators-body")).toBe(true);
    expect(document.documentElement.classList.contains("saved-creators-body")).toBe(true);

    unmount();

    expect(document.body.classList.contains("saved-creators-body")).toBe(false);
    expect(document.documentElement.classList.contains("saved-creators-body")).toBe(false);
  });

  it("redirects to /auth when loading creators requires authentication", async () => {
    fetchCreatorsMock.mockRejectedValue(new Error("AUTH_REQUIRED"));

    render(<SavedCreatorsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/auth");
    });
  });

  it("adds a creator, clears the handle field, and filters the rendered list", async () => {
    render(<SavedCreatorsPage />);

    await screen.findByText("@alphaeditor");

    fireEvent.change(screen.getByLabelText("Creator handle"), {
      target: { value: "newcreator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Platform" }));
    fireEvent.click(screen.getByRole("option", { name: "YouTube" }));
    fireEvent.click(screen.getByRole("button", { name: "Add creator" }));

    await waitFor(() => {
      expect(insertCreatorMock).toHaveBeenCalledWith({
        handle: "newcreator",
        platform: "YouTube",
      });
    });

    expect(screen.getByLabelText("Creator handle")).toHaveValue("");
    expect(
      screen.getAllByText((_, element) => element?.textContent === "@newcreator").length
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Search creators"), {
      target: { value: "beta" },
    });

    expect(
      screen.getAllByText((_, element) => element?.textContent === "@betafitness").length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText((_, element) => element?.textContent === "@alphaeditor")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((_, element) => element?.textContent === "@newcreator")
    ).not.toBeInTheDocument();
  });

  it("redirects to /auth when removing a creator loses authentication", async () => {
    deleteCreatorMock.mockRejectedValue(new Error("AUTH_REQUIRED"));

    render(<SavedCreatorsPage />);

    await screen.findByText("@alphaeditor");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    await waitFor(() => {
      expect(deleteCreatorMock).toHaveBeenCalledWith("creator-1");
      expect(replaceMock).toHaveBeenCalledWith("/auth");
    });
  });
});
