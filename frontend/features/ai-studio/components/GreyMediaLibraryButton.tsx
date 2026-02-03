import React from "react";
import { CloudArrowUp } from "phosphor-react";

type GreyMediaLibraryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export function GreyMediaLibraryButton({
  label = "Media Library",
  className = "",
  ...props
}: GreyMediaLibraryButtonProps) {
  return (
    <button
      type="button"
      className={`grey-media-library-btn ${className}`}
      {...props}
    >
      <CloudArrowUp size={14} weight="regular" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
