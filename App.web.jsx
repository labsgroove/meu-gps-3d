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

  useEffect(() => {
    (async () => {
      try {
        // Mock de localização para web
        // São Paulo, Brasil
        const mockLocation = {
          latitude: -25.5022141,
          longitude: -49.1837419,
          altitude: 0,
          accuracy: 10,
        };

        setLocation(mockLocation);
        setLoading(true);

        try {
          const data = await fetchMapData(mockLocation.latitude, mockLocation.longitude, 0.5);
          setMapData(data);
          setMapError(false);
        } catch (err) {
          console.error('Web map load error:', err);
          setMapError(true);
        }

        setLoading(false);
      } catch (err) {
        console.error('Location error:', err);
        setError('Erro ao inicializar: ' + err.message);
        setLoading(false);
      }
    })();
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
              {inputError && <div className="coord-error">{inputError}</div>}
            </div>
            <Map3DSceneWeb mapData={mapData} zoom={60} location={location} />
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
