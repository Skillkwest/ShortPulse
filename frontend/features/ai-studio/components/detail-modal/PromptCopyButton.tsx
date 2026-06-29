/**
 * Small clipboard action used by AI Studio detail modals to copy prompt text.
 */
import React from "react";
import { Check, CopySimple } from "phosphor-react";

type PromptCopyButtonProps = {
  text: string;
  className?: string;
};

const copyTextToClipboard = async (text: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

export function PromptCopyButton({ text, className = "" }: PromptCopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<number | null>(null);
  const copyableText = text.trim();
  const buttonClassName = ["art-copy-prompt-btn", "art-action-btn", "is-icon-only", className]
    .filter(Boolean)
    .join(" ");

  React.useEffect(
    () => () => {
      if (copyTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    []
  );

  const handleCopy = React.useCallback(async () => {
    if (!copyableText) return;
    await copyTextToClipboard(text);
    setCopied(true);
    if (copyTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(copyTimerRef.current);
    }
    if (typeof window === "undefined") return;
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1400);
  }, [copyableText, text]);

  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={handleCopy}
      aria-label="Copy prompt"
      title={copied ? "Copied" : "Copy prompt"}
      disabled={!copyableText}
    >
      {copied ? (
        <Check size={16} weight="bold" aria-hidden />
      ) : (
        <CopySimple size={16} weight="bold" aria-hidden />
      )}
    </button>
  );
}
