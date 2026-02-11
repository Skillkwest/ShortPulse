/**
 * Reusable collapse toggle button for reference panel step cards.
 */
import React from "react";
import { CaretDown } from "phosphor-react";

type ReferenceStepHeaderActionButtonProps = {
  label: string;
  isCollapsed?: boolean;
  onClick: () => void;
};

/**
 * Renders a small ghost action button used in step headers.
 */
export const ReferenceStepHeaderActionButton: React.FC<ReferenceStepHeaderActionButtonProps> = ({
  label,
  isCollapsed = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      className="ghost-btn mini step-utility-btn"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-expanded={!isCollapsed}
    >
      <CaretDown size={16} weight="bold" aria-hidden />
    </button>
  );
};
