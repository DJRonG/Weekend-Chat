import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferences {
  max_walk_distance: number;
  temp_threshold_high: number;
  temp_threshold_low: number;
  rain_threshold: number;
  prefer_ev: boolean;
  prefer_walking: boolean;
  notification_enabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  max_walk_distance: 1.5,
  temp_threshold_high: 30,
  temp_threshold_low: 5,
  rain_threshold: 40,
  prefer_ev: false,
  prefer_walking: false,
  notification_enabled: true,
};

interface UserPreferenceState {
  preferences: UserPreferences;
  updateSetting: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  getThreshold: (key: keyof UserPreferences) => UserPreferences[keyof UserPreferences];
  resetDefaults: () => void;
}

export const useUserPreferenceStore = create<UserPreferenceState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      updateSetting: (key, value) => set((state) => ({
        preferences: { ...state.preferences, [key]: value }
      })),
      getThreshold: (key) => get().preferences[key],
      resetDefaults: () => set({ preferences: DEFAULT_PREFERENCES }),
    }),
    { name: 'user-preference-store' }
  )
);
