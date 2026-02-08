// docs/TROUBLESHOOTING.md
# Guia de Troubleshooting - Meu GPS 3D

## ❌ Problemas Comuns e Soluções

### 1. "Mapa 3D não carrega / fica em branco"

**Causas Possíveis:**
- GPS desativado
- Sem conexão à internet
- Permissões não concedidas
- API OSM inativa

**Soluções:**
```javascript
// Verificar localização
console.log('Location:', location);

// Verificar dados do mapa
console.log('Map Data:', mapData);

// Ativar logs detalhados
// Em App.js
useEffect(() => {
  console.log('Status:', loading, error);
  console.log('Location:', location);
}, [loading, error, location]);
```

### 2. "Erro 500 da API Overpass"

**Causa:** Servidor Overpass sobrecarregado

**Solução:**
```javascript
// Esperar e retry automático
async function fetchWithRetry(lat, lon, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchMapData(lat, lon);
    } catch (error) {
      if (i < retries - 1) {
        // Esperar 2^i segundos
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }
}
```

### 3. "Performance muito lenta / Travamentos"

**Causas Possíveis:**
- Muitos prédios sendo renderizados
- Muita simplificação de geometria
- Materiais complexos demais

**Soluções:**
```javascript
// Reduzir raio de busca
const data = await fetchMapData(lat, lon, 0.3); // De 0.8

// Aumentar distância de atualização
distanceInterval: 50,

// Usar geometria simplificada
const simplifiedPoints = simplifyPath(points, 0.05);

// Usar materiais mais simples
<meshBasicMaterial color={building.color} />
```

### 4. "Câmera não responde ao toque"

**Causas Possíveis:**
- OrbitControls não inicializado
- Touch events bloqueados
- Canvas não focado

**Soluções:**
```javascript
// Verificar OrbitControls
if (controlsRef.current) {
  console.log('Controls initialized');
  controlsRef.current.update();
}

// Garantir que Canvas está focado
<Canvas
  gl={{
    antialias: true,
    alpha: true,
  }}
  onCreated={(state) => {
    console.log('Canvas created');
  }}
/>

// Habilitar touch events explicitamente
<Canvas
  onPointerMove={(e) => e.stopPropagation()}
  onPointerDown={(e) => e.stopPropagation()}
/>
```

### 5. "Prédios com cores estranhas ou não aparecem"

**Soluções:**
```javascript
// Verificar cores em hexa válidas
console.log(building.color.toString(16)); // Deve ser 6 dígitos

// Verificar se tags existem
console.log(building.tags);

// Usar cor padrão se inválida
const color = building.color || 0xcccccc;
```

### 6. "Erro: Cannot read property 'geometry' of undefined"

**Causa:** Geometria não criada corretamente

**Solução:**
```javascript
// Adicionar verificação
if (!geometry || !geometry.vertices || geometry.vertices.length === 0) {
  return null; // Pular renderização
}
```

### 7. "App fecha ao mudar de localização"

**Causa:** Atualização de estado durante renderização

**Solução:**
```javascript
// Usar useCallback para evitar re-renders desnecessários
const handleLocationChange = useCallback(async (coords) => {
  setLocation(coords);
  
  // Carregar dados em background
  setTimeout(async () => {
    const data = await fetchMapData(coords.latitude, coords.longitude);
    setMapData(data);
  }, 100);
}, []);
```

### 8. "Memory leak warning"

**Solução:**
```javascript
// Em components, limpar recursos
useEffect(() => {
  const subscription = Location.watchPositionAsync(...);
  
  return () => {
    if (subscription) {
      subscription.remove();
    }
  };
}, []);
```

---

## 🔍 Debugging Avançado

### Usar React DevTools
```bash
npm install --save-dev react-devtools
react-devtools
```

### Logs Estruturados
```javascript
const logger = {
  log: (tag, message, data) => {
    console.log(`[${tag}] ${message}`, data);
  },
  error: (tag, message, error) => {
    console.error(`[${tag}] ${message}`, error);
  }
};

logger.log('MAP', 'Carregando dados', { lat, lon });
```

### Teste com Coordenadas Conhecidas
```javascript
const TEST_LOCATIONS = {
  'São Paulo': { latitude: -23.5505, longitude: -46.6333 },
  'Rio de Janeiro': { latitude: -22.9068, longitude: -43.1729 },
  'Belo Horizonte': { latitude: -19.9167, longitude: -43.9345 },
};
```

---

## 📋 Checklist de Debug

- [ ] GPS está ativado?
- [ ] Internet está conectada?
- [ ] Permissões foram concedidas?
- [ ] API OSM está online?
- [ ] Console sem erros?
- [ ] Memory aceitável?
- [ ] FPS acima de 30?
- [ ] Dados do mapa válidos?

---

## 🚨 Erros Comuns no Console

| Erro | Causa | Solução |
|------|-------|---------|
| `Cannot read property 'latitude'` | Location é null | Aguardar GPS |
| `Failed to fetch from Overpass` | Sem internet | Verificar conexão |
| `OrbitControls is not defined` | Import faltando | `import { OrbitControls }` |
| `NaN values in geometry` | Coordenadas inválidas | Validar dados OSM |
| `Memory limit exceeded` | Muitos elementos | Reduzir raio busca |

---

## 🔗 Recursos para Debug

- [React DevTools](https://github.com/facebook/react-devtools)
- [Three.js Inspector](https://chrome.google.com/webstore/detail/threejs-inspector/dnhjfpomdbajcfn.../)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Expo Documentation](https://docs.expo.dev/)

---

## 💬 Procurando Ajuda?

1. Verificar console do navegador (F12)
2. Ativar modo debug em App.js
3. Testar com coordenadas conhecidas
4. Verificar conexão de internet
5. Reiniciar app e GPS
6. Limpar cache (npm cache clean)
7. Reinstalar dependências (rm -rf node_modules && npm install)
