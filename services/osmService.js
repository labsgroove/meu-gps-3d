// services/osmService.js
// Serviço para buscar dados de OpenStreetMap via Overpass API

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function fetchMapData(latitude, longitude, radiusKm = 0.5) {
  try {
    // Calcula bounding box ao redor da localização
    const latOffset = radiusKm / 111; // 1 grau ≈ 111km
    const lonOffset = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const south = latitude - latOffset;
    const north = latitude + latOffset;
    const west = longitude - lonOffset;
    const east = longitude + lonOffset;

    // Query Overpass para buildings e highways (amenities sem geometry pode ser pesado)
    const query = `[out:json];(
      way["building"](${south},${west},${north},${east});
      way["highway"](${south},${west},${north},${east});
    );out geom;`;

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      timeout: 30000,
    });

    if (!response.ok) {
      console.warn(`Overpass API warning: ${response.status}`);
      return { buildings: [], roads: [], amenities: [] };
    }

    const data = await response.json();
    if (!data || !data.elements) {
      return { buildings: [], roads: [], amenities: [] };
    }

    return parseOsmData(data, latitude, longitude);
  } catch (error) {
    console.error('Erro ao buscar dados OSM:', error.message);
    return { buildings: [], roads: [], amenities: [] };
  }
}

function parseOsmData(data, centerLat, centerLon) {
  const buildings = [];
  const roads = [];
  const amenities = [];

  if (!data.elements) return { buildings, roads, amenities };

  // Processa ways (edifícios e estradas)
  data.elements.forEach((element) => {
    if (element.type === 'way') {
      if (element.tags?.building) {
        buildings.push(parseBuilding(element, centerLat, centerLon));
      } else if (element.tags?.highway) {
        roads.push(parseRoad(element, centerLat, centerLon));
      }
    }
  });

  // Processa nodes (amenidades)
  data.elements.forEach((element) => {
    if (element.type === 'node' && element.tags?.amenity) {
      amenities.push(parseAmenity(element, centerLat, centerLon));
    }
  });

  return { buildings, roads, amenities };
}

function parseBuilding(way, centerLat, centerLon) {
  const coordinates = way.geometry || [];
  const points = coordinates.map((coord) => latLonToCartesian(coord.lat, coord.lon, centerLat, centerLon));

  return {
    id: way.id,
    type: 'building',
    points,
    height: getHeightFromTags(way.tags),
    color: getBuildingColor(way.tags),
    tags: way.tags,
  };
}

function parseRoad(way, centerLat, centerLon) {
  const coordinates = way.geometry || [];
  const points = coordinates.map((coord) => latLonToCartesian(coord.lat, coord.lon, centerLat, centerLon));

  return {
    id: way.id,
    type: 'road',
    points,
    width: getRoadWidth(way.tags),
    color: getRoadColor(way.tags),
    tags: way.tags,
  };
}

function parseAmenity(node, centerLat, centerLon) {
  const [x, z] = latLonToCartesian(node.lat, node.lon, centerLat, centerLon);

  return {
    id: node.id,
    type: 'amenity',
    position: [x, 0, z],
    amenityType: node.tags.amenity,
    color: getAmenityColor(node.tags.amenity),
    tags: node.tags,
  };
}

function latLonToCartesian(lat, lon, centerLat, centerLon) {
  // Converte coordenadas lat/lon para x,z relativo ao centro
  // Aproximação para distâncias pequenas
  const latDiff = (lat - centerLat) * 111 * 1000; // metros
  const lonDiff = (lon - centerLon) * 111 * Math.cos(centerLat * Math.PI / 180) * 1000;

  return [lonDiff, latDiff];
}

function getHeightFromTags(tags) {
  if (tags.height) {
    const height = parseFloat(tags.height);
    return isNaN(height) ? 15 : Math.min(height, 200);
  }

  // Estimativa baseada no tipo de edifício
  if (tags.building === 'residential') return 10;
  if (tags.building === 'commercial') return 20;
  if (tags.building === 'industrial') return 15;
  if (tags.building === 'apartments') return 25;

  return 8;
}

function getBuildingColor(tags) {
  const buildingType = tags.building;

  switch (buildingType) {
    case 'residential':
      return 0xd4a574; // Bege
    case 'commercial':
      return 0xb0b0b0; // Cinza
    case 'industrial':
      return 0x8b7d6b; // Marrom
    case 'apartments':
      return 0xc0a080; // Bege claro
    case 'church':
      return 0x8b4513; // Marrom escuro
    case 'hospital':
      return 0xff6b6b; // Vermelho
    default:
      return 0xa9a9a9; // Cinza padrão
  }
}

function getRoadWidth(tags) {
  const highway = tags.highway;

  switch (highway) {
    case 'motorway':
      return 8;
    case 'trunk':
    case 'primary':
      return 6;
    case 'secondary':
      return 5;
    case 'tertiary':
      return 4;
    case 'residential':
      return 2.5;
    case 'service':
      return 1.5;
    default:
      return 2;
  }
}

function getRoadColor(tags) {
  const highway = tags.highway;

  switch (highway) {
    case 'motorway':
      return 0xff6b6b; // Vermelho
    case 'trunk':
    case 'primary':
      return 0xffd700; // Ouro
    case 'secondary':
      return 0xffee99; // Amarelo claro
    case 'tertiary':
    case 'residential':
      return 0xffffff; // Branco
    case 'service':
      return 0xe0e0e0; // Cinza claro
    default:
      return 0xcccccc; // Cinza
  }
}

function getAmenityColor(amenityType) {
  const colors = {
    hospital: 0xff0000,
    school: 0x0000ff,
    restaurant: 0xff8c00,
    cafe: 0xffa500,
    park: 0x00ff00,
    parking: 0xffff00,
    bank: 0x800080,
    pharmacy: 0x008000,
    bus_station: 0xff1493,
  };

  return colors[amenityType] || 0x00ffff;
}
