import { create } from 'zustand';
import { useDestinationStore } from './destinationStore';
import { useEventStore } from './eventStore';
import { useUserPreferenceStore } from './userPreferenceStore';
import { useJourneyStore } from './journeyStore';

interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  lastSynced: string | null;
  initializeApp: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  syncWithDatabase: () => Promise<void>;
  resetAll: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isInitialized: false,
  isLoading: false,
  error: null,
  lastSynced: null,
  initializeApp: () => {
    useJourneyStore.getState().clearOldData();
    set({ isInitialized: true });
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  syncWithDatabase: async () => {
    set({ isLoading: true });
    try {
      set({ lastSynced: new Date().toISOString() });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Sync failed' });
    } finally {
      set({ isLoading: false });
    }
  },
  resetAll: () => {
    useDestinationStore.setState({ favorites: [], ratings: [], visitHistory: [] });
    useEventStore.setState({ trackedEvents: [], attendance: [] });
    useUserPreferenceStore.getState().resetDefaults();
    set({ isInitialized: false, error: null });
  },
}));

// Auto-save every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    useAppStore.getState().syncWithDatabase();
  }, 30000);
}
