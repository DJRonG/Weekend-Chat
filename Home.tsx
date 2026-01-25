import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import RecommendationCard from '@/react-app/components/RecommendationCard';
import DestinationSelector from '@/react-app/components/DestinationSelector';
import WeatherInput from '@/react-app/components/WeatherInput';
import HomeStatusPanel from '@/react-app/components/HomeStatusPanel';
import Modal from '@/react-app/components/Modal';
import AddDestinationForm from '@/react-app/components/AddDestinationForm';
import type { Destination, HomeStatus, MobilityRecommendation } from '@/shared/types';

export default function Home() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<number | null>(null);
  const [homeStatus, setHomeStatus] = useState<HomeStatus | null>(null);
  const [recommendation, setRecommendation] = useState<MobilityRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [weather, setWeather] = useState({
    temp: 20,
    condition: 'Clear',
    rain_probability: 0
  });

  useEffect(() => {
    loadDestinations();
    loadHomeStatus();
  }, []);

  const loadDestinations = async () => {
    try {
      const response = await fetch('/api/destinations');
      const data = await response.json();
      setDestinations(data);
    } catch (error) {
      console.error('Failed to load destinations:', error);
    }
  };

  const loadHomeStatus = async () => {
    try {
      const response = await fetch('/api/home-status');
      const data = await response.json();
      setHomeStatus(data);
    } catch (error) {
      console.error('Failed to load home status:', error);
    }
  };

  const handleGetRecommendation = async () => {
    if (!selectedDestination) return;

    setLoading(true);
    try {
      const response = await fetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: selectedDestination,
          weather
        })
      });
      const data = await response.json();
      setRecommendation(data);
    } catch (error) {
      console.error('Failed to get recommendation:', error);
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
      const data = await response.json();
      setDestinations([...destinations, data]);
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add destination:', error);
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
    } catch (error) {
      console.error('Failed to update home status:', error);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <Sparkles className="w-12 h-12" />
            Weekend Agent
          </h1>
          <p className="text-white/80 text-lg">Smart local logistics & mobility recommendations</p>
        </div>

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
    </div>
  );
}
