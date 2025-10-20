import { useState, useEffect, useRef } from 'react';
import { MapPin, Filter, Plus, Navigation, Star } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../../lib/supabase';
import SpotDetailModal from '../SpotDetailModal';
import AddSpotModal from '../AddSpotModal';
import type { Spot, SpotMedia } from '../../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function MapSection() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotCoverPhotos, setSpotCoverPhotos] = useState<Record<string, string>>({});
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
  }, [spots, loading, spotCoverPhotos]);

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

      if (data && data.length > 0) {
        loadCoverPhotos(data.map(spot => spot.id));
      }
    } catch (error) {
      console.error('Error loading spots:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCoverPhotos = async (spotIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('spot_media')
        .select('spot_id, media_url, is_cover_photo, created_at')
        .in('spot_id', spotIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const coverMap: Record<string, string> = {};

      spotIds.forEach(spotId => {
        const spotMedia = data?.filter(m => m.spot_id === spotId) || [];
        const coverPhoto = spotMedia.find(m => m.is_cover_photo) || spotMedia[0];
        if (coverPhoto) {
          coverMap[spotId] = coverPhoto.media_url;
        }
      });

      setSpotCoverPhotos(coverMap);
    } catch (error) {
      console.error('Error loading cover photos:', error);
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

      const coverPhotoUrl = spotCoverPhotos[spot.id];
      const stars = Array.from({ length: 5 }, (_, i) =>
        i < spot.difficulty ? '★' : '☆'
      ).join('');

      const createPopupWithSmartAnchor = () => {
        if (!map.current) return null;

        const point = map.current.project([spot.longitude, spot.latitude]);
        const mapContainer = map.current.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();

        const isMobile = mapRect.width < 768;
        const POPUP_WIDTH = isMobile ? Math.min(260, mapRect.width - 32) : 280;
        const POPUP_HEIGHT = isMobile ? 200 : 220;
        const EDGE_PADDING = isMobile ? 12 : 16;
        const MARKER_HEIGHT = 32;
        const MARKER_OFFSET = isMobile ? 35 : 40;

        const centerX = mapRect.width / 2;
        const centerY = mapRect.height / 2;

        const isAboveCenter = point.y < centerY;
        const isBelowCenter = point.y > centerY;
        const isLeftOfCenter = point.x < centerX;
        const isRightOfCenter = point.x > centerX;

        const distanceFromTop = point.y - EDGE_PADDING;
        const distanceFromBottom = mapRect.height - point.y - EDGE_PADDING;
        const distanceFromLeft = point.x - EDGE_PADDING;
        const distanceFromRight = mapRect.width - point.x - EDGE_PADDING;

        let anchor: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom';
        let offset = isMobile ? 30 : 35;

        const canFitBelow = distanceFromBottom > (POPUP_HEIGHT + MARKER_OFFSET);
        const canFitAbove = distanceFromTop > (POPUP_HEIGHT + MARKER_OFFSET);
        const canFitRight = distanceFromRight > (POPUP_WIDTH + MARKER_HEIGHT);
        const canFitLeft = distanceFromLeft > (POPUP_WIDTH + MARKER_HEIGHT);
        const hasHorizontalSpace = (distanceFromLeft > POPUP_WIDTH / 2) && (distanceFromRight > POPUP_WIDTH / 2);

        if (isMobile) {
          if (isAboveCenter && canFitBelow) {
            if (hasHorizontalSpace) {
              anchor = 'top';
              offset = 30;
            } else if (distanceFromLeft < POPUP_WIDTH / 2) {
              anchor = 'top-left';
              offset = 12;
            } else if (distanceFromRight < POPUP_WIDTH / 2) {
              anchor = 'top-right';
              offset = 12;
            } else {
              anchor = 'top';
              offset = 30;
            }
          } else if (isBelowCenter && canFitAbove) {
            if (hasHorizontalSpace) {
              anchor = 'bottom';
              offset = 30;
            } else if (distanceFromLeft < POPUP_WIDTH / 2) {
              anchor = 'bottom-left';
              offset = 12;
            } else if (distanceFromRight < POPUP_WIDTH / 2) {
              anchor = 'bottom-right';
              offset = 12;
            } else {
              anchor = 'bottom';
              offset = 30;
            }
          } else if (canFitBelow) {
            anchor = 'top';
            offset = 30;
          } else if (canFitAbove) {
            anchor = 'bottom';
            offset = 30;
          } else {
            anchor = 'top';
            offset = 10;
          }
        } else {
          if (isAboveCenter && canFitBelow && hasHorizontalSpace) {
            anchor = 'top';
            offset = 35;
          } else if (isBelowCenter && canFitAbove && hasHorizontalSpace) {
            anchor = 'bottom';
            offset = 35;
          } else if (isLeftOfCenter && canFitRight) {
            anchor = 'left';
            offset = 20;
          } else if (isRightOfCenter && canFitLeft) {
            anchor = 'right';
            offset = 20;
          } else if (isAboveCenter && canFitBelow) {
            if (distanceFromLeft < POPUP_WIDTH / 2) {
              anchor = 'top-left';
              offset = 15;
            } else if (distanceFromRight < POPUP_WIDTH / 2) {
              anchor = 'top-right';
              offset = 15;
            } else {
              anchor = 'top';
              offset = 35;
            }
          } else if (isBelowCenter && canFitAbove) {
            if (distanceFromLeft < POPUP_WIDTH / 2) {
              anchor = 'bottom-left';
              offset = 15;
            } else if (distanceFromRight < POPUP_WIDTH / 2) {
              anchor = 'bottom-right';
              offset = 15;
            } else {
              anchor = 'bottom';
              offset = 35;
            }
          } else if (canFitBelow) {
            anchor = 'top';
            offset = 35;
          } else if (canFitAbove) {
            anchor = 'bottom';
            offset = 35;
          } else if (canFitRight) {
            anchor = 'left';
            offset = 20;
          } else if (canFitLeft) {
            anchor = 'right';
            offset = 20;
          } else {
            anchor = 'top';
            offset = 10;
          }
        }

        return new mapboxgl.Popup({
          offset,
          closeButton: false,
          closeOnClick: false,
          className: 'spot-hover-popup',
          maxWidth: `${POPUP_WIDTH}px`,
          anchor
        })
          .setMaxWidth(`${POPUP_WIDTH}px`)
          .setHTML(`
          <div class="spot-hover-card">
            ${coverPhotoUrl ? `
              <div class="spot-hover-image">
                <img src="${coverPhotoUrl}" alt="${spot.name}" onerror="this.parentElement.innerHTML='<div class=\\'spot-hover-no-image\\'><svg width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path d=\\'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\\'></path><circle cx=\\'12\\' cy=\\'10\\' r=\\'3\\'></circle></svg></div>';" />
              </div>
            ` : `
              <div class="spot-hover-image spot-hover-no-image">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
            `}
            <div class="spot-hover-content">
              <h3 class="spot-hover-title">${spot.name}</h3>
              <div class="spot-hover-rating">
                <span class="spot-hover-stars">${stars}</span>
              </div>
              <p class="spot-hover-address">${spot.address || 'Adresse non spécifiée'}</p>
            </div>
          </div>
        `);
      };

      let popup: mapboxgl.Popup | null = null;
      let popupTimeout: NodeJS.Timeout | null = null;

      const showPopup = () => {
        if (popupTimeout) {
          clearTimeout(popupTimeout);
          popupTimeout = null;
        }

        if (popup) {
          popup.remove();
        }

        popup = createPopupWithSmartAnchor();
        if (popup && map.current) {
          popup.setLngLat([spot.longitude, spot.latitude]).addTo(map.current);
        }
      };

      const hidePopup = () => {
        if (popupTimeout) {
          clearTimeout(popupTimeout);
        }

        popupTimeout = setTimeout(() => {
          if (popup) {
            popup.remove();
            popup = null;
          }
        }, 150);
      };

      el.addEventListener('mouseenter', showPopup);
      el.addEventListener('mouseleave', hidePopup);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popupTimeout) {
          clearTimeout(popupTimeout);
          popupTimeout = null;
        }
        if (popup) {
          popup.remove();
          popup = null;
        }
        setSelectedSpot(spot);
      });

      markersRef.current.push(marker);
    });
  };

  const getMarkerColor = (type: string): string => {
    return '#ff8c00';
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
      <div className="bg-dark-800 border-b border-dark-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">SPOT MAP</h2>
          <div className="flex items-center gap-2">
            <button className="text-gray-400 hover:text-white transition-colors">
              <Filter size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Find new spots..."
              className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500"
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          </div>
          <button className="px-3 py-2 bg-dark-700 border border-dark-600 text-gray-400 rounded-lg hover:bg-dark-600 transition-colors text-sm">
            Park
          </button>
          <button className="px-3 py-2 bg-dark-700 border border-dark-600 text-gray-400 rounded-lg hover:bg-dark-600 transition-colors text-sm">
            DIY
          </button>
          <button className="px-3 py-2 bg-dark-700 border border-dark-600 text-gray-400 rounded-lg hover:bg-dark-600 transition-colors text-sm">
            Indoor
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
          <div className="relative h-full min-h-[400px]">
            <div ref={mapContainer} className="absolute inset-0" />
            <button
              onClick={getUserLocation}
              className="absolute top-4 left-4 bg-dark-800 rounded-lg p-3 shadow-lg hover:bg-dark-700 transition-colors z-10 border border-dark-700"
              title="Ma position"
            >
              <Navigation size={20} className="text-orange-500" />
            </button>
          </div>

          <div className="bg-dark-900 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-400">Chargement des spots...</div>
            ) : spots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MapPin size={48} className="mx-auto mb-2 opacity-30" />
                <p>Aucun spot trouvé</p>
                <p className="text-sm mt-1">Soyez le premier à en ajouter un!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {spots.map((spot) => (
                  <div
                    key={spot.id}
                    className="bg-dark-800 border border-dark-700 rounded-lg p-4 hover:bg-dark-700 transition-colors cursor-pointer"
                    onClick={() => flyToSpot(spot)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white">{spot.name}</h3>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500 text-white">
                        {getSpotTypeLabel(spot.spot_type)}
                      </span>
                    </div>
                    {spot.description && (
                      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{spot.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{spot.address || 'Adresse non spécifiée'}</span>
                      <span className="flex items-center gap-1 text-orange-500">
                        {'⭐'.repeat(spot.difficulty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-6 flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors shadow-lg font-semibold"
            >
              <Plus size={20} />
              <span>Add a Spot</span>
            </button>
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
