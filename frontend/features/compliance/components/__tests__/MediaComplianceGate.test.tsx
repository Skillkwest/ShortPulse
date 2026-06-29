import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { MEDIA_COMPLIANCE_AGREEMENT } from "../../../../lib/compliance/mediaAgreement";
import { MediaComplianceGate } from "../MediaComplianceGate";

vi.mock("next/image", () => ({
  default: (props: { alt?: string; src?: string; className?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element -- Test shim for next/image.
    return <img alt={props.alt ?? ""} src={props.src} className={props.className} />;
  },
}));

const buildProps = (
  overrides: Partial<ComponentProps<typeof MediaComplianceGate>> = {}
): ComponentProps<typeof MediaComplianceGate> => ({
  agreement: MEDIA_COMPLIANCE_AGREEMENT,
  error: null,
  loading: false,
  onAccept: vi.fn().mockResolvedValue(undefined),
  onRetry: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("MediaComplianceGate", () => {
  it("shows direct unavailable copy and preserves retry behavior", () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <MediaComplianceGate
        {...buildProps({ mode: "unavailable", onRetry, showSecondaryAction: false })}
      />
    );

    expect(
      screen.getByText(
        "Media agreement status could not be verified right now. Try again in a moment."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses the configured secondary action when provided", () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const onSecondaryAction = vi.fn().mockResolvedValue(undefined);

    render(
      <MediaComplianceGate
        {...buildProps({
          onRetry,
          onSecondaryAction,
          secondaryActionLabel: "Sign out",
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
