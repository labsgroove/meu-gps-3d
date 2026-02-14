// services/osmService.js
// Serviço para buscar dados de OpenStreetMap via Overpass API
import { simplifyPath } from "../utils/geoUtils.js";
import { MAP_CONFIG } from "../config/mapConfig.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const EARTH_RADIUS_METERS = 6378137;

function createEmptyMapData(includeAmenities = true) {
  return { buildings: [], roads: [], amenities: [] };
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
  includeAmenities = true,
) {
  const amenityFilter = includeAmenities
    ? `node["amenity"](${south},${west},${north},${east});`
    : "";

  return `[out:json];(
    way["building"](${south},${west},${north},${east});
    way["highway"](${south},${west},${north},${east});
    ${amenityFilter}
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

    const includeAmenities = MAP_CONFIG.ENABLE_AMENITIES !== false;
    const query = buildOverpassQuery(bounds, includeAmenities);
    const data = await fetchOverpassJson(query);
    if (!data) return createEmptyMapData(includeAmenities);

    return parseOsmData(data, {
      mode: "local",
      centerLat: latitude,
      centerLon: longitude,
      includeAmenities,
    });
  } catch (error) {
    console.error("Erro ao buscar dados OSM:", error?.message || String(error));
    return createEmptyMapData(MAP_CONFIG.ENABLE_AMENITIES !== false);
  }
}

function parseOsmData(data, options) {
  const buildings = [];
  const roads = [];
  const amenities = [];

  if (!data?.elements) return { buildings, roads, amenities };

  const toPoint =
    options.mode === "global"
      ? (lat, lon) => {
          const { x, y } = latLonToWorldMeters(lat, lon);
          return [x, y];
        }
      : (lat, lon) =>
          latLonToLocalMeters(lat, lon, options.centerLat, options.centerLon);

  for (const element of data.elements) {
    if (element.type !== "way") continue;

    if (element.tags?.building) {
      buildings.push(parseBuilding(element, toPoint));
      continue;
    }

    if (element.tags?.highway) {
      roads.push(parseRoad(element, toPoint));
    }
  }

  if (options.includeAmenities !== false) {
    for (const element of data.elements) {
      if (element.type !== "node" || !element.tags?.amenity) continue;
      amenities.push(parseAmenity(element, toPoint));
    }
  }

  return { buildings, roads, amenities };
}

function parseBuilding(way, toPoint) {
  const coordinates = way.geometry || [];
  const points = coordinates.map((coord) => toPoint(coord.lat, coord.lon));

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

  const tolerance = MAP_CONFIG.ROAD_SIMPLIFY_TOLERANCE_METERS ?? 1.0;
  const points = simplifyPath(rawPoints, tolerance);

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
  if (cache.size <= maxCachedTiles) return;

  const removable = [];
  for (const entry of cache.values()) {
    if (entry.promise) continue;
    if (activeKeys.has(entry.key)) continue;
    removable.push(entry);
  }

  removable.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));

  while (cache.size > maxCachedTiles && removable.length > 0) {
    const entry = removable.shift();
    cache.delete(entry.key);
  }
}

async function fetchTileMapData(tileX, tileY, tileSizeMeters) {
  const includeAmenities = MAP_CONFIG.ENABLE_AMENITIES !== false;
  const bounds = tileBoundsToLatLon(tileX, tileY, tileSizeMeters);
  const query = buildOverpassQuery(bounds, includeAmenities);
  const data = await fetchOverpassJson(query);
  if (!data) return createEmptyMapData(includeAmenities);
  return parseOsmData(data, {
    mode: "global",
    includeAmenities,
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

  return {
    buildings: outBuildings,
    roads: outRoads,
    amenities: outAmenities,
  };
}

export function createRealtimeMapLoader(options = {}) {
  const tileSizeMeters = options.tileSizeMeters ?? MAP_CONFIG.TILE_SIZE_METERS;
  const activeRadiusMeters =
    options.activeRadiusMeters ?? MAP_CONFIG.ACTIVE_RADIUS_METERS;
  const maxCachedTiles = options.maxCachedTiles ?? MAP_CONFIG.MAX_CACHED_TILES;
  const maxConcurrentFetches =
    options.maxConcurrentFetches ?? MAP_CONFIG.MAX_CONCURRENT_TILE_FETCHES;

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
        lastUsed: now,
        fetchedAt: 0,
      };
      cache.set(key, entry);
    }

    entry.lastUsed = now;

    if (entry.status === "ready" && !entry.promise) {
      return entry;
    }

    if (entry.promise) {
      return entry.promise;
    }

    entry.promise = (async () => {
      await semaphore.acquire();
      try {
        entry.status = "loading";
        entry.data = await fetchTileMapData(tileX, tileY, tileSizeMeters);
        entry.status = "ready";
        entry.error = null;
        entry.fetchedAt = Date.now();
      } catch (error) {
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
    const blockingTileCount = Math.max(
      1,
      options.blockingTileCount ?? MAP_CONFIG.BLOCKING_TILE_COUNT ?? 2,
    );
    const blockingTiles = tiles.slice(0, blockingTileCount);
    const backgroundTiles = tiles.slice(blockingTileCount);

    const blockingPromises = blockingTiles.map((tile) =>
      loadTile(tile.tileX, tile.tileY),
    );
    await Promise.all(blockingPromises);

    const onBackgroundLoaded =
      typeof options.onBackgroundLoaded === "function"
        ? options.onBackgroundLoaded
        : null;

    if (backgroundTiles.length > 0) {
      Promise.all(
        backgroundTiles.map((tile) => loadTile(tile.tileX, tile.tileY)),
      )
        .then(() => {
          pruneCache(cache, activeKeys, maxCachedTiles);
          if (onBackgroundLoaded) onBackgroundLoaded();
        })
        .catch(() => {
          pruneCache(cache, activeKeys, maxCachedTiles);
        });
    }

    pruneCache(cache, activeKeys, maxCachedTiles);
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
    }

    return {
      ...merged,
      meta: {
        activeRadiusMeters,
        tileSizeMeters,
        cachedTiles: cache.size,
        activeTiles: keysToMerge.size,
        loadedTiles,
      },
    };
  }

  function getStats() {
    return {
      cachedTiles: cache.size,
      activeTiles: activeKeys.size,
      activeRadiusMeters,
      tileSizeMeters,
    };
  }

  function clear() {
    cache.clear();
    activeKeys = new Set();
  }

  return {
    ensureActiveArea,
    getActiveMapData,
    getStats,
    clear,
  };
}
