# 🗺️ Mapas 3D - Web Edition

Uma aplicação web moderna para visualizar mapas 3D de cidades usando dados reais do OpenStreetMap. Construída com **React**, **Vite**, **Three.js** e **React Three Fiber**.

## ✨ Características

- 🌍 **Dados Reais**: Integração com OpenStreetMap via Overpass API
- 🏢 **Prédios 3D**: Renderização de edifícios com alturas reais
- 🛣️ **Estradas Realistas**: Vias com larguras apropriadas e cores diferenciadas
- 🎯 **Alinhamento Inteligente**: Prédios orientados perpendicularmente às ruas
- 🎮 **Controles Interativos**: Rotação com mouse, zoom com scroll
- 🎨 **Visualização Rica**: Cores diferenciadas por tipo de estrutura
- 📱 **Responsivo**: Funciona em desktop, tablet e mobile

## 🚀 Quick Start

### Instalação
```bash
npm install
```

### Desenvolvimento
```bash
npm run dev
```
Abre automaticamente em `http://localhost:3000`

### Build para Produção
```bash
npm run build
```

### Preview do Build
```bash
npm run preview
```

### Scripts Rápidos
```bash
./start.sh  # Instala e inicia tudo de uma vez
```

## 📂 Estrutura do Projeto

```
meu-gps-3d/
├── index.html              # Página HTML principal
├── App.web.jsx             # Componente raiz da aplicação
├── App.web.css             # Estilos globais
├── index.web.jsx           # Ponto de entrada React
├── vite.config.js          # Configuração do Vite
├── components/
│   └── Map3DScene.web.jsx  # Componente 3D (Three.js + React Three Fiber)
├── services/
│   └── osmService.js       # Integração com Overpass API
├── utils/
│   └── geoUtils.js         # Utilitários geoespaciais
├── config/
│   └── mapConfig.js        # Configurações do mapa
└── assets/
    └── favicon.png         # Ícone da aplicação
```

## 🔧 Tecnologias

| Tecnologia | Uso |
|-----------|-----|
| **React 19** | Framework UI |
| **Vite 5** | Bundler e dev server |
| **Three.js** | Renderização 3D |
| **React Three Fiber** | React renderer para Three.js |
| **Drei** | Componentes úteis para Three.js |
| **Turf.js** | Operações geoespaciais |

## 🗺️ Fonte de Dados

- **OpenStreetMap** (OSM): Dados geográficos abertos
- **Overpass API**: Query engine para OSM
- **Localização Padrão**: São Paulo, Brasil (-23.5505, -46.6333)
- **Raio de Busca**: 0.5 km

### Tipos de Dados Renderizados

- **Prédios**: Forma com altura real, coloridos por tipo (residencial, comercial, etc)
- **Estradas/Vias**: Malha de transporte com largura apropriada
- **Amenidades**: Pontos de interesse (escolas, hospitais, parques, etc)

## 🎮 Controles

| Ação | Descrição |
|------|-----------|
| **Arraste (mouse)** | Rotacionar a câmera ao redor do mapa |
| **Scroll/Wheel** | Zoom in/out |
| **Botão direito + arraste** | Deslocar a câmera |

## ⚙️ Configuração

### Alterar Localização Padrão

Em `App.web.jsx`, modifique:
```javascript
const mockLocation = {
  latitude: -23.5505,  // Sua latitude
  longitude: -46.6333, // Sua longitude
};
```

### Mudar Raio de Busca

Em `services/osmService.js`, altere:
```javascript
const data = await fetchMapData(latitude, longitude, 0.5); // raio em km
```

### Ajustar Configurações do Mapa

Veja `config/mapConfig.js` para:
- Altura dos prédios
- Tamanhos de estradas
- Configurações de câmera
- Iluminação

## 🎯 Funcionalidades Avançadas

### Alinhamento Perpendicular de Prédios

Os prédios se alinham automaticamente perpendiculares às ruas próximas, criando visualização realista:

```javascript
function calculatePerpendiculalOrientation(buildingPoints, roads)
// Busca a rua mais próxima e orienta o prédio transversalmente
```

### Cores Inteligentes

- **Prédios Residenciais**: Bege
- **Comerciais**: Cinza
- **Industriais**: Marrom
- **Apartamentos**: Bege claro
- **Estradas Principais**: Ouro
- **Estradas Secundárias**: Amarelo claro
- **Vias Corriqueiras**: Branco

## 📊 Performance

- Renderização otimizada com Three.js WebGL
- Simplificação de caminhos para melhor performance
- Grid de 500x500 para referência visual
- Névoa (fog) para evitar renderizar muitos objetos distantes

## 🌐 Compatibilidade

- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 15+
- ✅ Edge 90+
- ✅ Mobile browsers modernos

Requer suporte a **WebGL** (praticamente todos os navegadores modernos têm)

## 🐛 Troubleshooting

### "Port 3000 is in use"
Vite usará automaticamente a próxima porta disponível, ou mude em `vite.config.js`:
```javascript
server: { port: 3001 }
```

### Mapa não carrega
1. Verifique console do navegador (F12)
2. Overpass API pode estar sobrecarregada - tente novamente
3. Verifique conexão com internet

### Baixa performance
- Reduza raio de busca em `osmService.js`
- Verifique se GPU está sendo usada (DevTools > Performance)
- Feche outras abas/aplicações

## 📈 Expansões Futuras

- [ ] Geolocation API para GPS real do navegador
- [ ] Tracking em tempo real baseado em localização
- [ ] Modo noturno
- [ ] Exportação 3D (glTF, OBJ)
- [ ] Análise de distâncias
- [ ] Camadas customizáveis
- [ ] Autenticação e salvamento de favoritos
- [ ] PWA (Progressive Web App)

## 📄 Documentação

- [CONVERSAO_PARA_WEB.md](CONVERSAO_PARA_WEB.md) - Detalhes técnicos da conversão
- [CHECKLIST_CONVERSAO_WEB.md](CHECKLIST_CONVERSAO_WEB.md) - Checklist de mudanças

## 📝 Notas

- Localização é mockada com coordenadas de São Paulo para compatibilidade
- Para usar GPS real, implemente [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API)
- CORS é permitido pela Overpass API (sem necessidade de proxy)

## 🔐 Privacidade

- Nenhum dado de localização é enviado para servidores
- Tudo é processado localmente no navegador
- Dados obtidos apenas de OpenStreetMap (público)

## 📄 Licença

Projeto sob licença apropriada. Dados do OpenStreetMap sob [ODbL](https://opendatacommons.org/licenses/odbl/)

---

**Desenvolvido com ❤️ usando React + Three.js**

> Para sugestões e melhorias, abra uma issue ou pull request!
