import React from "react";

type PromptLibraryButtonTone = "library" | "save";

type PromptLibraryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: React.ReactNode;
  tone?: PromptLibraryButtonTone;
  showLabel?: boolean;
};

/**
 * Prefab button for prompt library actions (Media Library / Save Prompt).
 */
export function PromptLibraryButton({
  label,
  icon,
  tone = "library",
  showLabel = true,
  className = "",
  ...props
}: PromptLibraryButtonProps) {
  return (
    <button
      type="button"
      className={`prompt-library-btn prompt-library-btn--${tone}${showLabel ? "" : " is-icon-only"} ${className}`.trim()}
      {...props}
    >
      {icon}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
