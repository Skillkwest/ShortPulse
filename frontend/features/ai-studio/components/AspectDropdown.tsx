/**
 * Aspect ratio selector for AI Studio create/regenerate flows.
 * Handles open/close interactions internally and emits selected aspect values upstream.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "phosphor-react";
import { aspectOptions as defaultAspectOptions } from "../constants";
import { AspectOption } from "../types";

type AspectDropdownProps = {
  aspect: string;
  onSelect: (value: string) => void;
  options?: AspectOption[];
};

const toRatioClassName = (value: string): string | null => {
  if (!value.includes(":")) return null;
  return `ratio-${value.replace(":", "-")}`;
};

export function AspectDropdown({
  aspect,
  onSelect,
  options = defaultAspectOptions,
}: AspectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = React.useId();
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const selectedAspect = options.find((option) => option.value === aspect);
  const selectedRatioClass = selectedAspect?.value ? toRatioClassName(selectedAspect.value) : null;

  const syncMenuPosition = React.useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    const viewportHeight = window.innerHeight;
    const availableAbove = Math.max(96, triggerRect.top - 12);
    const availableBelow = Math.max(96, viewportHeight - triggerRect.bottom - 12);
    const shouldOpenAbove = availableAbove >= availableBelow;
    setMenuStyle({
      position: "fixed",
      top: shouldOpenAbove ? "auto" : triggerRect.bottom + 6,
      bottom: shouldOpenAbove ? viewportHeight - triggerRect.top + 6 : "auto",
      left: triggerRect.left,
      right: "auto",
      width: triggerRect.width,
      maxHeight: shouldOpenAbove ? availableAbove : availableBelow,
      overflowY: "auto",
      zIndex: 1230,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = dropdownRef.current?.contains(target) ?? false;
      const isInsideMenu = menuRef.current?.contains(target) ?? false;
      if (!isInsideTrigger && !isInsideMenu) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    const handleViewportChange = () => {
      syncMenuPosition();
    };
    if (!isOpen) return;
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, syncMenuPosition]);

  const menu =
    isOpen && menuStyle
      ? createPortal(
          <div
            id={listboxId}
            ref={menuRef}
            className="aspect-menu"
            role="listbox"
            style={menuStyle}
          >
            {options.map((option) => {
              const isActive = option.value === aspect;
              const ratioClass = toRatioClassName(option.value);
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`aspect-menu-item ${isActive ? "is-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`aspect-shape ${option.orientation}${ratioClass ? ` ${ratioClass}` : ""}`}
                    aria-hidden="true"
                  />
                  <span className="aspect-ratio">{option.ratioLabel}</span>
                  <span className="aspect-name">{option.name}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="aspect-dropdown" ref={dropdownRef}>
      <button
        type="button"
        ref={triggerRef}
        className="aspect-trigger"
        onClick={() => {
          if (!isOpen) {
            syncMenuPosition();
          }
          setIsOpen((open) => !open);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
      >
        <span
          className={`aspect-shape ${selectedAspect?.orientation ?? "horizontal"}${selectedRatioClass ? ` ${selectedRatioClass}` : ""}`}
          aria-hidden="true"
        />
        <span className="aspect-meta">
          <span className="aspect-ratio">{selectedAspect?.ratioLabel ?? aspect}</span>
          <span className="aspect-name tiny subdued">{selectedAspect?.name ?? ""}</span>
        </span>
        <CaretDown size={16} weight="bold" className="aspect-caret" aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}
