/**
 * AI Studio insufficient-credits top-up modal.
 * Keeps the creative-surface interruption local while delegating payment collection to Stripe Checkout.
 */
import React from "react";
import { CreditCard, X } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  buildInsufficientCreditsModalCopy,
  INSUFFICIENT_CREDITS_TITLE,
} from "../logic/insufficientCredits";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type CreditPackage = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  sort_order: number;
};

type AiStudioInsufficientCreditsModalProps = {
  isOpen: boolean;
  requiredCredits?: number | null;
  availableCredits?: number | null;
  onClose: () => void;
  onCheckoutStarted?: () => void;
};

const formatCurrencyFromCents = (cents: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, cents) / 100);

const resolveReturnPath = (): string => {
  if (typeof window === "undefined") return "/ai-studio";
  const pathname = window.location.pathname || "/ai-studio";
  const search = window.location.search || "";
  if (pathname !== "/ai-studio") return "/ai-studio";
  return `${pathname}${search}`;
};

const choosePackage = (
  packages: CreditPackage[],
  requiredCredits?: number | null,
  availableCredits?: number | null
): CreditPackage | null => {
  if (!packages.length) return null;
  const shortfall =
    typeof requiredCredits === "number" && typeof availableCredits === "number"
      ? Math.max(0, Math.ceil(requiredCredits) - Math.floor(availableCredits))
      : null;
  if (shortfall && shortfall > 0) {
    return packages.find((pkg) => pkg.credit_amount_cents >= shortfall) ?? packages[0] ?? null;
  }
  return packages[0] ?? null;
};

/**
 * Renders a blocking-but-dismissable credit top-up prompt.
 * Inputs: open state plus known required/available credit values.
 * Side effects: loads active top-up packages and redirects to Stripe Checkout when requested.
 */
export function AiStudioInsufficientCreditsModal({
  isOpen,
  requiredCredits = null,
  availableCredits = null,
  onClose,
  onCheckoutStarted,
}: AiStudioInsufficientCreditsModalProps) {
  const [packages, setPackages] = React.useState<CreditPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = React.useState(false);
  const [loadingCheckout, setLoadingCheckout] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  useAiStudioModalActivity("ai-studio-insufficient-credits", isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingPackages(true);
    setError(null);
    fetchWithAuth("/api/billing/credit-packages")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load credit packages.");
        }
        if (!cancelled) {
          setPackages(Array.isArray(payload?.packages) ? payload.packages : []);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPackages([]);
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load credit packages."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPackages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const selectedPackage = React.useMemo(
    () => choosePackage(packages, requiredCredits, availableCredits),
    [availableCredits, packages, requiredCredits]
  );

  const handleCheckout = React.useCallback(async () => {
    if (!selectedPackage) {
      window.location.assign("/profile?section=credits");
      return;
    }
    setLoadingCheckout(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          returnPath: resolveReturnPath(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to start checkout.");
      }
      if (typeof payload?.checkoutUrl === "string" && payload.checkoutUrl.trim()) {
        onCheckoutStarted?.();
        window.location.assign(payload.checkoutUrl);
        return;
      }
      throw new Error("Checkout session created, but no redirect URL was returned.");
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout."
      );
      setLoadingCheckout(false);
    }
  }, [onCheckoutStarted, selectedPackage]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bodyCopy = buildInsufficientCreditsModalCopy({ requiredCredits, availableCredits });
  const packageLabel = selectedPackage
    ? `${selectedPackage.display_name} - ${selectedPackage.credit_amount_cents.toLocaleString()} credits`
    : null;

  return (
    <AiStudioModalLayer>
      <div className="ai-credit-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="ai-credit-modal" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="ai-credit-modal-close"
            aria-label="Close credit top-up"
            onClick={onClose}
          >
            <X size={16} />
          </button>
          <div className="ai-credit-modal-icon" aria-hidden="true">
            <CreditCard size={24} />
          </div>
          <div className="ai-credit-modal-copy">
            <p className="ai-credit-modal-eyebrow">Credits</p>
            <h2>{INSUFFICIENT_CREDITS_TITLE}</h2>
            <p>{bodyCopy}</p>
          </div>
          {selectedPackage ? (
            <div className="ai-credit-modal-package" aria-label="Recommended credit package">
              <span>{packageLabel}</span>
              <strong>{formatCurrencyFromCents(selectedPackage.price_cents)}</strong>
            </div>
          ) : null}
          {error ? <p className="ai-credit-modal-error">{error}</p> : null}
          <div className="ai-credit-modal-actions">
            <button type="button" className="ai-credit-modal-secondary" onClick={onClose}>
              Not now
            </button>
            <button
              type="button"
              className="ai-credit-modal-primary"
              onClick={handleCheckout}
              disabled={loadingPackages || loadingCheckout}
            >
              {loadingCheckout
                ? "Starting checkout..."
                : selectedPackage
                  ? "Top up credits"
                  : "View credit packs"}
            </button>
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
