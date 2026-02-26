import { Car, PersonStanding, Umbrella, MapPin, Battery, Droplets, BarChart3, Clock } from 'lucide-react';
import type { MobilityRecommendation } from '@/shared/types';

interface RecommendationCardProps {
  recommendation: MobilityRecommendation;
}

const WEATHER_EMOJI: Record<string, string> = {
  clear: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
  snowy: '❄️',
};

/** Maximum score used to normalise the width of score breakdown bars */
const SCORE_BAR_MAX = 60;

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: string }) {
  const isPositive = score > 0;
  const isNeutral = score === 0;
  const color = isNeutral
    ? 'bg-white/20'
    : isPositive
    ? 'bg-orange-400/70'
    : 'bg-green-400/70';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-center">{icon}</span>
      <span className="text-white/70 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        {!isNeutral && (
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${Math.min(Math.abs(score) / SCORE_BAR_MAX * 100, 100)}%` }}
          />
        )}
      </div>
      <span className={`w-8 text-right font-mono ${isPositive ? 'text-orange-300' : isNeutral ? 'text-white/40' : 'text-green-300'}`}>
        {score > 0 ? `+${score}` : score}
      </span>
    </div>
  );
}

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const getIcon = () => {
    switch (recommendation.recommendation) {
      case 'Walk':
        return <PersonStanding className="w-8 h-8" />;
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

  const weatherEmoji = WEATHER_EMOJI[recommendation.weather.condition.toLowerCase()] ?? '🌤️';
  const { score_breakdown } = recommendation;

  return (
    <div className="glass-effect rounded-3xl p-8 shadow-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r ${getColor()} text-white font-semibold text-lg shadow-lg`}>
            {getIcon()}
            <span>{recommendation.recommendation}</span>
          </div>
          {/* Confidence bar */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-white/70 text-sm">Confidence</span>
            <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden w-32">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getColor()}`}
                style={{ width: `${Math.round(recommendation.confidence_score * 100)}%` }}
              />
            </div>
            <span className="text-white/80 text-sm font-semibold">
              {Math.round(recommendation.confidence_score * 100)}%
            </span>
          </div>
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
            <p className="text-white/90 text-lg font-semibold">
              {weatherEmoji} {recommendation.weather.temp}°C
            </p>
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

        {/* Score Breakdown */}
        <div className="glass-dark rounded-2xl p-4">
          <h4 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-white/70" />
            Score Breakdown
          </h4>
          <div className="space-y-2">
            <ScoreBar label="Weather" score={score_breakdown.weather} icon="🌡️" />
            <ScoreBar label="Parking" score={score_breakdown.parking} icon="🅿️" />
            <ScoreBar label="Events" score={score_breakdown.events} icon="📅" />
            <ScoreBar label="Home" score={score_breakdown.home_status} icon="🏠" />
            <ScoreBar label="Distance" score={score_breakdown.distance} icon="📍" />
            <ScoreBar label="Time of day" score={score_breakdown.time_of_day} icon="⏰" />
            <div className="border-t border-white/20 mt-2 pt-2 flex items-center justify-between">
              <span className="text-white/60 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" /> Total score
              </span>
              <span className="text-white font-semibold text-sm">{score_breakdown.total}</span>
            </div>
          </div>
        </div>

        {recommendation.friday_recap && (
          <div className="glass-dark rounded-2xl p-4 border-l-4 border-purple-400">
            <h4 className="text-white font-medium text-sm mb-2">Friday Recap</h4>
            <p className="text-white/90 text-sm leading-relaxed">{recommendation.friday_recap}</p>
          </div>
        )}
      </div>
    </div>
  );
}

