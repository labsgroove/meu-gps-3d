import React, { useRef, useState, useMemo, memo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MAP_CONFIG, MATERIALS } from '../config/mapConfig';

// Se o mapa estiver espelhado no seu input, ative esse flag para inverter X
const MIRROR_X = true;

// Cache para orientações de prédios já calculadas
const orientationCache = new Map();

function mapToSceneCoord(p) {
  if (!p) return [0, 0];
  return [MIRROR_X ? -p[0] : p[0], p[1]];
}

// Função para calcular a orientação perpendicular às ruas próximas (com cache)
function calculatePerpendiculalOrientation(buildingPoints, roads) {
  const cacheKey = `${buildingPoints.map(p => p.join(',')).join(';')}`;
  
  if (orientationCache.has(cacheKey)) {
    return orientationCache.get(cacheKey);
  }

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

  orientationCache.set(cacheKey, closestRoadAngle);
  return closestRoadAngle;
}

// Componente para renderizar edifícios com orientação corrigida (memoizado)
const Building = memo(function Building({ building, roads }) {
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

    // Fazer a extrusão apentar para o eixo Y
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, depth / 2, 0);

    const color = building.color || 0xa9a9a9;

    // Posicionar o mesh no centroide e rotacionar em Y para alinhar com a rua
    return (
      <mesh geometry={geometry} position={[centerX, 0, centerY]} rotation={[0, rotation, 0]}>
        <meshStandardMaterial 
          color={color} 
          metalness={0.2} 
          roughness={0.7}
          shadowMap={false}
        />
      </mesh>
    );
  } catch (e) {
    console.warn('Building render error:', e.message);
    return null;
  }
});

// Componente para renderizar estradas (memoizado)
const Road = memo(function Road({ road }) {
  if (!road || !road.points || road.points.length < 2) {
    return null;
  }

  try {
    // Converter pontos para coordenadas da cena
    const pts = road.points.map((p) => mapToSceneCoord(p));

    // Largura base (em metros) aplicada com multiplicador global
    const baseWidth = (road.width || 6) * (MAP_CONFIG.ROAD_WIDTH_MULTIPLIER || 1);
    const width = Math.max(0.5, baseWidth);
    const half = width / 2;

    // Elevação mais pronunciada para evitar z-fighting (levantar acima do solo)
    const mainY = 0.2;
    // Contorno ligeiramente abaixo da via principal, mas ainda acima do solo
    const outlineY = mainY - 0.01;

    // Função para construir ribbon geometry a partir de half-width e y
    const buildRibbon = (halfWidth, y) => {
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const x = p[0];
        const z = p[1];

        // Tangente aproximada
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

        // Perpendicular no plano XZ
        const px = -dz;
        const pz = dx;

        const lx = x + px * halfWidth;
        const lz = z + pz * halfWidth;
        const rx = x - px * halfWidth;
        const rz = z - pz * halfWidth;

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
      return geometry;
    };

    // Construir geometria do contorno (um pouco mais larga)
    const outlineGap = Math.max(0.4, width * 0.08);
    const outlineGeom = buildRibbon(half + outlineGap, outlineY);

    // Geometria principal da via
    const mainGeom = buildRibbon(half, mainY);

    // Cores
    const roadColor = road.color || 0x333333;
    // Contorno: escurece a cor principal para criar contraste
    const outlineColor = 0x000000;

    return (
      <group position={[0, 0, 0]}>
        <mesh geometry={outlineGeom} position={[0, 0, 0]}> 
          <meshStandardMaterial
            color={outlineColor}
            side={THREE.DoubleSide}
            polygonOffset={true}
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
            roughness={1}
            metalness={0}
          />
        </mesh>

        <mesh geometry={mainGeom} position={[0, 0, 0]}> 
          <meshStandardMaterial 
            color={roadColor} 
            roughness={MATERIALS.road?.roughness ?? 0.9} 
            metalness={MATERIALS.road?.metalness ?? 0}
            side={THREE.DoubleSide}
            shadowMap={false}
            polygonOffset={true}
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      </group>
    );
  } catch (e) {
    console.warn('Road render error:', e.message);
    return null;
  }
});

// Componente para renderizar amenidades (memoizado)
const Amenity = memo(function Amenity({ amenity }) {
  if (!amenity || !amenity.position) {
    return null;
  }

  try {
    const pos = mapToSceneCoord(amenity.position);
    return (
      <mesh position={[pos[0], amenity.position[2] || 1, pos[1]]}>
        <cylinderGeometry args={[0.8, 0.8, 2, 8]} />
        <meshStandardMaterial 
          color={amenity.color || 0x00ffff}
          shadowMap={false}
        />
      </mesh>
    );
  } catch (e) {
    console.warn('Amenity render error:', e.message);
    return null;
  }
});

