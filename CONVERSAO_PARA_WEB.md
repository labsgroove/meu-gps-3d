# Meu GPS 3D - Versão Web (React + Vite)

## ✅ Conversão Completada

Este projeto foi convertido de um projeto React Native + Expo para uma aplicação **React Web pura** usando **Vite** como bundler.

### Mudanças Principais

#### 1. **Removido Expo e React Native**
   - Removidas dependências:
     - `expo`
     - `expo-location`
     - `expo-status-bar`
     - `expo-three`
     - `react-native`
     - `react-native-maps`
     - `react-native-web`

#### 2. **Adicionadas Dependências Web**
   - `vite` - Bundler moderno e rápido
   - `@vitejs/plugin-react` - Plugin React para Vite
   - Mantidas: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `@turf/turf`

#### 3. **Scripts Atualizados**
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview"
     }
   }
   ```

#### 4. **Arquivos Criados/Modificados**
   - ✅ `vite.config.js` - Configuração do Vite
   - ✅ `App.web.jsx` - Componente principal para web
   - ✅ `App.web.css` - Estilos para web (substitui React Native StyleSheet)
   - ✅ `components/Map3DScene.web.jsx` - Componente 3D com React Three Fiber
   - ✅ `index.web.jsx` - Ponto de entrada da aplicação

#### 5. **Remoção de Dependências de Hardware**
   - Localização simulada em São Paulo para testes sem GPS
   - Possibilidade futura de adicionar Geolocation API do navegador

### 🔄 **Nova Lógica: Alinhamento de Prédios (Perpendicular às Ruas)**

Adicionada função inteligente que rotaciona automaticamente os prédios para ficarem **perpendiculares (transversais)** às ruas mais próximas:

```javascript
function calculatePerpendiculalOrientation(buildingPoints, roads) {
  // 1. Calcula o centroide do prédio
  // 2. Encontra a rua mais próxima
  // 3. Calcula a direção da rua
  // 4. Retorna orientação perpendicular (90°) à rua
  // 5. Rotaciona os pontos do prédio com essa orientação
}
```

**Benefícios:**
- Alinhamento realista dos prédios com as ruas
- Visualização mais natural do mapa 3D
- Melhor representação urbana

## 🚀 Como Iniciar

### Instalação
```bash
npm install
```

### Desenvolvimento
```bash
npm run dev
```
O servidor abrirá em `http://localhost:3000` (ou próxima porta disponível)

### Build para Produção
```bash
npm run build
```
Arquivos gerados em pasta `dist/`

### Preview do Build
```bash
npm run preview
```

## 📂 Estrutura do Projeto

```
/
├── index.html           # HTML principal
├── App.web.jsx         # Componente principal (web)
├── App.web.css         # Estilos CSS
├── index.web.jsx       # Ponto de entrada JSX
├── vite.config.js      # Configuração Vite
├── package.json        # Dependências
├── components/
│   └── Map3DScene.web.jsx    # Componente 3D (React Three Fiber)
├── services/
│   └── osmService.js   # API OpenStreetMap
├── utils/
│   └── geoUtils.js     # Utilitários geoespaciais
└── config/
    └── mapConfig.js    # Configurações do mapa
```

## 🌍 Dados do Mapa

- **Fonte:** OpenStreetMap (Overpass API)
- **Localização Padrão:** São Paulo, Brasil (-23.5505, -46.6333)
- **Raio de Busca:** 0.5 km
- **Elementos:** Prédios, ruas, e amenidades

## 🎯 Características

✅ Renderização 3D com Three.js  
✅ Controles OrbitControls (arraste para rotacionar, scroll para zoom)  
✅ Dados reais de OpenStreetMap  
✅ Prédios com cores diferentes por tipo (residencial, comercial, etc)  
✅ Estradas com larguras diferentes por tipo  
✅ Amenidades (parques, escolas, hospitais, etc)  
✅ **Alinhamento inteligente de prédios perpendicular às ruas**  

## 📱 Responsividade

A aplicação é totalmente responsiva e funciona em:
- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Tablets
- ✅ Mobile (navegadores modernos)

## 🔧 Tecnologias

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| React | 19.1.0 | Framework UI |
| Vite | 5.0.8 | Bundler |
| Three.js | 0.166.1 | Rendering 3D |
| React Three Fiber | 9.5.0 | React wrapper para Three.js |
| drei | 10.7.7 | Componentes úteis para Three.js |

## 📝 Notas Importantes

1. **Sem Geolocation Real:** Por enquanto, usa coordenadas fixas de São Paulo. Para habilitar GPS real:
   - Usar [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
   - Requerer permissão do usuário
   - Implementar watchPosition para atualizações em tempo real

2. **CORS:** A Overpass API permite requisições diretas do navegador (sem CORS)

3. **Performance:** Para áreas muito maiores, considerar:
   - Limitar raio de busca
   - Implementar clustering de prédios
   - Usar cancelamento de requisições anteriores

4. **Compatibilidade:** Requer navegador com suporte WebGL (praticamente todos modernos)

## 🐛 Troubleshooting

**Erro: "Port 3000 is in use"**
- Vite usará automaticamente a próxima porta disponível
- Ou mude em `vite.config.js`: `server: { port: 3001 }`

**Mapa não carrega:**
- Verifique console (F12) para erros de rede
- Overpass API pode estar sobrecarregada, tente novamente

**Performance baixa:**
- Reduza raio de busca em `osmService.js`
- Ajuste qualidade gráfica em `vite.config.js`

## ✨ Próximas Melhorias

- [ ] Geolocation API do navegador
- [ ] Perseguição automática da localização
- [ ] Importação de múltiplos pontos de interesse
- [ ] Modo noturno
- [ ] Exportação de mapa 3D (glTF, OBJ)
- [ ] Análise de distâncias no mapa
- [ ] Camadas de dados customizáveis
