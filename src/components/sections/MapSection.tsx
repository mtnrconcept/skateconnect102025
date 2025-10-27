import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapPin, Filter, Plus, Navigation, AlertTriangle, Star, Route, X, Clock } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../../lib/supabase.js';
import SpotDetailModal from '../SpotDetailModal';
import AddSpotModal from '../AddSpotModal';
import type { Spot } from '../../types';
import ScrollableSpotList from '../ScrollableSpotList';
import type { FeatureCollection, LineString } from 'geojson';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const ROUTE_SOURCE_ID = 'map-section-route-source';
const ROUTE_LAYER_ID = 'map-section-route-layer';

type RouteMode = 'driving' | 'transit' | 'walking';

const routeModeProfiles: Record<RouteMode, string> = {
  driving: 'mapbox/driving',
  transit: 'mapbox/driving-traffic',
  walking: 'mapbox/walking',
};

const routeModeLabels: Record<RouteMode, string> = {
  driving: 'Voiture',
  transit: 'Transports en commun',
  walking: 'À pied',
};

const routeModeOptions: Array<{ id: RouteMode; label: string }> = [
  { id: 'driving', label: routeModeLabels.driving },
  { id: 'transit', label: routeModeLabels.transit },
  { id: 'walking', label: routeModeLabels.walking },
];

