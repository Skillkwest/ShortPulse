/**
 * Shared non-blocking feedback message primitive.
 * Standardizes user-facing banners, inline alerts, notices, and toast-style messages.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X as XIcon } from "phosphor-react";

export type AppMessageTone = "error" | "warning" | "info" | "success";
export type AppMessageMode = "banner" | "inline" | "toast" | "compact";
export type AppMessageStackPlacement = "flow" | "viewport";

export type AppMessageAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type AppMessageState = {
  message: string;
  tone: AppMessageTone;
  fading?: boolean;
};

type AppMessageProps = {
  tone?: AppMessageTone;
  mode?: AppMessageMode;
  title?: ReactNode;
  message?: ReactNode;
  children?: ReactNode;
  action?: AppMessageAction;
  onDismiss?: () => void;
  className?: string;
  role?: "alert" | "status" | "note";
  ariaLive?: "assertive" | "polite" | "off";
  busy?: boolean;
  testId?: string;
};

type AppMessageStackProps = {
  children: ReactNode;
  placement?: AppMessageStackPlacement;
  className?: string;
  label?: string;
  testId?: string;
};

const DEFAULT_ROLE_BY_TONE: Record<AppMessageTone, "alert" | "status"> = {
  error: "alert",
  warning: "status",
  info: "status",
  success: "status",
};

const DEFAULT_LIVE_BY_TONE: Record<AppMessageTone, "assertive" | "polite"> = {
  error: "assertive",
  warning: "polite",
  info: "polite",
  success: "polite",
};

const DEFAULT_TRANSIENT_MS = 2200;
const DEFAULT_FADE_MS = 260;

/**
 * Renders a shared non-blocking app message.
 * Inputs: tone, mode, copy, optional CTA/dismiss handlers, and accessibility overrides.
 * Output: standardized message markup.
 * Side effects: invokes supplied action/dismiss handlers only on user interaction.
 */
export function AppMessage({
  tone = "info",
  mode = "banner",
  title,
  message,
  children,
  action,
  onDismiss,
  className,
  role,
  ariaLive,
  busy,
  testId,
}: AppMessageProps) {
  const resolvedRole = role ?? DEFAULT_ROLE_BY_TONE[tone];
  const resolvedLive = ariaLive ?? DEFAULT_LIVE_BY_TONE[tone];
  const content = children ?? message;
  const classes = [
    "app-message",
    `app-message--${tone}`,
    `app-message--${mode}`,
    busy ? "is-busy" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role={resolvedRole}
      aria-live={resolvedLive}
      aria-busy={busy || undefined}
      data-tone={tone}
      data-mode={mode}
      data-testid={testId}
    >
      <div className="app-message__copy">
        {title ? <strong className="app-message__title">{title}</strong> : null}
        {content ? <div className="app-message__body">{content}</div> : null}
      </div>
      {action || onDismiss ? (
        <div className="app-message__actions">
          {action?.href ? (
            <a className="app-message__action" href={action.href} onClick={action.onClick}>
              {action.label}
            </a>
          ) : null}
          {action && !action.href ? (
            <button type="button" className="app-message__action" onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className="app-message__dismiss"
              aria-label="Dismiss message"
              onClick={onDismiss}
            >
              <XIcon size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Groups page-level app messages.
 * Inputs: message children plus a flow or viewport placement.
 * Output: a stack wrapper that can float top-of-app banners without changing layout height.
 * Side effects: none.
 */
export function AppMessageStack({
  children,
  placement = "flow",
  className,
  label = "Application notifications",
  testId,
}: AppMessageStackProps) {
  const classes = ["app-message-stack", `app-message-stack--${placement}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} aria-label={label} data-testid={testId}>
      {children}
    </div>
  );
}

/**
 * Provides reusable transient message timing for local toast/status surfaces.
 * Inputs: optional visible and fade durations.
 * Output: current message state plus show/clear handlers.
 * Side effects: schedules and clears browser timers when messages are shown.
 */
export function useTransientAppMessage({
  visibleMs = DEFAULT_TRANSIENT_MS,
  fadeMs = DEFAULT_FADE_MS,
}: {
  visibleMs?: number;
  fadeMs?: number;
} = {}) {
  const [state, setState] = useState<AppMessageState | null>(null);
  const visibleTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (visibleTimerRef.current !== null) {
      window.clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimers();
    setState(null);
  }, [clearTimers]);

  const show = useCallback(
    (message: string, tone: AppMessageTone = "info") => {
      clearTimers();
      setState({ message, tone, fading: false });
      visibleTimerRef.current = window.setTimeout(() => {
        setState((current) => (current ? { ...current, fading: true } : current));
        fadeTimerRef.current = window.setTimeout(() => {
          setState(null);
          fadeTimerRef.current = null;
        }, fadeMs);
        visibleTimerRef.current = null;
      }, visibleMs);
    },
    [clearTimers, fadeMs, visibleMs]
  );

  useEffect(() => clearTimers, [clearTimers]);

  return { message: state, show, clear };
}
