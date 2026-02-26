import type { RecommendationContext, Destination, HomeStatus, Weather, JourneyDecision } from '@/shared/types';
import { useUserPreferenceStore } from '@/react-app/stores/userPreferenceStore';
import { useJourneyStore } from '@/react-app/stores/journeyStore';

export function buildAIContext(
  destination: Destination,
  weather: Weather,
  homeStatus: HomeStatus | null,
): RecommendationContext {
  const preferences = useUserPreferenceStore.getState().preferences;
  const recentDecisions = useJourneyStore.getState().getRecentDecisions(5) as JourneyDecision[];

  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    destination,
    weather,
    homeStatus,
    userPreferences: {
      max_walk_distance: preferences.max_walk_distance,
      temp_threshold_high: preferences.temp_threshold_high,
      temp_threshold_low: preferences.temp_threshold_low,
      rain_threshold: preferences.rain_threshold,
    },
    recentDecisions,
    currentTime: now.toLocaleTimeString(),
    dayOfWeek: days[now.getDay()],
  };
}
