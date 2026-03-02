// services/tilePriorityManager.js
// Sistema de raios de prioridade dinâmicos para carregar tiles de forma consistente
// em áreas densas, garantindo que o núcleo nunca fique com falhas

import { MAP_CONFIG } from "../config/mapConfig.js";

/**
 * Define os raios de prioridade como proporções do raio ativo
 * Raio Crítico (60%): Deve estar 100% carregado antes de outros
 * Raio Primário (100%): Carrega após crítico estar ready
 * Raio Secundário (130%): Carrega em background
 */
const PRIORITY_LAYERS = {
  CRITICAL: 0.6,      // Núcleo deve estar 100% pronto
  PRIMARY: 1.0,       // Próximo, carrega após crítico
  SECONDARY: 1.3,     // Periférico, carrega em background
};

const LAYER_ORDER = ["CRITICAL", "PRIMARY", "SECONDARY"];

/**
 * Cria um gerenciador de prioridades de tiles
 */
export function createTilePriorityManager(activeRadiusMeters, tileSizeMeters) {
  const criticRadius = activeRadiusMeters * PRIORITY_LAYERS.CRITICAL;
  const primaryRadius = activeRadiusMeters * PRIORITY_LAYERS.PRIMARY;
  const secondaryRadius = activeRadiusMeters * PRIORITY_LAYERS.SECONDARY;

  /**
   * Classifica um tile em sua camada de prioridade
   */
  function getTileLayer(tileDistance) {
    if (tileDistance <= criticRadius) return "CRITICAL";
    if (tileDistance <= primaryRadius) return "PRIMARY";
    if (tileDistance <= secondaryRadius) return "SECONDARY";
    return null; // Fora de qualquer raio
  }

  /**
   * Organiza tiles em camadas e retorna ordem de carregamento
   */
  function layerTiles(allTiles) {
    const layers = {
      CRITICAL: [],
      PRIMARY: [],
      SECONDARY: [],
      IGNORE: [],
    };

    for (const tile of allTiles) {
      const layer = getTileLayer(tile.distance);
      if (layer) {
        layers[layer].push(tile);
      } else {
        layers.IGNORE.push(tile);
      }
    }

    // Ordena tiles dentro de cada camada por distância (mais próximos primeiro)
    for (const layer of LAYER_ORDER) {
      layers[layer].sort((a, b) => a.distance - b.distance);
    }

    return layers;
  }

  /**
   * Cria uma fila de carregamento com alocação dinâmica de slots
   * Garante que raio crítico sempre tem prioridade
   */
  function createLoadQueue(layers, maxConcurrentFetches = 4) {
    const queue = {
      critical: [...layers.CRITICAL],
      primary: [...layers.PRIMARY],
      secondary: [...layers.SECONDARY],
      
      // Alocação dinâmica de slots: sempre reserva slots para crítico
      criticalSlots: Math.min(
        Math.ceil(maxConcurrentFetches * 0.5),
        layers.CRITICAL.length
      ),
      primarySlots: Math.ceil(maxConcurrentFetches * 0.3),
      secondarySlots: Math.max(1, maxConcurrentFetches - 
        Math.ceil(maxConcurrentFetches * 0.5) - 
        Math.ceil(maxConcurrentFetches * 0.3)
      ),
      
      maxConcurrentFetches,
      activeFetches: 0,
    };

    return queue;
  }

  /**
   * Obtém o próximo tile para carregar respeitando as prioridades
   * Retorna { tile, layer } ou null se nada disponível
   */
  function getNextTile(queue) {
    // Tenta pegar do crítico primeiro
    if (queue.critical.length > 0 && 
        queue.activeFetches < (queue.criticalSlots || 2)) {
      const tile = queue.critical.shift();
      return { tile, layer: "CRITICAL", priority: 0 };
    }

    // Depois primário se crítico tiver menos de 50% carregado
    if (queue.primary.length > 0 && 
        queue.activeFetches < queue.maxConcurrentFetches * 0.7) {
      const tile = queue.primary.shift();
      return { tile, layer: "PRIMARY", priority: 1 };
    }

    // E por fim secundário
    if (queue.secondary.length > 0 && 
        queue.activeFetches < queue.maxConcurrentFetches) {
      const tile = queue.secondary.shift();
      return { tile, layer: "SECONDARY", priority: 2 };
    }

    return null;
  }

  /**
   * Verifica se o raio crítico está totalmente pronto
   */
  function isCriticalReady(loadedTiles) {
    return layers.CRITICAL.every((tile) => 
      loadedTiles.has(tile.key)
    );
  }

  /**
   * Calcula a porcentagem de carregamento por camada
   */
  function getLoadProgress(loadedTiles) {
    const getProgress = (tiles) => {
      if (tiles.length === 0) return 1;
      const loaded = tiles.filter((t) => loadedTiles.has(t.key)).length;
      return loaded / tiles.length;
    };

    return {
      critical: getProgress(layers.CRITICAL),
      primary: getProgress(layers.PRIMARY),
      secondary: getProgress(layers.SECONDARY),
      complete: getProgress(layers.CRITICAL.concat(layers.PRIMARY, layers.SECONDARY)),
    };
  }

  return {
    getTileLayer,
    layerTiles,
    createLoadQueue,
    getNextTile,
    isCriticalReady,
    getLoadProgress,
    PRIORITY_LAYERS,
    radii: {
      critical: criticRadius,
      primary: primaryRadius,
      secondary: secondaryRadius,
    },
  };
}

