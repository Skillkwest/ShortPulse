import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyReferenceProjectionState } from "../../reference-projections";
import { useAiStudioRuntimeAuthorityUiState } from "../useAiStudioRuntimeAuthorityUiState";

type ProbeState = {
  activeOutputId: string | null;
  quickSlotIds: string[];
  saved: boolean;
};

const AuthorityProbe = ({
  authorityKey,
  onState,
  restoreDuringLayout,
}: {
  authorityKey: string;
  onState: (state: ProbeState) => void;
  restoreDuringLayout: boolean;
}) => {
  const [activeOutputId, setActiveOutputId] = React.useState<string | null>(null);
  const [referenceProjectionState, setReferenceProjectionState] = React.useState(
    createEmptyReferenceProjectionState
  );
  const [saved, setSaved] = React.useState(false);
  const sessionHydrationSigningRevisionRef = React.useRef(0);
  const setOutputCollectionsForAuthority = React.useCallback(() => undefined, []);
  const { setRuntimeUiStateForCreateMode } = useAiStudioRuntimeAuthorityUiState({
    activeOutputId,
    baseRuntimeAuthorityKey: authorityKey,
    referenceProjectionState,
    runtimeAuthorityKey: authorityKey,
    saved,
    sessionHydrationSigningRevisionRef,
    setActiveOutputId,
    setOutputCollectionsForAuthority,
    setReferenceProjectionState,
    setSaved,
  });

  React.useLayoutEffect(() => {
    if (!restoreDuringLayout) return;
    setRuntimeUiStateForCreateMode("standard", {
      activeOutputId: "out-1",
      referenceProjectionState: {
        quickSlotIds: ["out-1"],
        removedFromAllRefsIds: [],
      },
      saved: true,
    });
  }, [restoreDuringLayout, setRuntimeUiStateForCreateMode]);

  React.useEffect(() => {
    onState({
      activeOutputId,
      quickSlotIds: referenceProjectionState.quickSlotIds,
      saved,
    });
  }, [activeOutputId, onState, referenceProjectionState.quickSlotIds, saved]);

  return null;
};

describe("useAiStudioRuntimeAuthorityUiState", () => {
  it("keeps restored Quick Slot state queued during project authority activation", async () => {
    const states: ProbeState[] = [];
    const onState = vi.fn((state: ProbeState) => {
      states.push(state);
    });

    const { rerender } = render(
      <AuthorityProbe
        authorityKey="project:pending"
        onState={onState}
        restoreDuringLayout={false}
      />
    );

    rerender(
      <AuthorityProbe
        authorityKey="project:restored"
        onState={onState}
        restoreDuringLayout={true}
      />
    );

    await waitFor(() => {
      expect(states.at(-1)).toEqual({
        activeOutputId: "out-1",
        quickSlotIds: ["out-1"],
        saved: true,
      });
    });
  });
});
