import React from "react";

import { AppMessage } from "../../../../components/AppMessage";
import {
  ExpertEditCharacterPickerModal,
  type ExpertEditCharacterPickerModalProps,
} from "./ExpertEditCharacterPickerModal";

type ExpertEditPanelAuxiliaryProps = {
  statusToastMessage: string | null;
  statusToastTone: "info" | "warning";
  isStatusToastFading: boolean;
  primaryInputRef: React.Ref<HTMLInputElement>;
  inputRefs: readonly React.RefObject<HTMLInputElement | null>[];
  handlePrimaryFileSelection: React.ChangeEventHandler<HTMLInputElement>;
  handleExtraFileSelection: (index: number) => React.ChangeEventHandler<HTMLInputElement>;
  characterPicker: ExpertEditCharacterPickerModalProps;
};

export function ExpertEditPanelAuxiliary({
  statusToastMessage,
  statusToastTone,
  isStatusToastFading,
  primaryInputRef,
  inputRefs,
  handlePrimaryFileSelection,
  handleExtraFileSelection,
  characterPicker,
}: ExpertEditPanelAuxiliaryProps) {
  return (
    <>
      {statusToastMessage ? (
        <AppMessage
          className={`edit-expert-stage-status-toast ${
            statusToastTone === "warning" ? "is-warning" : "is-info"
          } ${isStatusToastFading ? "is-fading" : ""}`.trim()}
          tone={statusToastTone}
          mode="toast"
          message={statusToastMessage}
          role="status"
          ariaLive="polite"
        />
      ) : null}

      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePrimaryFileSelection}
      />
      {inputRefs.map((inputRef, index) => (
        <input
          key={`expert-edit-secondary-input-${index}`}
          ref={(element) => {
            (inputRef as { current: HTMLInputElement | null }).current = element;
          }}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleExtraFileSelection(index)}
        />
      ))}

      <ExpertEditCharacterPickerModal {...characterPicker} />
    </>
  );
}
