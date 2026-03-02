# Fluxo de Implementação Visual - Roadmap 2026

**Data**: Março 2, 2026  
**Objetivo**: Visualizar o caminho de otimização do projeto

---

## 🗺️ Mapa Mental - Arquitetura Atual vs Otimizada

### ANTES (Estado Atual)
```
┌─────────────────────────────────────────┐
│         APLICAÇÃO DO USUÁRIO            │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌──────────────────┐
       │  Movimento (60ms)│
       └────────┬─────────┘
                │
    ┌───────────┴────────────┐
    │                        │
    ▼                        ▼
┌─────────────┐      ┌──────────────────┐
│ Velocidade? │      │ Carregar Tiles   │──→ GARGALO! Apenas sob demanda
└─────────────┘      └──────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
        ┌──────────┐              ┌──────────────┐
        │ Bloqueio │              │ Background   │
        │(3 tiles) │              │(+paralelos)  │
        └────┬─────┘              └──────┬───────┘
             │                           │
             └───────────────┬───────────┘
                             │
                    ┌────────▼────────┐
                    │ Renderizar Tudo │──→ FPS Dropping em áreas densas
                    │ (Sem LOD)       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Cache RAM      │──→ Memory leak: +5MB/15min
                    │  Poda Suave     │
                    └─────────────────┘
```

### DEPOIS (Otimizado)
```
┌─────────────────────────────────────┐
│      APLICAÇÃO DO USUÁRIO           │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │   Movimento (60ms)   │
    │  + Velocidade Calc   │◄──── NOVO: Calcular velocity
    └────────┬─────────────┘
             │
    ┌────────▼──────────────────┐
    │   Movimento Rápido? (>8m/s)│
    └────────┬─────────────┬─────┘
    SIM      │           NÃO
             │             │
    ┌────────▼────────────────────┐   ┌──────────────┐
    │ Carregar Atuais + Previstos │   │CarrAtual     │
    │(1.3x raio até 2s à frente)  │   │              │
    └────────┬─────────────────────┘   └──────┬───────┘
             │                               │
             └───────────────┬───────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Bloqueio (3-4 tiles)      │
              └────────────┬────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌────────────────────┐             ┌──────────────────┐
│ Background (Atual) │             │Previstos (Se >8) │
└────────┬───────────┘             └────────┬─────────┘
         │                                  │
         └──────────────┬───────────────────┘
                        │
                ┌───────▼──────────┐
                │  Calcular LOD    │◄────────────────────── NOVO: Distance-based
                │  0: <150m        │
                │  1: 150-400m     │
                │  2: >400m        │
                └───────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  Renderizar +LOD   │◄────────────────────── NOVO: Geometry simplification
              │  ├─ LOD0: Completo │
              │  ├─ LOD1: Simples  │
              │  └─ LOD2: Caixas   │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  Frustum Culling   │◄────────────────────── NOVO: Cached spheres
              │  (C/ Bounding Box) │
              └─────────┬──────────┘
                        │
                ┌───────▼────────┐
                │  Renderização  │──→ 50+ FPS stável
                │  Eficiente     │
                └───────┬────────┘
                        │
              ┌─────────▼──────────┐
              │ Cache RAM Otimizado│◄────────────────────── NOVO: TTL 6h + soft limit
              │ Poda Agressiva    │──→ Memory < 150MB stable
              └───────────────────┘
```

---

## 🚀 Timeline de Implementação

