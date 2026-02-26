import type { RecommendationContext, MobilityData } from '@/shared/types';

export function buildRecommendationPrompt(context: RecommendationContext): string {
  const { destination, weather, homeStatus, userPreferences, recentDecisions, currentTime, dayOfWeek } = context;

  return `You are a mobility assistant helping someone decide how to travel to their destination.

Current Context:
- Time: ${currentTime} on ${dayOfWeek}
- Destination: ${destination.name} at ${destination.address}
- Weather: ${weather.temp}°C, ${weather.condition}, ${weather.rain_probability}% rain probability
- EV Charge: ${homeStatus?.ev_charge_percentage ?? 'Unknown'}%
- Garden watered: ${homeStatus?.garden_watered ? 'Yes' : 'No'}

User Preferences:
- Max comfortable walk distance: ${userPreferences.max_walk_distance} miles
- Temperature thresholds: ${userPreferences.temp_threshold_low}°C to ${userPreferences.temp_threshold_high}°C
- Rain threshold: ${userPreferences.rain_threshold}%

Destination parking: ${destination.typical_parking_difficulty || 'Unknown'} difficulty
${destination.has_parking_garage ? 'Parking garage available' : 'No parking garage'}
${destination.parking_cost_estimate ? `Estimated parking cost: $${destination.parking_cost_estimate}` : ''}

Recent travel decisions: ${recentDecisions.length > 0 ? recentDecisions.slice(-3).map(d => d.type).join(', ') : 'None'}

Based on this context, provide a recommendation in JSON format:
{
  "recommendation": "Walk" | "Drive" | "Rideshare",
  "reasoning": "clear explanation in 2-3 sentences",
  "confidence": 0.0 to 1.0,
  "factors": ["list", "of", "key", "factors"]
}

Return ONLY valid JSON, no additional text.`;
}

export function buildAlternativesPrompt(destinationName: string, reason: string): string {
  return `Suggest 3 alternative destinations similar to "${destinationName}" because: ${reason}

Return ONLY valid JSON:
[
  {"name": "Alternative 1", "reason": "why it's similar", "confidence": 0.8},
  {"name": "Alternative 2", "reason": "why it's similar", "confidence": 0.7},
  {"name": "Alternative 3", "reason": "why it's similar", "confidence": 0.6}
]`;
}

export function buildMobilityAnalysisPrompt(data: MobilityData): string {
  return `Analyze the mobility situation for traveling to ${data.destination.name}:
- Distance: ${data.distance.toFixed(1)} miles
- Weather: ${data.weather.temp}°C, ${data.weather.condition}, ${data.weather.rain_probability}% rain
- EV Charge: ${data.evCharge ?? 'Unknown'}%
- Nearby events: ${data.nearbyEvents.length}

Return ONLY valid JSON:
{
  "recommendation": "Walk" | "Drive" | "Rideshare",
  "reasoning": "explanation",
  "confidence": 0.0 to 1.0,
  "factors": ["factor1", "factor2"]
}`;
}
