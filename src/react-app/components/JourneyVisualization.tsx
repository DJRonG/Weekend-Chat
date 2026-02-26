import { useJourneyStore } from '@/react-app/stores/journeyStore';
import { Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';

export default function JourneyVisualization() {
  const { decisions } = useJourneyStore();
  const recent = decisions.slice(-10).reverse();

  const getIcon = (type: string) => {
    switch (type) {
      case 'destination_selected': return <MapPin className="w-4 h-4 text-blue-400" />;
      case 'accepted': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-white/50" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'destination_selected': return 'Selected destination';
      case 'recommendation_viewed': return 'Viewed recommendation';
      case 'accepted': return 'Accepted recommendation';
      case 'rejected': return 'Rejected recommendation';
      case 'alternative_viewed': return 'Viewed alternatives';
      default: return type;
    }
  };

  if (recent.length === 0) {
    return (
      <div className="glass-effect rounded-3xl p-8 text-center">
        <Clock className="w-12 h-12 text-white/30 mx-auto mb-3" />
        <p className="text-white/50">No journey history yet</p>
      </div>
    );
  }

  return (
    <div className="glass-effect rounded-3xl p-6">
      <h3 className="text-white font-semibold mb-4">Recent Journey</h3>
      <div className="relative">
        {recent.map((decision, index) => (
          <div key={decision.id} className="flex gap-3 mb-4 last:mb-0">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full glass-dark flex items-center justify-center flex-shrink-0">
                {getIcon(decision.type)}
              </div>
              {index < recent.length - 1 && (
                <div className="w-px flex-1 bg-white/20 mt-1 min-h-4" />
              )}
            </div>
            <div className="flex-1 pb-2">
              <p className="text-white text-sm font-medium">{getLabel(decision.type)}</p>
              {decision.destination_name && (
                <p className="text-white/60 text-xs mt-0.5">{decision.destination_name}</p>
              )}
              <p className="text-white/40 text-xs mt-0.5">
                {new Date(decision.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
