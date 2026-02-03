import React from "react";
import { CloudArrowUp } from "phosphor-react";

type GreyMediaLibraryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  icon?: React.ReactNode;
};

export function GreyMediaLibraryButton({
  label = "Media Library",
  icon,
  className = "",
  ...props
}: GreyMediaLibraryButtonProps) {
  return (
    <button
      type="button"
      className={`grey-media-library-btn ${className}`}
      {...props}
    >
      {icon ?? <CloudArrowUp size={14} weight="regular" aria-hidden />}
      <span>{label}</span>
    </button>
  );
}
