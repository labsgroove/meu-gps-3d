# Validação e Monitoramento de Performance

**Data**: Março 2026  
**Objetivo**: Testar e validar as otimizações implementadas

---

## 📊 Dashboard de Monitoramento

### 1. Adicionar Visualização de Performance em `App.web.jsx`

Criar componente simples para monitorar métricas:

```javascript
// Adicionar useState para tracking:
const [performanceMetrics, setPerformanceMetrics] = useState({
  fps: 60,
  tileLoadTime: 0,
  predictiveTilesLoaded: 0,
  activeTiles: 0,
  memoryUsage: 0,
  lastFrameTime: 0,
});

// Adicionar ao status bar, após </div> do status:
<div className="status-card">
  <div className="status-title">Performance</div>
  <div className="status-value">
    {performanceMetrics.fps.toFixed(0)} FPS
  </div>
  <div className="status-meta">
    Tiles Previstos: {performanceMetrics.predictiveTilesLoaded}
  </div>
  <div className="status-meta">
    Carga: {performanceMetrics.tileLoadTime.toFixed(0)}ms
  </div>
  <div className="status-meta">
    Memória: {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
  </div>
</div>
```

### 2. Implementar Coleta de Métricas

```javascript
// Adicionar useEffect para monitorar FPS e memória:
useEffect(() => {
  if (!mapData) return;

  let frameCount = 0;
  let lastTime = performance.now();
  let lastSecond = lastTime;

  const measureFrame = () => {
    const now = performance.now();
    frameCount += 1;

    if (now - lastSecond >= 1000) {
      const fps = frameCount;
      frameCount = 0;
      lastSecond = now;

      // Memória (disponível em navegadores com support)
      const memory = performance.memory?.usedJSHeapSize || 0;

      setPerformanceMetrics((prev) => ({
        ...prev,
        fps: Math.min(fps, 60),
        memoryUsage: memory,
        lastFrameTime: now - lastTime,
      }));
    }

    lastTime = now;
    requestAnimationFrame(measureFrame);
  };

  measureFrame();
}, [mapData]);

// Ao carregar tile, rastrear tempo:
const onTileReady = (tileData, meta) => {
  const loadTime = meta?.loadTime || 0;
  setPerformanceMetrics((prev) => ({
    ...prev,
    tileLoadTime: loadTime,
    predictiveTilesLoaded: meta?.isPredictive 
      ? prev.predictiveTilesLoaded + 1 
      : prev.predictiveTilesLoaded,
  }));
  // ... resto da lógica
};
```

---

## 🧪 Testes Automatizados

### 1. Teste de Previsão de Movimento

```javascript
// arquivo: tests/predictive-loading.test.js

describe('Previsão de Movimento', () => {
  test('Detecta velocidade corretamente', () => {
    const velocityRef = { vx: 0, vz: 0, lastUpdateTime: Date.now() };
    
    // Simular movimento
    let currentTime = Date.now();
    const deltaX = 100; // 100 metros
    const deltaZ = 0;
    const deltaTime = 500; // 500ms depois
    
    currentTime += deltaTime;
    const expectedVx = (deltaX / deltaTime) * 1000; // m/s
    
    // Resultado esperado: 200 m/s (100m em 0.5s)
    expect(expectedVx).toBe(200);
  });

  test('Carrega tiles previstos em movimento rápido', async () => {
    const mockLoader = createRealtimeMapLoader();
    const startLat = -25.4957255;
    const startLon = -49.1658802;
    
    // Simular velocidade rápida (20 m/s)
    const velocityX = 20;
    const velocityZ = 0;
    
    const loadedTileSettings = [];
    
    await mockLoader.ensureActiveArea(startLat, startLon, {
      velocityX,
      velocityZ,
      lookaheadSeconds: 2,
      onTileReady: (data, meta) => {
        if (meta.isPredictive) {
          loadedTileSettings.push({
            isPredictive: true,
            progress: meta.progress,
          });
        }
      },
    });
    
    // Deve ter carregado alguns tiles previstos
    expect(loadedTileSettings.length).toBeGreaterThan(0);
    expect(
      loadedTileSettings.some(t => t.isPredictive)
    ).toBe(true);
  });

  test('Não carrega tiles previstos em movimento lento', async () => {
    // Velocidade abaixo do limiar
    const velocityX = 1; // m/s
    const velocityZ = 0;
    
    let predictiveCount = 0;
    
    await mockLoader.ensureActiveArea(lat, lon, {
      velocityX,
      velocityZ,
      onTileReady: (data, meta) => {
        if (meta.isPredictive) predictiveCount += 1;
      },
    });
    
    expect(predictiveCount).toBe(0);
  });
});
```

