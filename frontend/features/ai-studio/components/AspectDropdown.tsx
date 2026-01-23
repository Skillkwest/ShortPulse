/**
 * Aspect ratio selector for AI Studio create/regenerate flows.
 * Handles open/close interactions internally and emits selected aspect values upstream.
 */
import React, { useEffect, useRef, useState } from "react";
import { CaretDown } from "phosphor-react";
import { aspectOptions as defaultAspectOptions } from "../constants";
import { AspectOption } from "../types";

type AspectDropdownProps = {
  aspect: string;
  onSelect: (value: string) => void;
  options?: AspectOption[];
};

export function AspectDropdown({ aspect, onSelect, options = defaultAspectOptions }: AspectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedAspect = options.find((option) => option.value === aspect);

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

  return (
    <div className="aspect-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="aspect-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`aspect-shape ${selectedAspect?.orientation ?? "horizontal"}`} aria-hidden="true" />
        <span className="aspect-meta">
          <span className="aspect-ratio">{selectedAspect?.ratioLabel ?? aspect}</span>
          <span className="aspect-name tiny subdued">{selectedAspect?.name ?? ""}</span>
        </span>
        <CaretDown size={16} weight="bold" className="aspect-caret" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="aspect-menu" role="listbox">
          {options.map((option) => {
            const isActive = option.value === aspect;
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
                <span className={`aspect-shape ${option.orientation}`} aria-hidden="true" />
                <span className="aspect-ratio">{option.ratioLabel}</span>
                <span className="aspect-name">{option.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
