import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.web.css";
import Map3DSceneWeb from "./components/Map3DScene.web.jsx";
import { createRealtimeMapLoader } from "./services/osmService.js";
import { MAP_CONFIG } from "./config/mapConfig.js";
import { calculateDistance } from "./utils/geoUtils.js";

const DEFAULT_LOCATION = {
  latitude: -25.4957255,
  longitude: -49.1658802,
  altitude: 0,
  accuracy: 5,
};
const OBSERVER_LOCATION_STORAGE_KEY = "observerLocation";
const DEVICE_LOCATION_STORAGE_KEY = "deviceLocation";

function normalizeLocation(loc) {
  return {
    latitude: Number(loc?.latitude) || DEFAULT_LOCATION.latitude,
    longitude: Number(loc?.longitude) || DEFAULT_LOCATION.longitude,
    altitude: Number(loc?.altitude) || 0,
    accuracy: Number(loc?.accuracy) || 5,
  };
}

function applyMetersToLocation(baseLocation, deltaXMeters, deltaZMeters) {
  const lat = baseLocation.latitude;
  const safeCos = Math.max(0.00001, Math.cos((lat * Math.PI) / 180));
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * safeCos;

  return {
    ...baseLocation,
    latitude: lat + deltaZMeters / metersPerDegreeLat,
    longitude: baseLocation.longitude + deltaXMeters / metersPerDegreeLon,
  };
}

