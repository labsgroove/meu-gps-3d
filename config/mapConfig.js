// config/mapConfig.js
// Configurações do mapa 3D

export const MAP_CONFIG = {
  // Raio de busca do mapa em km
  SEARCH_RADIUS_KM: 3,

  // Carregamento em tempo real
  ACTIVE_RADIUS_METERS: 900,
  TILE_SIZE_METERS: 280,
  MAX_CACHED_TILES: 100,
  MAX_CONCURRENT_TILE_FETCHES: 4,
  BLOCKING_TILE_COUNT: 3,
  REALTIME_REFRESH_DEBOUNCE_MS: 150,
  ENABLE_AMENITIES: true,
  ENABLE_GREEN_AREAS: true,
  ENABLE_WATER_AREAS: true,
  ENABLE_WATERWAYS: true,
  ENABLE_RAILWAYS: true,
  ENABLE_TRANSIT_STOPS: true,
  ROAD_SIMPLIFY_TOLERANCE_METERS: 1.5,
  WATERWAY_SIMPLIFY_TOLERANCE_METERS: 1.2,
  RAILWAY_SIMPLIFY_TOLERANCE_METERS: 1.0,

  // Distância mínima em metros para atualizar o mapa
  UPDATE_DISTANCE_INTERVAL: 100,

  // Intervalo de tempo mínimo entre atualizações (em ms)
  UPDATE_TIME_INTERVAL: 3000,

  // Movimento do observador (m/s)
  MOVEMENT_SPEED_MPS: 20,
  MOVEMENT_UPDATE_INTERVAL_MS: 60,
  MIN_MOVEMENT_UPDATE_METERS: 0.5,

  // Zoom inicial da câmera
  INITIAL_ZOOM: 80,

  // Limites de zoom
  MIN_ZOOM: 10,
  MAX_ZOOM: 200,

  // Altura padrão dos prédios quando não especificada
  DEFAULT_BUILDING_HEIGHT: 12,

  // Altura máxima para cálculos (limita prédios muito altos)
  MAX_BUILDING_HEIGHT: 200,

  // Multiplicador de altura para visualização melhorada
  HEIGHT_MULTIPLIER: 1.2,

  // Largura das estradas em metros (multiplicador global para deixar vias mais largas)
  ROAD_WIDTH_MULTIPLIER: 1.6,

  // Configurações de iluminação
  LIGHTING: {
    AMBIENT_LIGHT_INTENSITY: 0.7,
    DIRECTIONAL_LIGHT_INTENSITY: 1,
    HEMISPHERE_LIGHT_INTENSITY: 0.4,
    SHADOW_MAP_SIZE: 2048,
  },

  // Configurações de câmera
  CAMERA: {
    FOV: 45,
    NEAR: 0.1,
    FAR: 10000,
    POSITION: [0, 80, 80],
  },

  // Configurações de controle
  CONTROLS: {
    ENABLE_DAMPING: true,
    DAMPING_FACTOR: 0.05,
    ENABLE_ZOOM: true,
    ENABLE_PAN: true,
    AUTO_ROTATE: false,
  },

  // Cores de ambientação
  COLORS: {
    FOG_COLOR: 0x87ceeb,
    FOG_NEAR: 100,
    FOG_FAR: 2000,
    GRID_COLOR: 0xcccccc,
  },

  // Tipos de prédios e suas alturas estimadas
  BUILDING_HEIGHTS: {
    residential: 10,
    commercial: 20,
    industrial: 15,
    apartments: 25,
    church: 25,
    hospital: 30,
    office: 20,
    retail: 15,
  },

  // Tipos de ruas e suas larguras
  ROAD_WIDTHS: {
    motorway: 9,
    trunk: 8,
    primary: 7.5,
    secondary: 7,
    tertiary: 6.5,
    residential: 4.5,
    service: 2.5,
    footway: 1.5,
  },

  WATERWAY_WIDTHS: {
    river: 5,
    canal: 3.5,
    stream: 1.8,
    ditch: 1.2,
    drain: 1.1,
  },

  RAILWAY_WIDTHS: {
    rail: 2.2,
    subway: 1.8,
    tram: 1.4,
    light_rail: 1.8,
    narrow_gauge: 1.6,
  },

  // Cores de prédios por tipo
  BUILDING_COLORS: {
    residential: 0xd4a574,
    commercial: 0xb0b0b0,
    industrial: 0x8b7d6b,
    apartments: 0xc0a080,
    church: 0x8b4513,
    hospital: 0xff6b6b,
    office: 0xa9a9a9,
    retail: 0xdaa520,
  },

  // Cores de ruas por tipo
  ROAD_COLORS: {
    motorway: 0xff6b6b,
    trunk: 0xffd700,
    primary: 0xffd700,
    secondary: 0xffee99,
    tertiary: 0xffffff,
    residential: 0xffffff,
    service: 0xe0e0e0,
    footway: 0xcccccc,
  },

  // Cores de amenidades por tipo
  AMENITY_COLORS: {
    hospital: 0xff0000,
    school: 0x0000ff,
    university: 0x4169e1,
    restaurant: 0xff8c00,
    cafe: 0xffa500,
    bar: 0xff69b4,
    park: 0x00ff00,
    parking: 0xffff00,
    bank: 0x800080,
    pharmacy: 0x008000,
    bus_station: 0xff1493,
    library: 0x8b4789,
    cinema: 0x191970,
    theatre: 0xff00ff,
    supermarket: 0xff0000,
    bakery: 0xffa500,
  },

  GREEN_AREA_COLORS: {
    park: 0x66bb6a,
    garden: 0x7bcf7f,
    pitch: 0x8bcf7a,
    golf_course: 0x7aaa58,
    playground: 0x78b764,
    recreation_ground: 0x6cbf6e,
    forest: 0x417d44,
    wood: 0x3d6d3f,
    grass: 0x86c96f,
    meadow: 0x9ad382,
    village_green: 0x7fc76b,
    grassland: 0x93c970,
    scrub: 0x7ba06a,
  },

  WATER_AREA_COLORS: {
    water: 0x4d9de0,
    wetland: 0x4aa4b8,
    bay: 0x3e8ec8,
    reservoir: 0x3f88c5,
    basin: 0x4f97cc,
    riverbank: 0x4a90e2,
    swimming_pool: 0x3ab7ff,
  },

  WATERWAY_COLORS: {
    river: 0x2f7fd7,
    canal: 0x3689d8,
    stream: 0x3f9ae0,
    ditch: 0x5aa7de,
    drain: 0x64b0e4,
  },

  RAILWAY_COLORS: {
    rail: 0x5c5c5c,
    subway: 0x666666,
    tram: 0x7a5f48,
    light_rail: 0x706c62,
    narrow_gauge: 0x7f7f7f,
  },

  TRANSIT_COLORS: {
    station: 0x22c55e,
    halt: 0x3ecf7a,
    platform: 0x44c0c0,
    stop_position: 0xff66c4,
    bus_stop: 0xf59e0b,
    tram_stop: 0x14b8a6,
    subway_entrance: 0xa855f7,
    stop: 0xff6b6b,
  },
};

// Materiais pré-configurados para melhor performance
export const MATERIALS = {
  building: {
    metalness: 0.2,
    roughness: 0.7,
    side: 2, // THREE.DoubleSide
  },
  buildingSide: {
    metalness: 0,
    roughness: 1,
    side: 2,
  },
  road: {
    roughness: 0.9,
    metalness: 0,
  },
  amenity: {
    roughness: 0.6,
    metalness: 0.3,
  },
};
