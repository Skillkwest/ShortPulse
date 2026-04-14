import React from "react";

const initialSharedVoices = [
  "Harbor",
  "Solstice",
  "Atlas",
  "Nova",
  "Ember",
  "Grit",
  "Marlow",
  "Cinder",
] as const;

type SharedVoicesGridSnapshot = {
  selectedVoice: string;
  voices: string[];
};

let sharedVoicesGridSnapshot: SharedVoicesGridSnapshot = {
  selectedVoice: "Harbor",
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

export const resetSharedVoicesGridStore = () => {
  updateSnapshot({
    selectedVoice: "Harbor",
    voices: [...initialSharedVoices],
  });
};

export const useSharedVoicesGrid = () => {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setSelectedVoice = React.useCallback((voice: string) => {
    updateSnapshot({
      ...sharedVoicesGridSnapshot,
      selectedVoice: voice,
    });
  }, []);

  const saveVoice = React.useCallback((voice: string) => {
    const nextVoiceName = voice.trim();
    if (!nextVoiceName) {
      return;
    }

    const dedupedVoices = sharedVoicesGridSnapshot.voices.filter(
      (currentVoice) => currentVoice !== nextVoiceName
    );

    updateSnapshot({
      selectedVoice: nextVoiceName,
      voices: [nextVoiceName, ...dedupedVoices],
    });
  }, []);

  return {
    selectedVoice: snapshot.selectedVoice,
    setSelectedVoice,
    voices: snapshot.voices,
    saveVoice,
  };
};
