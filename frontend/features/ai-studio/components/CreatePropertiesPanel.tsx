/**
 * Create properties panel runtime switch.
 * Keeps Standard and Pulse Create composers in mode-owned modules.
 */
import React from "react";
import {
  ComposeSendCard,
  StandardCreatePropertiesPanel,
  type StandardCreatePropertiesPanelProps,
} from "./create/StandardCreatePropertiesPanel";
import {
  PulseCreatePropertiesPanel,
  type PulseCreatePropertiesPanelProps,
} from "./create/PulseCreatePropertiesPanel";

export { ComposeSendCard };
export type { ExpertCreateMode } from "./create/createModeTypes";

export type CreatePropertiesPanelProps = StandardCreatePropertiesPanelProps &
  Partial<PulseCreatePropertiesPanelProps>;

/**
 * Performs the single Create-mode UI decision before entering mode-owned composers.
 */
export function CreatePropertiesPanel(props: CreatePropertiesPanelProps) {
  const [uncontrolledExpertCreateMode, setUncontrolledExpertCreateMode] =
    React.useState<NonNullable<CreatePropertiesPanelProps["expertCreateMode"]>>("standard");
  const resolvedExpertCreateMode = props.expertCreateMode ?? uncontrolledExpertCreateMode;
  const handleExpertCreateModeChange = React.useCallback(
    (value: NonNullable<CreatePropertiesPanelProps["expertCreateMode"]>) => {
      setUncontrolledExpertCreateMode(value);
      props.onExpertCreateModeChange?.(value);
    },
    [props]
  );
  const resolvedProps = {
    ...props,
    expertCreateMode: resolvedExpertCreateMode,
    onExpertCreateModeChange: handleExpertCreateModeChange,
  };
  const showExpertView = Boolean(props.expertCreateUiEligible && !props.beginnerMode);
  if (showExpertView && resolvedExpertCreateMode === "pulse") {
    return React.createElement(
      PulseCreatePropertiesPanel,
      resolvedProps as PulseCreatePropertiesPanelProps
    );
  }
  return <StandardCreatePropertiesPanel {...resolvedProps} />;
}