```
DIA 1 (Crítica)
├─ 0:00-0:30  ├─ Setup: Criar branches/versioning
├─ 0:30-3:00  ├─ Previsão de Movimento          [PRIORIDADE 1]
│             │  ├─ Modificar App.web.jsx
│             │  ├─ Modificar osmService.js
│             │  └─ Rastrear velocidade
├─ 3:00-4:00  ├─ Otimizar Poda de Cache        [PRIORIDADE 2]
│             │  ├─ Configuração
│             │  └─ Lógica de poda
├─ 4:00-5:00  ├─ Testes rápidos & debug
│             └─ Commit & PR
│
│  GANHO DIA 1:
│  ✅ Zero pop-in
│  ✅ RAM controlado
│  ✅ Consistência +40%
│
DIA 2 (Performance)
├─ 5:00-9:00  ├─ Level of Detail (LOD)        [PRIORIDADE 3]
│             │  ├─ Helpers de geometria
│             │  ├─ Cálculo de distância
│             │  ├─ Simplificação
│             │  └─ Renderização com LOD
├─ 9:00-11:00 ├─ Frustum Culling Otimizado    [PRIORIDADE 4]
│             │  ├─ Cachear bounding spheres
│             │  └─ Reusar cálculos
├─ 11:00-12:00├─ Testes & ajustes
│             └─ Commit & PR
│
│  GANHO DIA 2:
│  ✅ FPS: 25fps → 50fps
│  ✅ CPU: -15%
│  ✅ Performance +25%
│
DIA 3 (Validação)
├─ 12:00-14:00├─ Testes Manuais (Completos)
│             │  ├─ Desktop
│             │  ├─ Mobile
│             │  └─ Stress test
├─ 14:00-16:00├─ Testes Automatizados
│             │  ├─ Previsão
│             │  ├─ LOD
│             │  └─ Cache
├─ 16:00-17:00├─ Ajustes de Valores
│             │  └─ Fine-tune de cada parâmetro
└─ 17:00+     └─ Merge & Produção ✅
```

---

## 📦 Mudanças por Arquivo

### Arquivo: `config/mapConfig.js`
```
LINHAS: +12

MUDANÇAS:
├─ MOVEMENT_LOOKAHEAD_SECONDS: 2
├─ MOVEMENT_LOOKAHEAD_RADIUS_MULTIPLIER: 1.3
├─ ACTIVE_RADIUS_INCREASE_ON_SPEED: 0.5
├─ SPEED_THRESHOLD_FOR_PREDICTION: 8
├─ TILE_DISK_CACHE_TTL_MS: 6h (era 24h)
├─ TILE_DISK_CACHE_MAX_ENTRIES: 400 (era 250)
├─ TILE_DISK_CACHE_MAX_STALE_MS: 2d (era 7d)
├─ CACHE_SOFT_LIMIT_MULTIPLIER: 0.75
├─ LOD_ENABLED: true
├─ LOD0_DISTANCE: 150
├─ LOD1_DISTANCE: 400
└─ LOD2_DISTANCE: 1000

IMPACTO: ⭐ Fácil (apenas valores)
```

### Arquivo: `App.web.jsx`
```
LINHAS: +40

MUDANÇAS:
├─ Adicionar velocityRef tracking
├─ Modificar handleObserverMove
├─ Passar velocidade a ensureActiveArea
├─ Adicionar performance metrics state
└─ Renderizar métricas no status bar

IMPACTO: ⭐⭐ Médio (adições em componente existente)
```

### Arquivo: `services/osmService.js`
```
LINHAS: +80

MUDANÇAS:
├─ Aceitar parâmetros de velocidade
├─ Calcular tiles previstos
├─ Carregar tiles previstos em background
├─ Atualizar pruneCache com soft limit
├─ Cachear bounding spheres em tiles
└─ Feedback de progresso no onTileReady

IMPACTO: ⭐⭐ Médio (lógica core mas isolated)
```

### Arquivo: `components/Map3DScene.web.jsx`
```
LINHAS: +120

MUDANÇAS:
├─ Importar calculateLOD
├─ Calcular LOD para buildings
├─ Passar LOD ao componente Building
├─ Cachear bounding spheres no frustum culling
├─ Usar caches em vez de recalcular
└─ Filtrar por LOD ao renderizar

IMPACTO: ⭐⭐⭐ Maior (muitas mudanças em scipt)
```

