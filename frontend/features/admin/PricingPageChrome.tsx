import { ConfirmationModal } from "../../components/ConfirmationModal";
import styles from "../../styles/admin.module.css";
import type { CostDocsPopover, PricingView } from "./pricingPageUtils";
import type { AdminPricingHealthSummary, AdminPricingPlanRow } from "./types";

export type PricingConfirmationDiffRow = {
  label: string;
  before: string;
  after: string;
};

export type PricingConfirmationIntent = {
  title: string;
  description: string;
  confirmLabel: string;
  rows: PricingConfirmationDiffRow[];
  hasInvalidDraft: boolean;
  onConfirm: () => void;
};

export type PricingWorkspaceState = {
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  actionLabel: string;
};

export const getProviderLabelClassName = (provider: string): string => {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "fal") return styles.pricingProviderFal;
  if (normalized === "kie") return styles.pricingProviderKie;
  if (normalized === "elevenlabs") return styles.pricingProviderElevenLabs;
  return "";
};

type PlanStatus = AdminPricingPlanRow["status"];

export const getPlanStatusClassName = (status: PlanStatus): string => {
  if (status === "active") return styles.pillOk;
  if (status === "baseline_access") return styles.pillInfo;
  if (status === "payment_exempt") return styles.pillInfo;
  if (status === "legacy") return styles.pillWarn;
  return styles.pillCritical;
};

export const getPlanStatusLabel = (status: PlanStatus): string => {
  if (status === "baseline_access") return "baseline access";
  if (status === "payment_exempt") return "payment exempt";
  return status;
};

export const getPricingAuthorityClassName = (
  authority: "shared_policy" | "local_pricing" | "metadata_only"
): string => {
  if (authority === "shared_policy") return styles.pillOk;
  if (authority === "local_pricing") return styles.pillWarn;
  return styles.pillInfo;
};

export const getStripeStatus = ({
  priceCents,
  stripePriceId,
  isActive = true,
}: {
  priceCents: number;
  stripePriceId: string | null;
  isActive?: boolean;
}): { label: string; className: string; isMono: boolean } => {
  if (!isActive) {
    return { label: "inactive", className: styles.pillWarn, isMono: false };
  }
  if (priceCents <= 0) {
    return { label: "No Stripe price required", className: styles.pillInfo, isMono: false };
  }
  if (!stripePriceId) {
    return { label: "Missing Stripe price", className: styles.pillCritical, isMono: false };
  }
  return { label: stripePriceId, className: styles.pricingMonoCell, isMono: true };
};

export function PricingWorkspaceNotice({
  workspaceState,
  pricingLoading,
  pricingRefreshing,
  onRefresh,
}: {
  workspaceState: PricingWorkspaceState;
  pricingLoading: boolean;
  pricingRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Pricing workspace</p>
          <h2 className={styles.adminSectionTitle}>{workspaceState.title}</h2>
          <p className="tiny subdued">{workspaceState.description}</p>
        </div>
        <button
          type="button"
          className="ghost-btn mini"
          onClick={onRefresh}
          disabled={pricingLoading || pricingRefreshing}
        >
          {pricingLoading || pricingRefreshing ? "Refreshing…" : workspaceState.actionLabel}
        </button>
      </div>
      <div className={styles.adminStatePanel}>
        <p className={styles.adminStateEyebrow}>{workspaceState.eyebrow}</p>
        <h3 className={styles.adminStateTitle}>{workspaceState.title}</h3>
        <p className={styles.adminStateDescription}>{workspaceState.description}</p>
        <p className={styles.adminStateDescriptionMuted}>{workspaceState.helper}</p>
      </div>
    </section>
  );
}

export function PricingViewTabs({
  tabs,
  selectedPricingView,
  onSelect,
}: {
  tabs: Array<{ id: PricingView; label: string }>;
  selectedPricingView: PricingView;
  onSelect: (view: PricingView) => void;
}) {
  return (
    <nav className={styles.adminNavRow} aria-label="Pricing views">
      {tabs.map((tab) => {
        const active = tab.id === selectedPricingView;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            className={`${styles.adminNavLink} ${styles.adminNavButton} ${
              active ? styles.adminNavLinkActive : ""
            }`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function PricingHealthSection({
  health,
}: {
  health: AdminPricingHealthSummary | null | undefined;
}) {
  if (!health?.totalWarnings) return null;
  return (
    <section className={`${styles.adminSection} ${styles.pricingHealthSection}`}>
      <div className={styles.adminSectionHead}>
        <div>
          <h2 className={styles.adminSectionTitle}>Catalog warnings</h2>
        </div>
      </div>
      <ul className={styles.pricingWarningList}>
        {health.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

export function PricingCostDocsPopover({ popover }: { popover: CostDocsPopover | null }) {
  if (!popover) return null;
  return (
    <div
      className={styles.pricingCostDocsPopover}
      style={{ left: popover.x, top: popover.y }}
      role="tooltip"
    >
      <p className="eyebrow">Provider docs</p>
      <h3>{popover.title}</h3>
      <div className={styles.pricingCostDocsBody}>
        {popover.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function PricingConfirmationDialog({
  pendingConfirmation,
  onCancel,
  onConfirm,
  confirmDisabled,
  cancelDisabled,
}: {
  pendingConfirmation: PricingConfirmationIntent | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  cancelDisabled: boolean;
}) {
  if (!pendingConfirmation) return null;
  return (
    <ConfirmationModal
      title={pendingConfirmation.title}
      body={
        <div className={styles.pricingConfirmationBody}>
          <p>{pendingConfirmation.description}</p>
          <div className={styles.pricingConfirmationDiff}>
            <div className={styles.pricingConfirmationDiffHead}>
              <span>Change</span>
              <span>Before</span>
              <span>After</span>
            </div>
            {pendingConfirmation.rows.map((row) => (
              <div key={row.label} className={styles.pricingConfirmationDiffRow}>
                <span>{row.label}</span>
                <span>{row.before}</span>
                <span>{row.after}</span>
              </div>
            ))}
          </div>
        </div>
      }
      confirmLabel={pendingConfirmation.confirmLabel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      tone="primary"
      confirmDisabled={confirmDisabled}
      cancelDisabled={cancelDisabled}
    />
  );
}