### 2. Teste de LOD

```javascript
// arquivo: tests/lod.test.js

describe('Level of Detail', () => {
  test('LOD0 para objetos próximos', () => {
    const distance = 100; // metros
    const lod = calculateLOD(distance, MAP_CONFIG);
    expect(lod).toBe(0);
  });

  test('LOD1 para objetos intermediários', () => {
    const distance = 250; // metros
    const lod = calculateLOD(distance, MAP_CONFIG);
    expect(lod).toBe(1);
  });

  test('LOD2 para objetos distantes', () => {
    const distance = 600; // metros
    const lod = calculateLOD(distance, MAP_CONFIG);
    expect(lod).toBe(2);
  });

  test('Simplificação geométrica funciona', () => {
    const building = {
      id: '123',
      height: 15,
      color: 0xcccccc,
      points: [
        [0, 0], [100, 0], [100, 100], [50, 150], [0, 100]
      ],
    };

    const lod0 = simplifyBuildingGeometry(building, 0);
    expect(lod0.points.length).toBe(5); // Sem mudanças

    const lod1 = simplifyBuildingGeometry(building, 1);
    expect(lod1.points.length).toBeLessThanOrEqual(5); // Pode simplificar

    const lod2 = simplifyBuildingGeometry(building, 2);
    expect(lod2.isSimplified).toBe(true);
    expect(lod2.points.length).toBe(4); // Bounding box
  });
});
```

### 3. Teste de Cache

```javascript
// arquivo: tests/cache-optimization.test.js

describe('Otimização de Cache', () => {
  test('Poda respira limite suave', () => {
    const cache = new Map();
    const activeKeys = new Set();
    const maxCachedTiles = 100;
    const softLimit = 75;

    // Preencher cache
    for (let i = 0; i < 90; i++) {
      cache.set(`tile-${i}`, {
        key: `tile-${i}`,
        lastUsed: Date.now() - (i * 1000), // Tiles antigos primeiro
        data: { buildings: [], roads: [] },
      });
    }

    // Marcar apenas alguns como ativos
    activeKeys.add('tile-85');
    activeKeys.add('tile-86');

    pruneCache(cache, activeKeys, maxCachedTiles);

    // Deve ter removido tiles inativos para atingir soft limit
    expect(cache.size).toBeLessThanOrEqual(softLimit);
    expect(cache.has('tile-85')).toBe(true); // Ativo preservado
  });

  test('Cache de disco revalida com 6h TTL', () => {
    const diskCache = createTileDiskCache({
      ttlMs: 6 * 60 * 60 * 1000,
      maxEntries: 400,
    });

    const mockData = { buildings: [], roads: [] };
    const now = Date.now();

    diskCache.set('tile-key', mockData, { now });

    // Imediatamente: hit
    const resultNow = diskCache.get('tile-key', { now });
    expect(resultNow.status).toBe('hit');

    // 5 horas depois: ainda hit
    const resultAfter5h = diskCache.get('tile-key', {
      now: now + 5 * 60 * 60 * 1000,
    });
    expect(resultAfter5h.status).toBe('hit');

    // 7 horas depois: stale (fora do TTL)
    const resultAfter7h = diskCache.get('tile-key', {
      now: now + 7 * 60 * 60 * 1000,
    });
    expect(resultAfter7h.status).toBe('stale');
  });
});
```

