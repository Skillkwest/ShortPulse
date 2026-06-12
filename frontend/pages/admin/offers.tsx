/**
 * Admin offers route.
 * Lets operators manage the four public dashboard offer slots shown to logged-out visitors.
 */
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AppMessage } from "../../components/AppMessage";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import {
  ADMIN_DASHBOARD_OFFER_CTA_LABEL_MAX_LENGTH,
  ADMIN_DASHBOARD_OFFER_DISCOUNT_MAX_LENGTH,
  ADMIN_DASHBOARD_OFFER_EYEBROW_MAX_LENGTH,
  ADMIN_DASHBOARD_OFFER_SLOT_COUNT,
  ADMIN_DASHBOARD_OFFER_TARGET_MAX_LENGTH,
  ADMIN_DASHBOARD_OFFER_TITLE_MAX_LENGTH,
  type AdminDashboardOfferDraft,
  useAdminOffersController,
} from "../../features/admin/logic/useAdminOffersController";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

const OFFER_KIND_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "plan", label: "Plan" },
  { value: "credit_package", label: "Credit package" },
  { value: "model_pricing", label: "Model pricing" },
  { value: "storage_addon", label: "Media add-on" },
] as const;

type OfferSlotRowProps = {
  draft: AdminDashboardOfferDraft;
  index: number;
  isDisabled: boolean;
  onChange: (patch: Partial<AdminDashboardOfferDraft>) => void;
};

function OfferSlotRow({ draft, index, isDisabled, onChange }: OfferSlotRowProps) {
  return (
    <div className={styles.offerSlotRow}>
      <div className={styles.offerSlotNumber}>
        <span className="eyebrow">Offer {index + 1}</span>
        <label className={styles.offerSlotActiveToggle}>
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => onChange({ isActive: event.target.checked })}
            disabled={isDisabled}
          />
          <span>Active</span>
        </label>
      </div>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">
          Eyebrow ({draft.eyebrow.trim().length}/{ADMIN_DASHBOARD_OFFER_EYEBROW_MAX_LENGTH})
        </span>
        <input
          className={styles.searchInput}
          type="text"
          value={draft.eyebrow}
          onChange={(event) => onChange({ eyebrow: event.target.value })}
          maxLength={ADMIN_DASHBOARD_OFFER_EYEBROW_MAX_LENGTH}
          disabled={isDisabled}
        />
      </label>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">
          Title ({draft.title.trim().length}/{ADMIN_DASHBOARD_OFFER_TITLE_MAX_LENGTH})
        </span>
        <input
          className={styles.searchInput}
          type="text"
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={ADMIN_DASHBOARD_OFFER_TITLE_MAX_LENGTH}
          placeholder={`Offer ${index + 1} headline`}
          disabled={isDisabled}
        />
      </label>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">Type</span>
        <select
          className={styles.searchInput}
          value={draft.offerKind}
          onChange={(event) =>
            onChange({ offerKind: event.target.value as AdminDashboardOfferDraft["offerKind"] })
          }
          disabled={isDisabled}
        >
          {OFFER_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">
          Discount ({draft.discountLabel.trim().length}/{ADMIN_DASHBOARD_OFFER_DISCOUNT_MAX_LENGTH})
        </span>
        <input
          className={styles.searchInput}
          type="text"
          value={draft.discountLabel}
          onChange={(event) => onChange({ discountLabel: event.target.value })}
          maxLength={ADMIN_DASHBOARD_OFFER_DISCOUNT_MAX_LENGTH}
          placeholder="Save 30%"
          disabled={isDisabled}
        />
      </label>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">
          Target ({draft.targetLabel.trim().length}/{ADMIN_DASHBOARD_OFFER_TARGET_MAX_LENGTH})
        </span>
        <input
          className={styles.searchInput}
          type="text"
          value={draft.targetLabel}
          onChange={(event) => onChange({ targetLabel: event.target.value })}
          maxLength={ADMIN_DASHBOARD_OFFER_TARGET_MAX_LENGTH}
          placeholder="Studio annual"
          disabled={isDisabled}
        />
      </label>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">
          CTA ({draft.ctaLabel.trim().length}/{ADMIN_DASHBOARD_OFFER_CTA_LABEL_MAX_LENGTH})
        </span>
        <input
          className={styles.searchInput}
          type="text"
          value={draft.ctaLabel}
          onChange={(event) => onChange({ ctaLabel: event.target.value })}
          maxLength={ADMIN_DASHBOARD_OFFER_CTA_LABEL_MAX_LENGTH}
          disabled={isDisabled}
        />
      </label>

      <label className={styles.manualAdjustField}>
        <span className="tiny subdued">Link</span>
        <input
          className={styles.searchInput}
          type="text"
          value={draft.ctaHref}
          onChange={(event) => onChange({ ctaHref: event.target.value })}
          placeholder="/pricing"
          disabled={isDisabled}
        />
      </label>
    </div>
  );
}

export default function AdminOffersPage() {
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
    userId: user?.id ?? null,
  });
  const {
    drafts,
    loading: offersLoading,
    savingSlotIndex,
    savingAll,
    hasUnsavedChanges,
    result,
    error,
    updateDraft,
    loadOffers,
    saveAllOffers,
  } = useAdminOffersController({
    enabled: Boolean(user && adminEnabled),
  });

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Offers"
      metaDescription="Admin offer management for logged-out dashboard promotional cards."
      pageTitle="Offers"
      pageDescription="Create limited dashboard offers for plan, package, media add-on, or model-pricing promotions shown to logged-out visitors."
      userEmail={user?.email}
      currentPath="/admin/offers"
    >
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Offer slots</p>
            <h2 className={styles.adminSectionTitle}>Four dashboard offers</h2>
            <p className="tiny subdued">
              Each row controls one logged-out dashboard offer card, ordered from left to right.
            </p>
          </div>
          <div className={styles.adminStateActions}>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void saveAllOffers()}
              disabled={
                offersLoading || savingAll || savingSlotIndex !== null || !hasUnsavedChanges
              }
            >
              {savingAll ? "Saving..." : "Save offers"}
            </button>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => void loadOffers()}
              disabled={offersLoading || savingAll || savingSlotIndex !== null}
            >
              {offersLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className={styles.offerSlotRows}>
          {drafts.slice(0, ADMIN_DASHBOARD_OFFER_SLOT_COUNT).map((draft, index) => (
            <OfferSlotRow
              key={index}
              draft={draft}
              index={index}
              isDisabled={savingAll || savingSlotIndex === index}
              onChange={(patch) => updateDraft(index, patch)}
            />
          ))}
        </div>

        {error ? (
          <AppMessage
            className={styles.announcementError}
            tone="error"
            mode="banner"
            message={error}
          />
        ) : null}
        {result ? (
          <AppMessage
            className={styles.announcementResult}
            tone="success"
            mode="banner"
            message={result}
          />
        ) : null}
      </section>
    </AdminRouteShell>
  );
}
