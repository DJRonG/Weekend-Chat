import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import Analytics from '@/react-app/components/Analytics';
import JourneyVisualization from '@/react-app/components/JourneyVisualization';
import { useAnalytics } from '@/react-app/hooks/useAnalytics';

export default function AnalyticsDashboard() {
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView('/analytics');
  }, [trackPageView]);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/"
            className="glass-dark rounded-full p-2 text-white hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart2 className="w-8 h-8" />
            Analytics Dashboard
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Analytics />
          </div>
          <div>
            <JourneyVisualization />
          </div>
        </div>
      </div>
    </div>
  );
}
