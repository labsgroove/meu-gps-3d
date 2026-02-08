// examples/AdvancedIntegrations.js
// Exemplos de integrações avançadas

// ============================================
// 1. INTEGRAÇÃO COM MAPBOX (Alternativa Premium)
// ============================================
export async function fetchMapDataFromMapbox(lat, lon, accessToken) {
  const url = `https://api.mapbox.com/style/v1/mapbox/streets-v12/static/${lon},${lat},15,0/1280x720@2x?access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('Mapbox error:', error);
    return null;
  }
}

// ============================================
// 2. CACHE DE DADOS LOCAIS
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';

export const mapDataCache = {
  async save(key, data, ttl = 3600000) {
    // TTL = 1 hora por padrão
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  },

  async get(key) {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp, ttl } = JSON.parse(cached);
    if (Date.now() - timestamp > ttl) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return data;
  },

  async clear() {
    await AsyncStorage.removeItem('mapData');
  },
};

// ============================================
// 3. GEOLOCALIZAÇÃO AVANÇADA
// ============================================
import * as Location from 'expo-location';

export async function getLocationWithHeading() {
  const location = await Location.getCurrentPositionAsync({});
  const heading = await Location.getHeadingAsync();

  return {
    ...location.coords,
    heading: heading.trueHeading,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
  };
}

// ============================================
// 4. RASTREAMENTO DE ROTA
// ============================================
export class RouteTracker {
  constructor() {
    this.route = [];
    this.startTime = null;
  }

  start() {
    this.route = [];
    this.startTime = Date.now();
  }

  addPoint(latitude, longitude, timestamp = Date.now()) {
    this.route.push({
      latitude,
      longitude,
      timestamp,
    });
  }

  getDistance() {
    // Usa fórmula Haversine
    let distance = 0;
    for (let i = 1; i < this.route.length; i++) {
      const p1 = this.route[i - 1];
      const p2 = this.route[i];
      distance += this.calculateDistance(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude
      );
    }
    return distance;
  }

  getDuration() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getSpeed() {
    // velocidade em km/h
    const distance = this.getDistance();
    const hours = this.getDuration() / (1000 * 60 * 60);
    return hours > 0 ? distance / hours : 0;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  export() {
    return {
      points: this.route,
      distance: this.getDistance(),
      duration: this.getDuration(),
      averageSpeed: this.getSpeed(),
    };
  }
}

// ============================================
// 5. BUSCA DE PONTOS DE INTERESSE
// ============================================
export async function searchNearby(lat, lon, amenityType, radius = 1) {
  // Busca amenidades próximas usando Overpass API
  const query = `[out:json];
    node["amenity"="${amenityType}"](${lat - radius / 111},${lon - radius / (111 * Math.cos((lat * Math.PI) / 180))},${lat + radius / 111},${lon + radius / (111 * Math.cos((lat * Math.PI) / 180))});
    out center;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    const data = await response.json();
    return data.elements.map((element) => ({
      id: element.id,
      name: element.tags?.name,
      lat: element.lat || element.center.lat,
      lon: element.lon || element.center.lon,
      type: amenityType,
      tags: element.tags,
    }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// ============================================
// 6. CÁLCULO DE ELEVAÇÃO
// ============================================
export async function getElevation(lat, lon) {
  // Usar Open-Elevation API (gratuita)
  try {
    const response = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`
    );
    const data = await response.json();
    return data.results[0]?.elevation || 0;
  } catch (error) {
    console.error('Elevation error:', error);
    return 0;
  }
}

// ============================================
// 7. PREVISÃO DE TEMPO INTEGRADA
// ============================================
export async function getWeather(lat, lon) {
  // Usar Open-Meteo (gratuita, sem API key)
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
    );
    const data = await response.json();
    return data.current;
  } catch (error) {
    console.error('Weather error:', error);
    return null;
  }
}

// ============================================
// 8. EXPORTAR MAPA COMO IMAGEM
// ============================================
export async function captureMapScreenshot(canvasRef) {
  if (!canvasRef.current) return null;

  return new Promise((resolve) => {
    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve(url);
    });
  });
}

// ============================================
// 9. INTEGRAÇÃO COM SHARING
// ============================================
import * as Sharing from 'expo-sharing';

export async function shareLocation(lat, lon, message = '') {
  const mapLink = `https://maps.google.com/?q=${lat},${lon}`;
  const text = `${message}\n${mapLink}`;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(text);
  }
}

// ============================================
// 10. NOTIFICAÇÕES DE PROXIMIDADE
// ============================================
export class ProximityAlert {
  constructor() {
    this.alerts = [];
  }

  addAlert(name, lat, lon, radiusMeters = 100) {
    this.alerts.push({ name, lat, lon, radiusMeters });
  }

  checkProximity(currentLat, currentLon) {
    const triggered = [];

    this.alerts.forEach((alert) => {
      const distance = this.calculateDistance(
        currentLat,
        currentLon,
        alert.lat,
        alert.lon
      );

      if (distance * 1000 < alert.radiusMeters) {
        triggered.push(alert);
      }
    });

    return triggered;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
