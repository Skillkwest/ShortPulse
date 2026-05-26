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
    const CREATE_COMPOSER_PANEL_BOUNDARY_INSET_PX = 32;
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
      const renderedHeightPx = textarea.getBoundingClientRect().height;
      const isInsideCreateComposer = Boolean(textarea.closest(".create-composer-panel"));
      const createComposerBoundary = textarea.closest(
        ".create-composer-right-panel-inner, .ai-properties"
      ) as HTMLElement | null;

      // Reset the explicit height before measuring so wider layouts can shrink the textarea.
      textarea.style.height = "0px";
      const measuredScrollHeightPx = textarea.scrollHeight;
      const contentHeightPx = Math.max(0, measuredScrollHeightPx - paddingTopPx - paddingBottomPx);
      const visualRowCount =
        lineHeightPx > 0 ? Math.max(1, Math.ceil(contentHeightPx / lineHeightPx)) : 1;

      onVisualRowCountChange?.(visualRowCount);

      const applyHeight = (nextHeightPx: number) => {
        if (renderedHeightPx > 0 && Math.abs(renderedHeightPx - nextHeightPx) > 0.5) {
          textarea.style.height = `${renderedHeightPx}px`;
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

      const createComposerAvailableHeightPx = isInsideCreateComposer
        ? Math.max(
            computedMinHeightPx,
            (createComposerBoundary?.getBoundingClientRect().bottom ?? window.innerHeight) -
              textarea.getBoundingClientRect().top -
              CREATE_COMPOSER_PANEL_BOUNDARY_INSET_PX
          )
        : maxHeightPx;
      const resolvedMaxHeightPx = Math.max(
        computedMinHeightPx,
        Math.min(maxHeightPx, createComposerAvailableHeightPx)
      );
      const nextHeightPx = Math.min(measuredScrollHeightPx, resolvedMaxHeightPx);
      applyHeight(nextHeightPx);
      textarea.style.overflowY = measuredScrollHeightPx > resolvedMaxHeightPx ? "auto" : "hidden";
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

        // Width changes often land on the composer wrappers first during shell resize.
        const observedNodes = new Set<HTMLElement>();
        let node: HTMLElement | null = textarea;
        for (let depth = 0; node && depth < 4; depth += 1) {
          observedNodes.add(node);
          node = node.parentElement;
        }
        observedNodes.forEach((observedNode) => {
          resizeObserver.observe(observedNode);
        });
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
