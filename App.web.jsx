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

  return (
    <div className="app-container">
      {mapData && location && !loading ? (
        <>
          <div className="map-container">
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
