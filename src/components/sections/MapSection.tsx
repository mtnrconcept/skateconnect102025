import { useState, useEffect, useRef } from 'react';
import { MapPin, Filter, Plus, Navigation } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../../lib/supabase';
import SpotDetailModal from '../SpotDetailModal';
import AddSpotModal from '../AddSpotModal';
import type { Spot } from '../../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function MapSection() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadSpots();
  }, [filter]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [2.3522, 48.8566],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || loading) return;
    updateMarkers();
  }, [spots, loading]);

  const loadSpots = async () => {
    try {
      let query = supabase
        .from('spots')
        .select('*, creator:profiles(*)');

      if (filter !== 'all') {
        query = query.eq('spot_type', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setSpots(data || []);
    } catch (error) {
      console.error('Error loading spots:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMarkers = () => {
    if (!map.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    spots.forEach((spot) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.cursor = 'pointer';

      const markerColor = getMarkerColor(spot.spot_type);
      el.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${markerColor}" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([spot.longitude, spot.latitude])
        .addTo(map.current!);

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div class="p-2">
            <h3 class="font-bold text-sm">${spot.name}</h3>
            <p class="text-xs text-slate-600">${getSpotTypeLabel(spot.spot_type)}</p>
          </div>
        `);

      marker.setPopup(popup);

      el.addEventListener('click', () => {
        setSelectedSpot(spot);
      });

      markersRef.current.push(marker);
    });
  };

  const getMarkerColor = (type: string): string => {
    const colors: Record<string, string> = {
      street: '#f97316',
      skatepark: '#22c55e',
      bowl: '#3b82f6',
      diy: '#a855f7',
      transition: '#06b6d4',
    };
    return colors[type] || '#64748b';
  };

  const getSpotTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      street: 'Street',
      skatepark: 'Skatepark',
      bowl: 'Bowl',
      diy: 'DIY',
      transition: 'Transition',
    };
    return labels[type] || type;
  };

  const flyToSpot = (spot: Spot) => {
    if (map.current) {
      map.current.flyTo({
        center: [spot.longitude, spot.latitude],
        zoom: 15,
        duration: 1500,
      });
      setSelectedSpot(spot);
    }
  };

  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(coords);

          if (map.current) {
            map.current.flyTo({
              center: coords,
              zoom: 14,
              duration: 1500,
            });

            new mapboxgl.Marker({ color: '#3b82f6' })
              .setLngLat(coords)
              .setPopup(new mapboxgl.Popup().setHTML('<p class="text-sm font-medium">Vous êtes ici</p>'))
              .addTo(map.current);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Impossible d\'obtenir votre position');
        }
      );
    }
  };

  const filterButtons = [
    { id: 'all', label: 'Tous' },
    { id: 'street', label: 'Street' },
    { id: 'skatepark', label: 'Parks' },
    { id: 'bowl', label: 'Bowls' },
    { id: 'diy', label: 'DIY' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Spots de Skate</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Ajouter un spot</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Filter size={18} className="text-slate-500 flex-shrink-0" />
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === btn.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
          <div className="relative h-full min-h-[400px]">
            <div ref={mapContainer} className="absolute inset-0" />
            <button
              onClick={getUserLocation}
              className="absolute top-4 left-4 bg-white rounded-lg p-3 shadow-lg hover:bg-slate-50 transition-colors z-10"
              title="Ma position"
            >
              <Navigation size={20} className="text-slate-700" />
            </button>
          </div>

          <div className="bg-white overflow-y-auto p-4">
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{spots.length}</div>
                  <div className="text-sm text-slate-600">spots au total</div>
                </div>
                <div className="bg-cyan-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-600">
                    {spots.filter(s => s.is_verified).length}
                  </div>
                  <div className="text-sm text-slate-600">spots vérifiés</div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Chargement des spots...</div>
            ) : spots.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MapPin size={48} className="mx-auto mb-2 opacity-30" />
                <p>Aucun spot trouvé</p>
                <p className="text-sm mt-1">Soyez le premier à en ajouter un!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {spots.map((spot) => (
                  <div
                    key={spot.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => flyToSpot(spot)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-800">{spot.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        spot.spot_type === 'street' ? 'bg-orange-100 text-orange-700' :
                        spot.spot_type === 'skatepark' ? 'bg-green-100 text-green-700' :
                        spot.spot_type === 'bowl' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {getSpotTypeLabel(spot.spot_type)}
                      </span>
                    </div>
                    {spot.description && (
                      <p className="text-sm text-slate-600 mb-2 line-clamp-2">{spot.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{spot.address || 'Adresse non spécifiée'}</span>
                      <span className="flex items-center gap-1">
                        {'⭐'.repeat(spot.difficulty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
        />
      )}

      {showAddModal && (
        <AddSpotModal
          onClose={() => setShowAddModal(false)}
          onSpotAdded={() => {
            loadSpots();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
