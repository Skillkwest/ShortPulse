import React, { useEffect, useMemo, useRef, useState } from "react";

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
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const isDisabled = !onSelect || options.length === 0;

  return (
    <div className="create-expert-resolution-dropdown aspect-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`create-expert-resolution-trigger aspect-trigger${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="create-expert-resolution-value">{selectedOption?.label ?? value}</span>
      </button>
      {isOpen ? (
        <div
          className="create-expert-resolution-menu aspect-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                type="button"
                key={option.value}
                className={`create-expert-resolution-option aspect-menu-item${isActive ? " is-active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect?.(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="create-expert-resolution-option-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
