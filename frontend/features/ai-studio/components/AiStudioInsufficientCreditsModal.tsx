/**
 * AI Studio insufficient-credits top-up modal.
 * Keeps the creative-surface interruption local while delegating payment collection to Stripe Checkout.
 */
import React from "react";
import { X } from "phosphor-react";
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

const resolvePackageDisplayName = (pkg: CreditPackage): string => {
  const creditAmount = pkg.credit_amount_cents.toLocaleString();
  const escapedCreditAmount = creditAmount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutTrailingAmount = pkg.display_name
    .replace(new RegExp(`\\s+${escapedCreditAmount}$`), "")
    .trim();
  return withoutTrailingAmount || pkg.display_name;
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
  const [checkoutPackageId, setCheckoutPackageId] = React.useState<string | null>(null);
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

  const sortedPackages = React.useMemo(
    () => [...packages].sort((left, right) => left.sort_order - right.sort_order),
    [packages]
  );

  React.useEffect(() => {
    if (!isOpen) setCheckoutPackageId(null);
  }, [isOpen]);

  const handleCheckout = React.useCallback(
    async (packageToBuy: CreditPackage) => {
      setCheckoutPackageId(packageToBuy.id);
      setError(null);
      try {
        const response = await fetchWithAuth("/api/billing/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: packageToBuy.id,
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
        setCheckoutPackageId(null);
      }
    },
    [onCheckoutStarted]
  );

  const handleOpenAccountCredits = React.useCallback(() => {
    window.location.assign("/profile?section=credits");
  }, []);

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

  return (
    <AiStudioModalLayer>
      <div className="ai-credit-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="ai-credit-modal" onClick={(event) => event.stopPropagation()}>
          <div className="ai-credit-modal-top-actions">
            <button
              type="button"
              className="ai-credit-modal-account"
              onClick={handleOpenAccountCredits}
            >
              Manage credits
            </button>
            <button
              type="button"
              className="ai-credit-modal-close"
              aria-label="Close credit top-up"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
          <div className="ai-credit-modal-copy">
            <p className="ai-credit-modal-eyebrow">Credits</p>
            <h2>{INSUFFICIENT_CREDITS_TITLE}</h2>
            <p>{bodyCopy}</p>
          </div>
          {loadingPackages ? (
            <div className="ai-credit-modal-package-empty">Loading credit packs...</div>
          ) : sortedPackages.length > 0 ? (
            <div className="ai-credit-modal-package-grid" aria-label="Credit top-up packages">
              {sortedPackages.map((pkg) => {
                const packageDisplayName = resolvePackageDisplayName(pkg);
                const checkoutInProgress = checkoutPackageId !== null;
                return (
                  <article
                    key={pkg.id}
                    className="ai-credit-modal-package-card"
                    aria-label={`${packageDisplayName} credit top-up package`}
                  >
                    <span className="ai-credit-modal-package-kicker">Credit package</span>
                    <span className="ai-credit-modal-package-name">{packageDisplayName}</span>
                    <strong>
                      {pkg.credit_amount_cents.toLocaleString()}{" "}
                      <span className="ai-credit-modal-package-unit">credits</span>
                    </strong>
                    <span className="ai-credit-modal-package-price">
                      {formatCurrencyFromCents(pkg.price_cents)} one-time purchase
                    </span>
                    <button
                      type="button"
                      className="ai-credit-modal-package-buy"
                      aria-label={`Buy credits: ${packageDisplayName}`}
                      onClick={() => handleCheckout(pkg)}
                      disabled={checkoutInProgress}
                    >
                      {checkoutPackageId === pkg.id ? "Starting checkout..." : "Buy credits"}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ai-credit-modal-package-empty">No credit packs are available.</div>
          )}
          {error ? <p className="ai-credit-modal-error">{error}</p> : null}
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
