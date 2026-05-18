import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ResolutionOption = {
  value: string;
  label: string;
};

type ResolutionDropdownProps = {
  value: string;
  options: ResolutionOption[];
  onSelect?: (value: string) => void;
  ariaLabel?: string;
};

export function ResolutionDropdown({
  value,
  options,
  onSelect,
  ariaLabel = "Image resolution",
}: ResolutionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = React.useId();
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );

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

  const isDisabled = !onSelect || options.length === 0;
  const menu =
    isOpen && menuStyle
      ? createPortal(
          <div
            id={listboxId}
            ref={menuRef}
            className="create-composer-resolution-menu aspect-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
          >
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`create-composer-resolution-option aspect-menu-item${isActive ? " is-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect?.(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="create-composer-resolution-option-label">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="create-composer-resolution-dropdown aspect-dropdown" ref={dropdownRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`create-composer-resolution-trigger aspect-trigger${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={() => {
          if (!isOpen) {
            syncMenuPosition();
          }
          setIsOpen((open) => !open);
        }}
      >
        <span className="create-composer-resolution-value">{selectedOption?.label ?? value}</span>
      </button>
      {menu}
    </div>
  );
}
