/**
 * Unit coverage for AI Studio modal layer primitives.
 * Verifies portal mount behavior and aggregated modal-open activity tracking.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logic/perfProfileFlags", () => ({
  PERF_FLAG_MODAL_STABILITY_V1: true,
}));

import {
  AiStudioModalActivityProvider,
  AiStudioModalLayer,
  useAiStudioAnyModalOpen,
  useAiStudioModalActivity,
} from "../AiStudioModalLayer";

const MODAL_LAYER_ROOT_ID = "ai-studio-modal-layer-root";

type ModalProbeProps = {
  modalId: string;
  isOpen: boolean;
};

const ModalProbe = ({ modalId, isOpen }: ModalProbeProps) => {
  useAiStudioModalActivity(modalId, isOpen);
  return null;
};

const ModalOpenStateProbe = () => {
  const isAnyModalOpen = useAiStudioAnyModalOpen();
  return <span data-testid="modal-open-state">{isAnyModalOpen ? "open" : "closed"}</span>;
};

afterEach(() => {
  document.getElementById(MODAL_LAYER_ROOT_ID)?.remove();
});

describe("AiStudioModalLayer", () => {
  it("tracks modal-open activity for single and nested modal states", () => {
    const { rerender } = render(
      <AiStudioModalActivityProvider>
        <ModalOpenStateProbe />
        <ModalProbe modalId="modal-a" isOpen={false} />
        <ModalProbe modalId="modal-b" isOpen={false} />
      </AiStudioModalActivityProvider>
    );

    expect(screen.getByTestId("modal-open-state")).toHaveTextContent("closed");

    rerender(
      <AiStudioModalActivityProvider>
        <ModalOpenStateProbe />
        <ModalProbe modalId="modal-a" isOpen />
        <ModalProbe modalId="modal-b" isOpen={false} />
      </AiStudioModalActivityProvider>
    );
    expect(screen.getByTestId("modal-open-state")).toHaveTextContent("open");

    rerender(
      <AiStudioModalActivityProvider>
        <ModalOpenStateProbe />
        <ModalProbe modalId="modal-a" isOpen />
        <ModalProbe modalId="modal-b" isOpen />
      </AiStudioModalActivityProvider>
    );
    expect(screen.getByTestId("modal-open-state")).toHaveTextContent("open");

    rerender(
      <AiStudioModalActivityProvider>
        <ModalOpenStateProbe />
        <ModalProbe modalId="modal-a" isOpen={false} />
        <ModalProbe modalId="modal-b" isOpen />
      </AiStudioModalActivityProvider>
    );
    expect(screen.getByTestId("modal-open-state")).toHaveTextContent("open");

    rerender(
      <AiStudioModalActivityProvider>
        <ModalOpenStateProbe />
        <ModalProbe modalId="modal-a" isOpen={false} />
        <ModalProbe modalId="modal-b" isOpen={false} />
      </AiStudioModalActivityProvider>
    );
    expect(screen.getByTestId("modal-open-state")).toHaveTextContent("closed");
  });

  it("mounts modal content through the shared portal root", () => {
    render(
      <AiStudioModalActivityProvider>
        <AiStudioModalLayer>
          <div data-testid="portal-child">Portal child</div>
        </AiStudioModalLayer>
      </AiStudioModalActivityProvider>
    );

    const portalRoot = document.getElementById(MODAL_LAYER_ROOT_ID);
    const portalChild = screen.getByTestId("portal-child");

    expect(portalRoot).not.toBeNull();
    expect(portalRoot?.contains(portalChild)).toBe(true);
  });
});
