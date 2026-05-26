import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  AiStudioModalActivityProvider,
  useAiStudioAnyModalOpen,
  useAiStudioModalActivity,
} from "../modal-layer/AiStudioModalLayer";

function ModalOpenProbe({ isOpen }: { isOpen: boolean }) {
  useAiStudioModalActivity("detail-modal-test", isOpen);
  const isAnyModalOpen = useAiStudioAnyModalOpen();

  return <div data-testid="modal-open-state">{String(isAnyModalOpen)}</div>;
}

describe("AiStudioModalLayer modal activity", () => {
  it("tracks whether any AI Studio modal is open", async () => {
    const { rerender } = render(
      <AiStudioModalActivityProvider>
        <ModalOpenProbe isOpen={false} />
      </AiStudioModalActivityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-open-state")).toHaveTextContent("false");
    });

    rerender(
      <AiStudioModalActivityProvider>
        <ModalOpenProbe isOpen />
      </AiStudioModalActivityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-open-state")).toHaveTextContent("true");
    });

    rerender(
      <AiStudioModalActivityProvider>
        <ModalOpenProbe isOpen={false} />
      </AiStudioModalActivityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("modal-open-state")).toHaveTextContent("false");
    });
  });
});
