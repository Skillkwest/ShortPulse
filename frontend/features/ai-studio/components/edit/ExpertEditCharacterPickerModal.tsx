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
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
} from "../picker/AiStudioPickerPrimitives";

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

  return (
    <AiStudioPickerModalFrame
      isOpen={isOpen}
      isEnabled={characterModeEnabled}
      activityId="edit-character-picker-modal"
      ariaLabel="Choose character"
      title="Character Picker"
      subtitle="Select a character profile from AI Studio Characters."
      onClose={onClose}
    >
      {characterOptions.length > 0 ? (
        <AiStudioPickerGrid ariaLabel="Character options">
          {characterOptions.map((option) => {
            const isActive = option.id === selectedCharacterId;
            const resolvedAvatarUrl = resolveAvatarUrl(
              option.id,
              resolveCharacterAvatarUrlById?.(option.id) ?? option.profileImageUrl ?? null
            );
            return (
              <AiStudioPickerCard
                key={option.id}
                isActive={isActive}
                onSelect={() => {
                  onSelectedCharacterIdChange?.(option.id);
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
};
