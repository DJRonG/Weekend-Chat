import { useState, useEffect } from 'react';
import { Sparkles, Settings } from 'lucide-react';
import RecommendationCard from '@/react-app/components/RecommendationCard';
import DestinationSelector from '@/react-app/components/DestinationSelector';
import WeatherInput from '@/react-app/components/WeatherInput';
import HomeStatusPanel from '@/react-app/components/HomeStatusPanel';
import Modal from '@/react-app/components/Modal';
import AddDestinationForm from '@/react-app/components/AddDestinationForm';
import SettingsPanel from '@/react-app/components/SettingsPanel';
import type { Destination, HomeStatus, MobilityRecommendation, UserSettings } from '@/shared/types';

export default function Home() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<number | null>(null);
  const [homeStatus, setHomeStatus] = useState<HomeStatus | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [recommendation, setRecommendation] = useState<MobilityRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const [weather, setWeather] = useState({
    temp: 20,
    condition: 'Clear',
    rain_probability: 0
  });

  useEffect(() => {
    loadDestinations();
    loadHomeStatus();
    loadSettings();
  }, []);

  const loadDestinations = async () => {
    try {
      const response = await fetch('/api/destinations');
      if (!response.ok) throw new Error('Failed to load destinations');
      const data = await response.json();
      setDestinations(data);
    } catch (err) {
      console.error('Failed to load destinations:', err);
    }
  };

  const loadHomeStatus = async () => {
    try {
      const response = await fetch('/api/home-status');
      if (!response.ok) throw new Error('Failed to load home status');
      const data = await response.json();
      setHomeStatus(data);
    } catch (err) {
      console.error('Failed to load home status:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleGetRecommendation = async () => {
    if (!selectedDestination) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: selectedDestination,
          weather
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || 'Failed to get recommendation');
      }
      const data = await response.json();
      setRecommendation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recommendation');
      console.error('Failed to get recommendation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDestination = async (destination: Omit<Destination, 'id'>) => {
    try {
      const response = await fetch('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destination)
      });
      if (!response.ok) throw new Error('Failed to add destination');
      const data = await response.json();
      setDestinations([...destinations, data]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add destination');
      console.error('Failed to add destination:', err);
    }
  };

  const handleUpdateHomeStatus = async (updates: Partial<HomeStatus>) => {
    try {
      const newStatus = { ...homeStatus, ...updates };
      
      if (homeStatus?.id) {
        await fetch('/api/home-status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStatus)
        });
      } else {
        await fetch('/api/home-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStatus)
        });
      }
      
      await loadHomeStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update home status');
      console.error('Failed to update home status:', err);
    }
  };

  const handleSaveSettings = async (updated: Partial<UserSettings>) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!response.ok) throw new Error('Failed to save settings');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err; // Re-throw so SettingsPanel can show its own inline error
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="absolute right-0 top-0 glass-dark rounded-full p-2 text-white hover:bg-white/20 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <Sparkles className="w-12 h-12" />
            Weekend Agent
          </h1>
          <p className="text-white/80 text-lg">Smart local logistics & mobility recommendations</p>
          {!settings?.home_latitude && (
            <p className="text-yellow-300/90 text-sm mt-2">
              ⚙️ Set your home location in{' '}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="underline hover:text-yellow-200 transition-colors"
              >
                Settings
              </button>{' '}
              to enable distance-based scoring
            </p>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 px-5 py-3 rounded-2xl bg-red-500/20 border border-red-400/40 text-red-200 text-sm flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-300 hover:text-white transition-colors">✕</button>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            <DestinationSelector
              destinations={destinations}
              selectedId={selectedDestination}
              onSelect={setSelectedDestination}
              onAdd={() => setShowAddModal(true)}
            />
            <WeatherInput weather={weather} onChange={setWeather} />
            <HomeStatusPanel status={homeStatus} onUpdate={handleUpdateHomeStatus} />
          </div>

          {/* Right Column - Recommendation */}
          <div className="lg:col-span-2">
            {recommendation ? (
              <RecommendationCard recommendation={recommendation} />
            ) : (
              <div className="glass-effect rounded-3xl p-12 shadow-2xl text-center">
                <Sparkles className="w-16 h-16 text-white/50 mx-auto mb-4" />
                <h3 className="text-white text-2xl font-semibold mb-2">Ready to get a recommendation?</h3>
                <p className="text-white/70 mb-6">Select a destination and configure the settings</p>
                {selectedDestination && (
                  <button
                    onClick={handleGetRecommendation}
                    disabled={loading}
                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Analyzing...' : 'Get Recommendation'}
                  </button>
                )}
              </div>
            )}

            {/* Action Button */}
            {recommendation && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleGetRecommendation}
                  disabled={loading}
                  className="px-8 py-4 rounded-2xl glass-effect text-white font-semibold shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Analyzing...' : 'Refresh Recommendation'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Destination Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Destination"
      >
        <AddDestinationForm
          onSubmit={handleAddDestination}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Settings"
      >
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      </Modal>
    </div>
  );
}
