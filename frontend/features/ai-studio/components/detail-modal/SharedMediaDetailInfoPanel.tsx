import React from "react";
import { PromptCopyButton } from "./PromptCopyButton";

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
}: SharedMediaDetailInfoPanelProps) {
  const shouldRenderCopyButton = label === "PROMPT" && Boolean(copyText?.trim());

  return (
    <div className="art-prompt-blade">
      {leadingContent}
      <div className="art-blade-header">
        <span className="art-label">{label}</span>
        {shouldRenderCopyButton ? (
          <PromptCopyButton text={copyText ?? ""} className="art-copy-prompt-btn--blade" />
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
