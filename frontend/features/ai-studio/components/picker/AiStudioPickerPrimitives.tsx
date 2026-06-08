import React, { type ReactNode } from "react";
import { X } from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";

type AiStudioPickerModalFrameProps = {
  isOpen: boolean;
  isEnabled?: boolean;
  activityId: string;
  ariaLabel: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
};

export const AiStudioPickerModalFrame = ({
  isOpen,
  isEnabled = true,
  activityId,
  ariaLabel,
  title,
  subtitle,
  onClose,
  headerActions = null,
  children,
}: AiStudioPickerModalFrameProps) => {
  useAiStudioModalActivity(activityId, isOpen && isEnabled);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !isOpen || !isEnabled,
  });

  if (!isOpen || !isEnabled) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <>
        <div className="model-modal-backdrop ai-character-picker-backdrop" {...backdropDismiss} />
        <div
          className="model-modal ai-character-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <div className="model-modal-header">
            <div className="model-modal-title-group">
              <h3 className="model-modal-title">{title}</h3>
              <p className="model-modal-subtitle">{subtitle}</p>
            </div>
            {headerActions ?? (
              <button
                type="button"
                className="ghost-btn mini model-modal-close"
                aria-label={`Close ${ariaLabel.toLowerCase()}`}
                onClick={onClose}
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
          <div className="model-modal-scroll">{children}</div>
        </div>
      </>
    </AiStudioModalLayer>
  );
};

type AiStudioPickerSectionProps = {
  title?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

export const AiStudioPickerSection = ({
  title = null,
  headerAction = null,
  children,
}: AiStudioPickerSectionProps) => {
  if (!title && !headerAction) {
    return <>{children}</>;
  }
  return (
    <section className="ai-character-picker-section">
      <div className="kling-entity-picker-section-header">
        {title ? <div>{title}</div> : <div />}
        {headerAction}
      </div>
      {children}
    </section>
  );
};

type AiStudioPickerGridProps = {
  ariaLabel: string;
  children: ReactNode;
};

export const AiStudioPickerGrid = ({ ariaLabel, children }: AiStudioPickerGridProps) => (
  <div className="ai-character-picker-grid" role="list" aria-label={ariaLabel}>
    {children}
  </div>
);

type AiStudioPickerCardProps = {
  isActive: boolean;
  className?: string;
  disabled?: boolean;
  onSelect: () => void;
  avatar: ReactNode;
  label: ReactNode;
  name: ReactNode;
  token?: ReactNode;
  footer?: ReactNode;
};

export const AiStudioPickerCard = ({
  isActive,
  className = "",
  disabled = false,
  onSelect,
  avatar,
  label,
  name,
  token = null,
  footer = null,
}: AiStudioPickerCardProps) => (
  <article
    role="listitem"
    className={`ai-character-list-card ai-character-picker-card ${className} ${
      isActive ? "is-active" : ""
    }`.trim()}
  >
    <button
      type="button"
      className="ai-character-list-select-btn"
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onSelect}
    >
      <div className="ai-character-list-main">
        <span className="ai-character-list-avatar" aria-hidden="true">
          {avatar}
        </span>
        <div className="ai-character-list-copy">
          <p className="metric-label tiny">{label}</p>
          <p className="ai-character-list-name">{name}</p>
          {token}
        </div>
      </div>
    </button>
    {footer}
  </article>
);

type AiStudioPickerFeedbackProps = {
  isLoading: boolean;
  loadingMessage: string;
  errorMessage: string | null;
  emptyMessage: string;
  onRetry?: () => void;
};

export const AiStudioPickerFeedback = ({
  isLoading,
  loadingMessage,
  errorMessage,
  emptyMessage,
  onRetry,
}: AiStudioPickerFeedbackProps) => {
  if (isLoading) {
    return <p className="tiny subdued ai-character-picker-empty">{loadingMessage}</p>;
  }
  if (errorMessage) {
    return (
      <div className="ai-character-picker-empty">
        <AppMessage tone="error" mode="inline" message={errorMessage} />
        {onRetry ? (
          <button type="button" className="ghost-btn mini" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  return <p className="tiny subdued ai-character-picker-empty">{emptyMessage}</p>;
};
