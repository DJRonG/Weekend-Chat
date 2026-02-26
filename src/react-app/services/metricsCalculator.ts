import type { AnalyticsEvent, Metrics } from '@/shared/types';

export function calculateConversionRate(events: AnalyticsEvent[]): number {
  const viewed = events.filter(e => e.event_type === 'recommendation_viewed').length;
  const accepted = events.filter(e => e.event_type === 'recommendation_accepted').length;
  return viewed > 0 ? accepted / viewed : 0;
}

export function calculateFeatureUsage(events: AnalyticsEvent[]): Record<string, number> {
  const usage: Record<string, number> = {};
  events.forEach(e => {
    const key = e.recommendation_type ?? e.event_type;
    usage[key] = (usage[key] ?? 0) + 1;
  });
  return usage;
}

export type UserSegment = 'early_adopter' | 'casual' | 'power_user' | 'churned';

export function classifyUser(events: AnalyticsEvent[], sessionId: string): UserSegment {
  const userEvents = events.filter(e => e.session_id === sessionId);
  const sessionCount = new Set(userEvents.map(e => e.session_id)).size;
  const daysSinceLastSeen = userEvents.length > 0
    ? (Date.now() - new Date(userEvents[userEvents.length - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (daysSinceLastSeen > 30) return 'churned';
  if (userEvents.length > 50) return 'power_user';
  if (sessionCount < 3) return 'early_adopter';
  return 'casual';
}

export function calculateChurnRisk(events: AnalyticsEvent[]): number {
  if (events.length === 0) return 1;
  const lastEvent = events[events.length - 1];
  const daysSince = (Date.now() - new Date(lastEvent.timestamp).getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(daysSince / 30, 1);
}

export function getTopDestinations(metrics: Metrics, limit = 10) {
  return metrics.popular_destinations.slice(0, limit);
}

export function getPeakUsageHours(metrics: Metrics, topN = 3): number[] {
  return [...metrics.peak_hours]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(h => h.hour);
}
