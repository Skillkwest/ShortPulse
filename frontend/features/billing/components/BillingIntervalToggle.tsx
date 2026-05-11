import type { BillingInterval } from "../catalog";

type BillingIntervalToggleProps = {
  selectedBillingInterval: BillingInterval;
  annualSavingsPercent: number;
  onChange: (billingInterval: BillingInterval) => void;
  className?: string;
};

/**
 * Shared monthly/annual segmented control used across pricing surfaces.
 */
export function BillingIntervalToggle({
  selectedBillingInterval,
  annualSavingsPercent,
  onChange,
  className = "",
}: BillingIntervalToggleProps) {
  const wrapperClassName = ["pricing-interval-stack", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClassName}>
      <div className="pricing-interval-toggle" role="group" aria-label="Billing interval">
        <button
          type="button"
          className={`pricing-interval-option ${selectedBillingInterval === "month" ? "is-active" : ""}`}
          aria-pressed={selectedBillingInterval === "month"}
          onClick={() => onChange("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`pricing-interval-option ${selectedBillingInterval === "year" ? "is-active" : ""}`}
          aria-pressed={selectedBillingInterval === "year"}
          onClick={() => onChange("year")}
        >
          Annual
        </button>
      </div>
      <p className="pricing-interval-support">
        <span className="pricing-interval-badge">Save up to {annualSavingsPercent || 0}%</span>
        <span className="pricing-interval-support-copy">with annual billing paid upfront</span>
      </p>
    </div>
  );
}
