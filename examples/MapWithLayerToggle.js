// examples/MapWithLayerToggle.js
// Exemplo: Mapa 3D com toggle de camadas

import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  layerControl: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 10,
    zIndex: 100,
  },
  layerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: '#2c3e50',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  layerButtonActive: {
    borderColor: '#3498db',
  },
  layerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export function MapWithLayerToggle({ mapData, setMapData }) {
  const [layers, setLayers] = useState({
    buildings: true,
    roads: true,
    amenities: true,
  });

  const toggleLayer = (layer) => {
    const newLayers = { ...layers, [layer]: !layers[layer] };
    setLayers(newLayers);

    // Atualizar dados visíveis
    const filteredData = {
      buildings: newLayers.buildings ? mapData.buildings : [],
      roads: newLayers.roads ? mapData.roads : [],
      amenities: newLayers.amenities ? mapData.amenities : [],
    };

    setMapData(filteredData);
  };

  return (
    <View style={styles.layerControl}>
      <TouchableOpacity
        style={[
          styles.layerButton,
          layers.buildings && styles.layerButtonActive,
        ]}
        onPress={() => toggleLayer('buildings')}
      >
        <Text style={styles.layerButtonText}>
          {layers.buildings ? '✓' : '○'} Prédios
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.layerButton, layers.roads && styles.layerButtonActive]}
        onPress={() => toggleLayer('roads')}
      >
        <Text style={styles.layerButtonText}>
          {layers.roads ? '✓' : '○'} Ruas
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.layerButton,
          layers.amenities && styles.layerButtonActive,
        ]}
        onPress={() => toggleLayer('amenities')}
      >
        <Text style={styles.layerButtonText}>
          {layers.amenities ? '✓' : '○'} Amenidades
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Exemplo: Renderizar com diferentes themas de cor
export function getThemeColors(theme = 'light') {
  const themes = {
    light: {
      buildings: {
        residential: 0xd4a574,
        commercial: 0xb0b0b0,
        industrial: 0x8b7d6b,
      },
      roads: {
        motorway: 0xff6b6b,
        primary: 0xffd700,
        residential: 0xffffff,
      },
    },
    dark: {
      buildings: {
        residential: 0x5a4a4a,
        commercial: 0x505050,
        industrial: 0x3d3a2f,
      },
      roads: {
        motorway: 0x8b0000,
        primary: 0x8b7500,
        residential: 0x808080,
      },
    },
    saturation: {
      buildings: {
        residential: 0xff69b4,
        commercial: 0x00bfff,
        industrial: 0x32cd32,
      },
      roads: {
        motorway: 0xff0000,
        primary: 0xffff00,
        residential: 0x00ff00,
      },
    },
  };

  return themes[theme] || themes.light;
}

// Exemplo: Filtrar por tipo
export function filterBuildingsByType(buildings, type) {
  return buildings.filter((b) => b.tags.building === type);
}

export function filterRoadsByType(roads, type) {
  return roads.filter((r) => r.tags.highway === type);
}

export function filterAmenitiesByType(amenities, type) {
  return amenities.filter((a) => a.amenityType === type);
}

// Exemplo: Estatísticas do mapa
export function calculateMapStatistics(mapData) {
  const stats = {
    totalBuildings: mapData.buildings.length,
    buildingsByType: {},
    totalRoads: mapData.roads.length,
    roadsByType: {},
    totalAmenities: mapData.amenities.length,
    amenitiesByType: {},
    totalBuildingArea: 0,
    totalRoadLength: 0,
  };

  // Contar prédios por tipo
  mapData.buildings.forEach((b) => {
    const type = b.tags.building || 'unknown';
    stats.buildingsByType[type] = (stats.buildingsByType[type] || 0) + 1;
  });

  // Contar ruas por tipo
  mapData.roads.forEach((r) => {
    const type = r.tags.highway || 'unknown';
    stats.roadsByType[type] = (stats.roadsByType[type] || 0) + 1;
  });

  // Contar amenidades por tipo
  mapData.amenities.forEach((a) => {
    const type = a.amenityType || 'unknown';
    stats.amenitiesByType[type] = (stats.amenitiesByType[type] || 0) + 1;
  });

  return stats;
}