### Arquivo: `utils/geoUtils.js`
```
LINHAS: +60

MUDANÇAS:
├─ Adicionar calculateLOD()
├─ Adicionar simplifyBuildingGeometry()
└─ Helper functions para LOD

IMPACTO: ⭐ Fácil (apenas novos exports)
```

### Novo Arquivo (Opcional): `tests/`
```
OPCIONAIS (Para validação automatizada):
├─ predictive-loading.test.js     (+80 linhas)
├─ lod.test.js                    (+80 linhas)
└─ cache-optimization.test.js     (+100 linhas)

IMPACTO: ⭐ Não crítico (mas recomendado)
```

**TOTAL DE MUDANÇAS**: ~600 linhas de código novo/modificado

---

## 🔄 Fluxo de Desenvolvimento Recomendado

```
┌─────────────────────────────────────────────┐
│          GIT WORKFLOW RECOMENDADO           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
            ┌──────────────┐
            │ git checkout │
            │ -b feat/     │
            │ optimization │
            └──────┬───────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌──────────┐
│ Passo 1 │  │ Passo 2 │  │ Passo 3  │
│         │  │         │  │          │
│Previsão ├─→│ Poda    ├─→│ LOD      │
│Movement │  │ Cache   │  │ Frustum  │
│         │  │         │  │          │
└────┬────┘  └────┬────┘  └────┬─────┘
     │            │            │
     ▼            ▼            ▼
  commit v1    commit v2    commit v3
  push/PR      push/PR      push/PR
     │            │            │
     └────────────┴────────────┘
              │
              ▼
      ┌────────────────┐
      │   Test Branch  │
      │  (manual +     │
      │   automated)   │
      └────────┬───────┘
               │
       ┌───────┴────────┐
    SIM│                │NÃO
       ▼                ▼
    ┌──────┐        ┌──────────┐
    │MERGE │        │FIX BUGS  │
    │ main │   ←────┤          │
    └──────┘        └──────────┘
       │
       ▼
  ┌────────────┐
  │ Produção  │ ✅ DONE
  └────────────┘
```

---

## 📊 Gráfico de Benefício Temporal

```
PERFORMANCE OVER TIME
│
│     ╔═══════════════════════════════╗
│     ║     DEPOIS (Otimizado)        ║
│ 100 ║════════════════════╗          ║
│     ║                    ╚══════════╣
│ 80  ║              ╔═════════════╗  ║
│     ║              ║ ANTES       ║  ║ Stável
│ 60  ║════╗         ║(Antes LOD)  ║  ║
│     ║    ╚═════════╣             ║  ║
│ 40  ║              ║        ╔════╣  ║
│     ║              ║        ║    ║  ║
│ 20  ║              ║        ║    ║  ║
│     ║              ║        ║    ║  ║
│  0  └──────┴──────┴────────┴────┴──┴─────→ Tempo
│     Dia 1  Dia 2  Teste    Prod
│
└─ Metro: FPS em áreas densas


MEMORY USAGE OVER TIME
│
│ 300│
│    │     ╔═════════════════════════════════╗
│ 250│  (╔═╗─────────────────── ANTES       │
│    │   ║ ║ cresce               (leak)    │
│ 200│   ║ ║  6MB/15min ↗           │        │
│    │   ║ ║                         │       │
│ 150│   ║ ║ ┌────────────────────────────╗│
│    │   ║ ║ │ DEPOIS (Otimizado)         ││
│ 100│   ╚═╝ │ Estável em 120MB           ││
│    │       │ <1MB/15min                 ││
│  50│       └────────────────────────────┘│
│    │                                      │
│  0 └──────┴──────┴────────┴────┴──┴────────→ Tempo
│     Dia1  Dia2  Teste    1h   2h
│
└─ Metro: MB RAM
```

---

## 🎯 Checkpoints de Sucesso

