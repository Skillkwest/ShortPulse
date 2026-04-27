import React from "react";
import { ELEVENLABS_DEFAULT_VOICES } from "../../../lib/model-runtime/elevenLabsDefaultVoices";

export type SharedVoiceOption = {
  id: string;
  name: string;
  previewUrl?: string | null;
  description?: string | null;
  isFallback?: boolean;
  provider: "elevenlabs" | "local";
};

const initialSharedVoices: SharedVoiceOption[] = ELEVENLABS_DEFAULT_VOICES.map((voice) => ({
  id: voice.fallbackVoiceId,
  name: voice.name,
  previewUrl: null,
  description: voice.description,
  isFallback: true,
  provider: "elevenlabs",
}));

type SharedVoicesGridSnapshot = {
  selectedVoiceId: string | null;
  voices: SharedVoiceOption[];
};

let sharedVoicesGridSnapshot: SharedVoicesGridSnapshot = {
  selectedVoiceId: initialSharedVoices[0]?.id ?? null,
  voices: [...initialSharedVoices],
};

const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => sharedVoicesGridSnapshot;

const updateSnapshot = (nextSnapshot: SharedVoicesGridSnapshot) => {
  sharedVoicesGridSnapshot = nextSnapshot;
  emitChange();
};

const normalizeVoiceName = (value: string): string => value.trim().replace(/\s+/g, " ");

export const resetSharedVoicesGridStore = () => {
  updateSnapshot({
    selectedVoiceId: initialSharedVoices[0]?.id ?? null,
    voices: [...initialSharedVoices],
  });
};

export const useSharedVoicesGrid = () => {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setSelectedVoice = React.useCallback((voiceId: string) => {
    updateSnapshot({
      ...sharedVoicesGridSnapshot,
      selectedVoiceId: voiceId,
    });
  }, []);

  const replaceVoices = React.useCallback((voices: SharedVoiceOption[]) => {
    const nextVoices = voices.length > 0 ? voices : [...initialSharedVoices];
    const hasCurrentSelection = nextVoices.some(
      (voice) => voice.id === sharedVoicesGridSnapshot.selectedVoiceId
    );
    updateSnapshot({
      selectedVoiceId: hasCurrentSelection
        ? sharedVoicesGridSnapshot.selectedVoiceId
        : (nextVoices[0]?.id ?? null),
      voices: nextVoices,
    });
  }, []);

  const upsertVoice = React.useCallback((voice: SharedVoiceOption) => {
    const nextVoiceName = normalizeVoiceName(voice.name);
    const nextVoiceId = voice.id.trim();
    if (!nextVoiceName || !nextVoiceId) {
      return;
    }

    const nextVoice: SharedVoiceOption = {
      ...voice,
      id: nextVoiceId,
      name: nextVoiceName,
    };
    const dedupedVoices = sharedVoicesGridSnapshot.voices.filter(
      (currentVoice) => currentVoice.id !== nextVoice.id
    );

    updateSnapshot({
      selectedVoiceId: nextVoice.id,
      voices: [nextVoice, ...dedupedVoices],
    });
  }, []);

  const selectedVoice =
    snapshot.voices.find((voice) => voice.id === snapshot.selectedVoiceId) ?? null;

  return {
    selectedVoice,
    selectedVoiceId: snapshot.selectedVoiceId,
    setSelectedVoice,
    voices: snapshot.voices,
    replaceVoices,
    upsertVoice,
  };
};
