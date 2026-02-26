import { useState, useCallback, useEffect, useRef } from 'react';
import type { Destination, HomeStatus, Weather, AlternativeDestination, Analysis } from '@/shared/types';
import { generateRecommendation, suggestAlternatives, isGeminiEnabled, clearCache } from '@/react-app/services/geminiService';
import { buildAIContext } from '@/react-app/services/aiContextBuilder';

const RECOMMENDATION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface GeminiState {
  loading: boolean;
  error: string | null;
  recommendation: string | null;
  analysis: Analysis | null;
  alternatives: AlternativeDestination[];
}

interface UseGeminiRecommendations {
  loading: boolean;
  error: string | null;
  recommendation: string | null;
  analysis: Analysis | null;
  alternatives: AlternativeDestination[];
  isAvailable: boolean;
  getRecommendation: (destination: Destination, weather: Weather, homeStatus: HomeStatus | null) => Promise<void>;
  getAlternatives: (destinationName: string, reason: string) => Promise<void>;
  regenerate: (destination: Destination, weather: Weather, homeStatus: HomeStatus | null) => Promise<void>;
  clearRecommendations: () => void;
}

export function useGeminiRecommendations(): UseGeminiRecommendations {
  const [state, setState] = useState<GeminiState>({
    loading: false,
    error: null,
    recommendation: null,
    analysis: null,
    alternatives: [],
  });

  const cacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    };
  }, []);

  const getRecommendation = useCallback(async (
    destination: Destination,
    weather: Weather,
    homeStatus: HomeStatus | null,
  ) => {
    if (!isGeminiEnabled()) {
      setState(prev => ({ ...prev, error: 'AI recommendations not available' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const context = buildAIContext(destination, weather, homeStatus);
      const result = await generateRecommendation(context);
      setState(prev => ({ ...prev, recommendation: result, loading: false }));

      // Auto-clear after configured TTL
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
      cacheTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, recommendation: null }));
      }, RECOMMENDATION_CACHE_TTL_MS);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get AI recommendation',
      }));
    }
  }, []);

  const getAlternatives = useCallback(async (destinationName: string, reason: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const alts = await suggestAlternatives(destinationName, reason);
      setState(prev => ({ ...prev, alternatives: alts, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get alternatives',
      }));
    }
  }, []);

  const regenerate = useCallback(async (destination: Destination, weather: Weather, homeStatus: HomeStatus | null) => {
    clearCache();
    await getRecommendation(destination, weather, homeStatus);
  }, [getRecommendation]);

  const clearRecommendations = useCallback(() => {
    if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    setState({ loading: false, error: null, recommendation: null, analysis: null, alternatives: [] });
  }, []);

  return {
    ...state,
    isAvailable: isGeminiEnabled(),
    getRecommendation,
    getAlternatives,
    regenerate,
    clearRecommendations,
  };
}
