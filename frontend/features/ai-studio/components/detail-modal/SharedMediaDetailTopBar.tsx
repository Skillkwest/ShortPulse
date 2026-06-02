import React from "react";
import { X } from "phosphor-react";

export type SharedMediaDetailTopBarItem = {
  label: string;
  className?: string;
  title?: string;
};

type SharedMediaDetailTopBarProps = {
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
  items,
  actions = null,
  onClose,
  closeLabel = "Close media detail",
}: SharedMediaDetailTopBarProps) {
  return (
    <div className="art-modal-top-controls">
      <div className="art-modal-meta-pill">
        {items.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? <span className="art-meta-divider">/</span> : null}
            <span className={item.className} title={item.title}>
              {item.label}
            </span>
          </React.Fragment>
        ))}
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
