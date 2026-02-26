import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Event } from '@/shared/types';

interface AttendanceRecord {
  eventId: number;
  attendedAt: string;
  enjoyed?: boolean;
}

interface EventState {
  trackedEvents: Event[];
  attendance: AttendanceRecord[];
  addEvent: (event: Event) => void;
  removeEvent: (id: number) => void;
  trackAttendance: (eventId: number, enjoyed?: boolean) => void;
  getUpcomingEvents: () => Event[];
  getPastEvents: () => Event[];
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      trackedEvents: [],
      attendance: [],
      addEvent: (event) => set((state) => ({
        trackedEvents: [...state.trackedEvents.filter(e => e.id !== event.id), event]
      })),
      removeEvent: (id) => set((state) => ({
        trackedEvents: state.trackedEvents.filter(e => e.id !== id)
      })),
      trackAttendance: (eventId, enjoyed) => set((state) => ({
        attendance: [...state.attendance, { eventId, attendedAt: new Date().toISOString(), enjoyed }]
      })),
      getUpcomingEvents: () => {
        const now = new Date().toISOString();
        return get().trackedEvents.filter(e => e.start_datetime >= now);
      },
      getPastEvents: () => {
        const now = new Date().toISOString();
        return get().trackedEvents.filter(e => e.start_datetime < now);
      },
    }),
    { name: 'event-store' }
  )
);
