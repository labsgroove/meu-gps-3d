import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Se o mapa estiver espelhado no seu input, ative esse flag para inverter X
const MIRROR_X = true;

function mapToSceneCoord(p) {
  if (!p) return [0, 0];
  return [MIRROR_X ? -p[0] : p[0], p[1]];
}

// Função para calcular a orientação perpendicular às ruas próximas
function calculatePerpendiculalOrientation(buildingPoints, roads) {
  if (!roads || roads.length === 0) return 0;

  // Calcular centroide do prédio (aplicando transformação de coordenadas)
  const mapped = buildingPoints.map((p) => mapToSceneCoord(p));
  const centerX = mapped.reduce((sum, p) => sum + p[0], 0) / mapped.length;
  const centerY = mapped.reduce((sum, p) => sum + p[1], 0) / mapped.length;

  let closestRoadAngle = 0;
  let closestDistance = Infinity;

  // Encontrar a rua mais próxima
  roads.forEach((road) => {
    if (!road.points || road.points.length < 2) return;

    // Usar os pontos da rua para calcular a direção
    for (let i = 0; i < road.points.length - 1; i++) {
      const p1 = road.points[i];
      const p2 = road.points[i + 1];

      // Calcular direção da estrada (aplica transformação de coordenadas)
      const mp1 = mapToSceneCoord(p1);
      const mp2 = mapToSceneCoord(p2);
      const roadDx = mp2[0] - mp1[0];
      const roadDy = mp2[1] - mp1[1];
      let roadAngle = Math.atan2(roadDy, roadDx);

      // Calcular distância do prédio ao ponto médio da rua (em coords de cena)
      const midX = (mp1[0] + mp2[0]) / 2;
      const midY = (mp1[1] + mp2[1]) / 2;
      const distance = Math.sqrt((centerX - midX) ** 2 + (centerY - midY) ** 2);

      if (distance < closestDistance) {
        closestDistance = distance;
        // Orientação perpendicular à rua.
        closestRoadAngle = roadAngle - Math.PI / 2;
      }
    }
  });

  return closestRoadAngle;
}

// Componente para renderizar edifícios com orientação corrigida
function Building({ building, roads }) {
  if (!building || !building.points || building.points.length < 3) {
    return null;
  }
  try {
    // Calcular centroide no sistema de cena (aplica mapToSceneCoord)
    const mappedPoints = building.points.map((p) => mapToSceneCoord(p));
    const centerX = mappedPoints.reduce((sum, p) => sum + p[0], 0) / mappedPoints.length;
    const centerY = mappedPoints.reduce((sum, p) => sum + p[1], 0) / mappedPoints.length;

    // Calcular orientação perpendicular às ruas (calculatePerpendiculalOrientation aplica mapeamento internamente)
    let rotation = calculatePerpendiculalOrientation(building.points, roads);
    if (MIRROR_X) rotation = -rotation;

    // Criar shape em coordenadas locais (centralizadas no centroide, em sistema de cena)
    const localPoints = mappedPoints.map((p) => [p[0] - centerX, p[1] - centerY]);

    const shape = new THREE.Shape();
    shape.moveTo(localPoints[0][0], localPoints[0][1]);
    for (let i = 1; i < localPoints.length; i++) {
      shape.lineTo(localPoints[i][0], localPoints[i][1]);
    }

    const depth = building.height || 10;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
    });

    // Fazer a extrusão apontar para o eixo Y
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, depth / 2, 0);

    const color = building.color || 0xa9a9a9;

    // Posicionar o mesh no centroide e rotacionar em Y para alinhar com a rua
    return (
      <mesh geometry={geometry} position={[centerX, 0, centerY]} rotation={[0, rotation, 0]}>
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.7} />
      </mesh>
    );
  } catch (e) {
    console.warn('Building render error:', e.message);
    return null;
  }
}

