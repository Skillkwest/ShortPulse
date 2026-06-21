/**
 * Admin legal policy controller.
 * Owns loading, document selection, local draft edits, text upload intake, and publication.
 */
import React from "react";
import { LEGAL_POLICY_SLUGS, type LegalPolicySlug } from "../../../legal/data/legalPolicies";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import type { AdminLegalPolicyDocument } from "../types";

const ACCEPTED_UPLOAD_EXTENSIONS = [".md", ".markdown", ".txt"];

type UseAdminLegalPoliciesControllerParams = {
  enabled: boolean;
};

type UseAdminLegalPoliciesControllerResult = {
  documents: AdminLegalPolicyDocument[];
  selectedSlug: LegalPolicySlug;
  selectedDocument: AdminLegalPolicyDocument | null;
  draftMarkdown: string;
  publishNote: string;
  loading: boolean;
  publishing: boolean;
  uploadReading: boolean;
  error: string | null;
  result: string | null;
  setSelectedSlug: React.Dispatch<React.SetStateAction<LegalPolicySlug>>;
  setDraftMarkdown: React.Dispatch<React.SetStateAction<string>>;
  setPublishNote: React.Dispatch<React.SetStateAction<string>>;
  loadPolicies: () => Promise<void>;
  resetDraftToLive: () => void;
  readUploadFile: (file: File) => Promise<void>;
  publishSelectedPolicy: () => Promise<void>;
};

const asAdminLegalPolicyDocument = (value: unknown): AdminLegalPolicyDocument | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const slug = row.slug;
  if (!LEGAL_POLICY_SLUGS.includes(slug as LegalPolicySlug)) return null;
  const markdown = typeof row.markdown === "string" ? row.markdown : "";
  if (!markdown.trim()) return null;

  return {
    slug: slug as LegalPolicySlug,
    markdown,
    version: typeof row.version === "number" ? row.version : null,
    versionId: typeof row.versionId === "number" ? row.versionId : null,
    note: typeof row.note === "string" ? row.note : null,
    source: row.source === "control_plane" ? "control_plane" : "seed",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
    updatedByEmail: typeof row.updatedByEmail === "string" ? row.updatedByEmail : null,
    degraded: row.degraded === true,
    history: Array.isArray(row.history)
      ? row.history
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const historyRow = entry as Record<string, unknown>;
            const version = typeof historyRow.version === "number" ? historyRow.version : null;
            const versionId =
              typeof historyRow.versionId === "number" ? historyRow.versionId : null;
            if (version == null || versionId == null) return null;
            return {
              version,
              versionId,
              note: typeof historyRow.note === "string" ? historyRow.note : null,
              createdAt: typeof historyRow.createdAt === "string" ? historyRow.createdAt : null,
              createdByEmail:
                typeof historyRow.createdByEmail === "string" ? historyRow.createdByEmail : null,
              isActive: historyRow.isActive === true,
            };
          })
          .filter((entry): entry is AdminLegalPolicyDocument["history"][number] => Boolean(entry))
      : [],
  };
};

const isAcceptedUploadFile = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  return (
    file.type === "text/markdown" ||
    file.type === "text/plain" ||
    ACCEPTED_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  );
};

const loadFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsText(file);
  });

/**
 * Compose the admin Legal tab state behind a route-local controller boundary.
 */
export const useAdminLegalPoliciesController = ({
  enabled,
}: UseAdminLegalPoliciesControllerParams): UseAdminLegalPoliciesControllerResult => {
  const [documents, setDocuments] = React.useState<AdminLegalPolicyDocument[]>([]);
  const [selectedSlug, setSelectedSlug] = React.useState<LegalPolicySlug>("terms");
  const [draftMarkdown, setDraftMarkdown] = React.useState("");
  const [publishNote, setPublishNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [uploadReading, setUploadReading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  const selectedDocument =
    documents.find((document) => document.slug === selectedSlug) ?? documents[0] ?? null;

  const loadPolicies = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/legal/policies", { method: "GET" });
      const data = (await response.json().catch(() => ({}))) as {
        policies?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load legal policies.");
      }
      const nextDocuments = Array.isArray(data.policies)
        ? data.policies
            .map(asAdminLegalPolicyDocument)
            .filter((document): document is AdminLegalPolicyDocument => Boolean(document))
        : [];
      if (nextDocuments.length === 0) {
        throw new Error("Legal policy payload is empty.");
      }
      setDocuments(nextDocuments);
      setSelectedSlug((currentSlug) =>
        nextDocuments.some((document) => document.slug === currentSlug)
          ? currentSlug
          : nextDocuments[0].slug
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load legal policies.");
      setDocuments([]);
      setDraftMarkdown("");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    void loadPolicies();
  }, [enabled, loadPolicies]);

  React.useEffect(() => {
    if (!selectedDocument) return;
    setDraftMarkdown(selectedDocument.markdown);
    setPublishNote("");
    setError(null);
    setResult(null);
  }, [selectedDocument]);

  const resetDraftToLive = React.useCallback(() => {
    if (!selectedDocument) return;
    setDraftMarkdown(selectedDocument.markdown);
    setPublishNote("");
    setError(null);
    setResult("Draft reset to the active policy.");
  }, [selectedDocument]);

  const readUploadFile = React.useCallback(async (file: File) => {
    if (!isAcceptedUploadFile(file)) {
      setError("Upload a Markdown or plain-text policy document.");
      setResult(null);
      return;
    }
    setUploadReading(true);
    setError(null);
    setResult(null);
    try {
      const text = await loadFileText(file);
      if (!text.trim()) {
        throw new Error("Uploaded policy document is empty.");
      }
      setDraftMarkdown(text.replace(/\r\n/g, "\n"));
      setResult(`${file.name} loaded into the draft.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to read upload.");
    } finally {
      setUploadReading(false);
    }
  }, []);

  const publishSelectedPolicy = React.useCallback(async () => {
    if (!selectedDocument) return;
    const normalizedMarkdown = draftMarkdown.replace(/\r\n/g, "\n").trim();
    if (!normalizedMarkdown) {
      setError("Legal policy markdown cannot be empty.");
      setResult(null);
      return;
    }

    setPublishing(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchWithAuth(
        `/api/admin/legal/policies/${selectedDocument.slug}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: normalizedMarkdown,
            expectedUpdatedAt: selectedDocument.updatedAt,
            note: publishNote.trim() || null,
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        policy?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to publish legal policy.");
      }
      const publishedPolicy = asAdminLegalPolicyDocument(data.policy);
      if (!publishedPolicy) {
        throw new Error("Published legal policy payload is invalid.");
      }
      setDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.slug === publishedPolicy.slug ? publishedPolicy : document
        )
      );
      setDraftMarkdown(publishedPolicy.markdown);
      setPublishNote("");
      setResult("Legal policy published.");
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : "Failed to publish legal policy."
      );
      setResult(null);
    } finally {
      setPublishing(false);
    }
  }, [draftMarkdown, publishNote, selectedDocument]);

  return {
    documents,
    selectedSlug,
    selectedDocument,
    draftMarkdown,
    publishNote,
    loading,
    publishing,
    uploadReading,
    error,
    result,
    setSelectedSlug,
    setDraftMarkdown,
    setPublishNote,
    loadPolicies,
    resetDraftToLive,
    readUploadFile,
    publishSelectedPolicy,
  };
};
