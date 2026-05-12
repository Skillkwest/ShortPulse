import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpertEditStageContextMenu } from "../ExpertEditStagePrimitives";

describe("ExpertEditStageContextMenu", () => {
  it("separates centering from destructive full reset", () => {
    const onResetView = vi.fn();
    const onReset = vi.fn();

    render(
      <ExpertEditStageContextMenu
        menuRef={{ current: null }}
        x={24}
        y={48}
        isMarkupExpandSelected={false}
        hasSelectedLayerImage
        onResetView={onResetView}
        onExpand={vi.fn()}
        onAddImage={vi.fn()}
        onReset={onReset}
        onRemoveImage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Center" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset All" }));

    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
