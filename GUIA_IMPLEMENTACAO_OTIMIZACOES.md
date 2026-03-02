# Guia de Implementação Prática - Otimizações Críticas

**Data**: Março 2026  
**Objetivo**: Passos passo a passo para implementar as otimizações

---

## 🎯 Prioridade 1: Previsão de Movimento (Predictive Loading)

Este é o maior impacto para **consistência** do mapa.

### Passo 1: Modificar `config/mapConfig.js`

Adicione no final do `MAP_CONFIG`:

```javascript
// Previsão e Lookahead
MOVEMENT_LOOKAHEAD_SECONDS: 2,        // Gastar 2s no futuro
MOVEMENT_LOOKAHEAD_RADIUS_MULTIPLIER: 1.3, // 30% a mais de raio preditivo
ACTIVE_RADIUS_INCREASE_ON_SPEED: 0.5, // +50% raio se velocidade > limiar
SPEED_THRESHOLD_FOR_PREDICTION: 8,    // m/s que ativa previsão agressiva
```

### Passo 2: Modificar `App.web.jsx`

Rastrear velocidade do movimento:

```javascript
// Adicionar no início do componente AppWeb:
const velocityRef = useRef({ vx: 0, vz: 0, lastUpdateTime: Date.now() });
const predictiveRadiusRef = useRef(MAP_CONFIG.ACTIVE_RADIUS_METERS);

// Modificar handleObserverMove:
const handleObserverMove = useCallback((deltaXMeters, deltaZMeters) => {
  if (!Number.isFinite(deltaXMeters) || !Number.isFinite(deltaZMeters)) return;
  if (deltaXMeters === 0 && deltaZMeters === 0) return;

  // NOVO: Calcular velocidade instantânea (m/s)
  const now = Date.now();
  const deltaTime = Math.max(1, now - velocityRef.current.lastUpdateTime) / 1000;
  velocityRef.current.vx = deltaXMeters / deltaTime;
  velocityRef.current.vz = deltaZMeters / deltaTime;
  velocityRef.current.lastUpdateTime = now;

  // NOVO: Ajustar raio preditivo baseado na velocidade
  const speed = Math.hypot(velocityRef.current.vx, velocityRef.current.vz);
  if (speed > MAP_CONFIG.SPEED_THRESHOLD_FOR_PREDICTION) {
    predictiveRadiusRef.current = 
      MAP_CONFIG.ACTIVE_RADIUS_METERS * 
      (1 + MAP_CONFIG.ACTIVE_RADIUS_INCREASE_ON_SPEED);
  } else {
    predictiveRadiusRef.current = MAP_CONFIG.ACTIVE_RADIUS_METERS;
  }

  // Existente:
  setLocation((previousLocation) => {
    if (!previousLocation) return previousLocation;
    const next = applyMetersToLocation(
      previousLocation,
      deltaXMeters,
      deltaZMeters,
    );
    return next;
  });
}, []);

// Modificar refreshMapForLocation para usar velocidade:
const refreshMapForLocation = useCallback(
  async (loc, { forceEnsure = false } = {}) => {
    const normalized = normalizeLocation(loc);
    const loader = ensureRealtimeLoader();
    const now = Date.now();
    const previousEnsure = lastEnsureRef.current;

    const movedMeters = Number.isFinite(previousEnsure.latitude)
      ? calculateDistance(
          previousEnsure.latitude,
          previousEnsure.longitude,
          normalized.latitude,
          normalized.longitude,
        ) * 1000
      : Number.POSITIVE_INFINITY;

    const shouldEnsureArea =
      forceEnsure ||
      movedMeters >= MAP_CONFIG.UPDATE_DISTANCE_INTERVAL ||
      now - previousEnsure.time >= MAP_CONFIG.UPDATE_TIME_INTERVAL;

    if (shouldEnsureArea) {
      const requestToken = ++updateTokenRef.current;
      
      // NOVO: Passar velocidade e raio preditivo
      await loader.ensureActiveArea(
        normalized.latitude,
        normalized.longitude,
        {
          blockingTileCount: MAP_CONFIG.BLOCKING_TILE_COUNT,
          velocityX: velocityRef.current.vx,
          velocityZ: velocityRef.current.vz,
          predictiveRadiusMultiplier: 
            predictiveRadiusRef.current / MAP_CONFIG.ACTIVE_RADIUS_METERS,
          onTileReady: (tileData) => {
            // ... resto igual
          },
          onBackgroundLoaded: () => {
            // ... resto igual
          },
        },
      );
      
      // ... resto igual
    }
    // ... resto igual
  },
  [ensureRealtimeLoader],
);
```

