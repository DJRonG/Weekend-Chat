import { useState } from 'react';
import type { Destination } from '@/shared/types';

interface AddDestinationFormProps {
  onSubmit: (destination: Omit<Destination, 'id'>) => void;
  onCancel: () => void;
}

export default function AddDestinationForm({ onSubmit, onCancel }: AddDestinationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    typical_parking_difficulty: 'medium',
    has_parking_garage: false,
    parking_cost_estimate: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      address: formData.address,
      latitude: formData.latitude ? Number(formData.latitude) : undefined,
      longitude: formData.longitude ? Number(formData.longitude) : undefined,
      typical_parking_difficulty: formData.typical_parking_difficulty,
      has_parking_garage: formData.has_parking_garage,
      parking_cost_estimate: formData.parking_cost_estimate ? Number(formData.parking_cost_estimate) : undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-white/90 text-sm font-medium block mb-2">Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Downtown Bar & Grill"
        />
      </div>

      <div>
        <label className="text-white/90 text-sm font-medium block mb-2">Address *</label>
        <input
          type="text"
          required
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="123 Main St"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-white/90 text-sm font-medium block mb-2">Latitude</label>
          <input
            type="number"
            step="any"
            value={formData.latitude}
            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
            className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder="37.7749"
          />
        </div>
        <div>
          <label className="text-white/90 text-sm font-medium block mb-2">Longitude</label>
          <input
            type="number"
            step="any"
            value={formData.longitude}
            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
            className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder="-122.4194"
          />
        </div>
      </div>

      <div>
        <label className="text-white/90 text-sm font-medium block mb-2">Parking Difficulty</label>
        <select
          value={formData.typical_parking_difficulty}
          onChange={(e) => setFormData({ ...formData, typical_parking_difficulty: e.target.value })}
          className="w-full px-4 py-3 rounded-xl glass-dark text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div>
        <label className="flex items-center gap-2 text-white/90 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.has_parking_garage}
            onChange={(e) => setFormData({ ...formData, has_parking_garage: e.target.checked })}
            className="w-5 h-5 rounded"
          />
          <span className="text-sm font-medium">Has parking garage</span>
        </label>
      </div>

      <div>
        <label className="text-white/90 text-sm font-medium block mb-2">Parking Cost ($)</label>
        <input
          type="number"
          step="0.01"
          value={formData.parking_cost_estimate}
          onChange={(e) => setFormData({ ...formData, parking_cost_estimate: e.target.value })}
          className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="15.00"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 rounded-xl glass-dark text-white font-medium hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all"
        >
          Add Destination
        </button>
      </div>
    </form>
  );
}