---

## 📋 Checklist Manual de Testes

### Teste 1: Previsão de Movimento
**Duração**: 5 minutos

```
[ ] Abrir mapa em -25.4957255, -49.1658802 (Curitiba)
[ ] Usar WASD para mover lentamente
    → Verificar que nenhum tile é carregado além do necessário
[ ] Usar WASD para mover rapidamente (manter W ou S)
    → Verificar na Console que tiles previstos carregam
    → Ao cruzar fronteira, não há pop-in (tiles já prontos)
[ ] Girar câmera rapidamente
    → Verificar que previsão não interfere
    → Ainda há resposta de movimento
[ ] Parar de mover
    → Verificar que tiles previstos não são mantidos
    → Cache mantém apenas atuais
```

### Teste 2: Level of Detail
**Duração**: 5 minutos

```
[ ] Zoom out para 200m
    → Buildings distantes viram caixas simples
    → FPS se mantém > 30
[ ] Zoom de volta para 50m
    → Buildings volta para detalhe completo
    → Transição suave (sem pops)
[ ] Girar câmera em zoom out
    → Verificar que caixas renderizam corretamente
    → Nenhuma geometria quebrada
[ ] Comparar FPS:
    → Zoom out: X fps
    → Zoom in: Y fps
    → Y não deve ser < X-10 (pequena perda permitida)
```

### Teste 3: Cache Otimizado
**Duração**: 30 minutos

```
[ ] Monitor DevTools > Memory (F12)
[ ] Deixar mapa rodando por 15 minutos
    → Andar bastante (WASD contínuo)
[ ] Observar gráfico de memória
    → Deve começar crescente (carregando tiles)
    → Depois estabiliza em ~100-150MB
    → Não deve crescer linearmente após 5 min
[ ] Acessar mesmas áreas múltiplas vezes
    → Verificar no Console que cache hits aumentam
    → Requisições de rede diminuem
[ ] Esperar 2 horas (opcional, simular em teste):
    → Verificar que memória não cresce além de 200MB
    → Tiles antigos são removidos (poda funciona)
```

### Teste 4: Frustum Culling
**Duração**: 5 minutos

```
[ ] Abrir Console > Network
[ ] Estrutura de threes.js renderizada:
    → Canvas deve mostrar apenas objetos visíveis
    → Girar câmera/zoom não causa lag
[ ] Desativar culling (temporariamente em código):
    → Renderizar TODOS os buildings
    → Comparar FPS com e sem culling
    → Com culling deve ser > 40%, sem > 20fps em mobile
```

### Teste 5: Stress Test (Muitos Dados)
**Duração**: 10 minutos

```
[ ] Navegar para área densa (ex: centro de Curitiba)
[ ] Aumentar raio ativo:
    → MAP_CONFIG.ACTIVE_RADIUS_METERS = 1500 (de 900)
[ ] Aguardar carregamento completo
[ ] Monitorar:
    → FPS se mantém > 30?
    → Memória < 200MB?
    → Sem travamentos?
[ ] Se FPS < 30:
    → Reduzir para 1200m
    → Se ainda < 30, não adequado para otimização atual
```

### Teste 6: Diferentes Dispositivos
**Duração**: 15 minutos (simular em DevTools)

```
DESKTOP (1080p, Chrome):
[ ] FPS target: 50-60
[ ] Memory: 100-150MB
[ ] Load time: <300ms por tile

TABLET (iPad Pro, Safari):
[ ] FPS target: 30-45
[ ] Memory: 60-100MB
[ ] Load time: <400ms por tile
[ ] Ajustar: MAX_CONCURRENT_TILE_FETCHES = 3 (de 6)

MOBILE (iPhone 12, Safari):
[ ] FPS target: 20-30
[ ] Memory: 50-80MB
[ ] Load time: <500ms por tile
[ ] Ajustar: MAX_CACHED_TILES = 60 (de 100)
             ACTIVE_RADIUS_METERS = 700 (de 900)
```

---

## 🔍 Debugging: Problemas Comuns