export default function AppWeb() {
  const [location, setLocation] = useState(null);
  const [renderAnchor, setRenderAnchor] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [coordInput, setCoordInput] = useState("");
  const [inputError, setInputError] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [mapStats, setMapStats] = useState(null);

  const watchIdRef = useRef(null);
  const deviceLocationRef = useRef(null);
  const loaderRef = useRef(null);
  const lastEnsureRef = useRef({
    latitude: Number.NaN,
    longitude: Number.NaN,
    time: 0,
  });
  const updateTokenRef = useRef(0);
  const skipNextDebouncedRefreshRef = useRef(false);

  const loadStoredLocation = () => {
    const stored = localStorage.getItem(OBSERVER_LOCATION_STORAGE_KEY);
    if (!stored) {
      // Compatibilidade com versão antiga que usava só "deviceLocation".
      const legacyStored = localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY);
      if (!legacyStored) return null;
      try {
        return normalizeLocation(JSON.parse(legacyStored));
      } catch (readError) {
        console.error(
          "Erro ao ler localização legada do localStorage:",
          readError,
        );
        return null;
      }
    }
    try {
      return normalizeLocation(JSON.parse(stored));
    } catch (readError) {
      console.error("Erro ao ler localização do observador:", readError);
      return null;
    }
  };

  const saveLocationToStorage = (loc) => {
    try {
      localStorage.setItem(
        OBSERVER_LOCATION_STORAGE_KEY,
        JSON.stringify(normalizeLocation(loc)),
      );
    } catch (writeError) {
      console.error("Erro ao salvar localização do observador:", writeError);
    }
  };

  const loadStoredDeviceLocation = () => {
    const stored = localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY);
    if (!stored) return null;
    try {
      return normalizeLocation(JSON.parse(stored));
    } catch (readError) {
      console.error("Erro ao ler localização do dispositivo:", readError);
      return null;
    }
  };

  const saveDeviceLocationToStorage = (loc) => {
    try {
      localStorage.setItem(
        DEVICE_LOCATION_STORAGE_KEY,
        JSON.stringify(normalizeLocation(loc)),
      );
    } catch (writeError) {
      console.error("Erro ao salvar localização do dispositivo:", writeError);
    }
  };

  const ensureRealtimeLoader = useCallback(() => {
    if (!loaderRef.current) {
      loaderRef.current = createRealtimeMapLoader({
        tileSizeMeters: MAP_CONFIG.TILE_SIZE_METERS,
        activeRadiusMeters: MAP_CONFIG.ACTIVE_RADIUS_METERS,
        maxCachedTiles: MAP_CONFIG.MAX_CACHED_TILES,
        maxConcurrentFetches: MAP_CONFIG.MAX_CONCURRENT_TILE_FETCHES,
      });
    }
    return loaderRef.current;
  }, []);

  const refreshMapForLocation = useCallback(
    async (loc, { forceEnsure = false } = {}) => {
      const normalized = normalizeLocation(loc);
      const loader = ensureRealtimeLoader();
      const now = Date.now();
      const previousEnsure = lastEnsureRef.current;

      const movedMeters = Number.isFinite(previousEnsure.latitude)
        ? calculateDistance(
            previousEnsure.latitude,
            previousEnsure.longitude,
            normalized.latitude,
            normalized.longitude,
          ) * 1000
        : Number.POSITIVE_INFINITY;

      const shouldEnsureArea =
        forceEnsure ||
        movedMeters >= MAP_CONFIG.UPDATE_DISTANCE_INTERVAL ||
        now - previousEnsure.time >= MAP_CONFIG.UPDATE_TIME_INTERVAL;

      if (shouldEnsureArea) {
        const requestToken = ++updateTokenRef.current;
        await loader.ensureActiveArea(
          normalized.latitude,
          normalized.longitude,
          {
            blockingTileCount: MAP_CONFIG.BLOCKING_TILE_COUNT,
            onBackgroundLoaded: () => {
              if (requestToken !== updateTokenRef.current) return;
              const bgMapData = loader.getActiveMapData(
                normalized.latitude,
                normalized.longitude,
              );
              setMapData(bgMapData);
              setMapStats(bgMapData.meta || loader.getStats());
            },
          },
        );
        if (requestToken !== updateTokenRef.current) return;

        const nextMapData = loader.getActiveMapData(
          normalized.latitude,
          normalized.longitude,
        );

        setRenderAnchor(normalized);
        setMapData(nextMapData);
        setMapStats(nextMapData.meta || loader.getStats());
        setMapError(false);

        lastEnsureRef.current = {
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          time: now,
        };
        return;
      }

      setMapStats(loader.getStats());
    },
    [ensureRealtimeLoader],
  );

  const jumpToLocation = useCallback(
    async (nextLocation) => {
      const normalized = normalizeLocation(nextLocation);
      skipNextDebouncedRefreshRef.current = true;

      setLocation(normalized);
      saveLocationToStorage(normalized);

      setLoading(true);
      try {
        await refreshMapForLocation(normalized, { forceEnsure: true });
        setMapError(false);
      } catch (refreshError) {
        console.error(
          "Erro ao carregar mapa para nova localização:",
          refreshError,
        );
        setMapError(true);
        setInputError("Falha ao carregar mapa");
      } finally {
        setLoading(false);
      }
    },
    [refreshMapForLocation],
  );

  const initializeGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation não suportada");
      return;
    }

    setLocationEnabled(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = normalizeLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
        });
        deviceLocationRef.current = loc;
        saveDeviceLocationToStorage(loc);
      },
      (geoError) => {
        console.warn("Erro ao obter localização atual:", geoError.message);
        const stored = loadStoredDeviceLocation();
        if (!stored) return;
        deviceLocationRef.current = stored;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc = normalizeLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
        });
        deviceLocationRef.current = loc;
        saveDeviceLocationToStorage(loc);
      },
      (geoError) => {
        console.warn("Erro ao monitorar localização:", geoError.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const storedDevice = loadStoredDeviceLocation();
        if (storedDevice) {
          deviceLocationRef.current = storedDevice;
        }
        const initialLocation = loadStoredLocation() || DEFAULT_LOCATION;
        const normalized = normalizeLocation(initialLocation);

        setLocation(normalized);
        setLoading(true);

        await refreshMapForLocation(normalized, { forceEnsure: true });

        if (!mounted) return;
        setLoading(false);
        initializeGeolocation();
      } catch (initError) {
        console.error("Location error:", initError);
        if (!mounted) return;
        setError(
          "Erro ao inicializar: " + (initError?.message || String(initError)),
        );
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      updateTokenRef.current += 1;
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (loaderRef.current) {
        loaderRef.current.clear();
      }
    };
  }, [initializeGeolocation, refreshMapForLocation]);

  useEffect(() => {
    if (!location || loading) return;

    if (skipNextDebouncedRefreshRef.current) {
      skipNextDebouncedRefreshRef.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      refreshMapForLocation(location).catch((refreshError) => {
        console.error(
          "Erro na atualização do mapa em tempo real:",
          refreshError,
        );
        setMapError(true);
      });
    }, MAP_CONFIG.REALTIME_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [location, loading, refreshMapForLocation]);

  useEffect(() => {
    if (!location) return;
    const persistTimeout = setTimeout(() => {
      saveLocationToStorage(location);
    }, 1500);
    return () => clearTimeout(persistTimeout);
  }, [location]);

  const handleObserverMove = useCallback((deltaXMeters, deltaZMeters) => {
    if (!Number.isFinite(deltaXMeters) || !Number.isFinite(deltaZMeters))
      return;
    if (deltaXMeters === 0 && deltaZMeters === 0) return;

    setLocation((previousLocation) => {
      if (!previousLocation) return previousLocation;
      const next = applyMetersToLocation(
        previousLocation,
        deltaXMeters,
        deltaZMeters,
      );
      return next;
    });
  }, []);

  const handleCenterOnDevice = () => {
    if (!navigator.geolocation) {
      setInputError("Geolocalização não suportada");
      return;
    }

    setInputError(null);

    if (deviceLocationRef.current) {
      jumpToLocation(deviceLocationRef.current);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const loc = normalizeLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
        });
        deviceLocationRef.current = loc;
        saveDeviceLocationToStorage(loc);
        await jumpToLocation(loc);
      },
      (geoError) => {
        console.error("Erro ao obter localização do dispositivo:", geoError);
        setInputError(
          "Não foi possível obter a localização. Verifique as permissões.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleGoToCoordinates = async () => {
    setInputError(null);
    if (!coordInput) return;

    const parts = coordInput
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length !== 2) {
      setInputError("Informe em: latitude, longitude");
      return;
    }

    const lat = parseFloat(parts[0].replace(/\s+/g, ""));
    const lon = parseFloat(parts[1].replace(/\s+/g, ""));

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setInputError("Coordenadas inválidas");
      return;
    }

    await jumpToLocation({
      latitude: lat,
      longitude: lon,
      altitude: 0,
      accuracy: 5,
    });
  };

  return (
    <div className="app-container">
      {mapData && location && !loading ? (
        <>
          <div className="map-container">
            <div className="coord-input">
              <input
                aria-label="Coordenadas"
                placeholder="latitude, longitude"
                value={coordInput}
                onChange={(event) => setCoordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleGoToCoordinates();
                }}
              />
              <button onClick={handleGoToCoordinates}>Ir</button>
              {locationEnabled && (
                <button
                  onClick={handleCenterOnDevice}
                  title="Centralizar na localização do dispositivo"
                >
                  📍
                </button>
              )}
              {inputError && <div className="coord-error">{inputError}</div>}
            </div>
            <Map3DSceneWeb
              mapData={mapData}
              zoom={60}
              location={location}
              renderAnchor={renderAnchor}
              onObserverMove={handleObserverMove}
            />
          </div>
          <div className="status-bar">
            <div className="status-text">
              📍 Lat: {location.latitude.toFixed(6)} | Lon:{" "}
              {location.longitude.toFixed(6)}
            </div>
            <div className="status-text">
              🏗️ Prédios: {mapData?.buildings?.length || 0} | 🛣️ Ruas:{" "}
              {mapData?.roads?.length || 0}
            </div>
            <div className="status-text">
              🧩 Tiles ativos: {mapStats?.loadedTiles || 0}/
              {mapStats?.activeTiles || 0} | Cache: {mapStats?.cachedTiles || 0}
            </div>
            <div className="status-text">
              💡 Dica: WASD/móvel move o observador, arraste para rotacionar
            </div>
          </div>
        </>
      ) : (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">
            {error ||
              (mapError ? "Erro ao carregar mapa" : "Carregando mapa 3D...")}
          </p>
          {location && (
            <p className="loading-text">
              Lat: {location.latitude.toFixed(6)} | Lon:{" "}
              {location.longitude.toFixed(6)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
