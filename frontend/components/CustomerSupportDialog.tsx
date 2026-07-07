/**
 * Shared customer-support contact dialog with mail-app and copy fallback actions.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { CUSTOMER_SUPPORT_EMAIL, CUSTOMER_SUPPORT_MAILTO_HREF } from "../lib/customerSupport";
import { useGuardedBackdropDismiss } from "./useGuardedBackdropDismiss";

type CopyState = "idle" | "copied" | "failed";

type CustomerSupportDialogControls = {
  customerSupportDialog: ReactNode;
  openCustomerSupportDialog: (event?: MouseEvent<HTMLElement>) => void;
};

const MAILTO_FALLBACK_DELAY_MS = 500;

const openEmailApp = () => {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = CUSTOMER_SUPPORT_MAILTO_HREF;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
};

/**
 * Provides a reusable support-contact trigger and dialog for customer-facing surfaces.
 * Inputs: optional click event from a support link.
 * Outputs: opener callback plus dialog node.
 * Side effects: attempts to open the configured mail app and can copy the support email.
 */
export function useCustomerSupportDialog(): CustomerSupportDialogControls {
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const fallbackTimerRef = useRef<number | null>(null);
  const mailAttemptBlurredRef = useRef(false);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setCopyState("idle");
  }, []);

  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(closeDialog);

  const openCustomerSupportDialog = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      event?.preventDefault();
      clearFallbackTimer();
      setCopyState("idle");
      setIsOpen(false);

      mailAttemptBlurredRef.current = false;
      const handleWindowBlur = () => {
        mailAttemptBlurredRef.current = true;
      };

      if (typeof window !== "undefined") {
        window.addEventListener("blur", handleWindowBlur, { once: true });
        fallbackTimerRef.current = window.setTimeout(() => {
          window.removeEventListener("blur", handleWindowBlur);
          fallbackTimerRef.current = null;
          const documentIsHidden =
            typeof document !== "undefined" && document.visibilityState === "hidden";
          if (!mailAttemptBlurredRef.current && !documentIsHidden) {
            setIsOpen(true);
          }
        }, MAILTO_FALLBACK_DELAY_MS);
      } else {
        setIsOpen(true);
      }

      openEmailApp();
    },
    [clearFallbackTimer]
  );

  useEffect(() => clearFallbackTimer, [clearFallbackTimer]);

  const handleCopyEmail = useCallback(async () => {
    try {
      const copied = await copyTextToClipboard(CUSTOMER_SUPPORT_EMAIL);
      setCopyState(copied ? "copied" : "failed");
    } catch {
      setCopyState("failed");
    }
  }, []);

  const customerSupportDialog = isOpen ? (
    <div
      {...backdropDismiss}
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="confirm-modal confirm-modal--primary customer-support-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal__copy">
          <h3 id={titleId} className="confirm-modal__title">
            Contact Customer Support
          </h3>
          <div className="confirm-modal__body">
            <p>
              Use the email below. If your browser does not open an email app, copy the address.
            </p>
            <p className="customer-support-dialog__email">{CUSTOMER_SUPPORT_EMAIL}</p>
            {copyState === "copied" ? (
              <p className="customer-support-dialog__status" role="status">
                Email copied.
              </p>
            ) : null}
            {copyState === "failed" ? (
              <p className="customer-support-dialog__status" role="status">
                Copy failed. Select the email address and copy it manually.
              </p>
            ) : null}
          </div>
        </div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__button confirm-modal__button--cancel"
            onClick={closeDialog}
          >
            Close
          </button>
          <button
            type="button"
            className="confirm-modal__button confirm-modal__button--cancel"
            onClick={handleCopyEmail}
          >
            {copyState === "copied" ? "Copied" : "Copy email"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { customerSupportDialog, openCustomerSupportDialog };
}
