import React, { useEffect, useState } from 'react';
import './App.web.css';
import Map3DSceneWeb from './components/Map3DScene.web.jsx';
import { fetchMapData } from './services/osmService.js';

export default function AppWeb() {
  const [location, setLocation] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [coordInput, setCoordInput] = useState('');
  const [inputError, setInputError] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [watchId, setWatchId] = useState(null);

  // Função para carregar localização do localStorage
  const loadStoredLocation = () => {
    const stored = localStorage.getItem('deviceLocation');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Erro ao ler localização do localStorage:', e);
      }
    }
    return null;
  };

  // Função para salvar localização no localStorage
  const saveLocationToStorage = (loc) => {
    try {
      localStorage.setItem('deviceLocation', JSON.stringify(loc));
    } catch (e) {
      console.error('Erro ao salvar localização no localStorage:', e);
    }
  };

  // Função para inicializar geolocation
  const initializeGeolocation = (callback) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation não suportada');
      return;
    }

    setLocationEnabled(true);

    // Tentar pegar localização atual primeiro
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
        };
        saveLocationToStorage(loc);
        if (callback) callback(loc);
      },
      (err) => {
        console.warn('Erro ao obter localização atual:', err.message);
        // Se falhar, usar localização armazenada ou padrão
        const stored = loadStoredLocation();
        if (stored && callback) {
          callback(stored);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Depois, monitorar mudanças de localização
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
        };
        saveLocationToStorage(loc);
        setLocation(loc);
      },
      (err) => {
        console.warn('Erro ao monitorar localização:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    setWatchId(id);
  };

  // Função para centralizar na localização do dispositivo
  const handleCenterOnDevice = () => {
    if (!navigator.geolocation) {
      setInputError('Geolocalização não suportada');
      return;
    }

    setInputError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const loc = { latitude: lat, longitude: lon, altitude: 0, accuracy: 5 };

        try {
          setLoading(true);
          setLocation(loc);
          saveLocationToStorage(loc);
          const data = await fetchMapData(lat, lon, 0.5);
          setMapData(data);
          setMapError(false);
        } catch (err) {
          console.error('Erro ao carregar mapa para localização do dispositivo:', err);
          setMapError(true);
          setInputError('Falha ao carregar mapa');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Erro ao obter localização do dispositivo:', err);
        setInputError('Não foi possível obter a localização. Verifique as permissões.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    (async () => {
      try {
        // Tentar carregr localização armazenada primeiro
        let initialLoc = loadStoredLocation();

        // Se não houver localização armazenada, usar padrão
        if (!initialLoc) {
          initialLoc = {
            latitude: -25.4957255,
            longitude: -49.1658802,
            altitude: 0,
            accuracy: 5,
          };
        }

        setLocation(initialLoc);
        setLoading(true);

        try {
          const data = await fetchMapData(initialLoc.latitude, initialLoc.longitude, 0.5);
          setMapData(data);
          setMapError(false);
        } catch (err) {
          console.error('Web map load error:', err);
          setMapError(true);
        }

        setLoading(false);

        // Inicializar geolocation após carregar o mapa
        initializeGeolocation((newLoc) => {
          setLocation(newLoc);
        });
      } catch (err) {
        console.error('Location error:', err);
        setError('Erro ao inicializar: ' + err.message);
        setLoading(false);
      }
    })();

    // Cleanup
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const handleGoToCoordinates = async () => {
    setInputError(null);
    if (!coordInput) return;
    // aceitar formatos: "lat,lon" ou "lon,lat" — assumimos "lat,lon"
    const parts = coordInput.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length !== 2) {
      setInputError('Informe em: latitude, longitude');
      return;
    }

    const lat = parseFloat(parts[0].replace(/\s+/g, ''));
    const lon = parseFloat(parts[1].replace(/\s+/g, ''));

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setInputError('Coordenadas inválidas');
      return;
    }

    const newLoc = { latitude: lat, longitude: lon, altitude: 0, accuracy: 5 };
    try {
      setLoading(true);
      setLocation(newLoc);
      saveLocationToStorage(newLoc);
      const data = await fetchMapData(lat, lon, 0.5);
      setMapData(data);
      setMapError(false);
    } catch (err) {
      console.error('Erro ao carregar mapa para coordenadas:', err);
      setMapError(true);
      setInputError('Falha ao carregar mapa');
    } finally {
      setLoading(false);
    }
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
                onChange={(e) => setCoordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGoToCoordinates(); }}
              />
              <button onClick={handleGoToCoordinates}>Ir</button>
              {locationEnabled && (
                <button onClick={handleCenterOnDevice} title="Centralizar na localização do dispositivo">
                  📍
                </button>
              )}
              {inputError && <div className="coord-error">{inputError}</div>}
            </div>
            <Map3DSceneWeb mapData={mapData} zoom={60} location={location} onLocationChange={setLocation} />
          </div>
          <div className="status-bar">
            <div className="status-text">
              📍 Lat: {location.latitude.toFixed(6)} | Lon: {location.longitude.toFixed(6)}
            </div>
            <div className="status-text">
              🏗️ Prédios: {mapData?.buildings?.length || 0} | 🛣️ Ruas: {mapData?.roads?.length || 0}
            </div>
            <div className="status-text">
              💡 Dica: Arraste para rotacionar, role para zoom
            </div>
          </div>
        </>
      ) : (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">
            {error || (mapError ? 'Erro ao carregar mapa' : 'Carregando mapa 3D...')}
          </p>
          {location && (
            <p className="loading-text">
              Lat: {location.latitude.toFixed(6)} | Lon: {location.longitude.toFixed(6)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
