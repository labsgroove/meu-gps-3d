// utils/geoUtils.js
// Utilitários para operações geoespaciais

export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Fórmula de Haversine para calcular distância entre dois pontos
  const R = 6371; // Raio da Terra em km
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

export function latLonToMeters(latitude, longitude, centerLat, centerLon) {
  // Converte coordenadas lat/lon para metros relativos ao centro
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

  const x = (longitude - centerLon) * metersPerDegreeLon;
  const y = (latitude - centerLat) * metersPerDegreeLat;

  return { x, y };
}

export function metersToLatLon(x, y, centerLat, centerLon) {
  // Converte metros de volta para lat/lon
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

  const lat = centerLat + y / metersPerDegreeLat;
  const lon = centerLon + x / metersPerDegreeLon;

  return { lat, lon };
}

export function getBoundingBox(centerLat, centerLon, radiusKm) {
  // Calcula bounding box ao redor de um ponto
  const latOffset = radiusKm / 111;
  const lonOffset = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

  return {
    south: centerLat - latOffset,
    north: centerLat + latOffset,
    west: centerLon - lonOffset,
    east: centerLon + lonOffset,
  };
}

export function simplifyPath(points, tolerance = 0.01) {
  // Simplifica caminho usando algoritmo Ramer-Douglas-Peucker
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = pointToLineDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  } else {
    return [start, end];
  }
}

function pointToLineDistance(point, lineStart, lineEnd) {
  // Calcula distância de um ponto para uma linha
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const t = Math.max(0, Math.min(1, ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy)));
  const projX = lineStart[0] + t * dx;
  const projY = lineStart[1] + t * dy;
  return Math.sqrt((point[0] - projX) ** 2 + (point[1] - projY) ** 2);
}
