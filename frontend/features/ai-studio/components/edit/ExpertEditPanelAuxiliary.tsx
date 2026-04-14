import React from "react";

import {
  ExpertEditCharacterPickerModal,
  type ExpertEditCharacterPickerModalProps,
} from "./ExpertEditCharacterPickerModal";

type ExpertEditPanelAuxiliaryProps = {
  statusToastMessage: string | null;
  statusToastTone: "info" | "warning";
  isStatusToastFading: boolean;
  primaryInputRef: React.Ref<HTMLInputElement>;
  extraOneInputRef: React.Ref<HTMLInputElement>;
  extraTwoInputRef: React.Ref<HTMLInputElement>;
  extraThreeInputRef: React.Ref<HTMLInputElement>;
  handlePrimaryFileSelection: React.ChangeEventHandler<HTMLInputElement>;
  handleExtraFileSelection: (index: 0 | 1 | 2) => React.ChangeEventHandler<HTMLInputElement>;
  characterPicker: ExpertEditCharacterPickerModalProps;
};

export function ExpertEditPanelAuxiliary({
  statusToastMessage,
  statusToastTone,
  isStatusToastFading,
  primaryInputRef,
  extraOneInputRef,
  extraTwoInputRef,
  extraThreeInputRef,
  handlePrimaryFileSelection,
  handleExtraFileSelection,
  characterPicker,
}: ExpertEditPanelAuxiliaryProps) {
  return (
    <>
      {statusToastMessage ? (
        <div
          className={`edit-expert-stage-status-toast ${
            statusToastTone === "warning" ? "is-warning" : "is-info"
          } ${isStatusToastFading ? "is-fading" : ""}`.trim()}
          role="status"
          aria-live="polite"
        >
          {statusToastMessage}
        </div>
      ) : null}

      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePrimaryFileSelection}
      />
      <input
        ref={extraOneInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleExtraFileSelection(0)}
      />
      <input
        ref={extraTwoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleExtraFileSelection(1)}
      />
      <input
        ref={extraThreeInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleExtraFileSelection(2)}
      />

      <ExpertEditCharacterPickerModal {...characterPicker} />
    </>
  );
}
