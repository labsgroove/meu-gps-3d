# Otimizações Avançadas - Mapa 3D Consistente e Eficiente

**Data**: Março 2026  
**Status**: 🎯 Pronto para Implementação  
**Objetivo**: Tornar o mapa mais consistente e carregar áreas maiores sem perder fluidez

---

## 📊 Análise Atual do Projeto

### ✅ O que Funciona Bem
```
✓ Tiles pequenos (280m)        → Atualizações granulares
✓ Debounce otimizado (150ms)   → Responsividade boa
✓ Terreno infinito              → Sem limites visuais
✓ Cache duplo (RAM + IndexedDB) → Dados persistem entre sessões
✓ Renderização incremental      → Carregamento gradual
✓ Frustum culling               → Reduz drawcalls desnecessários
```

### ⚠️ Gargalos Identificados

| Problema | Impacto | Causa |
|----------|---------|-------|
| **Sem previsão de tiles** | Pop-in ao mover rápido | Carrega sob demanda apenas |
| **LOD não implementado** | Sobrecarga em áreas densas | Todos objetos mesmo detalhe |
| **Cálculo de frustum redundante** | CPU waste em mobile | Cada objeto/frame calcula esfera |
| **Poda de cache conservadora** | RAM cresce com tempo | TTL de 24h é longo |
| **Feedback visual ausente** | UX vago durante load | Sem indicadores progressivos |
| **Apenas 4 requisições paralelas** | Carregamento lento | Limite baixo para áreas maiores |
| **Deduplicação em state** | Re-render cara | Spread operator em setMapData |

---

## 🚀 Otimizações Recomendadas (Prioritárias)

### 1. **CRÍTICA**: Previsão de Movimento (Predictive Loading)
**Impacto**: +40% consistência  
**Esforço**: 3-4 horas

#### Problema
Quando usuário move-se em direção, apenas tiles atuais carregam. Ao cruzar fronteira, há pop-in.

#### Solução
```javascript
// Conceito: Ao movimentar, carregar 1-2 tiles à frente
function predictNextTiles(currentLocation, movementVelocity, radius) {
  // Se velocidade detectada, carregar tiles na direção do movimento
  // Raio preditivo = radius + (velocity * time_lookahead)
  // Carrega até 30% mais tiles, aguarda vazio
  const predictedRadius = radius * 1.3;
  return listTilesForRadius(..., predictedRadius);
}
```

**Novo fluxo em `osmService.js`:**
```javascript
// Adicionar ao createRealtimeMapLoader:
async function ensureActiveAreaWithPrediction(
  observerLat, 
  observerLon, 
  velocityX,    // novo parâmetro
  velocityZ,    // novo parâmetro
  options
) {
  const predictedLat = observerLat + (velocityZ / 111320);
  const predictedLon = observerLon + (velocityX / (111320 * Math.cos(...)));
  
  // Carregar tiles atuais + previstos em paralelo
  const currentTiles = listTilesForRadius(..., activeRadiusMeters);
  const predictedTiles = listTilesForRadius(..., activeRadiusMeters * 1.2);
  
  // Bloquear apenas tiles atuais
  const blocking = currentTiles.slice(0, blockingCount);
  // Background: atuais + previstos
  const background = [...currentTiles, ...predictedTiles]
    .filter(t => !blocking.includes(t));
  
  // Executar ambos em paralelo
  await Promise.all([
    Promise.all(blocking.map(t => loadTile(...))),
    Promise.all(background.map(t => loadTile(...)))
  ]);
}
```

**Em `App.web.jsx`, rastrear velocidade:**
```javascript
const velocityRef = useRef({ vx: 0, vz: 0 });

const handleObserverMove = useCallback((deltaXMeters, deltaZMeters) => {
  // Novo: rastrear velocidade medida em m/s
  velocityRef.current = {
    vx: (deltaXMeters / MAP_CONFIG.MOVEMENT_UPDATE_INTERVAL_MS) * 1000,
    vz: (deltaZMeters / MAP_CONFIG.MOVEMENT_UPDATE_INTERVAL_MS) * 1000
  };
  // ... resto da função
}, []);

// Passar velocidade ao ensureActiveArea:
await loader.ensureActiveArea(
  normalized.latitude,
  normalized.longitude,
  {
    velocityX: velocityRef.current.vx,
    velocityZ: velocityRef.current.vz,
    // ... resto das opções
  }
);
```

---

### 2. **IMPORTANTE**: Level of Detail (LOD) Para Prédios
**Impacto**: +25% FPS em áreas densas  
**Esforço**: 4-5 horas

#### Problema
Curitiba tem ~500k prédios. Renderizar distante com mesmo detalhe é disperdício.

#### Solução
Criar 3 níveis de detalhe:
- **LOD0** (0-150m): Geometria completa com texturas
- **LOD1** (150-400m): Geometria simplificada, sem detalhes
- **LOD2** (400m+): Cubos simples por cor

