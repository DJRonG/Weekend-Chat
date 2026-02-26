import type { AnalyticsEvent, TimeRange, Metrics, BehaviorAnalysis } from '@/shared/types';

const ANALYTICS_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED !== 'false';
const STORAGE_KEY = 'weekend-agent-analytics';
const MAX_EVENTS = 1000;

function getStoredEvents(): AnalyticsEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: AnalyticsEvent[]): void {
  try {
    // Keep only the most recent events
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage may be full; ignore
  }
}

export async function trackEvent(event: Omit<AnalyticsEvent, 'id'>): Promise<void> {
  if (!ANALYTICS_ENABLED) return;
  const events = getStoredEvents();
  events.push({ ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  saveEvents(events);

  // Optionally sync to backend
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => { /* ignore network errors */ });
  } catch {
    // Ignore failures - analytics is non-critical
  }
}

export async function getMetrics(timeRange: TimeRange): Promise<Metrics> {
  const events = getStoredEvents().filter(e =>
    e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
  );

  const recommendations = events.filter(e =>
    e.event_type === 'recommendation_accepted' || e.event_type === 'recommendation_rejected'
  );
  const accepted = recommendations.filter(e => e.event_type === 'recommendation_accepted').length;
  const rejected = recommendations.filter(e => e.event_type === 'recommendation_rejected').length;

  const byType: Record<string, { accepted: number; rejected: number; rate: number }> = {};
  recommendations.forEach(e => {
    const type = e.recommendation_type ?? 'unknown';
    if (!byType[type]) byType[type] = { accepted: 0, rejected: 0, rate: 0 };
    if (e.event_type === 'recommendation_accepted') byType[type].accepted++;
    else byType[type].rejected++;
  });
  Object.values(byType).forEach(t => {
    t.rate = t.accepted + t.rejected > 0 ? t.accepted / (t.accepted + t.rejected) : 0;
  });

  const destinationCounts: Record<string, number> = {};
  events.filter(e => e.destination_name).forEach(e => {
    destinationCounts[e.destination_name!] = (destinationCounts[e.destination_name!] ?? 0) + 1;
  });
  const popular_destinations = Object.entries(destinationCounts)
    .map(([name, visits]) => ({ name, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  const hourCounts: Record<number, number> = {};
  events.forEach(e => {
    const hour = new Date(e.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
  });
  const peak_hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourCounts[hour] ?? 0 }));

  return {
    acceptance_rate: recommendations.length > 0 ? accepted / recommendations.length : 0,
    total_recommendations: recommendations.length,
    accepted,
    rejected,
    by_type: byType,
    popular_destinations,
    peak_hours,
  };
}

export async function getUserBehavior(sessionId: string): Promise<BehaviorAnalysis> {
  const events = getStoredEvents().filter(e => e.session_id === sessionId);
  const destinations = events.filter(e => e.destination_name).map(e => e.destination_name!);
  const uniqueDestinations = [...new Set(destinations)];
  const recommendations = events.filter(e =>
    e.event_type === 'recommendation_accepted' || e.event_type === 'recommendation_rejected'
  );
  const accepted = recommendations.filter(e => e.event_type === 'recommendation_accepted').length;

  return {
    user_id: sessionId,
    preferred_destination_types: [],
    typical_session_duration: 0,
    acceptance_rate: recommendations.length > 0 ? accepted / recommendations.length : 0,
    most_visited: uniqueDestinations.slice(0, 5),
  };
}

export function clearAnalytics(): void {
  localStorage.removeItem(STORAGE_KEY);
}
