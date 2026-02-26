import { Sun } from 'lucide-react';

interface WeatherInputProps {
  weather: {
    temp: number;
    condition: string;
    rain_probability: number;
  };
  onChange: (weather: { temp: number; condition: string; rain_probability: number }) => void;
}

export default function WeatherInput({ weather, onChange }: WeatherInputProps) {
  return (
    <div className="glass-effect rounded-3xl p-6 shadow-2xl">
      <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
        <Sun className="w-6 h-6" />
        Current Weather
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-white/90 text-sm font-medium block mb-2">
            Temperature (°C)
          </label>
          <input
            type="number"
            value={weather.temp}
            onChange={(e) => onChange({ ...weather, temp: Number(e.target.value) })}
            className="w-full px-4 py-3 rounded-xl glass-dark text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>

        <div>
          <label className="text-white/90 text-sm font-medium block mb-2">
            Condition
          </label>
          <select
            value={weather.condition}
            onChange={(e) => onChange({ ...weather, condition: e.target.value })}
            className="w-full px-4 py-3 rounded-xl glass-dark text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="Clear">Clear</option>
            <option value="Cloudy">Cloudy</option>
            <option value="Rainy">Rainy</option>
            <option value="Stormy">Stormy</option>
            <option value="Snowy">Snowy</option>
          </select>
        </div>

        <div>
          <label className="text-white/90 text-sm font-medium block mb-2">
            Rain Probability (%)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={weather.rain_probability}
            onChange={(e) => onChange({ ...weather, rain_probability: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-white/70 text-sm mt-1">
            <span>0%</span>
            <span className="font-semibold">{weather.rain_probability}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
