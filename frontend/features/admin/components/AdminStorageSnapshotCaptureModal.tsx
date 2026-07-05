/**
 * Admin storage snapshot capture modal.
 * Lets an admin enter provider-side Supabase usage evidence for the storage economics panel.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import styles from "../../../styles/admin.module.css";
import type { AdminStorageProviderUsage } from "../types";

type AdminStorageSnapshotCaptureModalProps = {
  providerUsage: AdminStorageProviderUsage;
  onClose: () => void;
  onCaptured: () => Promise<void> | void;
};

type SnapshotFormState = {
  snapshotMonth: string;
  capturedAt: string;
  source: AdminStorageProviderUsage["source"];
  supabasePlan: string;
  computePlan: string;
  computeMonthlyCostCents: string;
  storageUsedGb: string;
  storageIncludedGb: string;
  uncachedEgressGb: string;
  cachedEgressGb: string;
  uncachedEgressIncludedGb: string;
  cachedEgressIncludedGb: string;
  observedStorageOverageCostCents: string;
  observedUncachedEgressOverageCostCents: string;
  observedCachedEgressOverageCostCents: string;
  notes: string;
};

const SNAPSHOT_SOURCE_OPTIONS: Array<{
  value: Exclude<AdminStorageProviderUsage["source"], "unavailable">;
  label: string;
}> = [
  { value: "manual", label: "Manual entry" },
  { value: "supabase_usage_page", label: "Supabase usage page" },
  { value: "supabase_export", label: "Supabase export" },
  { value: "api_import", label: "API import" },
];

const toMonthInputValue = (value = new Date()): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const toDateTimeLocalInputValue = (value = new Date()): string => {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
};

const gbField = (value: number, fallback: number): string =>
  Number.isFinite(value) && value > 0 ? String(value) : String(fallback);

const buildInitialState = (providerUsage: AdminStorageProviderUsage): SnapshotFormState => ({
  snapshotMonth: toMonthInputValue(),
  capturedAt: toDateTimeLocalInputValue(),
  source: providerUsage.source === "unavailable" ? "supabase_usage_page" : providerUsage.source,
  supabasePlan: providerUsage.supabasePlan ?? "",
  computePlan: providerUsage.computePlan || "medium",
  computeMonthlyCostCents: String(providerUsage.computeMonthlyCostCents || 6000),
  storageUsedGb: providerUsage.status === "unavailable" ? "" : String(providerUsage.storageUsedGb),
  storageIncludedGb: gbField(providerUsage.storageIncludedGb, 100),
  uncachedEgressGb:
    providerUsage.status === "unavailable" ? "" : String(providerUsage.uncachedEgressGb),
  cachedEgressGb:
    providerUsage.status === "unavailable" ? "" : String(providerUsage.cachedEgressGb),
  uncachedEgressIncludedGb: gbField(providerUsage.uncachedEgressIncludedGb, 250),
  cachedEgressIncludedGb: gbField(providerUsage.cachedEgressIncludedGb, 250),
  observedStorageOverageCostCents: "",
  observedUncachedEgressOverageCostCents: "",
  observedCachedEgressOverageCostCents: "",
  notes: "",
});

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" && payload.error ? payload.error : fallback;
};

const toPayload = (form: SnapshotFormState) => ({
  ...form,
  source: form.source === "unavailable" ? "manual" : form.source,
  capturedAt: new Date(form.capturedAt).toISOString(),
  observedStorageOverageCostCents: form.observedStorageOverageCostCents || null,
  observedUncachedEgressOverageCostCents: form.observedUncachedEgressOverageCostCents || null,
  observedCachedEgressOverageCostCents: form.observedCachedEgressOverageCostCents || null,
});

const requiredFieldsFilled = (form: SnapshotFormState): boolean =>
  Boolean(
    form.snapshotMonth &&
    form.capturedAt &&
    form.source !== "unavailable" &&
    form.computeMonthlyCostCents &&
    form.storageUsedGb &&
    form.storageIncludedGb &&
    form.uncachedEgressGb &&
    form.cachedEgressGb &&
    form.uncachedEgressIncludedGb &&
    form.cachedEgressIncludedGb
  );

const SnapshotField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className={styles.adminSnapshotField}>
    <span>{label}</span>
    {children}
  </label>
);

/**
 * Renders the storage snapshot capture dialog.
 * Inputs: current provider snapshot, close handler, and refresh callback.
 * Outputs: modal form controls.
 * Side effects: writes one admin provider snapshot through `/api/admin/storage-usage-snapshots`.
 */