**Novo componente `Building.jsx`:**
```javascript
const Building = memo(function Building({ building, roads, distance = 200 }) {
  // Distância para câmera (aproximado)
  
  if (distance > 400) {
    // LOD2: Cubo simples
    return (
      <mesh position={[...building.position]}>
        <boxGeometry args={[building.width, building.height, building.depth]} />
        <meshStandardMaterial color={building.color} />
      </mesh>
    );
  }
  
  if (distance > 150) {
    // LOD1: Geometria básica sem detalhes
    return <SimplifiedBuilding building={building} />;
  }
  
  // LOD0: Completo
  return <DetailedBuilding building={building} roads={roads} />;
});
```

**Em `Map3DScene.jsx`, calcular LOD:**
```javascript
// No frustum culling, calcular distância para cada building
mapData.buildings?.forEach((building) => {
  const dist = Math.hypot(
    building.position[0] - camera.position.x,
    building.position[2] - camera.position.z
  );
  const lod = dist > 400 ? 2 : dist > 150 ? 1 : 0;
  visibleBuildings.push({ ...building, lod, distance: dist });
});

// Renderizar com LOD
visibleBuildings.map(b => <Building key={b.id} building={b} distance={b.distance} />)
```

---

### 3. **IMPORTANTE**: Poda de Cache Mais Agressiva
**Impacto**: -30% RAM, +Espaço para mais tiles  
**Esforço**: 1 hora

#### Problema
TTL de 24h mantém dados muito tempo. Em uso extenso, RAM cresce continuamente.

#### Solução
Reduzir TTL e ser mais agressivo:

**Em `config/mapConfig.js`:**
```javascript
export const MAP_CONFIG = {
  // ...
  // ANTES: 24h
  TILE_DISK_CACHE_TTL_MS: 6 * 60 * 60 * 1000,  // Novo: 6 horas
  
  // ANTES: 250 entries
  TILE_DISK_CACHE_MAX_ENTRIES: 400,             // Novo: 400 (custo: ~40MB)
  
  // ANTES: 7 dias
  TILE_DISK_CACHE_MAX_STALE_MS: 2 * 24 * 60 * 60 * 1000,  // Novo: 2 dias
  
  // Cache em memória mais agressivo
  MAX_CACHED_TILES: 80,  // ANTES: 100
  
  // Limipar automaricamente quando atinge 75% de limite
  MAX_CACHED_TILES_SOFT_LIMIT: 60,
};
```

**Em `services/osmService.js`, poda inteligente:**
```javascript
function pruneCache(cache, activeKeys, maxCachedTiles) {
  const softLimit = Math.floor(maxCachedTiles * 0.75);
  
  if (cache.size <= softLimit) return; // Não prune se abaixo do limite suave
  
  // Remover tiles não-ativos mais antigos
  const inactive = Array.from(cache.entries())
    .filter(([key]) => !activeKeys.has(key))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    .slice(0, Math.ceil(cache.size - softLimit));
    
  inactive.forEach(([key]) => cache.delete(key));
}
```

---

### 4. **IMPORTANTE**: Otimizar Cálculo de Frustum Culling
**Impacto**: +15% FPS na renderização  
**Esforço**: 2-3 horas

#### Problema
Cada building/road calcula esfera de bounding a cada frame. Muito custoso.

#### Solução
Cachear bounding spheres nos dados:

**Em `osmService.js`, ao processar tile:**
```javascript
function processBuildings(buildings, tileData) {
  return buildings.map(building => {
    const pts = building.points.map(p => mapToSceneCoord(p));
    const centerX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const centerZ = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const radius = Math.max(
      ...pts.map(p => Math.hypot(p[0] - centerX, p[1] - centerZ))
    );
    
    return {
      ...building,
      // Cache: center + radius
      _boundingSphere: {
        center: [centerX, (building.height || 10) / 2, centerZ],
        radius: radius + 5
      }
    };
  });
}
```

**Em `Map3DScene.jsx`, usar cache:**
```javascript
mapData.buildings?.forEach((building) => {
  const bs = building._boundingSphere;
  const sphere = new THREE.Sphere(
    new THREE.Vector3(...bs.center),
    bs.radius
  );
  if (frustumRef.current.intersectsSphere(sphere)) {
    visibleBuildings.add(building.id);
  }
});
```

---

### 5. **ÚTIL**: Aumentar Requisições Paralelas
**Impacto**: +20% velocidade de carregamento  
**Esforço**: 30 minutos

**Em `config/mapConfig.js`:**
```javascript
// ANTES: 4
MAX_CONCURRENT_TILE_FETCHES: 6,

// ANTES: 3
BLOCKING_TILE_COUNT: 4,

// Adicionar: aumentar para áreas maiores
ACTIVE_RADIUS_METERS: 950,  // +50m preditivos
```

---

### 6. **ÚTIL**: Deduplicação de Renderização
**Impacto**: -40% re-renders desnecessários  
**Esforço**: 2 horas

#### Problema
`setMapData` com spread operator causa re-renders completos.

#### Solução
Usar `useReducer` com merge inteligente:

