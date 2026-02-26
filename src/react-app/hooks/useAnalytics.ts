import { useCallback, useEffect, useRef } from 'react';
import { trackEvent } from '@/react-app/services/analyticsService';
import { useJourneyStore } from '@/react-app/stores/journeyStore';
import type { AnalyticsEvent } from '@/shared/types';

const BATCH_SIZE = 5;
const BATCH_INTERVAL = 5000;

interface UseAnalytics {
  trackEvent: (event: Omit<AnalyticsEvent, 'id' | 'session_id' | 'timestamp'>) => void;
  trackPageView: (page: string) => void;
  trackUserAction: (action: string, metadata?: Record<string, unknown>) => void;
}

export function useAnalytics(): UseAnalytics {
  const { sessionId } = useJourneyStore();
  const batchRef = useRef<Omit<AnalyticsEvent, 'id'>[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount to prevent flush after unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flushBatch = useCallback(async () => {
    if (batchRef.current.length === 0) return;
    const toSend = batchRef.current.splice(0, batchRef.current.length);
    await Promise.all(toSend.map(e => trackEvent(e)));
  }, []);

  const queueEvent = useCallback((event: Omit<AnalyticsEvent, 'id'>) => {
    batchRef.current.push(event);
    if (batchRef.current.length >= BATCH_SIZE) {
      if (timerRef.current) clearTimeout(timerRef.current);
      flushBatch();
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushBatch();
      }, BATCH_INTERVAL);
    }
  }, [flushBatch]);

  const track = useCallback((event: Omit<AnalyticsEvent, 'id' | 'session_id' | 'timestamp'>) => {
    queueEvent({ ...event, session_id: sessionId, timestamp: new Date().toISOString() });
  }, [queueEvent, sessionId]);

  const trackPageView = useCallback((page: string) => {
    track({ event_type: 'page_view', metadata: { page } });
  }, [track]);

  const trackUserAction = useCallback((action: string, metadata?: Record<string, unknown>) => {
    track({ event_type: 'user_action', metadata: { action, ...metadata } });
  }, [track]);

  return { trackEvent: track, trackPageView, trackUserAction };
}
