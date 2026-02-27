/**
 * Clipboard helper with modern API + legacy fallback.
 * Isolated for reuse across admin triage surfaces.
 */

/**
 * Copies text to clipboard, returning whether the write succeeded.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  try {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to deprecated fallback for compatibility.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.width = "1px";
    textarea.style.height = "1px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};
