# Guia de Otimizações de Desempenho 3D

## ✅ Otimizações Implementadas

1. **Memoização de Componentes** 
   - `Building`, `Road`, e `Amenity` agora usam `React.memo()`
   - Evita recalculação desnecessária quando props não mudam

2. **Cache de Cálculos de Orientação**
   - Orientação de prédios é cacheada baseada em pontos
   - Grande redução em cálculos repetitivos

3. **Renderização Canvas Otimizada**
   - ✖️ `antialias: false` - desativar em tempo real (pode reativar em build)
   - ✅ `powerPreference: 'high-performance'` - força GPU
   - ✅ Controle de `pixelRatio` para não renderizar além da tela

4. **Iluminação Simplificada**
   - ✖️ Removidas 2 luzes extras (directionalLight, hemisphereLight desnecessárias)
   - ✅ Uma única `ambientLight` com intensidade máxima
   - ✖️ Desativar shadows em materiais

5. **Materiais Otimizados**
   - Solo agora usa `meshBasicMaterial` (sem iluminação = mais rápido)
   - Todos os materiais têm `shadowMap: false`

## 🚀 Otimizações Avançadas (Implementar se necessário)

### 1. **LOD (Level of Detail) - Prédios Distantes**
```javascript
// Para prédios muito distantes, renderizar uma caixa simples
function BuildingOptimized({ building, roads, cameraDistance }) {
  const distance = Math.sqrt(building.center[0]**2 + building.center[1]**2);
  
  if (distance > 200) {
    // Renderizar caixa simples
    return <mesh position={...}><boxGeometry /><meshBasicMaterial color={...} /></mesh>;
  }
  
  // Renderizar detalhado
  return <Building building={building} roads={roads} />;
}
```

### 2. **Instancing para Amenidades Iguais**
Se houver muitas amenidades do mesmo tipo:
```javascript
import { Instances, Instance } from '@react-three/drei';

// Ao invés de mapear cada amenidade
{amenities.map(a => <Amenity key={a.id} {...a} />)}

// Usar Instances
<Instances limit={1000}>
  <cylinderGeometry args={[0.8, 0.8, 2, 8]} />
  <meshBasicMaterial color={0x00ffff} />
  {amenities.map(a => (
    <Instance key={a.id} position={[...]} />
  ))}
</Instances>
```

### 3. **Culling (Não renderizar o que não vê)**
```javascript
// Na SceneContent
<OrbitControls
  ref={controlsRef}
  enableDamping
  dampingFactor={0.05}
  autoRotate={false}
  enableZoom={true}
  enablePan={true}
  maxDistance={1000}
  minDistance={10}
/>
```

### 4. **Otimizar Geometria de Estradas**
```javascript
// Reduzir segmentos para estradas distantes
const maxSegments = distance > 300 ? 5 : 20;
for (let i = 0; i < pts.length - 1; i += Math.ceil((pts.length - 1) / maxSegments)) {
  // renderizar apenas segmentos principais
}
```

### 5. **Usar WebGL Compression**
No Vite config:
```javascript
// vite.config.js - Para build
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('three')) return 'three';
          if (id.includes('react-three')) return 'r3f';
        }
      }
    }
  }
});
```

### 6. **Defer Rendering com requestIdleCallback**
Para dados grandes, carregar gradualmente:
```javascript
// osmService.js
export async function fetchMapDataProgressive(lat, lon, radius) {
  const data = await fetchMapData(lat, lon, radius);
  
  // Renderizar em chunks
  return new Promise(resolve => {
    const chunks = {
      roads: [],
      buildings: [],
      amenities: []
    };
    
    let idx = 0;
    const processChunk = () => {
      // Processar 10 prédios por frame
      for (let i = 0; i < 10 && idx < data.buildings.length; i++, idx++) {
        chunks.buildings.push(data.buildings[idx]);
      }
      
      if (idx < data.buildings.length) {
        requestIdleCallback(processChunk);
      } else {
        resolve(chunks);
      }
    };
    
    requestIdleCallback(processChunk);
  });
}
```

### 7. **Monitorar Performance com Stats**
```javascript
// Adicionar ao App.web.jsx
import Stats from 'three/examples/jsm/libs/stats.module.js';

// Em Map3DScene.web.jsx useFrame
const stats = new Stats();

useFrame(() => {
  stats.update();
});
```

### 8. **Cachear Geometrias Reusáveis**
```javascript
// Ao invés de criar nova geometria cada vez
const geometryCache = new Map();

function getCachedGeometry(key, createFn) {
  if (!geometryCache.has(key)) {
    geometryCache.set(key, createFn());
  }
  return geometryCache.get(key);
}

// Usar para pontos e geometrias frequentes
const roadGeometry = getCachedGeometry(
  `road-${road.width}`,
  () => new THREE.BufferGeometry()
);
```

## 📊 Métricas a Monitorar

- **FPS (Frames Per Second)**: Deve estar acima de 30 fps
- **Memory Usage**: Monitorar com DevTools
- **Draw Calls**: Menos é melhor (evitar > 200)
- **Vertex Count**: Evitar > 1 milhão de vértices

## 🔍 Como Debugar

1. Chrome DevTools → Performance → Record
2. Procure por:
   - ✅ Frames abaixo de 16.67ms (60fps)
   - ❌ JavaScript longo
   - ❌ Rendering longo

3. Usar three.js Inspector:
```javascript
// Adicionar ao console
import { Inspector } from 'three/examples/jsm/libs/Inspector.js';
Inspector.attach(scene, renderer, camera);
```

## 🎯 Próximas Prioridades

1. Se > 5000 prédios: Implementar LOD
2. Se < 20 FPS: Implementar culling
3. Se > 500 amenidades iguais: Implementar instancing
4. Se tempo de carregamento > 3s: Usar progressive rendering
