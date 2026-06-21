/**
 * Locks the public legal policy routes to the runtime-backed legal policy renderer.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { GetServerSideProps } from "next";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage, { getServerSideProps as getPrivacyServerSideProps } from "../../pages/privacy";
import RefundPolicyPage, {
  getServerSideProps as getRefundPolicyServerSideProps,
} from "../../pages/refund-policy";
import TermsPage, { getServerSideProps as getTermsServerSideProps } from "../../pages/terms";

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

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

type StaticPropsShape = Record<string, unknown>;
type ServerSidePropsResult<T extends StaticPropsShape> = Awaited<ReturnType<GetServerSideProps<T>>>;

async function loadServerSideProps<T extends StaticPropsShape>(
  getServerSideProps: GetServerSideProps<T>
): Promise<T> {
  const result = (await getServerSideProps({
    res: { statusCode: 200 },
  } as never)) as ServerSidePropsResult<T>;
  if (!("props" in result)) {
    throw new Error("Expected server-side props for legal policy page.");
  }
  return result.props as T;
}

describe("public legal policy pages", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the Terms of Service route from the canonical markdown content", async () => {
    const props = await loadServerSideProps(getTermsServerSideProps);

    render(<TermsPage {...props} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ShortPulse Terms of Service" })
    ).toBeInTheDocument();
    expect(screen.getByText("Last updated: June 21, 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "1. Who We Are" })).toBeInTheDocument();
    expect(screen.getByText(/refer to \[LEGAL ENTITY NAME\]/i)).toBeInTheDocument();
  });

  it("renders the Privacy Policy route with legal navigation", async () => {
    const props = await loadServerSideProps(getPrivacyServerSideProps);

    render(<PrivacyPage {...props} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ShortPulse Privacy Policy" })
    ).toBeInTheDocument();
    expect(screen.getByText(/privacy-rights intake/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms"
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.getByRole("link", { name: "Refund Policy" })).toHaveAttribute(
      "href",
      "/refund-policy"
    );
  });

  it("renders the Refund Policy route from the canonical markdown content", async () => {
    const props = await loadServerSideProps(getRefundPolicyServerSideProps);

    render(<RefundPolicyPage {...props} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ShortPulse Refund Policy" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "1. Summary" })).toBeInTheDocument();
    expect(screen.getByText(/payments are non-refundable once charged/i)).toBeInTheDocument();
  });
});
