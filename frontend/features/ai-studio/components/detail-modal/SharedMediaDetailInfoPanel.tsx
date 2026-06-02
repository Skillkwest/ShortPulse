import React from "react";

type SharedMediaDetailInfoPanelProps = {
  leadingContent?: React.ReactNode;
  label: string;
  value: string;
  readOnly?: boolean;
  rows?: number;
  placeholder?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
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
}: SharedMediaDetailInfoPanelProps) {
  return (
    <div className="art-prompt-blade">
      <div className="art-blade-inner">
        {leadingContent}
        <div className="art-blade-header">
          <span className="art-label">{label}</span>
        </div>
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
