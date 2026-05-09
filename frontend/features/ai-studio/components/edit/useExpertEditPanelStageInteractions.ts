import React from "react";

import { useExpertEditStageInteractions } from "./useExpertEditStageInteractions";

type UseExpertEditPanelStageInteractionsArgs = Parameters<typeof useExpertEditStageInteractions>[0];

export function useExpertEditPanelStageInteractions(args: UseExpertEditPanelStageInteractionsArgs) {
  const interactionRouters = useExpertEditStageInteractions(args);

  const handleMarkupStageMiddleClickSuppress = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 1) return;
      event.preventDefault();
    },
    []
  );

  return {
    ...interactionRouters,
    handleMarkupStageMiddleClickSuppress,
  };
}
