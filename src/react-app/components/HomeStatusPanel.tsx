import { Battery, Droplets } from 'lucide-react';
import type { HomeStatus } from '@/shared/types';

interface HomeStatusPanelProps {
  status: HomeStatus | null;
  onUpdate: (status: Partial<HomeStatus>) => void;
}

export default function HomeStatusPanel({ status, onUpdate }: HomeStatusPanelProps) {
  return (
    <div className="glass-effect rounded-3xl p-6 shadow-2xl">
      <h2 className="text-white font-bold text-xl mb-4">Home Status</h2>

      <div className="space-y-4">
        <div>
          <label className="text-white/90 text-sm font-medium block mb-2 flex items-center gap-2">
            <Battery className="w-4 h-4" />
            EV Charge (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={status?.ev_charge_percentage || 0}
            onChange={(e) => onUpdate({ ev_charge_percentage: Number(e.target.value) })}
            className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>

        <div>
          <label className="text-white/90 text-sm font-medium block mb-2 flex items-center gap-2">
            <Droplets className="w-4 h-4" />
            Garden Status
          </label>
          <button
            onClick={() => onUpdate({
              garden_watered: !status?.garden_watered,
              last_watered_at: !status?.garden_watered ? new Date().toISOString() : status?.last_watered_at
            })}
            className={`w-full px-4 py-3 rounded-xl transition-all ${
              status?.garden_watered
                ? 'bg-green-500/30 border-2 border-green-400'
                : 'glass-dark'
            }`}
          >
            <span className="text-white font-medium">
              {status?.garden_watered ? '✓ Watered' : 'Needs Watering'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