// Componente para renderizar o ponto de localização (esfera)
const LocationMarker = memo(function LocationMarker({ position }) {
  if (!position) {
    return null;
  }

  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshStandardMaterial 
        color={0xff0000}
        metalness={0.5}
        roughness={0.3}
        emissive={0x660000}
      />
    </mesh>
  );
});

// Componente principal da cena
function SceneContent({ mapData, location, moveRef }) {
  const controlsRef = useRef();
  const [pointPosition, setPointPosition] = useState([0, 1, 0]);
  const keysPressed = useRef({});

  // Inicializar posição com a localização fornecida
  useMemo(() => {
    if (location) {
      const pos = mapToSceneCoord([location.longitude, location.latitude]);
      setPointPosition([pos[0], 1, pos[1]]);
    }
  }, [location]);

  // Controlar movimento com WASD
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.update();
      } catch (e) {
        // Ignore control update errors
      }
    }

    // Atualizar posição do ponto baseado em WASD ou controles mobile
    const moveSpeed = 0.5;
    const keys = keysPressed.current;
    const mobile = moveRef?.current || {};

    let moved = false;
    setPointPosition((prev) => {
      let newPos = [...prev];

      // Controles de teclado (WASD)
      if (keys['w'] || mobile.up) {
        newPos[2] -= moveSpeed; // Z negativo
        moved = true;
      }
      if (keys['s'] || mobile.down) {
        newPos[2] += moveSpeed; // Z positivo
        moved = true;
      }
      if (keys['a'] || mobile.left) {
        newPos[0] -= moveSpeed; // X negativo
        moved = true;
      }
      if (keys['d'] || mobile.right) {
        newPos[0] += moveSpeed; // X positivo
        moved = true;
      }

      return moved ? newPos : prev;
    });
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
        <ambientLight intensity={1} />
        <fog attach="fog" args={[0x87ceeb, 100, 2000]} />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={1} />

      {/* Solo (ground) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}> 
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial color={0x8fbf6f} />
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

      <LocationMarker position={pointPosition} />
      <fog attach="fog" args={[0x87ceeb, 100, 2000]} />
    </>
  );
}

export default function Map3DSceneWeb({ mapData, zoom = 50, location }) {
  const [mobileControls, setMobileControls] = useState(false);
  const moveRef = useRef({ up: false, down: false, left: false, right: false });

  // Detectar se é mobile
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setMobileControls(isMobile);
  }, []);

  const handleMoveStart = (direction) => {
    moveRef.current[direction] = true;
  };

  const handleMoveEnd = (direction) => {
    moveRef.current[direction] = false;
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{
          position: [0, zoom, zoom],
          fov: 45,
          near: 0.1,
          far: 10000,
        }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
          pixelRatio: Math.min(window.devicePixelRatio, 2),
        }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContent mapData={mapData} location={location} moveRef={moveRef} />
      </Canvas>

      {mobileControls && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 50px)',
            gap: '5px',
            zIndex: 100,
          }}
        >
          <div style={{ gridColumn: '2' }}>
            <button
              onMouseDown={() => handleMoveStart('up')}
              onMouseUp={() => handleMoveEnd('up')}
              onTouchStart={() => handleMoveStart('up')}
              onTouchEnd={() => handleMoveEnd('up')}
              style={{
                width: '50px',
                height: '50px',
                fontSize: '24px',
                borderRadius: '50%',
                border: '2px solid #333',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ↑
            </button>
          </div>

          <div style={{ gridColumn: '1' }}>
            <button
              onMouseDown={() => handleMoveStart('left')}
              onMouseUp={() => handleMoveEnd('left')}
              onTouchStart={() => handleMoveStart('left')}
              onTouchEnd={() => handleMoveEnd('left')}
              style={{
                width: '50px',
                height: '50px',
                fontSize: '24px',
                borderRadius: '50%',
                border: '2px solid #333',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ←
            </button>
          </div>

          <div style={{ gridColumn: '2' }}>
            <button
              onMouseDown={() => handleMoveStart('down')}
              onMouseUp={() => handleMoveEnd('down')}
              onTouchStart={() => handleMoveStart('down')}
              onTouchEnd={() => handleMoveEnd('down')}
              style={{
                width: '50px',
                height: '50px',
                fontSize: '24px',
                borderRadius: '50%',
                border: '2px solid #333',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ↓
            </button>
          </div>

          <div style={{ gridColumn: '3' }}>
            <button
              onMouseDown={() => handleMoveStart('right')}
              onMouseUp={() => handleMoveEnd('right')}
              onTouchStart={() => handleMoveStart('right')}
              onTouchEnd={() => handleMoveEnd('right')}
              style={{
                width: '50px',
                height: '50px',
                fontSize: '24px',
                borderRadius: '50%',
                border: '2px solid #333',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
