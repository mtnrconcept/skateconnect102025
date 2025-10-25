import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Filter, Plus, Navigation, AlertTriangle } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../../lib/supabase';
import SpotDetailModal from '../SpotDetailModal';
import AddSpotModal from '../AddSpotModal';
import type { Spot } from '../../types';
import SpotGrid from '../SpotGrid';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

interface MapSectionProps {
  focusSpotId?: string | null;
  onSpotFocusHandled?: () => void;
  isMapAvailable?: boolean;
}

export default function MapSection({
  focusSpotId,
  onSpotFocusHandled,
  isMapAvailable = true,
}: MapSectionProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const lastFocusedSpotRef = useRef<string | null>(null);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotCoverPhotos, setSpotCoverPhotos] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false));

  const filteredSpots = useMemo(() => {
    const trimmedQuery = searchTerm.trim();
    if (trimmedQuery.length === 0) {
      return spots;
    }

    const normalizedTokens = trimmedQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => normalizeText(token));

    if (normalizedTokens.length === 0) {
      return spots;
    }

    return spots.filter((spot) => {
      const haystack = normalizeText(
        `${spot.name} ${spot.address ?? ''} ${spot.description ?? ''} ${spot.spot_type ?? ''} ` +
          `${spot.creator?.display_name ?? ''} ${spot.creator?.username ?? ''}`,
      );

      return normalizedTokens.every((token) => haystack.includes(token));
    });
  }, [spots, searchTerm]);

  useEffect(() => {
    setLoading(true);
    loadSpots();
  }, [filter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportChange = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!isMapAvailable) return;
    if (!mapContainer.current || map.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [2.3522, 48.8566],
      zoom: 12,
    });

    map.current = mapInstance;

    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const handleResize = () => {
      mapInstance.resize();
    };

    if (!mapInstance.loaded()) {
      mapInstance.once('load', handleResize);
    } else {
      handleResize();
    }

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      mapInstance.remove();
      map.current = null;
    };
  }, [isMapAvailable]);

  useEffect(() => {
    if (!isMapAvailable) return;
    if (!map.current || !isDesktop) return;

    const frame = window.requestAnimationFrame(() => {
      map.current?.resize();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isDesktop, isMapAvailable]);

  useEffect(() => {
    if (!isMapAvailable) return;
    if (!map.current || loading) return;
    updateMarkers(filteredSpots);
  }, [filteredSpots, loading, spotCoverPhotos, isMapAvailable]);

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

  const updateMarkers = (spotsToRender: Spot[]) => {
    if (!isMapAvailable) return;
    if (!map.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    spotsToRender.forEach((spot) => {
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

  const getMarkerColor = (_type: string): string => {
    return '#ff8c00';
  };

  const flyToSpot = (spot: Spot) => {
    if (!isMapAvailable) {
      return;
    }

    if (map.current) {
      map.current.flyTo({
        center: [spot.longitude, spot.latitude],
        zoom: 15,
        duration: 1500,
      });
      setSelectedSpot(spot);
    }
  };

  useEffect(() => {
    if (!isMapAvailable) {
      if (focusSpotId) {
        onSpotFocusHandled?.();
      }
      return;
    }

    if (!focusSpotId || spots.length === 0) {
      return;
    }

    if (focusSpotId === lastFocusedSpotRef.current) {
      return;
    }

    const targetSpot = spots.find((spot) => spot.id === focusSpotId);

    if (targetSpot) {
      flyToSpot(targetSpot);
      lastFocusedSpotRef.current = focusSpotId;
      onSpotFocusHandled?.();
    }
  }, [focusSpotId, spots, onSpotFocusHandled, isMapAvailable]);

  useEffect(() => {
    if (!focusSpotId) {
      lastFocusedSpotRef.current = null;
      return;
    }

    setSearchTerm('');
  }, [focusSpotId]);

  const getUserLocation = () => {
    if (!isMapAvailable) {
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];

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

  const gridTemplateColumns = isDesktop ? 'minmax(0, 1fr) minmax(0, 1fr)' : undefined;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-dark-700 bg-dark-900/70 shadow-2xl shadow-orange-900/10 min-h-[640px] lg:h-[calc(100vh-13rem)] lg:max-h-[calc(100vh-13rem)]">
      <div className="border-b border-dark-700 bg-dark-900/80 px-6 py-6 backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-orange-400/80 mb-2">Explorer</p>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-white">Spot Map</h2>
              <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase text-orange-200">
                {filteredSpots.length} spots
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              Découvre les parks, bowls, DIY et transitions autour de toi. La carte reste visible pendant que tu explores les spots détaillés.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-[26rem]">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Rechercher un spot ou une ville"
                className="w-full rounded-xl border border-dark-600 bg-dark-800/70 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-dark-600 bg-dark-800/70 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-orange-500/40 hover:bg-dark-700/70">
              <Filter size={18} className="text-orange-400" />
              Affiner les filtres
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {filterButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => setFilter(button.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === button.id
                  ? 'border border-orange-500/60 bg-orange-500/20 text-orange-100 shadow-[0_0_15px_rgba(255,153,0,0.15)]'
                  : 'border border-dark-600 bg-dark-800/70 text-gray-300 hover:border-orange-500/40 hover:text-orange-100'
              }`}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div
          className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2"
          style={gridTemplateColumns ? { gridTemplateColumns } : undefined}
        >
          <div className="relative h-[360px] overflow-hidden border-b border-dark-800 lg:h-full lg:border-b-0 lg:border-r lg:border-dark-800">
            {isMapAvailable ? (
              <>
                <div ref={mapContainer} className="absolute inset-0" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-dark-900/70 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-dark-900/70 to-transparent" />

                <div className="absolute left-4 top-4 flex flex-col gap-3">
                  <button
                    onClick={getUserLocation}
                    className="inline-flex items-center gap-2 rounded-xl border border-dark-700 bg-dark-900/80 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-black/50 transition-colors hover:border-orange-500/50 hover:bg-dark-800/90"
                    title="Centrer sur ma position"
                  >
                    <Navigation size={18} className="text-orange-400" />
                    <span>Ma position</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-orange-900/30 transition-transform hover:-translate-y-1 hover:bg-orange-400"
                >
                  <Plus size={18} />
                  Ajouter un spot
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-dark-900/85 px-6 text-center text-gray-300">
                <AlertTriangle size={36} className="text-orange-400" />
                <div>
                  <p className="text-lg font-semibold text-white">Carte indisponible</p>
                  <p className="mt-2 text-sm text-gray-400">
                    Configure le jeton <code className="rounded bg-dark-800 px-1 py-0.5 text-xs">VITE_MAPBOX_TOKEN</code> pour activer la carte interactive.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-xl shadow-orange-900/30 transition-transform hover:-translate-y-0.5 hover:bg-orange-400"
                >
                  <Plus size={18} />
                  Ajouter un spot
                </button>
              </div>
            )}
          </div>

          <div className="relative bg-dark-900/80 lg:border-l lg:border-dark-800">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-dark-900 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-dark-900 to-transparent" />
            <div className="relative flex h-full flex-col overflow-hidden">
              {loading ? (
                <div className="flex flex-1 items-center justify-center px-6 py-10 text-gray-400">
                  Chargement des spots...
                </div>
              ) : filteredSpots.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-gray-400 text-center">
                  <MapPin size={48} className="opacity-40" />
                  <p>
                    {searchTerm.trim().length > 0
                      ? `Aucun spot ne correspond à « ${searchTerm} »`
                      : 'Aucun spot trouvé'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {searchTerm.trim().length > 0
                      ? 'Essaie un autre nom, une ville ou réinitialise ta recherche pour voir plus de résultats.'
                      : 'Ajoute le premier spot dans cette catégorie.'}
                  </p>
                </div>
              ) : (
                <SpotGrid
                  spots={filteredSpots}
                  initialCount={3}
                  onSpotClick={flyToSpot}
                  coverPhotos={spotCoverPhotos}
                />
              )}
            </div>
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
