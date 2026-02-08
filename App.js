import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, SafeAreaView, Platform } from 'react-native';
import * as Location from 'expo-location';
import Map3DScene from './components/Map3DScene';
import { fetchMapData } from './services/osmService';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#87ceeb',
  },
  statusBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2c3e50',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default function App() {
  const [location, setLocation] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let subscription;

    (async () => {
      try {
        // Para web, usar localização mock
        if (Platform.OS === 'web') {
          setLocation({
            latitude: -23.5505,
            longitude: -46.6333,
            altitude: 0,
            accuracy: 10,
          });
          setLoading(true);
          try {
            const data = await fetchMapData(-23.5505, -46.6333, 0.5);
            setMapData(data);
            setMapError(false);
          } catch (err) {
            console.error('Web map load error:', err);
            setMapError(true);
          }
          setLoading(false);
          return;
        }

        // Para dispositivos reais, usar GPS
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Permissão de localização não concedida');
          return;
        }

        // Obter localização atual primeiro
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (currentLocation && currentLocation.coords) {
          const coords = currentLocation.coords;
          setLocation(coords);

          // Carregar dados iniciais
          setLoading(true);
          try {
            const data = await fetchMapData(coords.latitude, coords.longitude, 0.5);
            setMapData(data);
            setMapError(false);
          } catch (err) {
            console.error('Initial map load error:', err);
            setMapError(true);
          }
          setLoading(false);
        }

        // Iniciar monitoramento contínuo
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 25,
            timeInterval: 5000,
          },
          async (loc) => {
            const coords = loc.coords;
            setLocation(coords);

            // Busca dados do mapa quando localização mudar
            if (!loading) {
              try {
                const data = await fetchMapData(coords.latitude, coords.longitude, 0.5);
                setMapData(data);
                setMapError(false);
              } catch (err) {
                console.error('Map update error:', err);
                setMapError(true);
              }
            }
          }
        );

        return () => {
          if (subscription) {
            subscription.remove();
          }
        };
      } catch (err) {
        console.error('Location error:', err);
        setError('Erro ao acessar localização: ' + err.message);
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {mapData && location && !loading ? (
        <>
          <View style={styles.mapContainer}>
            <Map3DScene mapData={mapData} zoom={60} />
          </View>
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              📍 Lat: {location.latitude.toFixed(6)} | Lon: {location.longitude.toFixed(6)}
            </Text>
            <Text style={styles.statusText}>
              🏗️ Prédios: {mapData?.buildings?.length || 0} | 🛣️ Ruas: {mapData?.roads?.length || 0}
            </Text>
            <Text style={styles.statusText}>
              💡 Dica: Arraste para rotacionar, role para zoom
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c3e50" />
          <Text style={styles.loadingText}>
            {error || (mapError ? 'Erro ao carregar mapa' : 'Carregando mapa 3D...')}
          </Text>
          {location && (
            <Text style={styles.loadingText}>
              Lat: {location.latitude.toFixed(6)} | Lon: {location.longitude.toFixed(6)}
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