export function AdminStorageSnapshotCaptureModal({
  providerUsage,
  onClose,
  onCaptured,
}: AdminStorageSnapshotCaptureModalProps) {
  const [form, setForm] = React.useState<SnapshotFormState>(() => buildInitialState(providerUsage));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const updateField = (field: keyof SnapshotFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requiredFieldsFilled(form)) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/admin/storage-usage-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Unable to capture storage usage snapshot.")
        );
      }
      await onCaptured();
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to capture storage usage snapshot."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.adminModalBackdrop} role="dialog" aria-modal="true">
      <form className={styles.adminModalCard} onSubmit={(event) => void handleSubmit(event)}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Provider snapshot</p>
            <h2 className={styles.adminSectionTitle}>Capture Supabase usage</h2>
            <p className="tiny subdued">
              Enter usage evidence from Supabase billing, usage, or export surfaces.
            </p>
          </div>
          <button type="button" className="ghost-btn mini" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        {error ? (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="warning"
            mode="banner"
            message={error}
          />
        ) : null}

        <div className={styles.adminSnapshotFormGrid}>
          <SnapshotField label="Snapshot month">
            <input
              type="month"
              value={form.snapshotMonth}
              onChange={(event) => updateField("snapshotMonth", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Captured at">
            <input
              type="datetime-local"
              value={form.capturedAt}
              onChange={(event) => updateField("capturedAt", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Source">
            <select
              value={form.source}
              onChange={(event) => updateField("source", event.target.value)}
              required
            >
              {SNAPSHOT_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SnapshotField>
          <SnapshotField label="Supabase plan">
            <input
              type="text"
              value={form.supabasePlan}
              onChange={(event) => updateField("supabasePlan", event.target.value)}
              placeholder="Pro"
            />
          </SnapshotField>
          <SnapshotField label="Compute plan">
            <input
              type="text"
              value={form.computePlan}
              onChange={(event) => updateField("computePlan", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Compute cost cents">
            <input
              type="number"
              min="0"
              step="1"
              value={form.computeMonthlyCostCents}
              onChange={(event) => updateField("computeMonthlyCostCents", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Storage used GB">
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.storageUsedGb}
              onChange={(event) => updateField("storageUsedGb", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Storage included GB">
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.storageIncludedGb}
              onChange={(event) => updateField("storageIncludedGb", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Uncached egress GB">
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.uncachedEgressGb}
              onChange={(event) => updateField("uncachedEgressGb", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Cached egress GB">
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.cachedEgressGb}
              onChange={(event) => updateField("cachedEgressGb", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Uncached included GB">
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.uncachedEgressIncludedGb}
              onChange={(event) => updateField("uncachedEgressIncludedGb", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Cached included GB">
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.cachedEgressIncludedGb}
              onChange={(event) => updateField("cachedEgressIncludedGb", event.target.value)}
              required
            />
          </SnapshotField>
          <SnapshotField label="Storage overage cents">
            <input
              type="number"
              min="0"
              step="1"
              value={form.observedStorageOverageCostCents}
              onChange={(event) =>
                updateField("observedStorageOverageCostCents", event.target.value)
              }
            />
          </SnapshotField>
          <SnapshotField label="Uncached overage cents">
            <input
              type="number"
              min="0"
              step="1"
              value={form.observedUncachedEgressOverageCostCents}
              onChange={(event) =>
                updateField("observedUncachedEgressOverageCostCents", event.target.value)
              }
            />
          </SnapshotField>
          <SnapshotField label="Cached overage cents">
            <input
              type="number"
              min="0"
              step="1"
              value={form.observedCachedEgressOverageCostCents}
              onChange={(event) =>
                updateField("observedCachedEgressOverageCostCents", event.target.value)
              }
            />
          </SnapshotField>
        </div>

        <label className={styles.adminSnapshotField}>
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Source context, usage page filter, or invoice/export note"
          />
        </label>

        <div className={styles.adminSnapshotActions}>
          <button type="button" className="ghost-btn mini" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="ghost-btn mini"
            disabled={saving || !requiredFieldsFilled(form)}
          >
            {saving ? "Capturing..." : "Capture snapshot"}
          </button>
        </div>
      </form>
    </section>
  );
}
