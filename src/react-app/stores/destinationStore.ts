import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoriteDestination {
  id: number;
  addedAt: string;
}

interface DestinationRating {
  destinationId: number;
  rating: number;
  ratedAt: string;
}

interface VisitRecord {
  destinationId: number;
  visitedAt: string;
}

interface DestinationState {
  favorites: FavoriteDestination[];
  ratings: DestinationRating[];
  visitHistory: VisitRecord[];
  addFavorite: (id: number) => void;
  removeFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
  updateRating: (destinationId: number, rating: number) => void;
  getRating: (destinationId: number) => number | undefined;
  getRatedDestinations: () => DestinationRating[];
  updateVisitCount: (destinationId: number) => void;
  getVisitCount: (destinationId: number) => number;
}

export const useDestinationStore = create<DestinationState>()(
  persist(
    (set, get) => ({
      favorites: [],
      ratings: [],
      visitHistory: [],
      addFavorite: (id) => set((state) => ({
        favorites: [...state.favorites.filter(f => f.id !== id), { id, addedAt: new Date().toISOString() }]
      })),
      removeFavorite: (id) => set((state) => ({
        favorites: state.favorites.filter(f => f.id !== id)
      })),
      isFavorite: (id) => get().favorites.some(f => f.id === id),
      updateRating: (destinationId, rating) => set((state) => ({
        ratings: [...state.ratings.filter(r => r.destinationId !== destinationId), { destinationId, rating, ratedAt: new Date().toISOString() }]
      })),
      getRating: (destinationId) => get().ratings.find(r => r.destinationId === destinationId)?.rating,
      getRatedDestinations: () => get().ratings,
      updateVisitCount: (destinationId) => set((state) => ({
        visitHistory: [...state.visitHistory, { destinationId, visitedAt: new Date().toISOString() }]
      })),
      getVisitCount: (destinationId) => get().visitHistory.filter(v => v.destinationId === destinationId).length,
    }),
    { name: 'destination-store' }
  )
);
