// config/mapConfig.js
// Configurações do mapa 3D

export const MAP_CONFIG = {
  // Raio de busca do mapa em km
  SEARCH_RADIUS_KM: 3,

  // Carregamento em tempo real
  ACTIVE_RADIUS_METERS: 450,
  TILE_SIZE_METERS: 450,
  MAX_CACHED_TILES: 48,
  MAX_CONCURRENT_TILE_FETCHES: 2,
  BLOCKING_TILE_COUNT: 2,
  REALTIME_REFRESH_DEBOUNCE_MS: 300,
  ENABLE_AMENITIES: false,
  ROAD_SIMPLIFY_TOLERANCE_METERS: 2.5,

  // Distância mínima em metros para atualizar o mapa
  UPDATE_DISTANCE_INTERVAL: 150,

  // Intervalo de tempo mínimo entre atualizações (em ms)
  UPDATE_TIME_INTERVAL: 4000,

  // Movimento do observador (m/s)
  MOVEMENT_SPEED_MPS: 20,
  MOVEMENT_UPDATE_INTERVAL_MS: 120,
  MIN_MOVEMENT_UPDATE_METERS: 0.8,

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
