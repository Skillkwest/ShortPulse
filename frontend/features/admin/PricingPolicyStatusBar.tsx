import React from "react";
import styles from "../../styles/admin.module.css";

export function PricingPolicyStatusBar({
  activePolicyVersion,
  updatedAt,
  updatedByEmail,
  isDraftDirty,
  draftPolicyDiffDescriptions,
  saveDisabled,
  resetDisabled,
  rollbackDisabled,
  saveLoading,
  rollbackLoading,
  onSave,
  onReset,
  onRollback,
}: {
  activePolicyVersion: number | null | undefined;
  updatedAt: string | null | undefined;
  updatedByEmail: string | null | undefined;
  isDraftDirty: boolean;
  draftPolicyDiffDescriptions: string[];
  saveDisabled: boolean;
  resetDisabled: boolean;
  rollbackDisabled: boolean;
  saveLoading: boolean;
  rollbackLoading: boolean;
  onSave: () => void;
  onReset: () => void;
  onRollback: () => void;
}) {
  const updatedSummary = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleString()}${updatedByEmail ? ` by ${updatedByEmail}` : ""}.`
    : "No live policy metadata.";
  const statusLabel = isDraftDirty ? "Unsaved pricing edits" : "Live pricing active";

  return (
    <section className={`${styles.adminSection} ${styles.pricingPolicyStatusBar}`}>
      <div className={styles.pricingPolicyStatusMeta}>
        <div className={styles.pricingPolicyStatusGroup}>
          <h2 className={styles.adminSectionTitle}>
            {activePolicyVersion != null ? `Live policy v${activePolicyVersion}` : "Live policy"}
          </h2>
          <p className="tiny subdued">{updatedSummary}</p>
        </div>

        <div className={styles.pricingPolicyStatusGroup}>
          <div className={styles.pricingPolicyStatusRow}>
            <span
              className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}
              role="status"
            >
              {statusLabel}
            </span>
          </div>
          {draftPolicyDiffDescriptions.length > 0 ? (
            <ul className={styles.pricingPolicyDiffList}>
              {draftPolicyDiffDescriptions.map((description) => (
                <li key={description}>{description}</li>
              ))}
            </ul>
          ) : (
            <p className="tiny subdued">
              No runtime pricing edits. Built-in display rows are loaded from code.
            </p>
          )}
          {isDraftDirty ? (
            <p className="tiny subdued">
              Use <strong>Save draft live</strong> only when you intentionally changed runtime
              prices in the grid.
            </p>
          ) : (
            <p className="tiny subdued">Edit the grid to create a saveable pricing draft.</p>
          )}
        </div>
      </div>

      <div className={styles.pricingPolicyStatusActions}>
        <button type="button" className="ghost-btn mini" onClick={onReset} disabled={resetDisabled}>
          Reset draft
        </button>
        <button
          type="button"
          className="ghost-btn mini"
          onClick={onRollback}
          disabled={rollbackDisabled}
        >
          {rollbackLoading ? "Rolling back…" : "Rollback live"}
        </button>
        <button
          type="button"
          className={`ghost-btn mini ${isDraftDirty ? styles.pricingSaveButtonDirty : ""}`}
          onClick={onSave}
          disabled={saveDisabled}
        >
          {saveLoading ? "Saving…" : "Save draft live"}
        </button>
      </div>
    </section>
  );
}
