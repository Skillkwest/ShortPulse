/**
 * Auto-resizing textarea prefab used across agent/chat surfaces.
 * Keeps sizing + padding consistent while remaining drop-in.
 */
import React, { useCallback, useEffect, useImperativeHandle, useRef } from "react";

type AgentInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  maxHeightPx?: number;
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
      maxHeightPx = 240,
    }: AgentInputBarProps,
    forwardedRef
  ) {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const resizeRafRef = useRef<number | null>(null);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLTextAreaElement, []);

    const resizeToFit = useCallback(() => {
      const textarea = localRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const nextHeightPx = Math.min(textarea.scrollHeight, maxHeightPx);
      textarea.style.height = `${nextHeightPx}px`;
    }, [maxHeightPx]);

    const scheduleResizeToFit = useCallback(() => {
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeToFit();
      });
    }, [resizeToFit]);

    useEffect(() => {
      resizeToFit();
    }, [resizeToFit, value]);

    useEffect(() => {
      const textarea = localRef.current;
      if (!textarea) return undefined;

      // Re-measure once the initial layout settles (refresh/splitter width transitions).
      scheduleResizeToFit();
      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
          scheduleResizeToFit();
        });
        resizeObserver.observe(textarea);
        return () => {
          resizeObserver.disconnect();
          if (resizeRafRef.current != null) {
            cancelAnimationFrame(resizeRafRef.current);
            resizeRafRef.current = null;
          }
        };
      }

      const onWindowResize = () => {
        scheduleResizeToFit();
      };
      window.addEventListener("resize", onWindowResize);

      return () => {
        window.removeEventListener("resize", onWindowResize);
        if (resizeRafRef.current != null) {
          cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = null;
        }
      };
    }, [scheduleResizeToFit]);

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
