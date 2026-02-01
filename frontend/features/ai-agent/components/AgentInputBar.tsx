import React, { useEffect, useRef } from "react";

type AgentInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  thinking?: boolean;
  thinkingLabel?: string;
};

export function AgentInputBar({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  onKeyDown,
  thinking = false,
  thinkingLabel = "Thinking…",
}: AgentInputBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 120;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  return (
    <div className={`agent-input-prefab ${className}`.trim()}>
      {thinking ? (
        <div className="agent-input-prefab-overlay" aria-live="polite">
          <div className="agent-input-prefab-thinking">{thinkingLabel}</div>
        </div>
      ) : null}
      <textarea
        className="agent-input-prefab-field"
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-busy={thinking}
        ref={ref}
      />
    </div>
  );
}