// Componente para renderizar estradas
function Road({ road }) {
  if (!road || !road.points || road.points.length < 2) {
    return null;
  }

  try {
    // Construir uma faixa plana (ribbon) como BufferGeometry para evitar paredes verticais
    const pts = road.points.map((p) => mapToSceneCoord(p));
    const width = road.width || 6;
    const half = width / 2;

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x = p[0];
      const z = p[1];

      // Calcular tangente aproximada
      let dx = 0;
      let dz = 0;
      if (i < pts.length - 1) {
        dx = pts[i + 1][0] - x;
        dz = pts[i + 1][1] - z;
      } else {
        dx = x - pts[i - 1][0];
        dz = z - pts[i - 1][1];
      }

      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= len;
      dz /= len;

      // Perpendicular (no plano XZ)
      const px = -dz;
      const pz = dx;

      const lx = x + px * half;
      const lz = z + pz * half;
      const rx = x - px * half;
      const rz = z - pz * half;

      // Y levemente acima do solo
      const y = 0.01;

      positions.push(lx, y, lz);
      positions.push(rx, y, rz);

      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      const t = pts.length > 1 ? i / (pts.length - 1) : 0;
      uvs.push(t, 0);
      uvs.push(t, 1);
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const a = 2 * i;
      const b = 2 * i + 1;
      const c = 2 * (i + 1);
      const d = 2 * (i + 1) + 1;

      indices.push(a, c, b);
      indices.push(c, d, b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    geometry.computeBoundingSphere();

    return (
      <mesh geometry={geometry} position={[0, 0, 0]}>
        <meshStandardMaterial color={road.color || 0x333333} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    );
  } catch (e) {
    console.warn('Road render error:', e.message);
    return null;
  }
}

// Componente para renderizar amenidades
function Amenity({ amenity }) {
  if (!amenity || !amenity.position) {
    return null;
  }

  try {
    const pos = mapToSceneCoord(amenity.position);
    return (
      <mesh position={[pos[0], amenity.position[2] || 1, pos[1]]}>
        <cylinderGeometry args={[0.8, 0.8, 2, 8]} />
        <meshStandardMaterial color={amenity.color || 0x00ffff} />
      </mesh>
    );
  } catch (e) {
    console.warn('Amenity render error:', e.message);
    return null;
  }
}

// Componente principal da cena
function SceneContent({ mapData }) {
  const controlsRef = useRef();

  useFrame(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.update();
      } catch (e) {
        // Ignore control update errors
      }
    }
  });

  if (!mapData) {
    return null;
  }

  const buildings = mapData.buildings || [];
  const roads = mapData.roads || [];
  const amenities = mapData.amenities || [];

  const hasData = buildings.length > 0 || roads.length > 0;

  if (!hasData) {
    return (
      <>
        <ambientLight intensity={0.7} />
        <directionalLight position={[100, 100, 100]} intensity={1} />
        <hemisphereLight intensity={0.4} />
        <gridHelper args={[500, 50]} position={[0, -0.1, 0]} />
        <fog attach="fog" args={[0x87ceeb, 100, 2000]} />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[100, 100, 100]} intensity={1} />
      <hemisphereLight intensity={0.4} />

      {/* Solo (ground) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}> 
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color={0x8fbf6f} roughness={1} />
      </mesh>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        autoRotate={false}
        enableZoom={true}
        enablePan={true}
      />

      {roads.map((road) => (
        <Road key={`r-${road.id}`} road={road} />
      ))}

      {buildings.map((building) => (
        <Building key={`b-${building.id}`} building={building} roads={roads} />
      ))}

      {amenities.map((amenity) => (
        <Amenity key={`a-${amenity.id}`} amenity={amenity} />
      ))}

      <gridHelper args={[500, 50]} position={[0, -0.1, 0]} />
      <fog attach="fog" args={[0x87ceeb, 100, 2000]} />
    </>
  );
}

export default function Map3DSceneWeb({ mapData, zoom = 50 }) {
  return (
    <Canvas
      camera={{
        position: [0, zoom, zoom],
        fov: 45,
        near: 0.1,
        far: 10000,
      }}
      gl={{
        antialias: true,
        alpha: true,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent mapData={mapData} />
    </Canvas>
  );
}
