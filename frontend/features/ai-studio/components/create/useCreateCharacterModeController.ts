import React from "react";

type CreateStepAction = "character" | "model" | "prompt" | "imageSettings";

export type CreateCharacterOption = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
};

type UseCreateCharacterModeControllerArgs = {
  beginnerMode: boolean;
  characterModeEnabled: boolean;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  isCharacterOptionsLoading: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  onStepActionClick?: (step: CreateStepAction) => void;
};

type UseCreateCharacterModeControllerResult = {
  characterStepSubtitle: string;
  isCharacterPickerOpen: boolean;
  openCharacterPicker: () => void;
  closeCharacterPicker: () => void;
  handleCharacterModeEnabledToggle: () => void;
  characterSelectDisabled: boolean;
  selectedCharacterName: string;
  selectedCharacterProfileImageUrl: string | null;
  selectedCharacterInitials: string | null;
};

export const getCreateCharacterInitials = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
};

export const useCreateCharacterModeController = ({
  beginnerMode,
  characterModeEnabled,
  characterOptions,
  selectedCharacterId,
  isCharacterOptionsLoading,
  onCharacterModeEnabledChange,
  onStepActionClick,
}: UseCreateCharacterModeControllerArgs): UseCreateCharacterModeControllerResult => {
  const [isCharacterPickerOpen, setIsCharacterPickerOpen] = React.useState(false);

  const closeCharacterPicker = React.useCallback(() => {
    setIsCharacterPickerOpen(false);
  }, []);
  const openCharacterPicker = React.useCallback(() => {
    if (!characterModeEnabled) return;
    setIsCharacterPickerOpen(true);
  }, [characterModeEnabled]);

  const handleCharacterModeEnabledToggle = React.useCallback(() => {
    const nextCharacterModeEnabled = !characterModeEnabled;
    if (!nextCharacterModeEnabled) {
      closeCharacterPicker();
    }
    onCharacterModeEnabledChange?.(nextCharacterModeEnabled);
    onStepActionClick?.("character");
  }, [characterModeEnabled, closeCharacterPicker, onCharacterModeEnabledChange, onStepActionClick]);

  React.useEffect(() => {
    if (!characterModeEnabled && isCharacterPickerOpen) {
      closeCharacterPicker();
    }
  }, [characterModeEnabled, closeCharacterPicker, isCharacterPickerOpen]);

  React.useEffect(() => {
    if (!isCharacterPickerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeCharacterPicker();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeCharacterPicker, isCharacterPickerOpen]);

  const hasCharacterOptions = characterOptions.length > 0;
  const characterSelectDisabled =
    isCharacterOptionsLoading || !hasCharacterOptions || !characterModeEnabled;
  const characterSelectPlaceholder = !characterModeEnabled
    ? "Character mode is off"
    : isCharacterOptionsLoading
      ? "Loading characters..."
      : hasCharacterOptions
        ? "Choose Character"
        : "No characters available";
  const selectedCharacterOption = React.useMemo(
    () => characterOptions.find((option) => option.id === selectedCharacterId) ?? null,
    [characterOptions, selectedCharacterId]
  );
  const selectedCharacterName = selectedCharacterOption?.name ?? characterSelectPlaceholder;
  const selectedCharacterProfileImageUrl = selectedCharacterOption?.profileImageUrl ?? null;
  const selectedCharacterInitials = selectedCharacterOption
    ? getCreateCharacterInitials(selectedCharacterOption.name)
    : null;
  const characterStepSubtitle = beginnerMode
    ? "Toggle on character mode then select your character."
    : "Select one of your Character Manager profiles.";

  return {
    characterStepSubtitle,
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    selectedCharacterName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  };
};
