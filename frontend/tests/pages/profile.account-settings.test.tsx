/**
 * Profile account settings page tests for autosave toggle wiring.
 */
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../pages/profile";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaAutosavePreferenceMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());

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
  useRouter: () => ({
    query: { section: "account" },
    isReady: true,
    pathname: "/profile",
    replace: routerReplaceMock,
  }),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: useProtectedRouteMock,
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: useCreditsMock,
}));

vi.mock("../../features/ai-studio/hooks/useMediaAutosavePreference", () => ({
  useMediaAutosavePreference: useMediaAutosavePreferenceMock,
}));

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
}));

describe("Profile account settings autosave toggle", () => {
  beforeEach(() => {
    useProtectedRouteMock.mockReturnValue({ loading: false, user: null });
    useCreditsMock.mockReturnValue({
      balanceCents: 0,
      balanceUpdatedAt: null,
      balanceLoading: false,
      refreshBalance: vi.fn(),
    });
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
  });

  it("renders autosave preference card in account settings", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("heading", { name: "Media Library autosave" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disable Media Library autosave" })
    ).toBeInTheDocument();
  });

  it("renders restored account presentation classes without relying on browser defaults", () => {
    render(<ProfilePage />);

    expect(screen.getByRole("main")).toHaveClass("profile-page-shell");
    expect(screen.getByLabelText("Display name")).toHaveClass("profile-input");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveClass("is-active");
    expect(screen.getByText("Profile").closest(".profile-account-grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Account summary")).toBeInTheDocument();
  });

  it("omits left-side helper copy from account panels", () => {
    render(<ProfilePage />);

    expect(
      screen.queryByText("This name appears in your dashboard and account records.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Email changes require your current password and must be confirmed from your inbox."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Control whether eligible AI Studio media is automatically saved to your Media Library."
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Autosave is ON/)).not.toBeInTheDocument();
  });

  it("places Media Library autosave in the first desktop account row", () => {
    const sectionCss = readFileSync("styles/workspace-profile-sections.css", "utf8");
    const normalizedCss = sectionCss.replace(/\s+/g, " ");

    expect(normalizedCss).toContain('"profile email security autosave"');
    expect(normalizedCss).toContain('"billing billing billing billing"');
    expect(normalizedCss).not.toContain('"autosave . ."');
  });

  it("keeps account console hero and metric surfaces compact", () => {
    const sectionCss = readFileSync("styles/workspace-profile-sections.css", "utf8");
    const normalizedCss = sectionCss.replace(/\s+/g, " ");

    expect(normalizedCss).toContain(".profile-credit-hero-value { font-size: 32px;");
    expect(normalizedCss).toContain(".profile-hero-value { font-size: 30px;");
    expect(normalizedCss).toContain("min-height: 62px;");
    expect(normalizedCss).not.toContain("font-size: 46px;");
    expect(normalizedCss).not.toContain("font-size: 42px;");
    expect(normalizedCss).not.toContain("0 18px 42px");
  });

  it("keeps desktop hero metric chips in a single row", () => {
    const sectionCss = readFileSync("styles/workspace-profile-sections.css", "utf8");
    const responsiveCss = readFileSync("styles/workspace-profile-responsive.css", "utf8");
    const normalizedSectionCss = sectionCss.replace(/\s+/g, " ");
    const normalizedResponsiveCss = responsiveCss.replace(/\s+/g, " ");

    expect(normalizedSectionCss).toContain(".profile-hero-meta { display: grid;");
    expect(normalizedSectionCss).toContain("grid-auto-flow: column;");
    expect(normalizedSectionCss).toContain("grid-auto-columns: minmax(118px, 1fr);");
    expect(normalizedSectionCss).not.toContain(
      "grid-template-columns: repeat(3, minmax(0, 180px));"
    );
    expect(normalizedResponsiveCss).toContain("grid-auto-flow: row;");
  });

  it("uses profile-scoped subscription card overrides instead of changing public pricing cards", () => {
    const planCardCss = readFileSync("styles/subscription-plan-cards.css", "utf8");
    const normalizedCss = planCardCss.replace(/\s+/g, " ");

    expect(normalizedCss).toContain(
      ".profile-page .profile-subscription-plan-card.subscription-plan-card {"
    );
    expect(normalizedCss).toContain("border-radius: var(--profile-radius);");
    expect(normalizedCss).toContain(
      ".profile-page .profile-subscription-plan-card .subscription-plan-card-title {"
    );
    expect(normalizedCss).toContain("font-size: 18px;");
    expect(normalizedCss).toContain(".profile-page .pricing-interval-toggle {");
  });

  it("keeps browser-autofilled profile inputs on the dark account theme", () => {
    const sectionCss = readFileSync("styles/workspace-profile-sections.css", "utf8");
    const normalizedCss = sectionCss.replace(/\s+/g, " ");

    expect(normalizedCss).toContain("color-scheme: dark;");
    expect(normalizedCss).toContain(".profile-input:-webkit-autofill");
    expect(normalizedCss).toContain("box-shadow: 0 0 0 1000px rgba(10, 14, 20, 0.96) inset;");
    expect(normalizedCss).toContain("-webkit-text-fill-color: var(--color-ash);");
  });

  it("keeps stale profile shell CSS from overriding restored inline page chrome", () => {
    const shellCss = readFileSync("styles/workspace-profile-shell.css", "utf8");

    expect(shellCss).not.toContain("background: transparent !important");
  });

  it("forwards toggle intent to media autosave setter", () => {
    const setMediaAutosaveEnabled = vi.fn();
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled,
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Disable Media Library autosave" }));
    expect(setMediaAutosaveEnabled).toHaveBeenCalledWith(false);
  });

  it("disables toggle while preference is loading or saving", () => {
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: true,
      syncState: "ready",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });

    const { rerender } = render(<ProfilePage />);
    expect(screen.getByRole("button", { name: "Disable Media Library autosave" })).toBeDisabled();

    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "saving",
      error: null,
      setMediaAutosaveEnabled: vi.fn(),
    });
    rerender(<ProfilePage />);

    expect(screen.getByRole("button", { name: "Disable Media Library autosave" })).toBeDisabled();
    expect(screen.getByText("Saving autosave preference...")).toBeInTheDocument();
  });

  it("shows inline autosave sync errors", () => {
    useMediaAutosavePreferenceMock.mockReturnValue({
      mediaAutosaveEnabled: true,
      loading: false,
      syncState: "error",
      error: "Unable to update media autosave preference",
      setMediaAutosaveEnabled: vi.fn(),
    });

    render(<ProfilePage />);
    expect(screen.getByText("Unable to update media autosave preference")).toBeInTheDocument();
  });
});
