import React from "react";
import { CloudArrowUp } from "phosphor-react";

type GreenMediaLibraryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export function GreenMediaLibraryButton({
  label = "Media Library",
  className = "",
  ...props
}: GreenMediaLibraryButtonProps) {
  return (
    <button
      type="button"
      className={`green-media-library-btn ${className}`}
      {...props}
    >
      <CloudArrowUp size={14} weight="regular" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
