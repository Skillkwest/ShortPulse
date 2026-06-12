import Image from "next/image";
import React from "react";
import { X } from "phosphor-react";
import { useAvatarResilience } from "../../hooks/useAvatarResilience";
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
} from "../picker/AiStudioPickerPrimitives";
import { CharacterLookDropdown } from "../picker/CharacterLookDropdown";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  type CreateCharacterLookOption,
} from "./useCreateCharacterModeController";

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  isCharacterOptionsLoading: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  selectedCharacterLookId: string;
  onSelectedCharacterIdChange?: (characterId: string, lookId: string) => void;
  onCreateCharacter?: () => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  loadCharacterLookOptions?: (characterId: string) => Promise<CreateCharacterLookOption[]>;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

export function CreateCharacterPickerModal({
  isOpen,
  characterModeEnabled,
  isCharacterOptionsLoading,
  onClose,
  characterOptions,
  selectedCharacterId,
  selectedCharacterLookId,
  onSelectedCharacterIdChange,
  onCreateCharacter,
  refreshCharacterOptions,
  loadCharacterLookOptions,
  resolveCharacterAvatarUrlById,
}: CharacterPickerModalProps) {
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-list",
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [lookOptionsByCharacterId, setLookOptionsByCharacterId] = React.useState<
    Record<string, CreateCharacterLookOption[]>
  >({});
  const [lookLoadingByCharacterId, setLookLoadingByCharacterId] = React.useState<
    Record<string, boolean>
  >({});
  const [lookErrorByCharacterId, setLookErrorByCharacterId] = React.useState<
    Record<string, string | null>
  >({});
  const [pendingLookIdByCharacterId, setPendingLookIdByCharacterId] = React.useState<
    Record<string, string>
  >({});

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

  const loadLooksForCharacter = React.useCallback(
    async (characterId: string) => {
      const normalizedCharacterId = characterId.trim();
      if (!loadCharacterLookOptions || !normalizedCharacterId) return [];
      setLookLoadingByCharacterId((current) => ({
        ...current,
        [normalizedCharacterId]: true,
      }));
      setLookErrorByCharacterId((current) => ({
        ...current,
        [normalizedCharacterId]: null,
      }));
      try {
        const nextOptions = await loadCharacterLookOptions(normalizedCharacterId);
        setLookOptionsByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: nextOptions,
        }));
        setPendingLookIdByCharacterId((current) => {
          const currentPendingLookId = current[normalizedCharacterId]?.trim() ?? "";
          const selectedLookId =
            normalizedCharacterId === selectedCharacterId ? selectedCharacterLookId.trim() : "";
          const resolvedLookId = [currentPendingLookId, selectedLookId]
            .find((lookId) => nextOptions.some((option) => option.id === lookId))
            ?.trim();
          const fallbackLookId =
            nextOptions.find((option) => option.isDefault)?.id ?? nextOptions[0]?.id ?? "";
          const nextLookId = resolvedLookId || fallbackLookId;
          if (!nextLookId || current[normalizedCharacterId] === nextLookId) {
            return current;
          }
          return {
            ...current,
            [normalizedCharacterId]: nextLookId,
          };
        });
        return nextOptions;
      } catch {
        setLookErrorByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: "Unable to load looks.",
        }));
        return [];
      } finally {
        setLookLoadingByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: false,
        }));
      }
    },
    [loadCharacterLookOptions, selectedCharacterId, selectedCharacterLookId]
  );

  React.useEffect(() => {
    if (!isOpen || !characterModeEnabled) return;
    void refreshNow();
  }, [characterModeEnabled, isOpen, refreshNow]);

  React.useEffect(() => {
    if (!isOpen || !characterModeEnabled || !loadCharacterLookOptions) return;
    characterOptions.forEach((option) => {
      if (lookOptionsByCharacterId[option.id] || lookLoadingByCharacterId[option.id]) return;
      void loadLooksForCharacter(option.id);
    });
  }, [
    characterModeEnabled,
    characterOptions,
    isOpen,
    loadCharacterLookOptions,
    loadLooksForCharacter,
    lookLoadingByCharacterId,
    lookOptionsByCharacterId,
  ]);

  return (
    <AiStudioPickerModalFrame
      isOpen={isOpen}
      isEnabled={characterModeEnabled}
      activityId="create-character-picker-modal"
      ariaLabel="Choose character"
      title="Character Picker"
      subtitle="Choose a character and the look to use for this generation."
      onClose={onClose}
      headerActions={
        <div className="model-modal-header-actions">
          <button
            type="button"
            className="ai-character-picker-library-btn"
            onClick={() => {
              onClose();
              onCreateCharacter?.();
            }}
          >
            + Create Character
          </button>
          <button
            type="button"
            className="ghost-btn mini model-modal-close"
            aria-label="Close character picker"
            onClick={onClose}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      }
    >
      {characterOptions.length > 0 ? (
        <AiStudioPickerGrid ariaLabel="Character options">
          {characterOptions.map((option) => {
            const isActive = option.id === selectedCharacterId;
            const lookOptions = lookOptionsByCharacterId[option.id] ?? [];
            const isLookLoading = Boolean(lookLoadingByCharacterId[option.id]);
            const lookError = lookErrorByCharacterId[option.id] ?? null;
            const showLookSelect = lookOptions.length > 1;
            const selectedLookIdForCard =
              pendingLookIdByCharacterId[option.id] ??
              (isActive ? selectedCharacterLookId.trim() : "") ??
              "";
            const resolvedAvatarUrl = resolveAvatarUrl(
              option.id,
              resolveCharacterAvatarUrlById?.(option.id) ?? option.profileImageUrl ?? null
            );
            return (
              <AiStudioPickerCard
                key={option.id}
                isActive={isActive}
                className="ai-character-picker-card--with-looks"
                onSelect={() => {
                  const fallbackLookId =
                    lookOptions.find((item) => item.isDefault)?.id ?? lookOptions[0]?.id ?? "";
                  onSelectedCharacterIdChange?.(
                    option.id,
                    selectedLookIdForCard || fallbackLookId || ""
                  );
                  onClose();
                }}
                avatar={
                  resolvedAvatarUrl ? (
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
                  )
                }
                label={isActive ? "Selected" : "Character"}
                name={option.name}
                footer={
                  isLookLoading ? (
                    <p className="ai-character-look-meta tiny subdued">Loading looks...</p>
                  ) : lookError ? (
                    <p className="ai-character-look-meta tiny">{lookError}</p>
                  ) : showLookSelect ? (
                    <div className="ai-character-look-field">
                      <span className="ai-character-look-label">Select look</span>
                      <CharacterLookDropdown
                        characterName={option.name}
                        value={selectedLookIdForCard}
                        options={lookOptions}
                        onChange={(nextLookId) => {
                          setPendingLookIdByCharacterId((current) => ({
                            ...current,
                            [option.id]: nextLookId,
                          }));
                          onSelectedCharacterIdChange?.(option.id, nextLookId);
                          onClose();
                        }}
                      />
                    </div>
                  ) : lookOptions.length === 1 ? (
                    <p className="ai-character-look-meta tiny subdued">
                      Look: {lookOptions[0]?.label}
                    </p>
                  ) : null
                }
              />
            );
          })}
        </AiStudioPickerGrid>
      ) : (
        <AiStudioPickerFeedback
          isLoading={isCharacterOptionsLoading || isRefreshing}
          loadingMessage="Loading character profiles..."
          errorMessage={refreshError}
          emptyMessage="No character profiles available."
          onRetry={() => void refreshNow()}
        />
      )}
    </AiStudioPickerModalFrame>
  );
}