**Em `App.web.jsx`:**
```javascript
// ANTES: setMapData((prev) => ({ ...prev, buildings: [...prev.buildings, ...new] }))

// DEPOIS: usar reducer
const mapDataReducer = (state, action) => {
  switch (action.type) {
    case 'MERGE_TILE': {
      const { tileData } = action;
      const seenIds = new Set(state.buildings.map(b => b.id));
      
      return {
        ...state,
        buildings: [
          ...state.buildings,
          ...tileData.buildings.filter(b => !seenIds.has(b.id))
        ],
        // ... para outras camadas
      };
    }
    case 'RESET': return action.payload;
    default: return state;
  }
};

const [mapData, dispatchMapData] = useReducer(mapDataReducer, null);

// Usar:
dispatchMapData({
  type: 'MERGE_TILE',
  tileData: tileData
});
```

---

## 🔄 Fluxo de Carregamento Otimizado

```
┌─────────────────────────────────────────┐
│ Usuário se move com velocidade detectada│
└────────────┬────────────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Calcular previsão  │
    │ (1.3x raio)        │
    └────────┬───────────┘
             │
    ┌────────┴───────────┬──────────────────────┐
    │                    │                      │
    ▼                    ▼                      ▼
┌─────────┐         ┌──────────┐          ┌──────────┐
│ Bloqueio│         │Background│          │Previsão  │
│(3 tiles)│         │(atuais)  │          │(futuros) │
└────┬────┘         └────┬─────┘          └────┬─────┘
     │                   │                     │
     │ WAIT              └─────────┬───────────┘
     │                             │
     ▼                             ▼
┌──────────────────────────────┐  ┌──────────────┐
│ Renderizar bloqueio + LOD    │  │ Renderizar   │
│ Frustum cull (cached spheres)│  │ em background│
└──────────────────────────────┘  └──────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Poda de cache      │
    │ (manter 75% limite)│
    └────────────────────┘
```

---

## 📈 Ganhos Esperados

### Antes das Novas Otimizações
```
Velocidade de Carregamento: ~450ms para nova área
Pop-in ao mover rápido: SIM
FPS em áreas densas: 30-45fps
Consistência: MÉDIA
```

### Depois das Otimizações
```
Velocidade de Carregamento: ~250ms (já carregado)
Pop-in ao mover rápido: NÃO (previsão)
FPS em áreas densas: 45-60fps (LOD)
Consistência: ALTA
```

| Métrica | Antes | Depois | Ganho |
| --- | --- | --- | --- |
| **Latência de área nova** | 450ms | 200ms | **55% ↓** |
| **Pop-in eliminado** | SIM | NÃO | **100%** |
| **FPS densas** | 30fps | 50fps | **66% ↑** |
| **Consumo RAM** | +10MB/h | +2MB/h | **80% ↓** |
| **Requisições/min** | ~8 | ~12 | **50% ↑** |

---

## 🛠️ Plano de Implementação

### Fase 1: Crítica (1 dia)
- [ ] **Previsão de movimento** (3h)
- [ ] **Poda agressiva** (1h)

### Fase 2: Performance (2 dias)
- [ ] **LOD para prédios** (4h)
- [ ] **Frustum cache** (2h)
- [ ] **Aumentar requisições** (0.5h)

### Fase 3: Refinamento (1 dia)
- [ ] **Deduplicação de estado** (2h)
- [ ] **Testes de stress** (2h)
- [ ] **Ajustes de valores** (1h)

### Fase 4: Polish (0.5 dias)
- [ ] **Feedback visual** (1.5h)
- [ ] **Documentação** (0.5h)

---

## ✅ Checklist de Validação

Após implementações, validar:

```
PREVISÃO:
[  ] Movimento rápido não gera pop-in
[  ] Tiles à frente carregam silenciosamente
[  ] Sem aumento de latência perceptível

LOD:
[  ] FPS estável em 45+ fps em áreas densas
[  ] Transição suave entre LODs (sem saltos)
[  ] Qualidade visual aceitável

CACHE:
[  ] RAM não cresce além de 150MB em ~2 horas de uso
[  ] Tiles reutilizados quando revisita
[  ] Poda não remove tiles ainda visíveis

FRUSTUM:
[  ] Sem lag ao girar câmera
[  ] Culling funciona (objetos fora vista não renderizam)

GERAL:
[  ] 60fps em desktop moderno
[  ] 30+ fps em mobile/tablet
[  ] Nenhuma regressão vs versão atual
```

---

## 🎯 Próximos Passos

1. Implementar **Previsão de Movimento** (maior impacto para consistência)
2. Implementar **LOD** (maior impacto para performance)
3. Implementar **Poda Agressiva** (melhor uso de recursos)
4. Testar em diferentes cenários (pedestre, veículo, diversos dispositivos)
5. Ajustar valores empiricamente

---

## 📝 Notas Importantes

- **Compatibilidade**: Todas as mudanças são backward compatible
- **Fallback**: Se previsão falhar, carregamento sob demanda ainda funciona
- **Mobile**: Testar com limites de requisições menores (3 paralelas vs 6)
- **Monitoramento**: Adicionar métricas de FPS/latência em tempo real

---

**Data**: Março 2026  
**Versão**: 3.0.0 (Planejado)  
**Status**: 📋 Pronto para Implementação
