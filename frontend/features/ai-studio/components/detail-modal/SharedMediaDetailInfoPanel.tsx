import React from "react";
import { PromptCopyButton } from "./PromptCopyButton";
import { ComposerPinButton } from "../shared/ComposerPinButton";

type SharedMediaDetailInfoPanelProps = {
  leadingContent?: React.ReactNode;
  label: string;
  value: string;
  readOnly?: boolean;
  rows?: number;
  placeholder?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  copyText?: string | null;
  onPinPromptReference?: (text: string) => void;
};

/**
 * Shared right-side metadata blade for AI Studio media detail dialogs.
 * Reuses the same structure for editable generated details and read-only library previews.
 */
export function SharedMediaDetailInfoPanel({
  leadingContent = null,
  label,
  value,
  readOnly = true,
  rows = 3,
  placeholder,
  textareaRef,
  onChange,
  copyText = null,
  onPinPromptReference,
}: SharedMediaDetailInfoPanelProps) {
  const shouldRenderCopyButton = label === "PROMPT" && Boolean(copyText?.trim());
  const shouldRenderPinButton = label === "PROMPT" && Boolean(copyText?.trim());

  return (
    <div className="art-prompt-blade">
      {leadingContent}
      <div className="art-blade-header">
        <span className="art-label">{label}</span>
        {shouldRenderCopyButton || shouldRenderPinButton ? (
          <div className="art-blade-actions">
            {shouldRenderPinButton ? (
              <ComposerPinButton
                text={copyText ?? ""}
                onPinTextReference={onPinPromptReference}
                className="art-pin-prompt-btn--blade"
              />
            ) : null}
            {shouldRenderCopyButton ? (
              <PromptCopyButton text={copyText ?? ""} className="art-copy-prompt-btn--blade" />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="art-blade-scroll-frame">
        <textarea
          className="art-blade-textarea"
          ref={textareaRef}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          rows={rows}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
