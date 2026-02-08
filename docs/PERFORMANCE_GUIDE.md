// docs/PERFORMANCE_GUIDE.md
# Guia de Performance - Meu GPS 3D

## 📊 Monitoramento de Performance

### Ferramentas Recomendadas
- React DevTools Profiler
- Chrome DevTools Performance
- Three.js Inspector
- Expo DevTools

### Métricas Importantes
- **FPS** (Frames Per Second): Manter acima de 30 FPS
- **Memory**: Monitorar uso de memória
- **Draw Calls**: Minimizar renderizações desnecessárias
- **Geometry Count**: Quantidade de elementos renderizados

---

## 🚀 Otimizações Implementadas

### 1. **Simplificação de Caminhos**
```javascript
// Em osmService.js
const simplifiedPath = simplifyPath(points, 0.01);
```
Reduz o número de pontos sem perder qualidade visual.

### 2. **Fog/Névoa**
```javascript
<fog attach="fog" args={[0x87ceeb, 100, 2000]} />
```
Culling automático: objetos distantes não são renderizados.

### 3. **Damping na Câmera**
```javascript
enableDamping: true,
dampingFactor: 0.05,
```
Reduz processamento desnecessário de eventos.

### 4. **Limites de Renderização**
```javascript
MAX_BUILDING_HEIGHT: 200
SEARCH_RADIUS_KM: 0.8
```

---

## ⚙️ Otimizações Recomendadas

### Para Dispositivos Antigos

**1. Reduzir Raio de Busca**
```javascript
// Em App.js
const data = await fetchMapData(lat, lon, 0.5); // De 0.8 para 0.5
```

**2. Aumentar Intervalo de Atualização**
```javascript
// Em App.js
distanceInterval: 25, // De 10 para 25 metros
UPDATE_TIME_INTERVAL: 2000, // De 1000 para 2000ms
```

**3. Simplificar Materiais**
```javascript
// Em components/Map3DScene.js
<meshBasicMaterial color={building.color} />
// Em vez de meshStandardMaterial
```

**4. Reduzir Qualidade de Sombra**
```javascript
// Em components/Map3DScene.js
shadow-mapSize-width={1024} // De 2048
shadow-mapSize-height={1024}
```

### Para Melhor Qualidade Visual

**1. Aumentar Raio de Busca**
```javascript
const data = await fetchMapData(lat, lon, 1.0);
```

**2. Adicionar Texturas**
```javascript
const texture = new THREE.TextureLoader().load('brick.jpg');
<meshStandardMaterial map={texture} />
```

**3. Aumentar Qualidade de Sombra**
```javascript
shadow-mapSize-width={4096}
shadow-mapSize-height={4096}
```

**4. Adicionar Post-Processing**
```javascript
import { EffectComposer, Bloom } from '@react-three/postprocessing';
```

---

## 🎯 Estratégias de Otimização

### Level of Detail (LOD)
```javascript
function renderBuilding(building, cameraDistance) {
  if (cameraDistance > 500) {
    // Renderizar com geometria simplificada
    return <simplifiedGeometry />;
  }
  // Renderizar com geometria completa
  return <detailedGeometry />;
}
```

### Culling Manual
```javascript
function isInFrustum(position, camera) {
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
  );
  return frustum.containsPoint(new THREE.Vector3(...position));
}
```

### Instancing
```javascript
// Para renderizar muitos objetos idênticos
const instancedGeometry = new THREE.InstancedBufferGeometry();
const positions = new THREE.InstancedBufferAttribute(new Float32Array(...), 3);
instancedGeometry.attributes.position = positions;
```

---

## 📈 Benchmarking

### Script de Teste
```bash
# Medir FPS
npm run test:performance

# Medir Memória
npm run test:memory
```

### Métricas Base (Deviceindependente)
| Métrica | Alvo | Limite |
|---------|------|--------|
| FPS | 60 | 30 |
| Memory | < 200MB | 500MB |
| Draw Calls | < 1000 | 5000 |
| Geometry Objects | < 500 | 2000 |

---

## 🔧 Checklist de Otimização

### Antes de Deploy
- [ ] FPS stable acima de 30
- [ ] Memory usage < 300MB
- [ ] Draw calls < 1000
- [ ] Raio de busca configurado
- [ ] Timeouts configurados
- [ ] Imagens otimizadas

### Monitoramento Contínuo
- [ ] Logar FPS periodicamente
- [ ] Alertar sobre memory leaks
- [ ] Rastrear comportamento de usuário
- [ ] Coletar dados de performance

---

## 🛠️ Ferramentas Úteis

### React Performance Profiler
```javascript
import { Profiler } from 'react';

<Profiler id="Map3D" onRender={onRenderCallback}>
  <Map3DScene />
</Profiler>
```

### Three.js Stats
```javascript
import Stats from 'three/examples/jsm/libs/stats.module.js';

const stats = new Stats();
renderer.domElement.appendChild(stats.dom);
```

### Chrome DevTools
1. Abrir DevTools (F12)
2. Ir para Performance tab
3. Gravar enquanto usa a app
4. Analisar timeline

---

## 📝 Logs de Performance

### Registrar FPS
```javascript
let frames = 0;
setInterval(() => {
  console.log(`FPS: ${frames}`);
  frames = 0;
}, 1000);

useFrame(() => frames++);
```

### Registrar Memória
```javascript
if (performance.memory) {
  console.log(`Memory: ${performance.memory.usedJSHeapSize / 1048576}MB`);
}
```

---

## 🎓 Recursos Adicionais

- [Three.js Performance Guide](https://threejs.org/docs/#manual/en/introduction/Performance)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [Web Performance Working Group](https://www.w3.org/webperf/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
