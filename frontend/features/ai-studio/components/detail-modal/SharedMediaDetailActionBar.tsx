import React from "react";
import type { SharedMediaDetailActionItem } from "./detailModalPlatformTypes";

type SharedMediaDetailActionBarProps = {
  items: SharedMediaDetailActionItem[];
  notice?: React.ReactNode;
};

/**
 * Shared action-button renderer for AI Studio media detail dialogs.
 * Centralizes button tone/state styling so rich detail surfaces can share the same action UX.
 */
export function SharedMediaDetailActionBar({
  items,
  notice = null,
}: SharedMediaDetailActionBarProps) {
  return (
    <>
      {items.map((item) => {
        const className = [
          "art-action-btn",
          item.intent === "save" ? "art-action-btn-save" : "",
          item.intent === "danger" ? "art-action-btn-danger" : "",
          item.state === "saved" ? "is-saved" : "",
          item.className ?? "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={item.id}
            type="button"
            className={className}
            onClick={item.onClick}
            disabled={item.disabled}
            title={item.title}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
      {notice}
    </>
  );
}