### Passo 3: Modificar `services/osmService.js`

Aceitar e usar velocidade no `ensureActiveArea`:

```javascript
async function ensureActiveArea(observerLat, observerLon, options = {}) {
  const observerWorld = latLonToWorldMeters(observerLat, observerLon);
  
  // NOVO: Calcular tiles atuais
  const currentTiles = listTilesForRadius(
    observerWorld.x,
    observerWorld.y,
    activeRadiusMeters,
    tileSizeMeters,
  );

  // NOVO: Calcular tiles previstos (se houver velocidade)
  const velocityX = options.velocityX ?? 0;
  const velocityZ = options.velocityZ ?? 0;
  const predictiveMultiplier = options.predictiveRadiusMultiplier ?? 1;
  
  let predictedTiles = [];
  if (Math.hypot(velocityX, velocityZ) > 2) { // > 2 m/s
    // Lookahead: onde o usuário estará em N segundos
    const lookaheadSeconds = 
      options.lookaheadSeconds ?? MAP_CONFIG.MOVEMENT_LOOKAHEAD_SECONDS ?? 2;
    const predictedX = observerWorld.x + (velocityX * lookaheadSeconds);
    const predictedY = observerWorld.y + (velocityZ * lookaheadSeconds);
    
    predictedTiles = listTilesForRadius(
      predictedX,
      predictedY,
      activeRadiusMeters * predictiveMultiplier,
      tileSizeMeters,
    );
  }

  // Combinar tiles (sem duplicatas)
  const allTiles = [...currentTiles];
  for (const tile of predictedTiles) {
    if (!allTiles.find(t => t.key === tile.key)) {
      allTiles.push(tile);
    }
  }

  // Separar bloqueantes vs background
  const blockingTileCount = Math.max(
    1,
    options.blockingTileCount ?? MAP_CONFIG.BLOCKING_TILE_COUNT ?? 2,
  );
  
  // Bloqueantes = tiles atuais críticos (não os previstos)
  const blockingTiles = currentTiles.slice(0, blockingTileCount);
  const backgroundTiles = allTiles.slice(blockingTileCount);

  // Carregar bloqueantes
  const blockingPromises = blockingTiles.map((tile) =>
    loadTile(tile.tileX, tile.tileY),
  );
  await Promise.all(blockingPromises);

  // Carregar background + previstos em paralelo
  activeKeys = new Set(allTiles.map((tile) => tile.key));
  const onTileReady = typeof options.onTileReady === "function" 
    ? options.onTileReady 
    : null;

  // Feedback de progresso
  let backgroundLoaded = 0;
  const totalBackground = backgroundTiles.length;

  if (backgroundTiles.length > 0) {
    backgroundTiles.forEach((tile) => {
      loadTile(tile.tileX, tile.tileY)
        .then((entry) => {
          if (entry.status === "ready") {
            const transformed = transformToObserverFrame(
              entry.data,
              observerWorld,
            );
            if (onTileReady) {
              onTileReady(transformed, {
                tileKey: entry.key,
                isPredictive: predictedTiles.some(t => t.key === entry.key),
                progress: (++backgroundLoaded) / totalBackground,
              });
            }
          }
        })
        .catch(() => {
          backgroundLoaded += 1;
        });
    });

    Promise.all(
      backgroundTiles.map((tile) => loadTile(tile.tileX, tile.tileY)),
    )
      .then(() => {
        pruneCache(cache, activeKeys, maxCachedTiles);
        if (diskCache) {
          const protectedDiskKeys = new Set(
            allTiles.map((tile) => getDiskTileKeyFor(tile.tileX, tile.tileY))
          );
          diskCache.prune({ protectedKeys: protectedDiskKeys });
        }
        if (options.onBackgroundLoaded) options.onBackgroundLoaded();
      })
      .catch(() => {
        pruneCache(cache, activeKeys, maxCachedTiles);
      });
  }

  pruneCache(cache, activeKeys, maxCachedTiles);
}
```

---

## 🎯 Prioridade 2: Otimizar Poda de Cache (1 hora)

### Modificar `config/mapConfig.js`

```javascript
// Alterar valores existentes:
TILE_DISK_CACHE_TTL_MS: 6 * 60 * 60 * 1000,  // De 24h para 6h
TILE_DISK_CACHE_MAX_ENTRIES: 400,             // De 250 para 400
TILE_DISK_CACHE_MAX_STALE_MS: 2 * 24 * 60 * 60 * 1000, // De 7d para 2d

// Adicionar novo:
CACHE_SOFT_LIMIT_MULTIPLIER: 0.75,  // Começar poda em 75% do limite
```

### Modificar `services/osmService.js`

