import { create } from 'zustand';
import { useDestinationStore } from './destinationStore';
import { useEventStore } from './eventStore';
import { useUserPreferenceStore } from './userPreferenceStore';
import { useJourneyStore } from './journeyStore';

const AUTO_SYNC_INTERVAL_MS = 30000;

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

/**
 * Start periodic auto-sync. Returns a cleanup function to stop it.
 * Call from a top-level useEffect in your app root.
 */
export function startAutoSync(): () => void {
  const id = setInterval(() => {
    useAppStore.getState().syncWithDatabase();
  }, AUTO_SYNC_INTERVAL_MS);
  return () => clearInterval(id);
}
