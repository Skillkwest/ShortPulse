import React from "react";

type CreateStepAction = "character" | "model" | "prompt" | "imageSettings";

export type CreateCharacterOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

export type CreateCharacterLookOption = {
  id: string;
  label: string;
  isDefault: boolean;
};

type UseCreateCharacterModeControllerArgs = {
  characterModeEnabled: boolean;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  selectedCharacterLookLabel?: string | null;
  isCharacterOptionsLoading: boolean;
  onCharacterPickerOpen?: () => void;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  onStepActionClick?: (step: CreateStepAction) => void;
};

type UseCreateCharacterModeControllerResult = {
  isCharacterPickerOpen: boolean;
  openCharacterPicker: () => void;
  closeCharacterPicker: () => void;
  handleCharacterModeEnabledToggle: () => void;
  characterSelectDisabled: boolean;
  isCharacterSelectionEmpty: boolean;
  selectedCharacterName: string;
  selectedCharacterDisplayName: string;
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
  characterModeEnabled,
  characterOptions,
  selectedCharacterId,
  selectedCharacterLookLabel = null,
  isCharacterOptionsLoading,
  onCharacterPickerOpen,
  onCharacterModeEnabledChange,
  onStepActionClick,
}: UseCreateCharacterModeControllerArgs): UseCreateCharacterModeControllerResult => {
  const [isCharacterPickerOpen, setIsCharacterPickerOpen] = React.useState(false);
  const hasCharacterOptions = characterOptions.length > 0;
  const characterSelectDisabled = !characterModeEnabled;

  const closeCharacterPicker = React.useCallback(() => {
    setIsCharacterPickerOpen(false);
  }, []);
  const openCharacterPicker = React.useCallback(() => {
    if (!characterModeEnabled) return;
    onCharacterPickerOpen?.();
    setIsCharacterPickerOpen(true);
  }, [characterModeEnabled, onCharacterPickerOpen]);

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
  const selectedCharacterDisplayName =
    selectedCharacterOption && selectedCharacterLookLabel?.trim()
      ? `${selectedCharacterOption.name} · ${selectedCharacterLookLabel.trim()}`
      : selectedCharacterName;
  const selectedCharacterProfileImageUrl = selectedCharacterOption?.profileImageUrl ?? null;
  const selectedCharacterInitials = selectedCharacterOption
    ? getCreateCharacterInitials(selectedCharacterOption.name)
    : null;
  const isCharacterSelectionEmpty = !selectedCharacterProfileImageUrl && !selectedCharacterInitials;
  return {
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    isCharacterSelectionEmpty,
    selectedCharacterName,
    selectedCharacterDisplayName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  };
};
