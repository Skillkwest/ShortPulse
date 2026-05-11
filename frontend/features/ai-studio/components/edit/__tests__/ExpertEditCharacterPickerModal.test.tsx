import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpertEditCharacterPickerModal } from "../ExpertEditCharacterPickerModal";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
    return <div data-testid="mock-next-image" {...forwarded} />;
  },
}));

vi.mock("../../modal-layer/AiStudioModalLayer", () => ({
  AiStudioModalLayer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAiStudioModalActivity: () => false,
}));

vi.mock("../../../hooks/useAvatarResilience", () => ({
  useAvatarResilience: () => ({
    resolveAvatarUrl: (_id: string, url: string | null) => url,
    clearAvatarFailure: vi.fn(),
    handleAvatarError: vi.fn(async () => undefined),
  }),
}));

describe("ExpertEditCharacterPickerModal", () => {
  it("renders the shared picker frame and preserves character selection behavior", () => {
    const onClose = vi.fn();
    const onSelectedCharacterIdChange = vi.fn();

    render(
      <ExpertEditCharacterPickerModal
        isOpen
        characterModeEnabled
        isCharacterOptionsLoading={false}
        onClose={onClose}
        characterOptions={[
          {
            id: "char-1",
            name: "Taylor",
            profileImageUrl: "https://example.com/taylor.png",
          },
        ]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
      />
    );

    expect(screen.getByRole("dialog", { name: "Choose character" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /taylor/i }));

    expect(onSelectedCharacterIdChange).toHaveBeenCalledWith("char-1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
