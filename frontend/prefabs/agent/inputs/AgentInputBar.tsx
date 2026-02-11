/**
 * Auto-resizing textarea prefab used across agent/chat surfaces.
 * Keeps sizing + padding consistent while remaining drop-in.
 */
import React, { useEffect, useImperativeHandle, useRef } from "react";

type AgentInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

export const AgentInputBar = React.forwardRef<HTMLTextAreaElement, AgentInputBarProps>(
  function AgentInputBar(
    {
      value,
      onChange,
      placeholder,
      disabled = false,
      className = "",
      onKeyDown,
    }: AgentInputBarProps,
    forwardedRef
  ) {
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLTextAreaElement, []);

    useEffect(() => {
      const textarea = localRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const maxHeight = 120;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }, [value]);

    return (
      <div className={`agent-input-prefab ${className}`.trim()}>
        <textarea
          className="agent-input-prefab-field"
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          ref={localRef}
        />
      </div>
    );
  }
);

AgentInputBar.displayName = "AgentInputBar";
