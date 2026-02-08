// __tests__/mapService.test.js
// Testes básicos para o serviço de mapa

import { fetchMapData } from '../services/osmService';

// Teste com coordenadas conhecidas (São Paulo, Brasil)
const TEST_COORDS = {
  latitude: -23.5505,
  longitude: -46.6333,
};

async function testMapDataFetching() {
  console.log('🧪 Iniciando testes do serviço de mapa...');

  try {
    console.log(`\n📍 Buscando dados para: ${TEST_COORDS.latitude}, ${TEST_COORDS.longitude}`);

    const mapData = await fetchMapData(TEST_COORDS.latitude, TEST_COORDS.longitude, 0.5);

    console.log('\n✅ Dados carregados com sucesso!');
    console.log(`   - Prédios encontrados: ${mapData.buildings.length}`);
    console.log(`   - Ruas encontradas: ${mapData.roads.length}`);
    console.log(`   - Amenidades encontradas: ${mapData.amenities.length}`);

    if (mapData.buildings.length > 0) {
      const building = mapData.buildings[0];
      console.log('\n🏢 Exemplo de Prédio:');
      console.log(`   - ID: ${building.id}`);
      console.log(`   - Altura: ${building.height}m`);
      console.log(`   - Cor: #${building.color.toString(16).padStart(6, '0')}`);
      console.log(`   - Pontos: ${building.points.length}`);
    }

    if (mapData.roads.length > 0) {
      const road = mapData.roads[0];
      console.log('\n🛣️ Exemplo de Rua:');
      console.log(`   - ID: ${road.id}`);
      console.log(`   - Tipo: ${road.tags.highway}`);
      console.log(`   - Largura: ${road.width}px`);
      console.log(`   - Cor: #${road.color.toString(16).padStart(6, '0')}`);
      console.log(`   - Segmentos: ${road.points.length}`);
    }

    if (mapData.amenities.length > 0) {
      const amenity = mapData.amenities[0];
      console.log('\n📍 Exemplo de Amenidade:');
      console.log(`   - ID: ${amenity.id}`);
      console.log(`   - Tipo: ${amenity.amenityType}`);
      console.log(`   - Nome: ${amenity.tags.name || 'N/A'}`);
      console.log(`   - Posição: [${amenity.position.join(', ')}]`);
    }

    console.log('\n✅ Todos os testes passaram!');
    return true;
  } catch (error) {
    console.error('\n❌ Erro nos testes:', error);
    return false;
  }
}

// Executar testes
if (require.main === module) {
  testMapDataFetching().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { testMapDataFetching };
