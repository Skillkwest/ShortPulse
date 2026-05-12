import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpertEditMarkupModalGeneralPanel } from "../ExpertEditStageControls";

describe("ExpertEditMarkupModalGeneralPanel", () => {
  it("labels the destructive general reset action explicitly", () => {
    render(
      <ExpertEditMarkupModalGeneralPanel
        aspect="9:16"
        aspectOptionsForModel={[]}
        canUndoGeneralAction
        canRedoGeneralAction
        isGeneralResetDisabled={false}
        onAspectChange={vi.fn()}
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
        handleResetGeneralAction={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Reset all edit work",
      })
    ).toHaveTextContent("Reset All");
  });
});
