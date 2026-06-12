/**
 * Shared character-look dropdown used by AI Studio picker modals.
 * Keeps Create and Video character look selection on the same accessible UI control.
 */
import React from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "phosphor-react";

export type CharacterLookDropdownOption = {
  id: string;
  label: string;
};

export type CharacterLookDropdownProps = {
  characterName: string;
  value: string;
  options: CharacterLookDropdownOption[];
  onChange: (value: string) => void;
};

export const CharacterLookDropdown = ({
  characterName,
  value,
  options,
  onChange,
}: CharacterLookDropdownProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxId = React.useId();
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties | null>(null);
  const selectedOption = React.useMemo(
    () => options.find((option) => option.id === value) ?? options[0] ?? null,
    [options, value]
  );

  const syncMenuPosition = React.useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    setMenuStyle({
      position: "fixed",
      top: triggerRect.bottom + 6,
      left: triggerRect.left,
      width: triggerRect.width,
      zIndex: 1230,
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
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

    syncMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, syncMenuPosition]);

  const isDisabled = options.length === 0;
  const label = `Choose look for ${characterName}`;
  const menu =
    isOpen && menuStyle
      ? createPortal(
          <div
            id={listboxId}
            ref={menuRef}
            className="ai-character-look-dropdown-menu"
            role="listbox"
            aria-label={label}
            style={menuStyle}
          >
            {options.map((option) => {
              const isActive = option.id === value;
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`ai-character-look-dropdown-option${isActive ? " is-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="ai-character-look-dropdown-option-label">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="ai-character-look-dropdown" ref={dropdownRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`ai-character-look-dropdown-trigger${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={label}
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="ai-character-look-dropdown-value">{selectedOption?.label ?? value}</span>
        <CaretDown
          size={16}
          weight="bold"
          className="ai-character-look-dropdown-caret"
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
};
