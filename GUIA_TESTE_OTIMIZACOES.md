# Guia de Teste das Otimizações

## ✅ Validação Rápida (5 minutos)

### 1. Inicialização
- [ ] App inicia sem erros
- [ ] Mapa carrega em menos de 2 segundos
- [ ] Status bar mostra "Atualização em tempo real"

### 2. Renderização de Terreno Infinito
- [ ] Nenhuma borda de mapa visível ao virar câmera
- [ ] Terreno continua infinitamente em qualquer direção
- [ ] Cor consistente em todo mapa base

### 3. Movimento Suave (WASD)
- [ ] Nenhum travamento ao pressionar WASD
- [ ] Movimento responsivo (sem delay perceptível)
- [ ] Tiles carregam enquanto se move
- [ ] Sem pop-in abrupto de prédios

### 4. Carregamento Incremental
- [ ] Status bar "Tiles: X/Y" aumenta gradualmente
- [ ] Prédios aparecem suavemente (fade-in)
- [ ] Ruas carregam sem interrupção

### 5. Performance
- [ ] 60fps constante em desktop
- [ ] 30fps+ em mobile
- [ ] CPU usage razoável (<50%)
- [ ] RAM estável (não cresce indefinidamente)

---

## 🎯 Teste Detalhado (15 minutos)

### A. Teste de Responsividade

**Usando geolocalização:**
1. Ative "Minha posição"
2. Caminhe/mova-se enquanto assiste ao mapa
3. **Espera**: Mapa atualiza a cada ~1-2 metros
4. **Expectativa**: Mapa sempre mostra sua localidade atual

**Usando teclado:**
1. Mantenha pressionada a tecla "W" continuamente
2. Observe o movimento uniforme
3. **Expectativa**: Movimento linear sem stuttering
4. **Medição**: Desloque ~500m, observe tiles carregados

### B. Teste de Zoom

1. Faça zoom in até o máximo (200m)
   - **Deve**: Ruas visíveis com detalhes
   - **Não deve**: Lag detectado
2. Faça zoom out até o mínimo (10m)
   - **Deve**: Visão ampla sem travamento
   - **Não deve**: Geração de código visível

### C. Teste de Cache

1. Mova para uma direção por ~1km
2. Retorne ao ponto original
3. **Expectativa**: Carregamento muito mais rápido
4. **Métrica**: Status bar mostra mesmo número de tiles

### D. Teste de Giro de Câmera (Orbit)

1. Mantenha mouse pressionado e gire
2. **Expectativa**: Rotação suave sem lag
3. **Não deve**: Freezing mesmo durante load

---

## 🔍 Verificação de Configurações

Abra `config/mapConfig.js` e confirme:

```javascript
✅ TILE_SIZE_METERS: 280
✅ ACTIVE_RADIUS_METERS: 900
✅ MAX_CACHED_TILES: 100
✅ REALTIME_REFRESH_DEBOUNCE_MS: 150
✅ MOVEMENT_UPDATE_INTERVAL_MS: 60
```

Se algum valor diferir, a otimização não foi aplicada corretamente.

---

## 📊 Métricas para Monitorar

### Status Bar (Canto inferior esquerdo)

```
Tiles: 8/12 ativos
Cache: 45
```

- **8/12**: 8 tiles carregados de 12 necessários
- **45**: Total de tiles em cache (máx 100)

**Comportamento esperado:**
- Aumenta gradually enquanto se move
- Nunca ultrapassa Cache máximo
- Diminui quando se retorna à origem

### Console (F12 Developer Tools)

Procure por:
- ❌ NÃO deve haver: "Erro ao buscar dados OSM"
- ❌ NÃO deve haver: "Road render error"
- ✅ Deve haver logs ocasionais de carregamento

---

## 🐛 Troubleshooting

### Problema: Mapa não aparece
**Solução:**
1. Verifique conexão de internet
2. Abra F12 e procure erros de rede
3. Tente "Minha posição" ou insira coordenadas manualmente

### Problema: Lag ao mover
**Solução:**
1. Reduza ACTIVE_RADIUS_METERS para 700
2. Reduza MAX_CONCURRENT_TILE_FETCHES para 3
3. Aumente REALTIME_REFRESH_DEBOUNCE_MS para 250

### Problema: Alto uso de RAM
**Solução:**
1. Reduza MAX_CACHED_TILES para 60
2. Reduza ACTIVE_RADIUS_METERS para 700
3. Feche outras abas/aplicações

### Problema: Terreno não é infinito
**Solução:**
1. Verifique se `InfiniteGround` está em Map3DScene.web.jsx linha ~30
2. Confirme gridRange = 5 (ou superior) no componente
3. Teste em modo incógnito para limpar cache

---

## 📈 Antes vs Depois (Observável)

### ANTES das otimizações:
```
⚠️ Pop-in jarring de prédios
⚠️ Latência ~300ms para atualizar
⚠️ Terreno termina abruptamente
⚠️ Às vezes precisa recarregar
```

### DEPOIS das otimizações:
```
✅ Carregamento suave e gradual
✅ Latência ~150ms (imperceptível)
✅ Terreno infinito
✅ Renderização incremental constante
```

---

## 🎮 Teste de UX Prático

**Cenário 1: Pedestrian (Caminhando)**
- Tempo esperado: ~2-3 segundos para atualizar
- Movimento observável: ~100m antes de reload
- Resultado: Muito fluido

**Cenário 2: Veículo (Carro)**
- Tempo esperado: ~1-2 segundos para atualizar
- Movimento observável: ~100m antes de reload
- Resultado: Sem lag mesmo em movimento rápido

**Cenário 3: Explorando (Teclado/Mobile)**
- Responsividade: Imediata (~16ms)
- Movimento: Suave 60fps
- Resultado: Muito responsivo

---

## ✨ Esperado Uma Vez Otimizado

### Visual:
- ✨ Terreno contínuo sem fim
- ✨ Prédios aparecem suavemente
- ✨ Sem piscadas ou transições abruptas
- ✨ Cores e texturas consistentes

### Performance:
- 🚀 Movimento fluido em 60fps
- 🚀 Sem travamentos notáveis
- 🚀 RAM estável
- 🚀 CPU < 50%

### Resposta:
- ⚡ Movimento instantâneo (< 50ms)
- ⚡ Zoom responsivo
- ⚡ Giro suave
- ⚡ Atualização rápida de tiles

---

## 📝 Relatório de Teste

Após testar, preencha:

```
Data: ___/___/_____
Navegador: ________________
Dispositivo: ________________

Performance:
[ ] 60fps em desktop
[ ] 30fps+ em mobile
[ ] Terreno infinito funciona
[ ] Tiles carregam incrementalmente
[ ] Movimento suave

Problemas encontrados:
(descrever qualquer issue)

Recomendações:
(sugerir ajustes if needed)
```

---

**Pronto para testar! 🚀**
