# Meu GPS 3D - Visualizador de Mapa 3D em Tempo Real

Aplicação React Native que exibe um ambiente 3D espelhado em tempo real, com dados de mapa do OpenStreetMap integrados via API Overpass.

## 🎯 Funcionalidades

### ✅ Implementadas
- **Mapa 3D em Tempo Real**: Renderização dinâmica de prédios, ruas e amenidades baseado na sua localização GPS
- **Localização Contínua**: Monitoramento de posição com atualização automática do mapa
- **Controles de Câmera**:
  - **Arrastar com mouse**: Rotaciona a visualização
  - **Scroll/Roda do mouse**: Zoom in/out
  - **Clique direito + arrastar**: Pan (movimento lateral)
- **Cores Diferenciadas**:
  - **Prédios**: Diferentes cores por tipo (residencial, comercial, industrial, etc.)
  - **Ruas**: Cores por tipo (motorway, primary, secondary, residential)
  - **Amenidades**: Cores por tipo (hospital, escola, restaurante, parque, etc.)
- **Iluminação Realista**: Ambient light, directional light e hemisphere light
- **Grid de Referência**: Visualização para orientação espacial
- **Informações em Tempo Real**: Exibe coordenadas, quantidade de prédios e ruas carregados

## 📁 Estrutura de Arquivos

```
meu-gps-3d/
├── App.js                          # Componente principal
├── components/
│   └── Map3DScene.js              # Cena 3D com Three.js/Fiber
├── services/
│   └── osmService.js              # Integração com OpenStreetMap
├── utils/
│   └── geoUtils.js                # Utilitários geoespaciais
├── package.json                    # Dependências
└── README.md                       # Este arquivo
```

## 🚀 Instalação e Uso

### Pré-requisitos
- Node.js 16+
- npm ou yarn
- Dispositivo/emulador Android ou iOS com GPS

### Instalação

```bash
# Clonar ou acessar o projeto
cd meu-gps-3d

# Instalar dependências
npm install

# Para Android
npm run android

# Para iOS
npm run ios

# Para Web (teste)
npm run web
```

### Requisições de Permissão
- **GPS**: Necessário para localização em tempo real
- **Acesso à Internet**: Para buscar dados do OpenStreetMap

## 🎨 Esquema de Cores

### Tipos de Prédios
| Tipo | Cor | Hex |
|------|-----|-----|
| Residencial | Bege | `#d4a574` |
| Comercial | Cinza | `#b0b0b0` |
| Industrial | Marrom | `#8b7d6b` |
| Apartamentos | Bege Claro | `#c0a080` |
| Igreja | Marrom Escuro | `#8b4513` |
| Hospital | Vermelho | `#ff6b6b` |

### Tipos de Ruas
| Tipo | Cor | Hex | Largura |
|------|-----|-----|---------|
| Motorway | Vermelho | `#ff6b6b` | 8px |
| Primary/Trunk | Ouro | `#ffd700` | 6px |
| Secondary | Amarelo Claro | `#ffee99` | 5px |
| Tertiary | Branco | `#ffffff` | 4px |
| Residencial | Branco | `#ffffff` | 2.5px |
| Serviço | Cinza Claro | `#e0e0e0` | 1.5px |

### Amenidades
| Tipo | Cor | Hex |
|------|-----|-----|
| Hospital | Vermelho | `#ff0000` |
| Escola | Azul | `#0000ff` |
| Restaurante | Laranja Escuro | `#ff8c00` |
| Café | Laranja | `#ffa500` |
| Parque | Verde | `#00ff00` |
| Estacionamento | Amarelo | `#ffff00` |
| Banco | Púrpura | `#800080` |
| Farmácia | Verde Escuro | `#008000` |
| Estação de Bus | Rosa | `#ff1493` |

## 🔧 Configurações Personalizáveis

