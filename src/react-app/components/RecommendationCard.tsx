import { Car, TrendingUp, Umbrella, MapPin, Battery, Droplets, Sparkles, Check, X } from 'lucide-react';
import type { MobilityRecommendation } from '@/shared/types';

interface RecommendationCardProps {
  recommendation: MobilityRecommendation;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function RecommendationCard({ recommendation, onAccept, onReject }: RecommendationCardProps) {
  const getIcon = () => {
    switch (recommendation.recommendation) {
      case 'Walk':
        return <TrendingUp className="w-8 h-8" />;
      case 'Drive':
        return <Car className="w-8 h-8" />;
      case 'Rideshare':
        return <Car className="w-8 h-8" />;
    }
  };

  const getColor = () => {
    switch (recommendation.recommendation) {
      case 'Walk':
        return 'from-green-400 to-emerald-600';
      case 'Drive':
        return 'from-blue-400 to-blue-600';
      case 'Rideshare':
        return 'from-purple-400 to-purple-600';
    }
  };

  return (
    <div className="glass-effect rounded-3xl p-8 shadow-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r ${getColor()} text-white font-semibold text-lg shadow-lg`}>
            {getIcon()}
            <span>{recommendation.recommendation}</span>
          </div>
          <p className="text-white/80 mt-4 text-sm">
            Confidence: {Math.round(recommendation.confidence_score * 100)}%
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="glass-dark rounded-2xl p-4">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Why?
          </h3>
          <p className="text-white/90 text-sm leading-relaxed">{recommendation.reasoning}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-dark rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Umbrella className="w-4 h-4 text-white/70" />
              <h4 className="text-white font-medium text-sm">Weather</h4>
            </div>
            <p className="text-white/90 text-lg font-semibold">{recommendation.weather.temp}°C</p>
            <p className="text-white/70 text-xs">{recommendation.weather.condition}</p>
            <p className="text-white/70 text-xs mt-1">{recommendation.weather.rain_probability}% rain</p>
          </div>

          <div className="glass-dark rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Car className="w-4 h-4 text-white/70" />
              <h4 className="text-white font-medium text-sm">Parking</h4>
            </div>
            <p className="text-white/90 text-lg font-semibold capitalize">{recommendation.parking.difficulty}</p>
            {recommendation.parking.estimated_cost && (
              <p className="text-white/70 text-xs mt-1">${recommendation.parking.estimated_cost}</p>
            )}
          </div>
        </div>

        {recommendation.nearby_event && (
          <div className="glass-dark rounded-2xl p-4">
            <h4 className="text-white font-medium text-sm mb-1">Nearby Event</h4>
            <p className="text-white/90">{recommendation.nearby_event.name}</p>
            <p className="text-white/70 text-xs mt-1">
              {recommendation.nearby_event.distance.toFixed(1)} miles away
            </p>
          </div>
        )}

        <div className="glass-dark rounded-2xl p-4">
          <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
            <Battery className="w-4 h-4 text-white/70" />
            Home Status
          </h4>
          <div className="space-y-1">
            {recommendation.home_status.ev_charge !== undefined && (
              <p className="text-white/90 text-sm">EV Charge: {recommendation.home_status.ev_charge}%</p>
            )}
            <p className="text-white/90 text-sm flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Garden: {recommendation.home_status.garden_watered ? 'Watered ✓' : 'Needs watering'}
            </p>
          </div>
        </div>

        {recommendation.ai_reasoning && (
          <div className="glass-dark rounded-2xl p-4 border-l-4 border-blue-400">
            <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              AI Analysis
            </h4>
            <p className="text-white/90 text-sm leading-relaxed">{recommendation.ai_reasoning}</p>
          </div>
        )}

        {recommendation.friday_recap && (
          <div className="glass-dark rounded-2xl p-4 border-l-4 border-purple-400">
            <h4 className="text-white font-medium text-sm mb-2">Friday Recap</h4>
            <p className="text-white/90 text-sm leading-relaxed">{recommendation.friday_recap}</p>
          </div>
        )}
      </div>

      {(onAccept || onReject) && (
        <div className="flex gap-3">
          {onAccept && (
            <button
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500/30 border border-green-400/50 text-green-300 hover:bg-green-500/50 transition-all font-medium"
            >
              <Check className="w-4 h-4" />
              Accept
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/30 border border-red-400/50 text-red-300 hover:bg-red-500/50 transition-all font-medium"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
