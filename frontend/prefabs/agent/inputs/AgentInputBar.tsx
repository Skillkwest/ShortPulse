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
  collapseToMinHeightWhenBlurred?: boolean;
  onFocusChange?: (isFocused: boolean) => void;
  onVisualRowCountChange?: (rowCount: number) => void;
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
      collapseToMinHeightWhenBlurred = false,
      onFocusChange,
      onVisualRowCountChange,
    }: AgentInputBarProps,
    forwardedRef
  ) {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const resizeRafRef = useRef<number | null>(null);
    const [isFocused, setIsFocused] = React.useState(false);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLTextAreaElement, []);

    const resizeToFit = useCallback(() => {
      const textarea = localRef.current;
      if (!textarea) return;
      const computedStyle = window.getComputedStyle(textarea);
      const computedMinHeightPx = Number.parseFloat(computedStyle.minHeight) || 0;
      const lineHeightPx = Number.parseFloat(computedStyle.lineHeight) || 0;
      const paddingTopPx = Number.parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottomPx = Number.parseFloat(computedStyle.paddingBottom) || 0;
      const contentHeightPx = Math.max(0, textarea.scrollHeight - paddingTopPx - paddingBottomPx);
      const visualRowCount =
        lineHeightPx > 0 ? Math.max(1, Math.ceil(contentHeightPx / lineHeightPx)) : 1;

      onVisualRowCountChange?.(visualRowCount);

      const applyHeight = (nextHeightPx: number) => {
        const currentHeightPx = textarea.getBoundingClientRect().height;
        if (currentHeightPx > 0 && Math.abs(currentHeightPx - nextHeightPx) > 0.5) {
          textarea.style.height = `${currentHeightPx}px`;
          void textarea.offsetHeight;
        }
        textarea.style.height = `${nextHeightPx}px`;
      };

      const isValueEmpty = value.length === 0;

      if (
        (collapseToMinHeightWhenBlurred && !isFocused) ||
        (collapseToMinHeightWhenBlurred && isValueEmpty)
      ) {
        applyHeight(computedMinHeightPx);
        textarea.style.overflowY = "hidden";
        return;
      }

      const nextHeightPx = Math.min(textarea.scrollHeight, maxHeightPx);
      applyHeight(nextHeightPx);
      textarea.style.overflowY = textarea.scrollHeight > maxHeightPx ? "auto" : "hidden";
    }, [collapseToMinHeightWhenBlurred, isFocused, maxHeightPx, onVisualRowCountChange, value]);

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
          onFocus={() => {
            setIsFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            onFocusChange?.(false);
          }}
          placeholder={placeholder}
          disabled={disabled}
          ref={localRef}
        />
      </div>
    );
  }
);

AgentInputBar.displayName = "AgentInputBar";