```
CHECKPOINT 1: Dia 1 Fim (Previsão + Poda)
├─ [ ] Previsão funciona (sem pop-in)
├─ [ ] Memory cresce lentamente (<1MB/15min)
├─ [ ] Nenhuma regressão visual
└─ GO/NO-GO: ____________________

CHECKPOINT 2: Dia 2 Fim (LOD + Frustum)
├─ [ ] FPS > 40 em áreas densas
├─ [ ] LOD transitions suaves
├─ [ ] Sem artefatos visuais
└─ GO/NO-GO: ____________________

CHECKPOINT 3: Dia 3 Fim (Testes + Produção)
├─ [ ] 99% de testes passando
├─ [ ] Métricas dentro do esperado
├─ [ ] Sem bugs críticos
├─ [ ] Mobile testa bem
└─ GO/NO-GO: ____________________

FINAL: Merge para Main
└─ Status: ✅ PRONTO PARA PRODUÇÃO
```

---

## 🔗 Dependências Entre Otimizações

```
┌──────────────────────┐
│ Config/mapConfig.js  │
│  (Valores base)      │
└──────────┬───────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
    ┌────────────┐      ┌────────────┐
    │ Previsão   │      │ LOD Config │
    │ Movimento  │      │ Valores    │
    └────────┬───┘      └────────┬───┘
             │                   │
             └─────────┬─────────┘
                       │
            ┌──────────▼──────────┐
            │ osmService.js       │
            │ (Core loading)      │
            └──────────┬──────────┘
                       │
            ┌──────────┼──────────┐
            │          │          │
            ▼          ▼          ▼
      ┌─────────┐┌─────────┐┌──────────┐
      │App.web  ││geoUtils ││Map3D     │
      │.jsx     ││         ││Scene     │
      │         ││         ││          │
      │Velocid. ││LOD calc ││Frustum   │
      │Tracking ││+Simplif ││Culling   │
      │         ││         ││          │
      └─────┬───┘└────┬────┘└────┬─────┘
            │         │         │
            └─────────┴─────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Testes/Debug │
              │ & Validation │
              └────────┬─────┘
                       │
                       ▼
              ┌──────────────┐
              │ Merge & Ship │
              └──────────────┘
```

---

## 💾 Estratégia de Backup

```
Antes de começar:
git branch -b backup/pre-optimization
git push origin backup/pre-optimization

Ao longo do desenvolvimento:
git commit -m "✨ Step 1: Predictive loading"
git commit -m "✨ Step 2: Aggressive cache pruning"
git commit -m "✨ Step 3: Level of Detail"
git commit -m "✨ Step 4: Frustum optimization"

Se algo der errado:
git checkout backup/pre-optimization
```

---

## 🎓 Ordem de Leitura Recomendada

```
Para ENTENDER:
1. Este arquivo (Roadmap visual)
2. RESUMO_REVISAO_PROJETO.md (Contexto)
3. OTIMIZACOES_AVANCADAS_2026.md (Técnico)

Para CODIFICAR:
4. GUIA_IMPLEMENTACAO_OTIMIZACOES.md (Código)
   ├─ Seção: Previsão de Movimento
   ├─ Seção: Otimizar Cache
   ├─ Seção: Level of Detail
   └─ Seção: Frustum Cache

Para VALIDAR:
5. VALIDACAO_PERFORMANCE.md (Testes)
   ├─ Testes Automatizados
   ├─ Testes Manuais
   ├─ Checklists
   └─ Métricas Esperadas
```

---

## ✨ Pronto para Começar?

```
PRÓXIMO PASSO:
→ Ler OTIMIZACOES_AVANCADAS_2026.md completo

DEPOIS:
→ Seguir GUIA_IMPLEMENTACAO_OTIMIZACOES.md seção por seção

VALIDAÇÃO:
→ Usar VALIDACAO_PERFORMANCE.md para garantir qualidade
```

---

**Data**: Março 2, 2026  
**Versão**: 3.0.0 (Planejado)  
**Status**: 🗺️ Roadmap Definido | ✅ Pronto para Implementação

### 🚀 Comece agora → Mergulhe em OTIMIZACOES_AVANCADAS_2026.md