### Em `App.js`
```javascript
// Raio de busca do mapa (em km)
const data = await fetchMapData(coords.latitude, coords.longitude, 0.8);

// Distância mínima para atualizar mapa
distanceInterval: 10, // metros

// Altura da câmera inicial
<Map3DScene mapData={mapData} zoom={80} />
```

### Em `osmService.js`
```javascript
// Raio padrão de busca
radiusKm = 0.5

// Tipos de dados a buscar (modificar a query Overpass)
query = `[out:json];(
  way["building"](...);
  way["highway"](...);
  node["amenity"](...);
);out geom;`;
```

## 🌐 API Utilizada

### OpenStreetMap + Overpass API
- **URL**: `https://overpass-api.de/api/interpreter`
- **Grátis**: Sim, sem necessidade de API key
- **Limite**: ~100 requisições/min (recomendado aguardar entre requisições)
- **Dados**: Prédios, ruas, amenidades com atributos completos

## 📱 Controles da Câmera

### Mouse (Desktop/Web)
- **Botão esquerdo + arrastar**: Rotaciona câmera
- **Roda do mouse**: Zoom in/out
- **Botão direito + arrastar**: Pan (move a câmera lateralmente)
- **Auto-damping**: Movimento suave com inércia

### Touch (Mobile)
- **Um dedo + arrastar**: Rotaciona câmera
- **Dois dedos + pinça**: Zoom in/out
- **Dois dedos + arrastar**: Pan

## 🎛️ Componentes Principais

### `App.js`
- Gerencia localização GPS
- Carrega dados do mapa quando a posição muda
- Controla estado de loading
- Exibe informações em tempo real

### `Map3DScene.js`
- Renderiza cena 3D com Three.js
- Componentes: `Building`, `Road`, `Amenity`
- Gerencia iluminação
- Implementa OrbitControls

### `osmService.js`
- Faz requisições à Overpass API
- Converte dados OSM em geometrias 3D
- Aplica cores e estilos baseados em tipos
- Estima alturas dos prédios

### `geoUtils.js`
- Converte coordenadas lat/lon para metros
- Calcula distâncias (Haversine)
- Simplifica caminhos (Ramer-Douglas-Peucker)
- Trabalha com bounding boxes

## ⚠️ Limitações e Considerações

1. **Performance**: Renderizar muitos prédios pode impactar performance em dispositivos antigos
2. **Dados OSM**: Qualidade varia por região - algumas áreas podem ter dados incompletos
3. **Altura dos Prédios**: Estimada a partir de atributos; nem todos os prédios possuem altura definida
4. **Taxa de Requisições**: Aguarde entre atualizações para não sobrecarregar a API
5. **Distância**: Configurada para buscar em raio de 0.8km (~400 prédios médios)

## 🔌 Dependências Principais

```json
{
  "@react-three/fiber": "^9.5.0",      // Renderer Three.js para React
  "@react-three/drei": "^9.x.x",       // Utilitários (OrbitControls)
  "expo": "~54.0.33",                  // Framework React Native
  "expo-location": "^19.0.8",          // API de GPS
  "react-native": "0.81.5",            // Framework base
  "three": "^0.166.1"                  // Engine 3D
}
```

## 📝 Licença

Este projeto utiliza dados do OpenStreetMap (ODbL License) e é fornecido sob a mesma licença.

## 🤝 Contribuições

Sinta-se livre para:
- Reportar bugs
- Sugerir novas features
- Melhorar a renderização
- Otimizar performance

## 🎓 Próximas Melhorias Sugeridas

- [ ] Renderizar via Mapbox/Google Maps para melhor geometria
- [ ] Adicionar texturas aos prédios
- [ ] Implementar pathfinding para navegação
- [ ] Cache de dados carregados
- [ ] Modo noturno com iluminação dinâmica
- [ ] Adicionar modelos 3D de pontos de interesse
- [ ] Integração com Street View
- [ ] Modo AR (Augmented Reality)
