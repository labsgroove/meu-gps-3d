// services/osmService.js
// Serviço para buscar dados de OpenStreetMap via Overpass API
import { simplifyPath } from "../utils/geoUtils.js";
import { MAP_CONFIG } from "../config/mapConfig.js";
import { createTileDiskCache } from "./tileDiskCache.js";
import { createTilePriorityManager } from "./tilePriorityManager.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const EARTH_RADIUS_METERS = 6378137;

const GREEN_LEISURE_VALUES = new Set([
  "park",
  "garden",
  "pitch",
  "golf_course",
  "playground",
  "recreation_ground",
]);
const GREEN_LANDUSE_VALUES = new Set([
  "forest",
  "grass",
  "meadow",
  "village_green",
  "recreation_ground",
  "allotments",
]);
const GREEN_NATURAL_VALUES = new Set(["wood", "grassland", "scrub"]);
const WATER_NATURAL_VALUES = new Set(["water", "wetland", "bay"]);
const WATER_LANDUSE_VALUES = new Set(["reservoir", "basin", "salt_pond"]);
const TRANSIT_PUBLIC_VALUES = new Set(["platform", "station", "stop_position"]);
const TRANSIT_RAILWAY_VALUES = new Set([
  "station",
  "halt",
  "tram_stop",
  "subway_entrance",
  "stop",
]);

function createLayerFlags() {
  return {
    includeAmenities: MAP_CONFIG.ENABLE_AMENITIES !== false,
    includeGreenAreas: MAP_CONFIG.ENABLE_GREEN_AREAS !== false,
    includeWaterAreas: MAP_CONFIG.ENABLE_WATER_AREAS !== false,
    includeWaterways: MAP_CONFIG.ENABLE_WATERWAYS !== false,
    includeRailways: MAP_CONFIG.ENABLE_RAILWAYS !== false,
    includeTransitStops: MAP_CONFIG.ENABLE_TRANSIT_STOPS !== false,
  };
}

function layerFlagsSignature(flags) {
  const f = flags || createLayerFlags();
  return [
    "A",
    f.includeAmenities ? 1 : 0,
    "G",
    f.includeGreenAreas ? 1 : 0,
    "WA",
    f.includeWaterAreas ? 1 : 0,
    "WW",
    f.includeWaterways ? 1 : 0,
    "R",
    f.includeRailways ? 1 : 0,
    "T",
    f.includeTransitStops ? 1 : 0,
  ].join("");
}

function createEmptyMapData() {
  return {
    buildings: [],
    roads: [],
    amenities: [],
    greenAreas: [],
    waterAreas: [],
    waterways: [],
    railways: [],
    transitStops: [],
  };
}

function clampLatitude(latitude) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

export function latLonToWorldMeters(latitude, longitude) {
  const lat = clampLatitude(latitude);
  const x = (EARTH_RADIUS_METERS * longitude * Math.PI) / 180;
  const y =
    EARTH_RADIUS_METERS *
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x, y };
}

