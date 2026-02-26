import { useState } from 'react';
import { MapPin, Thermometer, Droplets, Navigation } from 'lucide-react';
import type { UserSettings } from '@/shared/types';

interface SettingsPanelProps {
  settings: UserSettings | null;
  onSave: (settings: Partial<UserSettings>) => Promise<void>;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [formData, setFormData] = useState({
    home_latitude: settings?.home_latitude?.toString() ?? '',
    home_longitude: settings?.home_longitude?.toString() ?? '',
    max_comfortable_walk_distance: settings?.max_comfortable_walk_distance?.toString() ?? '1.5',
    temperature_drive_threshold_high: settings?.temperature_drive_threshold_high?.toString() ?? '30',
    temperature_drive_threshold_low: settings?.temperature_drive_threshold_low?.toString() ?? '5',
    rain_drive_threshold: settings?.rain_drive_threshold?.toString() ?? '40',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        home_latitude: formData.home_latitude ? Number(formData.home_latitude) : undefined,
        home_longitude: formData.home_longitude ? Number(formData.home_longitude) : undefined,
        max_comfortable_walk_distance: Number(formData.max_comfortable_walk_distance),
        temperature_drive_threshold_high: Number(formData.temperature_drive_threshold_high),
        temperature_drive_threshold_low: Number(formData.temperature_drive_threshold_low),
        rain_drive_threshold: Number(formData.rain_drive_threshold),
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4" />
          Home Location
        </h3>
        <p className="text-white/60 text-xs mb-3">
          Required for accurate distance-based recommendations
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/80 text-xs block mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={formData.home_latitude}
              onChange={(e) => setFormData({ ...formData, home_latitude: e.target.value })}
              className="w-full px-3 py-2 rounded-xl glass-dark text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
              placeholder="e.g. 37.7749"
            />
          </div>
          <div>
            <label className="text-white/80 text-xs block mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={formData.home_longitude}
              onChange={(e) => setFormData({ ...formData, home_longitude: e.target.value })}
              className="w-full px-3 py-2 rounded-xl glass-dark text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
              placeholder="e.g. -122.4194"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Navigation className="w-4 h-4" />
          Walk Threshold
        </h3>
        <label className="text-white/80 text-xs block mb-1">
          Max comfortable walk distance (miles)
        </label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="10"
          value={formData.max_comfortable_walk_distance}
          onChange={(e) => setFormData({ ...formData, max_comfortable_walk_distance: e.target.value })}
          className="w-full px-3 py-2 rounded-xl glass-dark text-white focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
        />
      </div>

      <div>
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Thermometer className="w-4 h-4" />
          Temperature Thresholds
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/80 text-xs block mb-1">Drive if above (°C)</label>
            <input
              type="number"
              value={formData.temperature_drive_threshold_high}
              onChange={(e) => setFormData({ ...formData, temperature_drive_threshold_high: e.target.value })}
              className="w-full px-3 py-2 rounded-xl glass-dark text-white focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
            />
          </div>
          <div>
            <label className="text-white/80 text-xs block mb-1">Drive if below (°C)</label>
            <input
              type="number"
              value={formData.temperature_drive_threshold_low}
              onChange={(e) => setFormData({ ...formData, temperature_drive_threshold_low: e.target.value })}
              className="w-full px-3 py-2 rounded-xl glass-dark text-white focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Droplets className="w-4 h-4" />
          Rain Threshold
        </h3>
        <label className="text-white/80 text-xs block mb-1">
          Drive if rain probability above (%)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={formData.rain_drive_threshold}
          onChange={(e) => setFormData({ ...formData, rain_drive_threshold: e.target.value })}
          className="w-full px-3 py-2 rounded-xl glass-dark text-white focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        {saveError && (
          <p className="text-red-300 text-xs mb-2 w-full">⚠️ {saveError}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 rounded-xl glass-dark text-white font-medium hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
