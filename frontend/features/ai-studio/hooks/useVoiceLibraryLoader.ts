/**
 * Voice library loader.
 * Owns the provider voices API load, timeout, fallback reset, and payload normalization.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { resetSharedVoicesGridStore, type SharedVoiceOption } from "./useSharedVoicesGrid";

type VoicesLibrarySection = "default" | "my";

type VoicesListResponse = {
  voices?: Array<{
    voiceId?: string;
    name?: string;
    previewUrl?: string | null;
    description?: string | null;
    isFallback?: boolean;
    librarySection?: "default" | "my";
    providerCategory?: string | null;
    providerVoiceType?: string | null;
    originKind?:
      | "fallback-default"
      | "provider-default"
      | "provider-saved"
      | "provider-user-created"
      | "legacy-saved";
    canRemoveFromLibrary?: boolean;
    canDeleteFromProvider?: boolean;
    destructiveAction?: "none" | "remove" | "delete";
    destructiveActionLabel?: "Remove" | "Delete" | null;
    destructiveActionDescription?: string | null;
    destructiveActionDisabledReason?: string | null;
  }>;
  source?: "api" | "fallback";
  warning?: string;
};

const voiceLibraryLoadTimeoutMs = 15_000;

type UseVoiceLibraryLoaderParams = {
  replaceVoices: (voices: SharedVoiceOption[]) => void;
  sessionUserId: string | null;
  setActiveVoicesLibrarySection: (section: VoicesLibrarySection) => void;
  shouldLoadVoiceLibrary: boolean;
};

export const useVoiceLibraryLoader = ({
  replaceVoices,
  sessionUserId,
  setActiveVoicesLibrarySection,
  shouldLoadVoiceLibrary,
}: UseVoiceLibraryLoaderParams) => {
  const [isVoicesLoading, setIsVoicesLoading] = React.useState(false);
  const [voicesLoadError, setVoicesLoadError] = React.useState<string | null>(null);
  const [voicesLoadNotice, setVoicesLoadNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!shouldLoadVoiceLibrary) {
      return;
    }
    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, voiceLibraryLoadTimeoutMs);
    const loadVoices = async () => {
      setIsVoicesLoading(true);
      setVoicesLoadError(null);
      setVoicesLoadNotice(null);
      resetSharedVoicesGridStore();
      try {
        const response = await fetchWithAuth("/api/elevenlabs/voices", {
          shortpulseLogScope: "generation",
          shortpulseAuthTimeoutMs: 5_000,
          signal: abortController.signal,
        });
        const payload = (await response.json().catch(() => null)) as VoicesListResponse | null;
        if (!response.ok) {
          throw new Error("Unable to load voices.");
        }
        const nextVoices: SharedVoiceOption[] = (payload?.voices ?? []).flatMap((voice) => {
          const voiceId = voice.voiceId?.trim() ?? "";
          const name = voice.name?.trim() ?? "";
          if (!voiceId || !name) return [];
          const resolvedLibrarySection =
            voice.librarySection === "default"
              ? "default"
              : voice.librarySection === "my"
                ? "my"
                : voice.isFallback
                  ? "default"
                  : "my";
          const canRemoveFromLibrary =
            typeof voice.canRemoveFromLibrary === "boolean"
              ? voice.canRemoveFromLibrary
              : resolvedLibrarySection === "my";
          const canDeleteFromProvider = Boolean(voice.canDeleteFromProvider);
          const destructiveAction =
            voice.destructiveAction ??
            (canDeleteFromProvider ? "delete" : canRemoveFromLibrary ? "remove" : "none");
          const destructiveActionLabel =
            voice.destructiveActionLabel ??
            (destructiveAction === "delete"
              ? "Delete"
              : destructiveAction === "remove"
                ? "Remove"
                : null);
          const destructiveActionDisabledReason =
            voice.destructiveActionDisabledReason?.trim() ||
            (destructiveAction === "none" && voice.isFallback
              ? "Built-in voices can't be deleted here."
              : destructiveAction === "none"
                ? "This voice can't be deleted here."
                : null);
          return [
            {
              id: voiceId,
              name: sanitizeCustomerFacingProviderText(name, "Voice"),
              previewUrl: voice.previewUrl?.trim() || null,
              description: sanitizeCustomerFacingProviderText(voice.description, "") || null,
              isFallback: Boolean(voice.isFallback),
              librarySection: resolvedLibrarySection,
              provider: "elevenlabs" as const,
              providerCategory: voice.providerCategory?.trim().toLowerCase() || null,
              providerVoiceType: voice.providerVoiceType?.trim().toLowerCase() || null,
              originKind:
                voice.originKind ?? (voice.isFallback ? "fallback-default" : "legacy-saved"),
              canRemoveFromLibrary,
              canDeleteFromProvider,
              destructiveAction,
              destructiveActionLabel,
              destructiveActionDescription:
                sanitizeCustomerFacingProviderText(voice.destructiveActionDescription, "") || null,
              destructiveActionDisabledReason:
                sanitizeCustomerFacingProviderText(destructiveActionDisabledReason, "") || null,
            },
          ];
        });
        if (cancelled) return;
        if (nextVoices.length > 0) {
          replaceVoices(nextVoices);
        }
        setVoicesLoadNotice(sanitizeCustomerFacingProviderText(payload?.warning, "") || null);
      } catch (error) {
        if (cancelled) return;
        resetSharedVoicesGridStore();
        setActiveVoicesLibrarySection("default");
        setVoicesLoadError(
          sanitizeCustomerFacingProviderText(
            error instanceof Error && error.name === "AbortError"
              ? "Voice library took too long to load. Showing built-in voices for now."
              : error instanceof Error
                ? error.message
                : null,
            "Unable to load voices."
          )
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) {
          setIsVoicesLoading(false);
        }
      }
    };

    void loadVoices();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [replaceVoices, sessionUserId, setActiveVoicesLibrarySection, shouldLoadVoiceLibrary]);

  return {
    isVoicesLoading,
    voicesLoadError,
    setVoicesLoadError,
    voicesLoadNotice,
    setVoicesLoadNotice,
  };
};
