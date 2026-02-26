import { MapPin, Plus } from 'lucide-react';
import type { Destination } from '@/shared/types';

interface DestinationSelectorProps {
  destinations: Destination[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
}

export default function DestinationSelector({
  destinations,
  selectedId,
  onSelect,
  onAdd
}: DestinationSelectorProps) {
  return (
    <div className="glass-effect rounded-3xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <MapPin className="w-6 h-6" />
          Where to?
        </h2>
        <button
          onClick={onAdd}
          className="glass-dark rounded-full p-2 text-white hover:bg-white/20 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {destinations.length === 0 ? (
          <p className="text-white/70 text-sm text-center py-4">
            No destinations yet. Add one to get started!
          </p>
        ) : (
          destinations.map((dest) => (
            <button
              key={dest.id}
              onClick={() => onSelect(dest.id)}
              className={`w-full text-left p-4 rounded-2xl transition-all ${
                selectedId === dest.id
                  ? 'bg-white/30 shadow-lg scale-[1.02]'
                  : 'glass-dark hover:bg-white/15'
              }`}
            >
              <h3 className="text-white font-semibold">{dest.name}</h3>
              <p className="text-white/70 text-sm mt-1">{dest.address}</p>
              {dest.typical_parking_difficulty && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/20 text-white/90 text-xs">
                  Parking: {dest.typical_parking_difficulty}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
