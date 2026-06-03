import React from "react";
import { X } from "phosphor-react";
import type { SharedMediaDetailTopBarItem } from "./detailModalPlatformTypes";

type SharedMediaDetailTopBarProps = {
  eyebrow?: string | null;
  title?: string | null;
  items: SharedMediaDetailTopBarItem[];
  actions?: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
};

/**
 * Shared top-bar chrome for AI Studio media detail dialogs.
 * Keeps metadata pills and action/close controls visually aligned across surfaces.
 */
export function SharedMediaDetailTopBar({
  eyebrow = null,
  title = null,
  items,
  actions = null,
  onClose,
  closeLabel = "Close media detail",
}: SharedMediaDetailTopBarProps) {
  return (
    <div className="art-modal-top-controls">
      <div className="art-modal-heading-group">
        {eyebrow || title ? (
          <div className="art-modal-heading-copy">
            {eyebrow ? <span className="art-modal-eyebrow">{eyebrow}</span> : null}
            {title ? <h2 className="art-modal-title">{title}</h2> : null}
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="art-modal-meta-pill" aria-label="Media details">
            {items.map((item, index) => (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 ? <span className="art-meta-divider">/</span> : null}
                <span
                  className={["art-meta-chip", item.className].filter(Boolean).join(" ")}
                  title={item.title}
                >
                  {item.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>
      <div className="art-modal-action-row">
        {actions}
        <button type="button" className="art-close-btn" aria-label={closeLabel} onClick={onClose}>
          <X size={16} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
