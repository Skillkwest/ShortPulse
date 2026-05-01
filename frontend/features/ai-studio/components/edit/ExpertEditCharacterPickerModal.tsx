/**
 * Expert Edit character picker modal.
 * Owns character selection UI and avatar recovery behavior for the edit surface.
 */
import Image from "next/image";
import React from "react";
import { useAvatarResilience } from "../../hooks/useAvatarResilience";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
} from "../create/useCreateCharacterModeController";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";

export type ExpertEditCharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  isCharacterOptionsLoading: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

export const ExpertEditCharacterPickerModal = ({
  isOpen,
  characterModeEnabled,
  isCharacterOptionsLoading,
  onClose,
  characterOptions,
  selectedCharacterId,
  onSelectedCharacterIdChange,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
}: ExpertEditCharacterPickerModalProps) => {
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "edit-character-picker-list",
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const refreshNow = React.useCallback(async () => {
    if (!refreshCharacterOptions) return;
    setRefreshError(null);
    setIsRefreshing(true);
    try {
      await refreshCharacterOptions();
    } catch {
      setRefreshError("Unable to refresh character profiles.");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCharacterOptions]);

  React.useEffect(() => {
    if (!isOpen || !characterModeEnabled) return;
    void refreshNow();
  }, [characterModeEnabled, isOpen, refreshNow]);
  useAiStudioModalActivity("edit-character-picker-modal", isOpen && characterModeEnabled);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !isOpen || !characterModeEnabled,
  });

  if (!isOpen || !characterModeEnabled) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <>
        <div className="model-modal-backdrop ai-character-picker-backdrop" {...backdropDismiss} />
        <div
          className="model-modal ai-character-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Choose character"
        >
          <div className="model-modal-header">
            <div className="model-modal-title-group">
              <h3 className="model-modal-title">Character Picker</h3>
              <p className="model-modal-subtitle">
                Select a character profile from Character Manager.
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn mini model-modal-close"
              aria-label="Close character picker"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div className="model-modal-scroll">
            {characterOptions.length > 0 ? (
              <div className="ai-character-picker-grid" role="list" aria-label="Character options">
                {characterOptions.map((option) => {
                  const isActive = option.id === selectedCharacterId;
                  const resolvedAvatarUrl = resolveAvatarUrl(
                    option.id,
                    resolveCharacterAvatarUrlById?.(option.id) ?? option.profileImageUrl ?? null
                  );
                  return (
                    <article
                      key={option.id}
                      role="listitem"
                      className={`ai-character-list-card ai-character-picker-card ${
                        isActive ? "is-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="ai-character-list-select-btn"
                        aria-pressed={isActive}
                        onClick={() => {
                          onSelectedCharacterIdChange?.(option.id);
                          onClose();
                        }}
                      >
                        <div className="ai-character-list-main">
                          <span className="ai-character-list-avatar" aria-hidden="true">
                            {resolvedAvatarUrl ? (
                              <Image
                                src={resolvedAvatarUrl}
                                alt=""
                                className="ai-character-list-avatar-image"
                                width={44}
                                height={44}
                                unoptimized
                                onLoad={() => {
                                  clearAvatarFailure(option.id);
                                }}
                                onError={() => {
                                  void handleAvatarError({
                                    avatarId: option.id,
                                    recoverAvatarUrl: async () => {
                                      const refreshedOptions = await refreshCharacterOptions?.();
                                      const refreshedAvatarUrl =
                                        refreshedOptions?.find((item) => item.id === option.id)
                                          ?.profileImageUrl ?? null;
                                      return (
                                        refreshedAvatarUrl?.trim() ??
                                        resolveCharacterAvatarUrlById?.(option.id) ??
                                        null
                                      );
                                    },
                                  });
                                }}
                              />
                            ) : (
                              <span className="ai-character-list-avatar-initials">
                                {getCreateCharacterInitials(option.name)}
                              </span>
                            )}
                          </span>
                          <div className="ai-character-list-copy">
                            <p className="metric-label tiny">
                              {isActive ? "Selected" : "Character"}
                            </p>
                            <p className="ai-character-list-name">{option.name}</p>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : isCharacterOptionsLoading || isRefreshing ? (
              <p className="tiny subdued ai-character-picker-empty">
                Loading character profiles...
              </p>
            ) : refreshError ? (
              <div className="ai-character-picker-empty">
                <p className="tiny">{refreshError}</p>
                <button type="button" className="ghost-btn mini" onClick={() => void refreshNow()}>
                  Retry
                </button>
              </div>
            ) : (
              <p className="tiny subdued ai-character-picker-empty">
                No character profiles available.
              </p>
            )}
          </div>
        </div>
      </>
    </AiStudioModalLayer>
  );
};
