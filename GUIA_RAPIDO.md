// GUIA_RAPIDO.md
# Guia Rápido - Meu GPS 3D

## 🎬 Começar Rápido

### 1. Instalar dependências
```bash
npm install
```

### 2. Rodar no Android
```bash
npm run android
```

### 3. Rodar no iOS
```bash
npm run ios
```

### 4. Rodar na Web (teste)
```bash
npm run web
```

---

## 🗂️ Estrutura do Projeto

```
meu-gps-3d/
├── App.js                    ← Componente principal
├── components/
│   └── Map3DScene.js        ← Renderização 3D
├── services/
│   └── osmService.js        ← Integração OpenStreetMap
├── utils/
│   └── geoUtils.js          ← Funções geoespaciais
├── config/
│   └── mapConfig.js         ← Configurações centralizadas
├── __tests__/
│   └── mapService.test.js   ← Testes
└── package.json             ← Dependências
```

---

## 🎮 Controles

### Desktop/Web
| Ação | Controle |
|------|----------|
| Rotacionar | Arrastar com mouse esquerdo |
| Zoom In/Out | Roda do mouse |
| Mover câmera | Clique direito + arrastar |

### Mobile
| Ação | Controle |
|------|----------|
| Rotacionar | Um dedo + arrastar |
| Zoom | Dois dedos + pinça |
| Mover câmera | Dois dedos + arrastar |

---

## 🔧 Configurações Principais

Edite `config/mapConfig.js` para:

```javascript
// Raio de busca (em km)
SEARCH_RADIUS_KM: 0.8

// Zoom inicial
INITIAL_ZOOM: 80

// Alturas dos prédios
DEFAULT_BUILDING_HEIGHT: 12
```

Edite `App.js` para:

```javascript
// Distância mínima para atualizar
distanceInterval: 10

// Raio de busca do mapa
const data = await fetchMapData(lat, lon, 0.8);
```

---

## 🎨 Adicionar Cores Personalizadas

### Em `config/mapConfig.js`:

```javascript
BUILDING_COLORS: {
  residential: 0xd4a574,  // Bege
  hospital: 0xff6b6b,     // Vermelho
  // Adicione mais aqui
}

ROAD_COLORS: {
  motorway: 0xff6b6b,     // Vermelho
  residential: 0xffffff,  // Branco
}

AMENITY_COLORS: {
  hospital: 0xff0000,     // Vermelho
  school: 0x0000ff,       // Azul
}
```

---

## 🐛 Debugging

### Ver logs de localização
```javascript
// Em App.js
console.log('Localização:', location);
```

### Ver dados do mapa
```javascript
// Em App.js
console.log('Mapa:', mapData);
```

### Testar API OSM
```bash
node __tests__/mapService.test.js
```

---

## 📊 Performance

### Otimizações Implementadas
- ✅ Simplificação de caminhos
- ✅ Damping na câmera
- ✅ Fog (névoa) para culling
- ✅ Materiais otimizados

### Dicas
1. Reduzir `SEARCH_RADIUS_KM` para áreas com muitos prédios
2. Aumentar `UPDATE_DISTANCE_INTERVAL` para atualizar menos
3. Usar `MAX_BUILDING_HEIGHT` para limitar outliers

---

## 🌍 API Utilizada

**OpenStreetMap + Overpass API**
- URL: https://overpass-api.de/api/interpreter
- Grátis: ✅ Sim
- Rate Limit: ~100 req/min
- Dados: Prédios, ruas, amenidades

---

## 🚀 Próximas Melhorias

- [ ] Cache de dados
- [ ] Texturas nos prédios
- [ ] Modo AR (Augmented Reality)
- [ ] Pathfinding
- [ ] Modelos 3D dinâmicos
- [ ] Modo noturno

---

## ⚠️ Possíveis Problemas

### Mapa não carrega
→ Verifique localização GPS e internet

### Prédios não aparecem
→ Reduzir `SEARCH_RADIUS_KM` ou trocar localização

### Performance lenta
→ Reduzir raio de busca ou aumentar `UPDATE_DISTANCE_INTERVAL`

### Câmera travada
→ Verify `enableDamping` and `dampingFactor` em `Map3DScene.js`

---

## 📞 Suporte

Dúvidas? Procure em:
- [Three.js Docs](https://threejs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [OpenStreetMap Wiki](https://wiki.openstreetmap.org)
- [Overpass API Doc](https://wiki.openstreetmap.org/wiki/Overpass_API)