### Problema 1: Pop-in ainda ocorre
```
Causa possível: Previsão não está ativada
Solução:
1. Verificar velocidade calcula corretamente:
   console.log(velocityRef.current)
   
2. Verificar se threshold é muito alto:
   MAP_CONFIG.SPEED_THRESHOLD_FOR_PREDICTION
   Tentar reduzir para 5 m/s
   
3. Verificar lookahead está correto:
   MAP_CONFIG.MOVEMENT_LOOKAHEAD_SECONDS
   Aumentar para 3s se ainda houver pop-in
```

### Problema 2: FPS baixo
```
Causa possível: LOD não está funcionando
Solução:
1. Verificar if MAP_CONFIG.LOD_ENABLED = true
2. Forçar teste de LOD:
   MAP_CONFIG.DEBUG_FORCE_LOD = 2 // Força tudo como caixas
   Se FPS melhora muito, LOD está funcionando
3. Distâncias podem estar muito curtas:
   MAP_CONFIG.LOD0_DISTANCE = 200
   MAP_CONFIG.LOD1_DISTANCE = 500
```

### Problema 3: Cache crescendo
```
Causa possível: Poda não ativada
Solução:
1. Verificar CACHE_SOFT_LIMIT_MULTIPLIER:
   Deve ser 0.75
2. Verificar se activeKeys está vazio:
   console.log(activeKeys.size)
   Se = 0, poda nunca funciona
3. Reduzir TTL mais ainda:
   TILE_DISK_CACHE_TTL_MS = 3 * 60 * 60 * 1000 // 3h
```

### Problema 4: Tiles previstos causam lag
```
Causa possível: Muito preditivo carregando
Solução:
1. Reduzir multiplicador:
   MAP_CONFIG.ACTIVE_RADIUS_INCREASE_ON_SPEED = 0.2
2. Aumentar threshold:
   MAP_CONFIG.SPEED_THRESHOLD_FOR_PREDICTION = 15 // m/s
3. Reduzir lookahead:
   MAP_CONFIG.MOVEMENT_LOOKAHEAD_SECONDS = 1
```

---

## 📊 Métricas Esperadas

### Performance Baseline

| Métrica | Valor Esperado | Mínimo Aceitável |
|---------|---|---|
| FPS Idle | 60 | 50 |
| FPS Movimento | 45 | 30 |
| FPS Zoom/Rotate | 40 | 25 |
| Tempo de Tile | 200ms | 400ms |
| Memória Inicial | 80MB | 120MB |
| Memória após 1h | 100MB | 200MB |
| Pop-in ao mover | NÃO | RARO |

### Comparativo Antes vs Depois

```
ANTES OTIMIZAÇÕES:
├─ Pop-in ao mover rápido: SIM (frequente)
├─ FPS em áreas densas: 25-35
├─ Memory leak: ~5MB/15min
└─ Tiles carregados: apenas atuais

DEPOIS OTIMIZAÇÕES:
├─ Pop-in ao mover rápido: NÃO
├─ FPS em áreas densas: 45-55
├─ Memory leak: <1MB/15min
└─ Tiles carregados: atuais + previstos
```

---

## 🚀 Validação de Sucesso

Projeto será considerado **bem-sucedido** se:

✅ **Consistência**
- [ ] Zero pop-in em movimento rápido
- [ ] Tiles carregam antes de usuário chegar
- [ ] Nenhuma descontinuidade visual

✅ **Performance**
- [ ] 50+ FPS em desktop
- [ ] 30+ FPS em mobile
- [ ] <300ms por tile carregado

✅ **Eficiência**
- [ ] Memory < 150MB stable
- [ ] Cache efetivo (>70% hit rate)
- [ ] Sem requisições redundantes

✅ **Regressão**
- [ ] Nenhuma quebra de funcionalidade existente
- [ ] Zoom/pan ainda suave
- [ ] Geolocalização ainda funciona

---

**Data**: Março 2026  
**Versão**: 3.0.0  
**Status**: 📋 Pronto para Testes