export function worldMetersToLatLon(x, y) {
  const lon = (x / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lat =
    (Math.atan(Math.exp(y / EARTH_RADIUS_METERS)) * 360) / Math.PI - 90;
  return { lat, lon };
}

function latLonToLocalMeters(latitude, longitude, centerLat, centerLon) {
  const latDiff = (latitude - centerLat) * 111 * 1000;
  const lonDiff =
    (longitude - centerLon) *
    111 *
    Math.cos((centerLat * Math.PI) / 180) *
    1000;
  return [lonDiff, latDiff];
}

function buildOverpassQuery(
  { south, west, north, east },
  layerFlags = createLayerFlags(),
) {
  const amenityFilter = layerFlags.includeAmenities
    ? `node["amenity"](${south},${west},${north},${east});`
    : "";
  const greenAreaFilter = layerFlags.includeGreenAreas
    ? `
    way["leisure"~"park|garden|pitch|golf_course|playground|recreation_ground"](${south},${west},${north},${east});
    way["landuse"~"forest|grass|meadow|village_green|recreation_ground|allotments"](${south},${west},${north},${east});
    way["natural"~"wood|grassland|scrub"](${south},${west},${north},${east});`
    : "";
  const waterAreaFilter = layerFlags.includeWaterAreas
    ? `
    way["natural"~"water|wetland|bay"](${south},${west},${north},${east});
    way["landuse"~"reservoir|basin|salt_pond"](${south},${west},${north},${east});
    way["waterway"="riverbank"](${south},${west},${north},${east});
    way["leisure"="swimming_pool"](${south},${west},${north},${east});`
    : "";
  const waterwayFilter = layerFlags.includeWaterways
    ? `way["waterway"](${south},${west},${north},${east});`
    : "";
  const railwayFilter = layerFlags.includeRailways
    ? `way["railway"](${south},${west},${north},${east});`
    : "";
  const transitFilter = layerFlags.includeTransitStops
    ? `
    node["public_transport"~"platform|station|stop_position"](${south},${west},${north},${east});
    node["highway"="bus_stop"](${south},${west},${north},${east});
    node["railway"~"station|halt|tram_stop|subway_entrance|stop"](${south},${west},${north},${east});`
    : "";

  return `[out:json][timeout:30];(
    way["building"](${south},${west},${north},${east});
    way["highway"](${south},${west},${north},${east});
    ${amenityFilter}
    ${greenAreaFilter}
    ${waterAreaFilter}
    ${waterwayFilter}
    ${railwayFilter}
    ${transitFilter}
  );out geom;`;
}

async function fetchOverpassJson(query, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`Overpass API warning: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) {
      return null;
    }

    return data;
  } catch (error) {
    const msg =
      error?.name === "AbortError"
        ? "timeout na requisição Overpass"
        : error?.message || String(error);
    console.error("Erro ao buscar dados OSM:", msg);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchMapData(latitude, longitude, radiusKm = 0.5) {
  try {
    const latOffset = radiusKm / 111;
    const lonOffset = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const bounds = {
      south: latitude - latOffset,
      north: latitude + latOffset,
      west: longitude - lonOffset,
      east: longitude + lonOffset,
    };

    const layerFlags = createLayerFlags();
    const query = buildOverpassQuery(bounds, layerFlags);
    const data = await fetchOverpassJson(query);
    if (!data) return createEmptyMapData();

    return parseOsmData(data, {
      mode: "local",
      centerLat: latitude,
      centerLon: longitude,
      layerFlags,
    });
  } catch (error) {
    console.error("Erro ao buscar dados OSM:", error?.message || String(error));
    return createEmptyMapData();
  }
}

function parseOsmData(data, options) {
  const buildings = [];
  const roads = [];
  const amenities = [];
  const greenAreas = [];
  const waterAreas = [];
  const waterways = [];
  const railways = [];
  const transitStops = [];

  if (!data?.elements) {
    return {
      buildings,
      roads,
      amenities,
      greenAreas,
      waterAreas,
      waterways,
      railways,
      transitStops,
    };
  }

  const toPoint =
    options.mode === "global"
      ? (lat, lon) => {
          const { x, y } = latLonToWorldMeters(lat, lon);
          return [x, y];
        }
      : (lat, lon) =>
          latLonToLocalMeters(lat, lon, options.centerLat, options.centerLon);
  const layerFlags = options.layerFlags || createLayerFlags();

  for (const element of data.elements) {
    if (element.type !== "way") continue;
    const tags = element.tags || {};

    if (tags.building) {
      const parsed = parseBuilding(element, toPoint);
      if (parsed) buildings.push(parsed);
    }

    if (tags.highway) {
      const parsed = parseRoad(element, toPoint);
      if (parsed) roads.push(parsed);
    }

    if (layerFlags.includeGreenAreas && isGreenAreaWay(tags)) {
      const parsed = parseGreenArea(element, toPoint);
      if (parsed) greenAreas.push(parsed);
    }

    if (layerFlags.includeWaterAreas && isWaterAreaWay(tags)) {
      const parsed = parseWaterArea(element, toPoint);
      if (parsed) waterAreas.push(parsed);
    }

    if (layerFlags.includeWaterways && isWaterwayWay(tags)) {
      const parsed = parseWaterway(element, toPoint);
      if (parsed) waterways.push(parsed);
    }

    if (layerFlags.includeRailways && isRailwayWay(tags)) {
      const parsed = parseRailway(element, toPoint);
      if (parsed) railways.push(parsed);
    }
  }

  for (const element of data.elements) {
    if (element.type !== "node") continue;
    const tags = element.tags || {};

    if (layerFlags.includeAmenities && tags.amenity) {
      const parsed = parseAmenity(element, toPoint);
      if (parsed) amenities.push(parsed);
    }

    if (layerFlags.includeTransitStops && isTransitNode(tags)) {
      const parsed = parseTransitStop(element, toPoint);
      if (parsed) transitStops.push(parsed);
    }
  }

  return {
    buildings,
    roads,
    amenities,
    greenAreas,
    waterAreas,
    waterways,
    railways,
    transitStops,
  };
}

function normalizeWayPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return points || [];
  const first = points[0];
  const last = points[points.length - 1];
  if (
    first &&
    last &&
    Math.abs(first[0] - last[0]) < 0.001 &&
    Math.abs(first[1] - last[1]) < 0.001
  ) {
    return points.slice(0, -1);
  }
  return points;
}

function parseBuilding(way, toPoint) {
  const coordinates = way.geometry || [];
  const points = normalizeWayPoints(
    coordinates.map((coord) => toPoint(coord.lat, coord.lon)),
  );
  if (points.length < 3) return null;

  return {
    id: way.id,
    type: "building",
    points,
    height: getHeightFromTags(way.tags),
    color: getBuildingColor(way.tags),
    tags: way.tags,
  };
}

function parseRoad(way, toPoint) {
  const coordinates = way.geometry || [];
  const rawPoints = coordinates.map((coord) => toPoint(coord.lat, coord.lon));
  if (rawPoints.length < 2) return null;

  const tolerance = MAP_CONFIG.ROAD_SIMPLIFY_TOLERANCE_METERS ?? 1.0;
  const points = simplifyPath(rawPoints, tolerance);
  if (!points || points.length < 2) return null;

  return {
    id: way.id,
    type: "road",
    points,
    width: getRoadWidth(way.tags),
    color: getRoadColor(way.tags),
    tags: way.tags,
  };
}

function parseAmenity(node, toPoint) {
  if (!Number.isFinite(node?.lat) || !Number.isFinite(node?.lon)) return null;
  const [x, z] = toPoint(node.lat, node.lon);

  return {
    id: node.id,
    type: "amenity",
    position: [x, 0, z],
    amenityType: node.tags.amenity,
    color: getAmenityColor(node.tags.amenity),
    tags: node.tags,
  };
}

function parseGreenArea(way, toPoint) {
  const coordinates = way.geometry || [];
  const points = normalizeWayPoints(
    coordinates.map((coord) => toPoint(coord.lat, coord.lon)),
  );
  if (points.length < 3) return null;

  const greenType = getGreenAreaType(way.tags || {});
  return {
    id: way.id,
    type: "greenArea",
    greenType,
    points,
    color: getGreenAreaColor(greenType),
    height: 0.02,
    tags: way.tags,
  };
}

function parseWaterArea(way, toPoint) {
  const coordinates = way.geometry || [];
  const points = normalizeWayPoints(
    coordinates.map((coord) => toPoint(coord.lat, coord.lon)),
  );
  if (points.length < 3) return null;

  const waterType = getWaterAreaType(way.tags || {});
  return {
    id: way.id,
    type: "waterArea",
    waterType,
    points,
    color: getWaterAreaColor(waterType),
    height: 0.015,
    tags: way.tags,
  };
}

function parseWaterway(way, toPoint) {
  const coordinates = way.geometry || [];
  const rawPoints = coordinates.map((coord) => toPoint(coord.lat, coord.lon));
  if (rawPoints.length < 2) return null;

  const tolerance = MAP_CONFIG.WATERWAY_SIMPLIFY_TOLERANCE_METERS ?? 1.2;
  const points = simplifyPath(rawPoints, tolerance);
  if (!points || points.length < 2) return null;

  const waterwayType = way.tags?.waterway || "default";
  return {
    id: way.id,
    type: "waterway",
    waterwayType,
    points,
    width: getWaterwayWidth(waterwayType),
    color: getWaterwayColor(waterwayType),
    tags: way.tags,
  };
}

function parseRailway(way, toPoint) {
  const coordinates = way.geometry || [];
  const rawPoints = coordinates.map((coord) => toPoint(coord.lat, coord.lon));
  if (rawPoints.length < 2) return null;

  const tolerance = MAP_CONFIG.RAILWAY_SIMPLIFY_TOLERANCE_METERS ?? 1.0;
  const points = simplifyPath(rawPoints, tolerance);
  if (!points || points.length < 2) return null;

  const railwayType = way.tags?.railway || "rail";
  return {
    id: way.id,
    type: "railway",
    railwayType,
    points,
    width: getRailwayWidth(railwayType),
    color: getRailwayColor(railwayType),
    tags: way.tags,
  };
}

function parseTransitStop(node, toPoint) {
  if (!Number.isFinite(node?.lat) || !Number.isFinite(node?.lon)) return null;
  const [x, z] = toPoint(node.lat, node.lon);
  const transitType = getTransitType(node.tags || {});

  return {
    id: node.id,
    type: "transitStop",
    transitType,
    position: [x, 0, z],
    color: getTransitColor(transitType),
    size: getTransitSize(transitType),
    tags: node.tags,
  };
}

function isGreenAreaWay(tags) {
  return (
    GREEN_LEISURE_VALUES.has(tags.leisure) ||
    GREEN_LANDUSE_VALUES.has(tags.landuse) ||
    GREEN_NATURAL_VALUES.has(tags.natural)
  );
}

function isWaterAreaWay(tags) {
  if (WATER_NATURAL_VALUES.has(tags.natural)) return true;
  if (WATER_LANDUSE_VALUES.has(tags.landuse)) return true;
  if (tags.waterway === "riverbank") return true;
  if (tags.leisure === "swimming_pool") return true;
  return false;
}

function isWaterwayWay(tags) {
  return Boolean(tags.waterway && tags.waterway !== "riverbank");
}

function isRailwayWay(tags) {
  return Boolean(tags.railway);
}

function isTransitNode(tags) {
  if (TRANSIT_PUBLIC_VALUES.has(tags.public_transport)) return true;
  if (tags.highway === "bus_stop") return true;
  if (TRANSIT_RAILWAY_VALUES.has(tags.railway)) return true;
  return false;
}

function getHeightFromTags(tags) {
  if (tags.height) {
    const height = parseFloat(tags.height);
    return Number.isNaN(height) ? 15 : Math.min(height, 200);
  }

  if (tags.building === "residential") return 10;
  if (tags.building === "commercial") return 20;
  if (tags.building === "industrial") return 15;
  if (tags.building === "apartments") return 25;

  return 8;
}

function getBuildingColor(tags) {
  const buildingType = tags.building;
  const configColor = MAP_CONFIG.BUILDING_COLORS?.[buildingType];
  if (Number.isFinite(configColor)) return configColor;

  switch (buildingType) {
    case "residential":
      return 0xd4a574;
    case "commercial":
      return 0xb0b0b0;
    case "industrial":
      return 0x8b7d6b;
    case "apartments":
      return 0xc0a080;
    case "church":
      return 0x8b4513;
    case "hospital":
      return 0xff6b6b;
    default:
      return 0xa9a9a9;
  }
}

function getRoadWidth(tags) {
  const highway = tags.highway;
  const configWidth = MAP_CONFIG.ROAD_WIDTHS?.[highway];
  if (Number.isFinite(configWidth)) return configWidth;

  switch (highway) {
    case "motorway":
      return 8;
    case "trunk":
    case "primary":
      return 6;
    case "secondary":
      return 5;
    case "tertiary":
      return 4;
    case "residential":
      return 2.5;
    case "service":
      return 1.5;
    default:
      return 2;
  }
}

function getRoadColor(tags) {
  const highway = tags.highway;
  const configColor = MAP_CONFIG.ROAD_COLORS?.[highway];
  if (Number.isFinite(configColor)) return configColor;

  switch (highway) {
    case "motorway":
      return 0xff6b6b;
    case "trunk":
    case "primary":
      return 0xffd700;
    case "secondary":
      return 0xffee99;
    case "tertiary":
    case "residential":
      return 0xffffff;
    case "service":
      return 0xe0e0e0;
    default:
      return 0xcccccc;
  }
}

function getAmenityColor(amenityType) {
  const configColor = MAP_CONFIG.AMENITY_COLORS?.[amenityType];
  if (Number.isFinite(configColor)) return configColor;
  return 0x00ffff;
}

function getGreenAreaType(tags) {
  return tags.leisure || tags.landuse || tags.natural || "default";
}

function getWaterAreaType(tags) {
  return tags.natural || tags.landuse || tags.water || tags.waterway || "water";
}

function getGreenAreaColor(type) {
  const configColor = MAP_CONFIG.GREEN_AREA_COLORS?.[type];
  if (Number.isFinite(configColor)) return configColor;
  return 0x6ba368;
}

function getWaterAreaColor(type) {
  const configColor = MAP_CONFIG.WATER_AREA_COLORS?.[type];
  if (Number.isFinite(configColor)) return configColor;
  return 0x4a90e2;
}

function getWaterwayWidth(type) {
  const configWidth = MAP_CONFIG.WATERWAY_WIDTHS?.[type];
  if (Number.isFinite(configWidth)) return configWidth;
  if (type === "river") return 5;
  if (type === "canal") return 3;
  if (type === "stream") return 1.5;
  return 2.2;
}

function getWaterwayColor(type) {
  const configColor = MAP_CONFIG.WATERWAY_COLORS?.[type];
  if (Number.isFinite(configColor)) return configColor;
  return 0x3b82f6;
}

function getRailwayWidth(type) {
  const configWidth = MAP_CONFIG.RAILWAY_WIDTHS?.[type];
  if (Number.isFinite(configWidth)) return configWidth;
  if (type === "subway") return 1.8;
  if (type === "tram") return 1.2;
  return 2;
}

function getRailwayColor(type) {
  const configColor = MAP_CONFIG.RAILWAY_COLORS?.[type];
  if (Number.isFinite(configColor)) return configColor;
  return 0x5e5e5e;
}

function getTransitType(tags) {
  if (tags.public_transport) return tags.public_transport;
  if (tags.highway === "bus_stop") return "bus_stop";
  if (tags.railway) return tags.railway;
  return "stop";
}

function getTransitColor(type) {
  const configColor = MAP_CONFIG.TRANSIT_COLORS?.[type];
  if (Number.isFinite(configColor)) return configColor;
  if (type === "bus_stop") return 0xf59e0b;
  if (type === "station") return 0x22c55e;
  if (type === "tram_stop") return 0x14b8a6;
  if (type === "subway_entrance") return 0xa855f7;
  return 0xff66c4;
}

function getTransitSize(type) {
  if (type === "station") return 2.2;
  if (type === "platform") return 1.6;
  if (type === "bus_stop") return 1.4;
  return 1.2;
}

function getTileKey(tileX, tileY) {
  return `${tileX}:${tileY}`;
}

function getTileBoundsMeters(tileX, tileY, tileSizeMeters) {
  const minX = tileX * tileSizeMeters;
  const maxX = minX + tileSizeMeters;
  const minY = tileY * tileSizeMeters;
  const maxY = minY + tileSizeMeters;
  return { minX, maxX, minY, maxY };
}

function tileBoundsToLatLon(tileX, tileY, tileSizeMeters) {
  const { minX, maxX, minY, maxY } = getTileBoundsMeters(
    tileX,
    tileY,
    tileSizeMeters,
  );
  const sw = worldMetersToLatLon(minX, minY);
  const ne = worldMetersToLatLon(maxX, maxY);
  return {
    south: Math.min(sw.lat, ne.lat),
    north: Math.max(sw.lat, ne.lat),
    west: Math.min(sw.lon, ne.lon),
    east: Math.max(sw.lon, ne.lon),
  };
}

function expandBoundsWithOverlap(bounds, overlapPercent = 0.1) {
  if (overlapPercent <= 0) return bounds;
  
  // Calcular a expansão em graus
  const latExpand = (bounds.north - bounds.south) * overlapPercent;
  const lonExpand = (bounds.east - bounds.west) * overlapPercent;
  
  return {
    south: bounds.south - latExpand,
    north: bounds.north + latExpand,
    west: bounds.west - lonExpand,
    east: bounds.east + lonExpand,
  };
}

function tileCenterMeters(tileX, tileY, tileSizeMeters) {
  return {
    x: (tileX + 0.5) * tileSizeMeters,
    y: (tileY + 0.5) * tileSizeMeters,
  };
}

function listTilesForRadius(
  observerX,
  observerY,
  radiusMeters,
  tileSizeMeters,
) {
  const minTileX = Math.floor((observerX - radiusMeters) / tileSizeMeters);
  const maxTileX = Math.floor((observerX + radiusMeters) / tileSizeMeters);
  const minTileY = Math.floor((observerY - radiusMeters) / tileSizeMeters);
  const maxTileY = Math.floor((observerY + radiusMeters) / tileSizeMeters);
  const acceptedRadius = radiusMeters + tileSizeMeters * Math.SQRT2 * 0.5;
  const selectedTiles = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      const center = tileCenterMeters(tileX, tileY, tileSizeMeters);
      const distance = Math.hypot(center.x - observerX, center.y - observerY);
      if (distance > acceptedRadius) continue;

      selectedTiles.push({
        tileX,
        tileY,
        key: getTileKey(tileX, tileY),
        distance,
      });
    }
  }

  selectedTiles.sort((a, b) => a.distance - b.distance);
  return selectedTiles;
}

function createSemaphore(limit) {
  const safeLimit = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const waiting = [];

  return {
    acquire() {
      if (active < safeLimit) {
        active += 1;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        waiting.push(resolve);
      });
    },
    release() {
      if (waiting.length > 0) {
        const next = waiting.shift();
        next();
        return;
      }
      active = Math.max(0, active - 1);
    },
  };
}

function pruneCache(cache, activeKeys, maxCachedTiles) {
  // Poda mais agressiva para tiles não-ativos
  const targetSize = Math.max(maxCachedTiles * 0.75, maxCachedTiles - 20);
  if (cache.size <= targetSize) return;

  const removable = [];
  for (const entry of cache.values()) {
    if (entry.promise) continue;
    if (activeKeys.has(entry.key)) continue;
    removable.push(entry);
  }

  removable.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));

  while (cache.size > targetSize && removable.length > 0) {
    const entry = removable.shift();
    cache.delete(entry.key);
  }
}

async function fetchTileMapData(tileX, tileY, tileSizeMeters, layerFlags) {
  const effectiveFlags = layerFlags || createLayerFlags();
  const baseBounds = tileBoundsToLatLon(tileX, tileY, tileSizeMeters);
  
  // Expandir bounds com overlap para conectar ruas entre tiles
  const overlapPercent = MAP_CONFIG.TILE_BOUNDS_OVERLAP_PERCENT ?? 0.1;
  const expandedBounds = expandBoundsWithOverlap(baseBounds, overlapPercent);
  
  const query = buildOverpassQuery(expandedBounds, effectiveFlags);
  const data = await fetchOverpassJson(query);
  if (!data) return createEmptyMapData();
  return parseOsmData(data, {
    mode: "global",
    layerFlags: effectiveFlags,
  });
}

function transformToObserverFrame(tileData, observerWorld) {
  const outBuildings = tileData.buildings.map((building) => ({
    ...building,
    points: building.points.map((point) => [
      point[0] - observerWorld.x,
      point[1] - observerWorld.y,
    ]),
  }));

  const outRoads = tileData.roads.map((road) => ({
    ...road,
    points: road.points.map((point) => [
      point[0] - observerWorld.x,
      point[1] - observerWorld.y,
    ]),
  }));

  const outAmenities = tileData.amenities.map((amenity) => ({
    ...amenity,
    position: [
      amenity.position[0] - observerWorld.x,
      amenity.position[1],
      amenity.position[2] - observerWorld.y,
    ],
  }));

  const outGreenAreas = tileData.greenAreas.map((area) => ({
    ...area,
    points: area.points.map((point) => [
      point[0] - observerWorld.x,
      point[1] - observerWorld.y,
    ]),
  }));

  const outWaterAreas = tileData.waterAreas.map((area) => ({
    ...area,
    points: area.points.map((point) => [
      point[0] - observerWorld.x,
      point[1] - observerWorld.y,
    ]),
  }));

  const outWaterways = tileData.waterways.map((waterway) => ({
    ...waterway,
    points: waterway.points.map((point) => [
      point[0] - observerWorld.x,
      point[1] - observerWorld.y,
    ]),
  }));

  const outRailways = tileData.railways.map((railway) => ({
    ...railway,
    points: railway.points.map((point) => [
      point[0] - observerWorld.x,
      point[1] - observerWorld.y,
    ]),
  }));

  const outTransitStops = tileData.transitStops.map((stop) => ({
    ...stop,
    position: [
      stop.position[0] - observerWorld.x,
      stop.position[1],
      stop.position[2] - observerWorld.y,
    ],
  }));

  return {
    buildings: outBuildings,
    roads: outRoads,
    amenities: outAmenities,
    greenAreas: outGreenAreas,
    waterAreas: outWaterAreas,
    waterways: outWaterways,
    railways: outRailways,
    transitStops: outTransitStops,
  };
}

export function createRealtimeMapLoader(options = {}) {
  const tileSizeMeters = options.tileSizeMeters ?? MAP_CONFIG.TILE_SIZE_METERS;
  const activeRadiusMeters =
    options.activeRadiusMeters ?? MAP_CONFIG.ACTIVE_RADIUS_METERS;
  const maxCachedTiles = options.maxCachedTiles ?? MAP_CONFIG.MAX_CACHED_TILES;
  const maxConcurrentFetches =
    options.maxConcurrentFetches ?? MAP_CONFIG.MAX_CONCURRENT_TILE_FETCHES;

  const layerFlags = createLayerFlags();
  const layerFlagsKey = layerFlagsSignature(layerFlags);

  const diskCacheEnabled =
    options.diskCacheEnabled ?? MAP_CONFIG.TILE_DISK_CACHE_ENABLED;
  const diskCache = diskCacheEnabled
    ? createTileDiskCache({
        ttlMs: MAP_CONFIG.TILE_DISK_CACHE_TTL_MS,
        maxEntries: MAP_CONFIG.TILE_DISK_CACHE_MAX_ENTRIES,
        maxStaleMs: MAP_CONFIG.TILE_DISK_CACHE_MAX_STALE_MS,
      })
    : null;

  const networkStats = {
    fetches: 0,
    errors: 0,
    revalidations: 0,
  };

  function getDiskTileKeyFor(tileX, tileY) {
    return `${tileX}:${tileY}:${tileSizeMeters}:${layerFlagsKey}`;
  }

  const cache = new Map();
  const semaphore = createSemaphore(maxConcurrentFetches);
  let activeKeys = new Set();

  async function loadTile(tileX, tileY) {
    const key = getTileKey(tileX, tileY);
    const now = Date.now();
    let entry = cache.get(key);

    if (!entry) {
      entry = {
        key,
        tileX,
        tileY,
        status: "idle",
        data: createEmptyMapData(),
        promise: null,
        revalidatePromise: null,
        diskKey: diskCache ? getDiskTileKeyFor(tileX, tileY) : null,
        diskStatus: "unknown",
        diskPromise: null,
        lastUsed: now,
        fetchedAt: 0,
      };
      cache.set(key, entry);
    }

    entry.lastUsed = now;

    if (diskCache && entry.diskStatus === "unknown" && !entry.diskPromise) {
      const diskKey = entry.diskKey;
      entry.diskPromise = (async () => {
        const result = await diskCache.get(diskKey, { now });
        entry.diskStatus = result.status;
        if ((result.status === "hit" || result.status === "stale") && result.record?.data) {
          entry.status = "ready";
          entry.error = null;
          entry.data = result.record.data;
          entry.fetchedAt = result.record.fetchedAt || entry.fetchedAt;
          entry.lastUsed = now;
        }
      })()
        .catch(() => {
          entry.diskStatus = "error";
        })
        .finally(() => {
          entry.diskPromise = null;
        });
    }

    if (entry.status === "ready" && !entry.promise) {
      if (diskCache && entry.diskStatus === "stale" && !entry.revalidatePromise) {
        entry.revalidatePromise = (async () => {
          await semaphore.acquire();
          try {
            networkStats.fetches += 1;
            networkStats.revalidations += 1;
            const fresh = await fetchTileMapData(
              tileX,
              tileY,
              tileSizeMeters,
              layerFlags,
            );
            entry.data = fresh;
            entry.status = "ready";
            entry.error = null;
            entry.fetchedAt = Date.now();
            await diskCache.set(entry.diskKey, fresh, { now: entry.fetchedAt });
            entry.diskStatus = "hit";
          } catch (error) {
            networkStats.errors += 1;
          } finally {
            entry.lastUsed = Date.now();
            semaphore.release();
            entry.revalidatePromise = null;
          }
        })();
      }
      return entry;
    }

    if (entry.promise) {
      return entry.promise;
    }

    entry.promise = (async () => {
      if (entry.diskPromise) {
        try {
          await entry.diskPromise;
        } catch {
          // ignorar erro de disco e seguir via rede
        }
        if (entry.status === "ready") {
          return entry;
        }
      }

      await semaphore.acquire();
      try {
        entry.status = "loading";
        networkStats.fetches += 1;
        entry.data = await fetchTileMapData(tileX, tileY, tileSizeMeters, layerFlags);
        entry.status = "ready";
        entry.error = null;
        entry.fetchedAt = Date.now();
        if (diskCache && entry.diskKey) {
          await diskCache.set(entry.diskKey, entry.data, { now: entry.fetchedAt });
          entry.diskStatus = "hit";
        }
      } catch (error) {
        networkStats.errors += 1;
        entry.status = "error";
        entry.error = error;
        entry.data = createEmptyMapData();
      } finally {
        entry.promise = null;
        entry.lastUsed = Date.now();
        semaphore.release();
      }

      return entry;
    })();

    return entry.promise;
  }

  async function ensureActiveArea(observerLat, observerLon, options = {}) {
    const observerWorld = latLonToWorldMeters(observerLat, observerLon);
    const tiles = listTilesForRadius(
      observerWorld.x,
      observerWorld.y,
      activeRadiusMeters,
      tileSizeMeters,
    );

    activeKeys = new Set(tiles.map((tile) => tile.key));
    const protectedDiskKeys =
      diskCache && tiles.length > 0
        ? new Set(tiles.map((tile) => getDiskTileKeyFor(tile.tileX, tile.tileY)))
        : null;

    const onBackgroundLoaded =
      typeof options.onBackgroundLoaded === "function"
        ? options.onBackgroundLoaded
        : null;

    const onTileReady =
      typeof options.onTileReady === "function" ? options.onTileReady : null;

    // Usar sistema de prioridades dinâmicas para garantir núcleo consistente
    const priorityManager = createTilePriorityManager(
      activeRadiusMeters,
      tileSizeMeters,
    );

    const layers = priorityManager.layerTiles(tiles);
    const criticalTiles = layers.CRITICAL;
    const primaryTiles = layers.PRIMARY;
    const secondaryTiles = layers.SECONDARY;

    // Fase 1: Carregar raio crítico completamente (bloqueante)
    // Reserva todos os slots para crítico até estar 100% pronto
    const criticalPromises = criticalTiles.map((tile) =>
      loadTile(tile.tileX, tile.tileY),
    );
    
    try {
      await Promise.all(criticalPromises);
    } catch (e) {
      console.warn("Erro ao carregar raio crítico:", e.message);
    }

    // Fase 2: Carregar raio primário incrementalmente
    // Fire-and-forget com callbacks - não aguarda completação
    if (primaryTiles.length > 0) {
      primaryTiles.forEach((tile) => {
        loadTile(tile.tileX, tile.tileY)
          .then((entry) => {
            if (onTileReady && entry.status === "ready") {
              const transformed = transformToObserverFrame(
                entry.data,
                observerWorld,
              );
              onTileReady(transformed);
            }
          })
          .catch(() => {
            // Ignorar erros de tiles periféricos
          });
      });
    }

    // Fase 3: Carregar raio secundário com baixa prioridade
    // Completamente assíncrono, não impacta renderização
    if (secondaryTiles.length > 0) {
      secondaryTiles.forEach((tile) => {
        // Adiciona pequeno delay para não competir com primário
        setTimeout(() => {
          loadTile(tile.tileX, tile.tileY)
            .then((entry) => {
              if (onTileReady && entry.status === "ready") {
                const transformed = transformToObserverFrame(
                  entry.data,
                  observerWorld,
                );
                onTileReady(transformed);
              }
            })
            .catch(() => {
              // Ignorar completamente
            });
        }, 50);
      });
    }

    // Aguardar todos os tiles (primário + secundário) em background
    const allBackgroundPromises = [
      ...primaryTiles.map((tile) => loadTile(tile.tileX, tile.tileY)),
      ...secondaryTiles.map((tile) => loadTile(tile.tileX, tile.tileY)),
    ];

    Promise.all(allBackgroundPromises)
      .then(() => {
        pruneCache(cache, activeKeys, maxCachedTiles);
        if (diskCache && protectedDiskKeys) {
          diskCache.prune({ protectedKeys: protectedDiskKeys });
        }
        if (onBackgroundLoaded) onBackgroundLoaded();
      })
      .catch(() => {
        pruneCache(cache, activeKeys, maxCachedTiles);
        if (diskCache && protectedDiskKeys) {
          diskCache.prune({ protectedKeys: protectedDiskKeys });
        }
      });

    // Poda imediata após crítico estar pronto
    pruneCache(cache, activeKeys, maxCachedTiles);
    if (diskCache && protectedDiskKeys) {
      diskCache.prune({ protectedKeys: protectedDiskKeys });
    }
  }

  function getActiveMapData(observerLat, observerLon) {
    const observerWorld = latLonToWorldMeters(observerLat, observerLon);
    let keysToMerge = activeKeys;

    if (keysToMerge.size === 0) {
      const tiles = listTilesForRadius(
        observerWorld.x,
        observerWorld.y,
        activeRadiusMeters,
        tileSizeMeters,
      );
      keysToMerge = new Set(tiles.map((tile) => tile.key));
    }

    const seenBuildings = new Set();
    const seenRoads = new Set();
    const seenAmenities = new Set();
    const seenGreenAreas = new Set();
    const seenWaterAreas = new Set();
    const seenWaterways = new Set();
    const seenRailways = new Set();
    const seenTransitStops = new Set();
    const merged = createEmptyMapData();
    let loadedTiles = 0;

    for (const key of keysToMerge) {
      const entry = cache.get(key);
      if (!entry || entry.status !== "ready") continue;
      loadedTiles += 1;
      entry.lastUsed = Date.now();

      const transformed = transformToObserverFrame(entry.data, observerWorld);

      for (const building of transformed.buildings) {
        if (seenBuildings.has(building.id)) continue;
        seenBuildings.add(building.id);
        merged.buildings.push(building);
      }

      for (const road of transformed.roads) {
        if (seenRoads.has(road.id)) continue;
        seenRoads.add(road.id);
        merged.roads.push(road);
      }

      for (const amenity of transformed.amenities) {
        if (seenAmenities.has(amenity.id)) continue;
        seenAmenities.add(amenity.id);
        merged.amenities.push(amenity);
      }

      for (const greenArea of transformed.greenAreas) {
        if (seenGreenAreas.has(greenArea.id)) continue;
        seenGreenAreas.add(greenArea.id);
        merged.greenAreas.push(greenArea);
      }

      for (const waterArea of transformed.waterAreas) {
        if (seenWaterAreas.has(waterArea.id)) continue;
        seenWaterAreas.add(waterArea.id);
        merged.waterAreas.push(waterArea);
      }

      for (const waterway of transformed.waterways) {
        if (seenWaterways.has(waterway.id)) continue;
        seenWaterways.add(waterway.id);
        merged.waterways.push(waterway);
      }

      for (const railway of transformed.railways) {
        if (seenRailways.has(railway.id)) continue;
        seenRailways.add(railway.id);
        merged.railways.push(railway);
      }

      for (const stop of transformed.transitStops) {
        if (seenTransitStops.has(stop.id)) continue;
        seenTransitStops.add(stop.id);
        merged.transitStops.push(stop);
      }
    }

    return {
      ...merged,
      meta: {
        activeRadiusMeters,
        tileSizeMeters,
        cachedTiles: cache.size,
        activeTiles: keysToMerge.size,
        loadedTiles,
        diskCache: diskCache ? diskCache.getStats() : null,
        network: { ...networkStats },
      },
    };
  }

  function getStats() {
    return {
      cachedTiles: cache.size,
      activeTiles: activeKeys.size,
      activeRadiusMeters,
      tileSizeMeters,
      diskCache: diskCache ? diskCache.getStats() : null,
      network: { ...networkStats },
    };
  }

  async function clear() {
    cache.clear();
    activeKeys = new Set();
    if (diskCache) {
      await diskCache.clear();
    }
  }

  return {
    ensureActiveArea,
    getActiveMapData,
    getStats,
    clear,
  };
}