interface MapboxRouteResponse {
  routes?: Array<{
    geometry?: LineString;
    distance?: number;
    duration?: number;
    legs?: Array<{
      distance?: number;
      duration?: number;
      steps?: Array<{
        distance?: number;
        duration?: number;
        maneuver?: {
          instruction?: string;
        };
      }>;
    }>;
  }>;
}

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

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
  const userLocationRef = useRef<[number, number] | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotCoverPhotos, setSpotCoverPhotos] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Spot['spot_type'] | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false));
  const [surfaceFilters, setSurfaceFilters] = useState<string[]>([]);
  const [moduleFilters, setModuleFilters] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [mapVisibleSpots, setMapVisibleSpots] = useState<Spot[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeMode, setRouteMode] = useState<RouteMode>('walking');
  const [activeRouteSpotId, setActiveRouteSpotId] = useState<string | null>(null);
  const [routeDetails, setRouteDetails] = useState<{
    spotId: string;
    spotName: string;
    distance: number;
    duration: number;
    steps: RouteStep[];
    mode: RouteMode;
  } | null>(null);

  const filterControlsRef = useRef<HTMLDivElement | null>(null);

  const clearRoute = useCallback(() => {
    setRouteDetails(null);
    setActiveRouteSpotId(null);

    if (!isMapAvailable) {
      return;
    }

    const mapInstance = map.current;
    if (!mapInstance) {
      return;
    }

    if (mapInstance.getLayer(ROUTE_LAYER_ID)) {
      mapInstance.removeLayer(ROUTE_LAYER_ID);
    }

    if (mapInstance.getSource(ROUTE_SOURCE_ID)) {
      mapInstance.removeSource(ROUTE_SOURCE_ID);
    }
  }, [isMapAvailable]);

  const formatDistance = useCallback((meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) {
      return '—';
    }

    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }

    return `${Math.round(meters)} m`;
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '—';
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} h`;
    }

    return `${hours} h ${remainingMinutes} min`;
  }, []);

  const sanitizeInstruction = useCallback((instruction: string) => {
    return instruction
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  useEffect(() => {
    return () => {
      clearRoute();
    };
  }, [clearRoute]);

  const surfaceOptions = useMemo(
    () => [
      'concrete',
      'wood',
      'marble',
      'granite',
      'metal',
      'asphalt',
    ],
    [],
  );

  const moduleOptions = useMemo(
    () => [
      'stairs',
      'rails',
      'ledges',
      'gaps',
      'quarter',
      'funbox',
      'bank',
      'bowl',
      'pool',
      'transitions',
      'manual pad',
      'spine',
      'curbs',
    ],
    [],
  );

  const surfaceLabels: Record<string, string> = {
    concrete: 'Béton',
    wood: 'Bois',
    marble: 'Marbre',
    granite: 'Granite',
    metal: 'Métal',
    asphalt: 'Asphalte',
  };

  const moduleLabels: Record<string, string> = {
    stairs: 'Marches',
    rails: 'Rails',
    ledges: 'Ledges',
    gaps: 'Gaps',
    quarter: 'Quarter',
    funbox: 'Funbox',
    bank: 'Banks',
    bowl: 'Bowl',
    pool: 'Pool',
    transitions: 'Transitions',
    'manual pad': 'Manual pad',
    spine: 'Spine',
    curbs: 'Curbs',
  };

  const difficultyOptions: {
    id: 'all' | 'beginner' | 'intermediate' | 'advanced';
    label: string;
    helper?: string;
  }[] = [
    { id: 'all', label: 'Tous niveaux' },
    { id: 'beginner', label: 'Débutant', helper: 'Niveaux 1 à 2' },
    { id: 'intermediate', label: 'Intermédiaire', helper: 'Niveau 3' },
    { id: 'advanced', label: 'Avancé', helper: 'Niveaux 4 à 5' },
  ];

  const difficultyRanges = useMemo(
    () => ({
      beginner: { min: 1, max: 2 },
      intermediate: { min: 3, max: 3 },
      advanced: { min: 4, max: 5 },
    }),
    [],
  );

  const ratingFilterOptions: { id: 'all' | 1 | 2 | 3 | 4 | 5; label: string }[] = [
    { id: 'all', label: 'Toutes notes' },
    { id: 4, label: '4 étoiles et +' },
    { id: 3, label: '3 étoiles et +' },
    { id: 2, label: '2 étoiles et +' },
  ];

  const activeFiltersCount =
    surfaceFilters.length +
    moduleFilters.length +
    (difficultyFilter !== 'all' ? 1 : 0) +
    (ratingFilter !== 'all' ? 1 : 0);

  const filteredSpots = useMemo(() => {
    const trimmedQuery = searchTerm.trim();
    const normalizedTokens = trimmedQuery.length > 0
      ? trimmedQuery
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => normalizeText(token))
      : [];

    return spots.filter((spot) => {
      if (surfaceFilters.length > 0) {
        const spotSurfaces = Array.isArray(spot.surfaces) ? spot.surfaces : [];
        const hasAllSurfaces = surfaceFilters.every((surface) => spotSurfaces.includes(surface));
        if (!hasAllSurfaces) {
          return false;
        }
      }

      if (moduleFilters.length > 0) {
        const spotModules = Array.isArray(spot.modules) ? spot.modules : [];
        const hasAllModules = moduleFilters.every((module) => spotModules.includes(module));
        if (!hasAllModules) {
          return false;
        }
      }

      if (difficultyFilter !== 'all') {
        const range = difficultyRanges[difficultyFilter];
        if (spot.difficulty < range.min) {
          return false;
        }
        if (typeof range.max !== 'undefined' && spot.difficulty > range.max) {
          return false;
        }
      }

      if (ratingFilter !== 'all') {
        const ratingValue =
          typeof spot.rating_average === 'number' && Number.isFinite(spot.rating_average)
            ? spot.rating_average
            : 0;
        if (ratingValue < ratingFilter) {
          return false;
        }
      }

      if (normalizedTokens.length > 0) {
        const haystack = normalizeText(
          `${spot.name} ${spot.address ?? ''} ${spot.description ?? ''} ${spot.spot_type ?? ''} ` +
            `${spot.creator?.display_name ?? ''} ${spot.creator?.username ?? ''}`,
        );

        return normalizedTokens.every((token) => haystack.includes(token));
      }

      return true;
    });
  }, [spots, searchTerm, surfaceFilters, moduleFilters, difficultyFilter, difficultyRanges, ratingFilter]);

  const loadCoverPhotos = useCallback(async (spotIds: string[]) => {
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
  }, []);

  const loadSpots = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('spots')
        .select('*, creator:profiles(*)');

      if (filter !== 'all') {
        query = query.eq('spot_type', filter);
      }

      if (surfaceFilters.length > 0) {
        query = query.contains('surfaces', surfaceFilters);
      }

      if (moduleFilters.length > 0) {
        query = query.contains('modules', moduleFilters);
      }

      if (difficultyFilter !== 'all') {
        const { min, max } = difficultyRanges[difficultyFilter];
        query = query.gte('difficulty', min);
        if (typeof max !== 'undefined') {
          query = query.lte('difficulty', max);
        }
      }

      if (ratingFilter !== 'all') {
        query = query.gte('rating_average', ratingFilter);
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
  }, [difficultyFilter, difficultyRanges, filter, loadCoverPhotos, moduleFilters, surfaceFilters, ratingFilter]);

  useEffect(() => {
    void loadSpots();
  }, [loadSpots]);

  useEffect(() => {
    if (!showFilterPanel) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterControlsRef.current && !filterControlsRef.current.contains(target)) {
        setShowFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterPanel]);

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

    const handleViewportChange = () => {
      updateVisibleSpotsRef.current();
    };

    const handleMapClick = () => {
      setSelectedSpot(null);
    };

    mapInstance.on('moveend', handleViewportChange);
    mapInstance.on('zoomend', handleViewportChange);
    mapInstance.on('click', handleMapClick);

    if (!mapInstance.loaded()) {
      mapInstance.once('load', () => {
        handleResize();
        handleViewportChange();
      });
    } else {
      handleResize();
      handleViewportChange();
    }

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
      handleViewportChange();
    });

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      mapInstance.off('moveend', handleViewportChange);
      mapInstance.off('zoomend', handleViewportChange);
      mapInstance.off('click', handleMapClick);
      clearRoute();
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      userLocationRef.current = null;
      mapInstance.remove();
      map.current = null;
    };
  }, [clearRoute, isMapAvailable]);

  useEffect(() => {
    if (!isMapAvailable) return;
    if (!map.current || !isDesktop) return;

    const frame = window.requestAnimationFrame(() => {
      map.current?.resize();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isDesktop, isMapAvailable]);

  const markerColors = useMemo(
    () => ({
      street: '#f97316',
      skatepark: '#22d3ee',
      bowl: '#a855f7',
      diy: '#facc15',
      transition: '#34d399',
    } satisfies Record<Spot['spot_type'], string>),
    [],
  );

  const getMarkerColor = useCallback(
    (type: Spot['spot_type']): string => markerColors[type] ?? '#ff8c00',
    [markerColors],
  );

  const updateVisibleSpotsOnMap = useCallback(() => {
    if (!isMapAvailable || !map.current) {
      setMapVisibleSpots(filteredSpots);
      return;
    }

    const bounds = map.current.getBounds();
    if (!bounds) {
      setMapVisibleSpots(filteredSpots);
      return;
    }
    const visibleSpots = filteredSpots.filter((spot) => {
      if (typeof spot.latitude !== 'number' || typeof spot.longitude !== 'number') {
        return false;
      }

      return bounds.contains([spot.longitude, spot.latitude]);
    });

    setMapVisibleSpots(visibleSpots);
  }, [filteredSpots, isMapAvailable]);

  useEffect(() => {
    updateVisibleSpotsOnMap();
  }, [updateVisibleSpotsOnMap]);

  const updateVisibleSpotsRef = useRef(updateVisibleSpotsOnMap);

  useEffect(() => {
    updateVisibleSpotsRef.current = updateVisibleSpotsOnMap;
  }, [updateVisibleSpotsOnMap]);

  const updateMarkers = useCallback((spotsToRender: Spot[]) => {
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
  }, [getMarkerColor, isMapAvailable, spotCoverPhotos]);

  useEffect(() => {
    if (!isMapAvailable) return;
    if (!map.current || loading) return;
    updateMarkers(filteredSpots);
  }, [filteredSpots, loading, isMapAvailable, updateMarkers]);

  const flyToSpot = useCallback(
    (spot: Spot) => {
      setSelectedSpot(spot);

      if (!isMapAvailable) {
        return;
      }

      if (map.current) {
        map.current.flyTo({
          center: [spot.longitude, spot.latitude],
          zoom: 15,
          duration: 1500,
        });
      }
    },
    [isMapAvailable],
  );

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
  }, [focusSpotId, spots, onSpotFocusHandled, isMapAvailable, flyToSpot]);

  useEffect(() => {
    if (!focusSpotId) {
      lastFocusedSpotRef.current = null;
      return;
    }

    setSearchTerm('');
  }, [focusSpotId]);

  const updateUserLocationMarker = useCallback(
    (coords: [number, number]) => {
      if (!isMapAvailable) {
        return;
      }

      const mapInstance = map.current;
      if (!mapInstance) {
        return;
      }

      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setLngLat(coords);
      } else {
        userLocationMarkerRef.current = new mapboxgl.Marker({ color: '#3b82f6' })
          .setLngLat(coords)
          .setPopup(new mapboxgl.Popup().setHTML('<p class="text-sm font-medium">Vous êtes ici</p>'))
          .addTo(mapInstance);
      }
    },
    [isMapAvailable],
  );

  const requestUserLocation = useCallback(async () => {
    if (!isMapAvailable) {
      throw new Error('Carte indisponible');
    }

    if (userLocationRef.current) {
      updateUserLocationMarker(userLocationRef.current);
      return userLocationRef.current;
    }

    if (!('geolocation' in navigator)) {
      throw new Error('La géolocalisation n\'est pas supportée par votre navigateur.');
    }

    return await new Promise<[number, number]>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          userLocationRef.current = coords;
          updateUserLocationMarker(coords);
          resolve(coords);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 15_000,
        },
      );
    });
  }, [isMapAvailable, updateUserLocationMarker]);

  const getUserLocation = useCallback(() => {
    if (!isMapAvailable) {
      return;
    }

    (async () => {
      try {
        const coords = await requestUserLocation();

        if (map.current) {
          map.current.flyTo({
            center: coords,
            zoom: 14,
            duration: 1500,
          });
        }
      } catch (error) {
        console.error('Geolocation error:', error);
        alert('Impossible d\'obtenir votre position');
      }
    })();
  }, [isMapAvailable, requestUserLocation]);

  const showRouteToSpot = useCallback(
    async (spot: Spot) => {
      if (!isMapAvailable) {
        alert('La carte n\'est pas disponible.');
        return;
      }

      if (!map.current) {
        return;
      }

      if (typeof spot.longitude !== 'number' || typeof spot.latitude !== 'number') {
        alert('Ce spot ne dispose pas de coordonnées valides.');
        return;
      }

      setIsRouteLoading(true);

      try {
        const userCoords = await requestUserLocation();
        const mapInstance = map.current;

        if (!mapInstance) {
          throw new Error('Carte non disponible');
        }

        const profile = routeModeProfiles[routeMode] ?? routeModeProfiles.walking;
        const directionsUrl = new URL(
          `https://api.mapbox.com/directions/v5/${profile}/${userCoords[0]},${userCoords[1]};${spot.longitude},${spot.latitude}`,
        );
        directionsUrl.searchParams.set('geometries', 'geojson');
        directionsUrl.searchParams.set('overview', 'full');
        directionsUrl.searchParams.set('steps', 'true');
        directionsUrl.searchParams.set('language', 'fr');
        directionsUrl.searchParams.set('alternatives', 'false');
        directionsUrl.searchParams.set('access_token', mapboxgl.accessToken ?? '');

        const response = await fetch(directionsUrl.toString());

        if (!response.ok) {
          throw new Error(`Échec de la récupération de l'itinéraire (${response.status})`);
        }

        const data: MapboxRouteResponse = await response.json();

        const firstRoute = data.routes?.[0];
        const routeGeometry = firstRoute?.geometry;

        if (!routeGeometry || !Array.isArray(routeGeometry.coordinates) || routeGeometry.coordinates.length === 0) {
          throw new Error('Aucun itinéraire disponible');
        }

        const routeFeatureCollection: FeatureCollection<LineString> = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: routeGeometry,
              properties: {},
            },
          ],
        };

        clearRoute();

        mapInstance.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: routeFeatureCollection,
        });

        mapInstance.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#fb923c',
            'line-width': 5,
            'line-opacity': 0.9,
          },
        });

        const bounds = routeGeometry.coordinates.reduce(
          (acc, coordinate) => acc.extend(coordinate as [number, number]),
          new mapboxgl.LngLatBounds(),
        );

        bounds.extend(userCoords);
        bounds.extend([spot.longitude, spot.latitude]);

        mapInstance.fitBounds(bounds, {
          padding: 80,
          duration: 1200,
          maxZoom: 15.5,
        });

        const steps = firstRoute?.legs?.[0]?.steps
          ?.map((step) => ({
            instruction: sanitizeInstruction(step.maneuver?.instruction ?? ''),
            distance: step.distance ?? 0,
            duration: step.duration ?? 0,
          }))
          .filter((step) => step.instruction.length > 0) ?? [];

        setRouteDetails({
          spotId: spot.id,
          spotName: spot.name,
          distance: firstRoute?.distance ?? 0,
          duration: firstRoute?.duration ?? 0,
          steps,
          mode: routeMode,
        });

        setActiveRouteSpotId(spot.id);
      } catch (error) {
        console.error('Error fetching route:', error);
        clearRoute();
        alert('Impossible de calculer l\'itinéraire jusqu\'à ce spot.');
      } finally {
        setIsRouteLoading(false);
      }
    },
    [clearRoute, isMapAvailable, requestUserLocation, routeMode, sanitizeInstruction],
  );

  const handleRouteRequest = useCallback(
    (spot: Spot) => {
      void showRouteToSpot(spot);
    },
    [showRouteToSpot],
  );

  useEffect(() => {
    if (!selectedSpot || !activeRouteSpotId) {
      return;
    }

    if (activeRouteSpotId !== selectedSpot.id) {
      clearRoute();
    }
  }, [selectedSpot, activeRouteSpotId, clearRoute]);

  useEffect(() => {
    if (routeDetails) {
      clearRoute();
    }
  }, [routeMode, routeDetails, clearRoute]);

  const filterButtons: { id: Spot['spot_type'] | 'all'; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'street', label: 'Street' },
    { id: 'skatepark', label: 'Parks' },
    { id: 'bowl', label: 'Bowls' },
    { id: 'diy', label: 'DIY' },
    { id: 'transition', label: 'Transitions' },
  ];

  const gridTemplateColumns = isDesktop ? 'minmax(0, 1fr) minmax(0, 1fr)' : undefined;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-dark-700 bg-dark-900/70 shadow-2xl shadow-orange-900/10 min-h-[640px] lg:h-[calc(100vh-13rem)] lg:max-h-[calc(100vh-13rem)]">
      <div className="relative z-30 border-b border-dark-700 bg-dark-900/80 px-6 py-6 backdrop-blur">
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
            <div ref={filterControlsRef} className="relative">
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dark-600 bg-dark-800/70 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-orange-500/40 hover:bg-dark-700/70"
                onClick={() => setShowFilterPanel((previous) => !previous)}
                aria-expanded={showFilterPanel}
                type="button"
              >
                <Filter size={18} className="text-orange-400" />
                Affiner les filtres
                {activeFiltersCount > 0 && (
                  <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {showFilterPanel && (
                <div
                  className="absolute right-0 z-50 mt-2 w-full max-w-sm rounded-2xl border border-dark-600 bg-dark-900/95 p-4 shadow-2xl shadow-black/40 backdrop-blur"
                  role="dialog"
                  aria-label="Filtres des spots"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">Filtres avancés</p>
                    {activeFiltersCount > 0 && (
                      <span className="text-xs text-gray-400">
                        {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-white">Surfaces</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {surfaceOptions.map((surface) => {
                        const isActive = surfaceFilters.includes(surface);
                        return (
                          <button
                            key={surface}
                            onClick={() =>
                              setSurfaceFilters((previous) =>
                                previous.includes(surface)
                                  ? previous.filter((value) => value !== surface)
                                  : [...previous, surface],
                              )
                            }
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              isActive
                                ? 'border border-orange-500/60 bg-orange-500/20 text-orange-100 shadow-[0_0_10px_rgba(255,153,0,0.12)]'
                                : 'border border-dark-600 bg-dark-800/70 text-gray-300 hover:border-orange-500/40 hover:text-orange-100'
                            }`}
                            type="button"
                          >
                            {surfaceLabels[surface] ?? surface}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-white">Modules</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {moduleOptions.map((module) => {
                        const isActive = moduleFilters.includes(module);
                        return (
                          <button
                            key={module}
                            onClick={() =>
                              setModuleFilters((previous) =>
                                previous.includes(module)
                                  ? previous.filter((value) => value !== module)
                                  : [...previous, module],
                              )
                            }
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              isActive
                                ? 'border border-orange-500/60 bg-orange-500/20 text-orange-100 shadow-[0_0_10px_rgba(255,153,0,0.12)]'
                                : 'border border-dark-600 bg-dark-800/70 text-gray-300 hover:border-orange-500/40 hover:text-orange-100'
                            }`}
                            type="button"
                          >
                            {moduleLabels[module] ?? module}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-white">Difficulté</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {difficultyOptions.map((option) => {
                        const isActive = difficultyFilter === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setDifficultyFilter(option.id)}
                            className={`flex flex-col rounded-xl border px-3 py-2 text-left transition-colors ${
                              isActive
                                ? 'border-orange-500/60 bg-orange-500/15 text-orange-100 shadow-[0_0_12px_rgba(255,153,0,0.12)]'
                                : 'border-dark-600 bg-dark-800/70 text-gray-300 hover:border-orange-500/40 hover:text-orange-100'
                            }`}
                            type="button"
                          >
                            <span className="text-sm font-semibold">{option.label}</span>
                            {option.helper && <span className="text-xs text-gray-400">{option.helper}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-white">Note minimale</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ratingFilterOptions.map((option) => {
                        const isActive = ratingFilter === option.id;
                        const isNumeric = typeof option.id === 'number';
                        const threshold = isNumeric ? option.id : 0;

                        return (
                          <button
                            key={option.id}
                            onClick={() => setRatingFilter(option.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              isActive
                                ? 'border border-orange-500/60 bg-orange-500/20 text-orange-100 shadow-[0_0_10px_rgba(255,153,0,0.12)]'
                                : 'border border-dark-600 bg-dark-800/70 text-gray-300 hover:border-orange-500/40 hover:text-orange-100'
                            }`}
                            type="button"
                          >
                            {isNumeric ? (
                              <span className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, index) => (
                                  <Star
                                    key={index}
                                    size={14}
                                    className={index < threshold ? 'fill-amber-300 text-amber-300' : 'text-dark-500'}
                                  />
                                ))}
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
                                  {`${threshold}★ et +`}
                                </span>
                              </span>
                            ) : (
                              <span>{option.label}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSurfaceFilters([]);
                        setModuleFilters([]);
                        setDifficultyFilter('all');
                        setRatingFilter('all');
                      }}
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 hover:text-orange-200"
                      type="button"
                    >
                      Réinitialiser
                    </button>
                    <button
                      onClick={() => setShowFilterPanel(false)}
                      className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-orange-900/40 transition-transform hover:-translate-y-0.5 hover:bg-orange-400"
                      type="button"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
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
          <div className="relative h-[360px] min-h-0 overflow-hidden border-b border-dark-800 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:border-dark-800">
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
                  <div className="inline-flex items-stretch gap-1 rounded-xl border border-dark-700 bg-dark-900/80 p-1 text-xs font-semibold text-gray-300 shadow-lg shadow-black/50">
                    {routeModeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRouteMode(option.id)}
                        disabled={isRouteLoading}
                        className={`rounded-lg px-3 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                          routeMode === option.id
                            ? 'bg-orange-500/20 text-orange-100 shadow-inner shadow-orange-900/20'
                            : 'text-gray-300 hover:bg-dark-800/70'
                        } ${isRouteLoading ? 'cursor-not-allowed opacity-70' : ''}`}
                        aria-pressed={routeMode === option.id}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {selectedSpot && (
                    <button
                      onClick={() => {
                        handleRouteRequest(selectedSpot);
                      }}
                      disabled={isRouteLoading}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-black/50 transition-colors hover:border-orange-500/50 hover:bg-dark-800/90 ${
                        activeRouteSpotId === selectedSpot.id
                          ? 'border-orange-500/60 bg-orange-500/20 text-orange-100'
                          : 'border-dark-700 bg-dark-900/80'
                      } ${isRouteLoading ? 'cursor-wait opacity-80' : ''}`}
                      title="Afficher l'itinéraire vers ce spot"
                    >
                      <Route size={18} className="text-orange-400" />
                      <span>{isRouteLoading ? 'Calcul...' : 'Itinéraire'}</span>
                    </button>
                  )}
                </div>

                {routeDetails && (
                  <div className="absolute right-4 top-4 z-30 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-dark-700 bg-dark-900/85 p-4 text-gray-200 shadow-2xl shadow-black/40 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-400/80">Itinéraire</p>
                        <h3 className="mt-1 text-lg font-semibold text-white leading-tight">{routeDetails.spotName}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1 rounded-full bg-dark-800/70 px-2.5 py-1 text-orange-200">
                            {routeModeLabels[routeDetails.mode]}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-dark-800/70 px-2.5 py-1">
                            <Route size={14} className="text-orange-400" />
                            {formatDistance(routeDetails.distance)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-dark-800/70 px-2.5 py-1">
                            <Clock size={14} className="text-orange-400" />
                            {formatDuration(routeDetails.duration)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearRoute}
                        className="rounded-full p-1 text-gray-400 transition-colors hover:bg-dark-800/70 hover:text-white"
                        title="Fermer l'itinéraire"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
                      {routeDetails.steps.length > 0 ? (
                        <ol className="space-y-3 text-sm text-gray-200">
                          {routeDetails.steps.map((step, index) => (
                            <li
                              key={`${routeDetails.spotId}-step-${index}`}
                              className="rounded-xl bg-dark-800/70 p-3 shadow-inner shadow-black/20"
                            >
                              <div className="flex items-start gap-3">
                                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-xs font-semibold text-orange-200">
                                  {index + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="font-medium leading-snug text-white">{step.instruction}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                                    <span>{formatDistance(step.distance)}</span>
                                    <span>•</span>
                                    <span>{formatDuration(step.duration)}</span>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-gray-400">
                          Itinéraire détaillé indisponible pour ce trajet.
                        </p>
                      )}
                    </div>
                  </div>
                )}

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

          <div
            className="relative flex h-[360px] min-h-0 flex-col overflow-hidden bg-dark-900/80 lg:h-full lg:min-h-0 lg:border-l lg:border-dark-800"
            data-spot-panel
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-dark-900 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-dark-900 to-transparent" />
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
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
              ) : mapVisibleSpots.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-gray-400 text-center">
                  <MapPin size={48} className="opacity-40" />
                  <p>Aucun spot visible dans cette zone.</p>
                  <p className="text-sm text-gray-500">
                    Dézoome ou déplace la carte pour découvrir davantage de spots.
                  </p>
                </div>
              ) : (
                <ScrollableSpotList
                  spots={mapVisibleSpots}
                  onSpotClick={flyToSpot}
                  coverPhotos={spotCoverPhotos}
                  onRouteRequest={handleRouteRequest}
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
          onRequestRoute={handleRouteRequest}
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