Na função `pruneCache`:

```javascript
function pruneCache(cache, activeKeys, maxCachedTiles) {
  const softLimit = Math.floor(
    maxCachedTiles * MAP_CONFIG.CACHE_SOFT_LIMIT_MULTIPLIER
  );

  // Não prune se ainda estamos abaixo do limite suave
  if (cache.size <= softLimit) return;

  // Buscar tiles não-ativos (não na activeKeys)
  const nonActive = Array.from(cache.entries())
    .filter(([key]) => !activeKeys.has(key))
    .map(([key, entry]) => ({
      key,
      entry,
      // Dar prioridade a tiles antigos e grandes
      score: entry.lastUsed - (entry.data.buildings?.length || 0) * 100,
    }))
    .sort((a, b) => a.score - b.score);

  // Remover até atingir soft limit
  const toRemove = cache.size - softLimit;
  for (let i = 0; i < toRemove && i < nonActive.length; i++) {
    cache.delete(nonActive[i].key);
  }
}
```

---

## 🎯 Prioridade 3: Level of Detail (LOD)

Esta é a mais complexa mas impacta muito performance.

### Passo 1: Modificar `config/mapConfig.js`

Adicionar ao final:

```javascript
// Level of Detail
LOD_ENABLED: true,
LOD0_DISTANCE: 150,  // Completo até 150m
LOD1_DISTANCE: 400,  // Simplificado até 400m
LOD2_DISTANCE: 1000, // Caixas até 1000m+

// LOD pode ser desabilitado para debug
DEBUG_FORCE_LOD: null, // null = auto, 0 = força LOD0, 1 = LOD1, 2 = LOD2
```

### Passo 2: Criar helper em `utils/geoUtils.js`

```javascript
// Adicionar ao final do arquivo:

export function calculateLOD(distanceMeters, config = MAP_CONFIG) {
  if (!config.LOD_ENABLED) return 0;
  
  if (config.DEBUG_FORCE_LOD !== null) return config.DEBUG_FORCE_LOD;
  
  if (distanceMeters < config.LOD0_DISTANCE) return 0;
  if (distanceMeters < config.LOD1_DISTANCE) return 1;
  return 2;
}

export function simplifyBuildingGeometry(building, lod) {
  if (lod === 0) return building; // Sem mudanças
  
  // LOD1: Simplificar detalhes, manter forma
  if (lod === 1) {
    return {
      ...building,
      // Remover linhas muito pequenas
      points: simplifyPath(building.points, 2.0), // 2m tolerance
    };
  }
  
  // LOD2: Apenas bounding box
  if (lod === 2) {
    const points = building.points;
    const minX = Math.min(...points.map(p => p[0]));
    const maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1]));
    const maxY = Math.max(...points.map(p => p[1]));
    
    return {
      ...building,
      // Substituir por retângulo simples
      isSimplified: true,
      points: [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
    };
  }
  
  return building;
}
```

### Passo 3: Modificar `components/Map3DScene.web.jsx`

No `useFrame`, ao calcular visibilidade, calcular também distância e LOD:

```javascript
// Dentro do useFrame, antes do frustum culling:

const cameraWorldPos = camera.position;

// Calcular LOD para cada building visível
if (mapData) {
  const visibleBuildingsWithLOD = new Map(); // ID -> { object, lod }
  
  mapData.buildings?.forEach((building) => {
    if (!building.points || building.points.length < 3) return;
    
    const mappedPoints = building.points.map((p) => mapToSceneCoord(p));
    const centerX = mappedPoints.reduce((sum, p) => sum + p[0], 0) / mappedPoints.length;
    const centerY = mappedPoints.reduce((sum, p) => sum + p[1], 0) / mappedPoints.length;
    
    // Distância para câmera
    const dx = centerX - cameraWorldPos.x;
    const dz = centerY - cameraWorldPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Calcular LOD
    const lod = calculateLOD(distance, MAP_CONFIG);
    
    // Armazenar para renderização
    visibleBuildingsWithLOD.set(building.id, {
      building: simplifyBuildingGeometry(building, lod),
      lod,
      distance,
    });
  });
  
  // Fazer frustum culling com dados LOD
  mapData.buildings?.forEach((building) => {
    const lodData = visibleBuildingsWithLOD.get(building.id);
    if (!lodData) return;
    
    const simplifiedBuilding = lodData.building;
    const mappedPoints = simplifiedBuilding.points.map((p) => mapToSceneCoord(p));
    const centerX = mappedPoints.reduce((sum, p) => sum + p[0], 0) / mappedPoints.length;
    const centerZ = mappedPoints.reduce((sum, p) => sum + p[1], 0) / mappedPoints.length;
    
    const buildingSphere = new THREE.Sphere(
      new THREE.Vector3(centerX, (simplifiedBuilding.height || 10) / 2, centerZ),
      Math.max(...mappedPoints.map((p) =>
        Math.sqrt((p[0] - centerX) ** 2 + (p[1] - centerZ) ** 2),
      )) + 5,
    );
    
    if (frustumRef.current.intersectsSphere(buildingSphere)) {
      visibleBuildings.add(building.id);
    }
  });
}

// Então ao renderizar:
visibleBuildings.map((id) => {
  const lodData = visibleBuildingsWithLOD.get(id);
  return (
    <Building
      key={`b-${id}`}
      building={lodData.building}
      lod={lodData.lod}
      roads={roads}
    />
  );
});
```

