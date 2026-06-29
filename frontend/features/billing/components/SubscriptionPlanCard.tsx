import type { ReactNode } from "react";
import { CheckCircle, XCircle } from "phosphor-react";
import {
  buildPlanView,
  formatConcurrentGenerationsLabel,
  resolvePlanPricingForInterval,
  type BillingInterval,
  type BillingPlanRecord,
} from "../catalog";
import { formatStorageBytes } from "../storage";

type SubscriptionPlanCardProps = {
  plan: BillingPlanRecord;
  plans: BillingPlanRecord[];
  billingInterval: BillingInterval;
  actionSlot: ReactNode;
  isSelected?: boolean;
  isCurrent?: boolean;
  stateBadgeLabel?: string | null;
  featuredBadgeLabel?: string | null;
  className?: string;
};

const formatPlanCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);

const formatSavingsPercent = (value: number): string => `${Math.max(1, Math.round(value))}% OFF`;

/**
 * Shared subscription plan card used by public pricing and profile subscription surfaces.
 */
export function SubscriptionPlanCard({
  plan,
  plans,
  billingInterval,
  actionSlot,
  isSelected = false,
  isCurrent = false,
  stateBadgeLabel = null,
  featuredBadgeLabel = null,
  className = "",
}: SubscriptionPlanCardProps) {
  const planView = buildPlanView({ planId: plan.id, plans });
  const monthlyPricing = resolvePlanPricingForInterval(plan, "month");
  const selectedPricing = resolvePlanPricingForInterval(plan, billingInterval);
  const pricing =
    billingInterval === "year" && !selectedPricing.hasLiveOffer ? monthlyPricing : selectedPricing;
  const showsAnnualSavings =
    billingInterval === "year" &&
    selectedPricing.hasLiveOffer &&
    monthlyPricing.monthlyEquivalentCents > pricing.monthlyEquivalentCents &&
    pricing.savingsAmountCents > 0;
  const creditsLabel = `${pricing.monthlyCreditsCents.toLocaleString()} credits every month`;
  const storageLabel = `${formatStorageBytes(pricing.storageLimitBytes)} of media storage`;
  const featureRows = [
    {
      label: creditsLabel,
      included: true,
      annotation: planView.bonusCreditsLabel,
    },
    {
      label: storageLabel,
      included: true,
      annotation: null,
    },
    ...planView.cardFeatures.slice(0, 4).map((feature) => ({
      label: feature.label,
      included: feature.included,
      annotation: null,
    })),
    {
      label: formatConcurrentGenerationsLabel(pricing.maxConcurrentGenerations),
      included: true,
      annotation: null,
    },
    ...planView.cardFeatures.slice(4).map((feature) => ({
      label: feature.label,
      included: feature.included,
      annotation: null,
    })),
  ];
  const priceDisplay = formatPlanCurrency(pricing.monthlyEquivalentCents);
  const priceCompareDisplay = showsAnnualSavings
    ? formatPlanCurrency(monthlyPricing.monthlyEquivalentCents)
    : null;
  const billingCopy =
    billingInterval === "year"
      ? selectedPricing.hasLiveOffer
        ? "per month billed annually"
        : "Annual pricing unavailable"
      : "Billed monthly";
  const cardClasses = [
    "subscription-plan-card",
    planView.className,
    isSelected ? "is-selected" : "",
    isCurrent ? "is-current" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClasses}>
      <div className="subscription-plan-card-frame">
        <div className="subscription-plan-card-head">
          <div className="subscription-plan-card-top">
            <h3 className="subscription-plan-card-title">{planView.displayName}</h3>
            <div className="subscription-plan-card-tags" aria-label="Plan badges">
              {featuredBadgeLabel ? (
                <span className="subscription-plan-card-tag is-featured">{featuredBadgeLabel}</span>
              ) : null}
              {showsAnnualSavings ? (
                <span className="subscription-plan-card-tag is-discount">
                  {formatSavingsPercent(pricing.savingsPercent)}
                </span>
              ) : null}
              {stateBadgeLabel ? (
                <span className="subscription-plan-card-tag is-state">{stateBadgeLabel}</span>
              ) : null}
            </div>
          </div>

          <div className="subscription-plan-card-price-block">
            {showsAnnualSavings ? (
              <div className="subscription-plan-card-price-row is-annual">
                <span className="subscription-plan-card-price is-struck">
                  {priceCompareDisplay}
                </span>
                <span className="subscription-plan-card-price">{priceDisplay}</span>
              </div>
            ) : (
              <div className="subscription-plan-card-price-row">
                <span className="subscription-plan-card-price">{priceDisplay}</span>
              </div>
            )}
            <p className="subscription-plan-card-billing-copy">{billingCopy}</p>
          </div>
        </div>

        <ul className="subscription-plan-card-feature-list">
          {featureRows.map((feature) => (
            <li
              key={`${plan.id}-${feature.label}`}
              className={feature.included ? "is-included" : "is-excluded"}
            >
              {feature.included ? (
                <CheckCircle size={18} weight="bold" />
              ) : (
                <XCircle size={18} weight="bold" />
              )}
              <div className="subscription-plan-card-feature-copy">
                <span>{feature.label}</span>
                {feature.annotation ? (
                  <span className="subscription-plan-card-feature-annotation">
                    {feature.annotation}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {showsAnnualSavings ? (
          <div className="subscription-plan-card-save-chip">
            {`Save ${formatPlanCurrency(pricing.savingsAmountCents)}`}
          </div>
        ) : (
          <div className="subscription-plan-card-save-chip is-placeholder" aria-hidden="true" />
        )}

        <p className="subscription-plan-card-footer-copy">{planView.cardFooterDescription}</p>

        <div className="subscription-plan-card-action">{actionSlot}</div>
      </div>
    </article>
  );
}
