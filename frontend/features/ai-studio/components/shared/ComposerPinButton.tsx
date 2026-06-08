/**
 * Small composer action that pins authored text into the Reference Grid.
 * Keeps prompt-reference creation on the caller-owned ingestion path.
 */
import React from "react";
import { PushPinSimple } from "phosphor-react";

type ComposerPinButtonProps = {
  text: string | null | undefined;
  onPinTextReference?: (text: string) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

/**
 * Renders an icon-only pin action for prompt composers.
 */
export const ComposerPinButton = ({
  text,
  onPinTextReference,
  className = "",
  ariaLabel = "Pin text reference to reference grid",
  disabled = false,
}: ComposerPinButtonProps) => {
  const cleanedText = text?.trim() ?? "";
  const isDisabled = disabled;

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (isDisabled) return;
      onPinTextReference?.(cleanedText);
    },
    [cleanedText, isDisabled, onPinTextReference]
  );

  if (cleanedText.length === 0 || !onPinTextReference) {
    return null;
  }

  return (
    <button
      type="button"
      className={`composer-pin-button ${className}`.trim()}
      aria-label={ariaLabel}
      title="Pin text to Reference Grid"
      disabled={isDisabled}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
      }}
      onClick={handleClick}
    >
      <PushPinSimple aria-hidden="true" size={13} weight="fill" />
    </button>
  );
};
