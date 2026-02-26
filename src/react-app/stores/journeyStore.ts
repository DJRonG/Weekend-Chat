import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JourneyDecision } from '@/shared/types';

interface JourneyState {
  decisions: JourneyDecision[];
  sessionId: string;
  recordDecision: (decision: Omit<JourneyDecision, 'id' | 'timestamp'>) => void;
  logInteraction: (type: JourneyDecision['type'], metadata?: Record<string, unknown>) => void;
  getJourneyPath: () => JourneyDecision[];
  getRecentDecisions: (limit?: number) => JourneyDecision[];
  clearOldData: (daysToKeep?: number) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      decisions: [],
      sessionId: generateId(),
      recordDecision: (decision) => set((state) => ({
        decisions: [...state.decisions, {
          ...decision,
          id: generateId(),
          timestamp: new Date().toISOString(),
        }]
      })),
      logInteraction: (type, metadata) => {
        get().recordDecision({ type, metadata });
      },
      getJourneyPath: () => get().decisions,
      getRecentDecisions: (limit = 10) => {
        const decisions = get().decisions;
        return decisions.slice(-limit);
      },
      clearOldData: (daysToKeep = 30) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);
        set((state) => ({
          decisions: state.decisions.filter(d => new Date(d.timestamp) > cutoff)
        }));
      },
    }),
    { name: 'journey-store' }
  )
);
