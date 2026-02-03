import React from "react";

type PromptLibraryButtonTone = "library" | "save";

type PromptLibraryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: React.ReactNode;
  tone?: PromptLibraryButtonTone;
};

/**
 * Prefab button for prompt library actions (Media Library / Save Prompt).
 */
export function PromptLibraryButton({
  label,
  icon,
  tone = "library",
  className = "",
  ...props
}: PromptLibraryButtonProps) {
  return (
    <button
      type="button"
      className={`prompt-library-btn prompt-library-btn--${tone} ${className}`.trim()}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