/**
 * Adaptador para usar o Priority Manager com o sistema de loading existente
 */
export function createPriorityAwareTileLoader(
  tileLoader,
  maxConcurrentFetches = MAP_CONFIG.MAX_CONCURRENT_TILE_FETCHES
) {
  const loadingState = {
    queue: null,
    priorityManager: null,
    activeFetches: 0,
    metrics: {
      totalFetched: 0,
      totalErrors: 0,
      averageTimeMs: 0,
    },
  };

  /**
   * Inicia o carregamento com prioridades
   */
  async function startPriorityLoadSession(
    allTiles,
    activeRadiusMeters,
    tileSizeMeters,
    callbacks = {}
  ) {
    const priorityManager = createTilePriorityManager(
      activeRadiusMeters,
      tileSizeMeters
    );

    const layers = priorityManager.layerTiles(allTiles);
    const queue = priorityManager.createLoadQueue(layers, maxConcurrentFetches);
    
    loadingState.queue = queue;
    loadingState.priorityManager = priorityManager;
    loadingState.activeFetches = 0;

    const loadedTiles = new Set();
    const failedTiles = new Set();

    // Preenche a fila inicial
    const pendingLoads = [];
    
    for (let i = 0; i < maxConcurrentFetches; i++) {
      const nextItem = priorityManager.getNextTile(queue);
      if (!nextItem) break;

      queue.activeFetches += 1;
      const startTime = performance.now();

      const loadPromise = tileLoader(nextItem.tile)
        .then((data) => {
          const timeMs = performance.now() - startTime;
          loadedTiles.add(nextItem.tile.key);
          
          if (callbacks.onTileReady) {
            callbacks.onTileReady({
              tile: nextItem.tile,
              layer: nextItem.layer,
              data,
            });
          }

          // Atualizar métricas
          loadingState.metrics.totalFetched += 1;
          const prevAvg = loadingState.metrics.averageTimeMs;
          const count = loadingState.metrics.totalFetched;
          loadingState.metrics.averageTimeMs = 
            (prevAvg * (count - 1) + timeMs) / count;

          // Verificar se raio crítico ficou pronto
          if (nextItem.layer === "CRITICAL" &&
              priorityManager.isCriticalReady(loadedTiles) &&
              callbacks.onCriticalReady) {
            callbacks.onCriticalReady();
          }

          // Reportar progresso
          if (callbacks.onProgress) {
            const progress = priorityManager.getLoadProgress(loadedTiles);
            callbacks.onProgress(progress);
          }

          // Próximo tile
          queue.activeFetches -= 1;
          loadNextTile();
        })
        .catch((error) => {
          failedTiles.add(nextItem.tile.key);
          loadingState.metrics.totalErrors += 1;
          queue.activeFetches -= 1;
          
          if (callbacks.onTileError) {
            callbacks.onTileError({
              tile: nextItem.tile,
              layer: nextItem.layer,
              error,
            });
          }

          loadNextTile();
        });

      pendingLoads.push(loadPromise);
    }

    // Função recursiva para carregar próximos tiles
    function loadNextTile() {
      const nextItem = priorityManager.getNextTile(queue);
      if (!nextItem) return;

      queue.activeFetches += 1;
      const startTime = performance.now();

      tileLoader(nextItem.tile)
        .then((data) => {
          const timeMs = performance.now() - startTime;
          loadedTiles.add(nextItem.tile.key);

          if (callbacks.onTileReady) {
            callbacks.onTileReady({
              tile: nextItem.tile,
              layer: nextItem.layer,
              data,
            });
          }

          loadingState.metrics.totalFetched += 1;
          const prevAvg = loadingState.metrics.averageTimeMs;
          const count = loadingState.metrics.totalFetched;
          loadingState.metrics.averageTimeMs = 
            (prevAvg * (count - 1) + timeMs) / count;

          if (nextItem.layer === "CRITICAL" &&
              priorityManager.isCriticalReady(loadedTiles) &&
              callbacks.onCriticalReady) {
            callbacks.onCriticalReady();
          }

          if (callbacks.onProgress) {
            const progress = priorityManager.getLoadProgress(loadedTiles);
            callbacks.onProgress(progress);
          }

          queue.activeFetches -= 1;
          loadNextTile();
        })
        .catch((error) => {
          failedTiles.add(nextItem.tile.key);
          loadingState.metrics.totalErrors += 1;
          queue.activeFetches -= 1;

          if (callbacks.onTileError) {
            callbacks.onTileError({
              tile: nextItem.tile,
              layer: nextItem.layer,
              error,
            });
          }

          loadNextTile();
        });
    }

    // Aguardar finalização das cargas iniciais
    await Promise.all(pendingLoads);

    return {
      loadedTiles,
      failedTiles,
      manager: priorityManager,
      metrics: loadingState.metrics,
    };
  }

  return {
    startPriorityLoadSession,
    getMetrics: () => loadingState.metrics,
    getState: () => loadingState,
  };
}
