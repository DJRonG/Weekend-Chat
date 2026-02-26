import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMetrics } from '@/react-app/services/analyticsService';
import type { Metrics } from '@/shared/types';

const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981'];

export default function Analytics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);
      const end = new Date().toISOString();
      const start = new Date();
      start.setDate(start.getDate() - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 1));
      try {
        const data = await getMetrics({ start: start.toISOString(), end });
        setMetrics(data);
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMetrics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="glass-effect rounded-3xl p-8 text-center">
        <p className="text-white/70">Loading analytics...</p>
      </div>
    );
  }

  if (!metrics) return null;

  const pieData = [
    { name: 'Accepted', value: metrics.accepted },
    { name: 'Rejected', value: metrics.rejected },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-3 justify-end">
        {['1d', '7d', '30d'].map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              timeRange === range ? 'bg-purple-500 text-white' : 'glass-dark text-white/70 hover:text-white'
            }`}
          >
            {range === '1d' ? 'Today' : range === '7d' ? '7 Days' : '30 Days'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-2xl p-4 text-center">
          <p className="text-white/70 text-sm">Total Recommendations</p>
          <p className="text-white text-2xl font-bold">{metrics.total_recommendations}</p>
        </div>
        <div className="glass-effect rounded-2xl p-4 text-center">
          <p className="text-white/70 text-sm">Acceptance Rate</p>
          <p className="text-white text-2xl font-bold">{(metrics.acceptance_rate * 100).toFixed(1)}%</p>
        </div>
        <div className="glass-effect rounded-2xl p-4 text-center">
          <p className="text-white/70 text-sm">Accepted</p>
          <p className="text-green-400 text-2xl font-bold">{metrics.accepted}</p>
        </div>
        <div className="glass-effect rounded-2xl p-4 text-center">
          <p className="text-white/70 text-sm">Rejected</p>
          <p className="text-red-400 text-2xl font-bold">{metrics.rejected}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Acceptance Rate Pie Chart */}
        <div className="glass-effect rounded-3xl p-6">
          <h3 className="text-white font-semibold mb-4">Recommendation Outcomes</h3>
          {metrics.total_recommendations > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                >
                  {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50 text-center py-16">No recommendation data yet</p>
          )}
        </div>

        {/* Peak Usage Hours */}
        <div className="glass-effect rounded-3xl p-6">
          <h3 className="text-white font-semibold mb-4">Peak Usage Hours</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={metrics.peak_hours.filter(h => h.count > 0).slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="hour" stroke="rgba(255,255,255,0.5)" tickFormatter={(h: number) => `${h}:00`} />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Destinations */}
      {metrics.popular_destinations.length > 0 && (
        <div className="glass-effect rounded-3xl p-6">
          <h3 className="text-white font-semibold mb-4">Top Destinations</h3>
          <div className="space-y-2">
            {metrics.popular_destinations.slice(0, 10).map((dest, i) => (
              <div key={dest.name} className="flex items-center gap-3">
                <span className="text-white/50 text-sm w-6">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-sm">{dest.name}</span>
                    <span className="text-white/70 text-sm">{dest.visits} visits</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${(dest.visits / metrics.popular_destinations[0].visits) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