### Passo 4: Atualizar componente `Building`

```javascript
const Building = memo(function Building({ building, roads, lod = 0 }) {
  // Para LOD2, renderizar apenas caixa
  if (lod === 2 || building.isSimplified) {
    const center = calculateCenter(building.points);
    return (
      <mesh position={[center[0], (building.height || 10) / 2, center[1]]}>
        <boxGeometry 
          args={[
            calculateWidth(building.points),
            building.height || 10,
            calculateDepth(building.points),
          ]}
        />
        <meshStandardMaterial 
          color={building.color || 0xcccccc}
          roughness={1}
          metalness={0}
        />
      </mesh>
    );
  }

  // Para LOD0 e LOD1, renderizar normalmente (implementação existente)
  return <DetailedBuilding building={building} roads={roads} />;
});

// Helpers:
function calculateCenter(points) {
  const sumX = points.reduce((s, p) => s + p[0], 0);
  const sumY = points.reduce((s, p) => s + p[1], 0);
  return [sumX / points.length, sumY / points.length];
}

function calculateWidth(points) {
  const xs = points.map(p => p[0]);
  return Math.max(...xs) - Math.min(...xs);
}

function calculateDepth(points) {
  const ys = points.map(p => p[1]);
  return Math.max(...ys) - Math.min(...ys);
}
```

---

## 🔧 Cache Otimizado de Bounding Spheres

### Modificar `services/osmService.js`

Ao transformar dados para a frame do observador:

```javascript
function transformToObserverFrame(tileData, observerWorld) {
  // ... resto do código ...
  
  const outBuildings = tileData.buildings.map((building) => {
    const transformed = {
      ...building,
      points: building.points.map((point) => [
        point[0] - observerWorld.x,
        point[1] - observerWorld.y,
      ]),
    };
    
    // NOVO: Cache bounding sphere
    if (transformed.points && transformed.points.length >= 3) {
      const pts = transformed.points;
      const centerX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const centerZ = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const radius = Math.max(
        ...pts.map(p => Math.sqrt((p[0] - centerX) ** 2 + (p[1] - centerZ) ** 2))
      );
      
      transformed._boundingSphere = {
        center: [centerX, (building.height || 10) / 2, centerZ],
        radius: radius + 5,
      };
    }
    
    return transformed;
  });
  
  // ... aplicar mesmo para roads, amenities, etc ...
  
  return {
    buildings: outBuildings,
    roads: outRoads,
    // ... resto
  };
}
```

Então em `Map3DScene.jsx`, usar o cache:

```javascript
mapData.buildings?.forEach((building) => {
  if (!building._boundingSphere) return;
  
  const bs = building._boundingSphere;
  const sphere = new THREE.Sphere(
    new THREE.Vector3(...bs.center),
    bs.radius,
  );
  
  if (frustumRef.current.intersectsSphere(sphere)) {
    visibleBuildings.add(building.id);
  }
});
```

---

## ✅ Teste e Validação

Após cada mudança, validar:

```javascript
// 1. Previsão funciona:
//    - Mover rápido na direção
//    - Observar que tiles à frente carregam (status: visible mas faded)
//    - Não há pop-in ao cruzar fronteira

// 2. LOD funciona:
//    - Zoom out
//    - Buildings distantes viram caixas
//    - Zoom in novamente
//    - Buildings volta ao detalhe

// 3. Cache otimizado:
//    - Deixar mapa rodando por 2h
//    - Monitorar DevTools > Memory
//    - RAM não deve crescer linearmente

// 4. Frustum cache:
//    - Tirar FPS stats (F12 > Performance)
//    - Girar câmera rapidamente
//    - FPS > 30 mesmo com muitos buildings
```

---

**Status**: 📋 Pronto para Implementação em Ordem  
**Tempo Total Estimado**: 2-3 dias de desenvolvimento  
**Teste**: 1 dia
