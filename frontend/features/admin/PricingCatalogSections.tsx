/**
 * Catalog-management sections for the admin pricing workspace.
 */
import React from "react";
import { PricingCreditPackagesSection } from "./PricingCreditPackagesSection";
import { PricingPlansSection } from "./PricingPlansSection";
import { PricingStorageAddonsSection } from "./PricingStorageAddonsSection";
import type { AdminPricingStateResponse } from "./types";
import type {
  CreditPackageDraft,
  PlanCreateDraft,
  PlanOfferDraft,
  StorageOfferDraft,
} from "./pricingPageUtils";
import styles from "../../styles/admin.module.css";

type PricingCatalogSectionsProps = {
  pricingState: AdminPricingStateResponse | null;
  planDraft: PlanCreateDraft | null;
  setPlanDraft: React.Dispatch<React.SetStateAction<PlanCreateDraft | null>>;
  planOfferDraft: PlanOfferDraft | null;
  setPlanOfferDraft: React.Dispatch<React.SetStateAction<PlanOfferDraft | null>>;
  planSaving: boolean;
  planMessage: string | null;
  planError: string | null;
  setPlanMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setPlanError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmPlanCreate: () => void;
  onConfirmPlanOffer: () => void;
  creditDraft: CreditPackageDraft | null;
  setCreditDraft: React.Dispatch<React.SetStateAction<CreditPackageDraft | null>>;
  creditSaving: boolean;
  creditMessage: string | null;
  creditError: string | null;
  setCreditMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setCreditError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmCreditPackage: () => void;
  storageDraft: StorageOfferDraft | null;
  setStorageDraft: React.Dispatch<React.SetStateAction<StorageOfferDraft | null>>;
  storageSaving: boolean;
  storageMessage: string | null;
  storageError: string | null;
  setStorageMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setStorageError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmStorageOffer: () => void;
};

export function PricingCatalogSections({
  pricingState,
  planDraft,
  setPlanDraft,
  planOfferDraft,
  setPlanOfferDraft,
  planSaving,
  planMessage,
  planError,
  setPlanMessage,
  setPlanError,
  onConfirmPlanCreate,
  onConfirmPlanOffer,
  creditDraft,
  setCreditDraft,
  creditSaving,
  creditMessage,
  creditError,
  setCreditMessage,
  setCreditError,
  onConfirmCreditPackage,
  storageDraft,
  setStorageDraft,
  storageSaving,
  storageMessage,
  storageError,
  setStorageMessage,
  setStorageError,
  onConfirmStorageOffer,
}: PricingCatalogSectionsProps) {
  const hasOpenEditor = Boolean(planDraft || planOfferDraft || creditDraft || storageDraft);
  const [isExpanded, setIsExpanded] = React.useState(hasOpenEditor);

  React.useEffect(() => {
    if (hasOpenEditor) setIsExpanded(true);
  }, [hasOpenEditor]);

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <h2 className={styles.adminSectionTitle}>Catalog tools</h2>
        </div>
        <button
          type="button"
          className="ghost-btn mini"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Hide catalog tools" : "Show catalog tools"}
        </button>
      </div>

      {isExpanded ? (
        <>
          <PricingPlansSection
            pricingState={pricingState}
            planDraft={planDraft}
            setPlanDraft={setPlanDraft}
            planOfferDraft={planOfferDraft}
            setPlanOfferDraft={setPlanOfferDraft}
            planSaving={planSaving}
            planMessage={planMessage}
            planError={planError}
            setPlanMessage={setPlanMessage}
            setPlanError={setPlanError}
            onConfirmPlanCreate={onConfirmPlanCreate}
            onConfirmPlanOffer={onConfirmPlanOffer}
          />

          <PricingCreditPackagesSection
            pricingState={pricingState}
            creditDraft={creditDraft}
            setCreditDraft={setCreditDraft}
            creditSaving={creditSaving}
            creditMessage={creditMessage}
            creditError={creditError}
            setCreditMessage={setCreditMessage}
            setCreditError={setCreditError}
            onConfirmCreditPackage={onConfirmCreditPackage}
          />

          <PricingStorageAddonsSection
            pricingState={pricingState}
            storageDraft={storageDraft}
            setStorageDraft={setStorageDraft}
            storageSaving={storageSaving}
            storageMessage={storageMessage}
            storageError={storageError}
            setStorageMessage={setStorageMessage}
            setStorageError={setStorageError}
            onConfirmStorageOffer={onConfirmStorageOffer}
          />
        </>
      ) : null}
    </section>
  );
}
