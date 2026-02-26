import React, { useRef, useState, memo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MAP_CONFIG, MATERIALS } from "../config/mapConfig.js";

// Se o mapa estiver espelhado no seu input, ative esse flag para inverter X
const MIRROR_X = true;

// Estruturas acima de 5000 m² (ex: estádios, shoppings) não são rotacionadas
// para se alinhar com ruas, pois precisam manter sua geometria interna consistente
const LARGE_STRUCTURE_AREA_THRESHOLD = 5000;

// Cache para orientações de prédios já calculadas
const orientationCache = new Map();

// Cache de geometrias de ruas para evitar recomputos
const roadGeomCache = new Map();

function mapToSceneCoord(p) {
  if (!p) return [0, 0];
  return [MIRROR_X ? -p[0] : p[0], p[1]];
}

function locationDeltaMeters(currentLocation, anchorLocation) {
  if (!currentLocation || !anchorLocation) return [0, 0];
  const anchorLat = anchorLocation.latitude;
  const safeCos = Math.max(0.00001, Math.cos((anchorLat * Math.PI) / 180));
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * safeCos;

  const deltaX =
    (currentLocation.longitude - anchorLocation.longitude) * metersPerDegreeLon;
  const deltaZ =
    (currentLocation.latitude - anchorLocation.latitude) * metersPerDegreeLat;

  const distance = Math.hypot(deltaX, deltaZ);
  if (!Number.isFinite(distance)) return [0, 0];
  // Evita deslocar o mundo para muito longe quando GPS muda bruscamente.
  if (distance > MAP_CONFIG.ACTIVE_RADIUS_METERS * 1.2) return [0, 0];

  return [deltaX, deltaZ];
}

// Função para calcular a orientação perpendicular às ruas próximas (com cache)
function calculatePerpendiculalOrientation(buildingId, buildingPoints, roads) {
  const cacheKey =
    buildingId !== undefined && buildingId !== null
      ? `b-${buildingId}`
      : `${buildingPoints.map((p) => p.join(",")).join(";")}`;

  if (orientationCache.has(cacheKey)) {
    return orientationCache.get(cacheKey);
  }

  if (!roads || roads.length === 0) return 0;
  if (roads.length > 240) return 0;

  // Calcular centroide do prédio (aplicando transformação de coordenadas)
  const mapped = buildingPoints.map((p) => mapToSceneCoord(p));
  const centerX = mapped.reduce((sum, p) => sum + p[0], 0) / mapped.length;
  const centerY = mapped.reduce((sum, p) => sum + p[1], 0) / mapped.length;

  // Calcular área do polígono usando fórmula do shoelace
  // Se a estrutura é muito grande (ex: estádio), não rotacionar
  let area = 0;
  for (let i = 0; i < mapped.length; i++) {
    const j = (i + 1) % mapped.length;
    area += mapped[i][0] * mapped[j][1];
    area -= mapped[j][0] * mapped[i][1];
  }
  area = Math.abs(area) / 2;

  // Se estrutura > threshold (ex: estádios, grandes complexos), não rotacionar
  // Mantém o alinhamento geométrico natural da estrutura
  if (area > LARGE_STRUCTURE_AREA_THRESHOLD) {
    orientationCache.set(cacheKey, 0);
    return 0;
  }

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
    const centerX =
      mappedPoints.reduce((sum, p) => sum + p[0], 0) / mappedPoints.length;
    const centerY =
      mappedPoints.reduce((sum, p) => sum + p[1], 0) / mappedPoints.length;

    // Calcular orientação perpendicular às ruas (calculatePerpendiculalOrientation aplica mapeamento internamente)
    let rotation = calculatePerpendiculalOrientation(
      building.id,
      building.points,
      roads,
    );
    // NOTA: calculatePerpendiculalOrientation já aplica mapToSceneCoord aos pontos,
    // então a rotação já está corrigida para o espaço transformado. Não negar novamente!

    // Criar shape em coordenadas locais (centralizadas no centroide, em sistema de cena)
    const localPoints = mappedPoints.map((p) => [
      p[0] - centerX,
      p[1] - centerY,
    ]);

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
      <mesh
        geometry={geometry}
        position={[centerX, 0, centerY]}
        rotation={[0, rotation, 0]}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.2}
          roughness={0.7}
          shadowMap={false}
        />
      </mesh>
    );
  } catch (e) {
    console.warn("Building render error:", e.message);
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
    const anchor = pts[0];
    const localPts = pts.map((p) => [p[0] - anchor[0], p[1] - anchor[1]]);

    // Cache key baseado na forma local da rua (invariante à translação do observador)
    const lastLocal = localPts[localPts.length - 1] || [0, 0];
    const cacheKey = `road-${road.id}-${road.width || ""}-${localPts.length}-${Math.round(
      lastLocal[0],
    )}-${Math.round(lastLocal[1])}`;

    let cached = roadGeomCache.get(cacheKey);
    if (!cached) {
      // Largura base (em metros) aplicada com multiplicador global
      const baseWidth =
        (road.width || 6) * (MAP_CONFIG.ROAD_WIDTH_MULTIPLIER || 1);
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

        for (let i = 0; i < localPts.length; i++) {
          const p = localPts[i];
          const x = p[0];
          const z = p[1];

          // Tangente aproximada
          let dx = 0;
          let dz = 0;
          if (i < localPts.length - 1) {
            dx = localPts[i + 1][0] - x;
            dz = localPts[i + 1][1] - z;
          } else {
            dx = x - localPts[i - 1][0];
            dz = z - localPts[i - 1][1];
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

          const t = localPts.length > 1 ? i / (localPts.length - 1) : 0;
          uvs.push(t, 0);
          uvs.push(t, 1);
        }

        for (let i = 0; i < localPts.length - 1; i++) {
          const a = 2 * i;
          const b = 2 * i + 1;
          const c = 2 * (i + 1);
          const d = 2 * (i + 1) + 1;

          indices.push(a, c, b);
          indices.push(c, d, b);
        }

        const geometry = new THREE.BufferGeometry();
        const posAttr = new THREE.Float32BufferAttribute(positions, 3);
        const normalAttr = new THREE.Float32BufferAttribute(normals, 3);
        const uvAttr = new THREE.Float32BufferAttribute(uvs, 2);
        geometry.setAttribute("position", posAttr);
        geometry.setAttribute("normal", normalAttr);
        geometry.setAttribute("uv", uvAttr);
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();

        try {
          posAttr.setUsage(THREE.StaticDrawUsage);
          normalAttr.setUsage(THREE.StaticDrawUsage);
          uvAttr.setUsage(THREE.StaticDrawUsage);
          if (geometry.index) geometry.index.setUsage(THREE.StaticDrawUsage);
        } catch (e) {
          // alguns builds podem não suportar setUsage, ignorar
        }

        return geometry;
      };

      // Construir geometria do contorno (um pouco mais larga)
      const outlineGap = Math.max(
        0.4,
        (((road.width || 6) * (MAP_CONFIG.ROAD_WIDTH_MULTIPLIER || 1)) / 2) *
          0.08,
      );
      const outlineGeom = buildRibbon(half + outlineGap, outlineY);

      // Geometria principal da via
      const mainGeom = buildRibbon(half, mainY);

      cached = { outlineGeom, mainGeom };
      roadGeomCache.set(cacheKey, cached);
    }

    const outlineGeom = cached.outlineGeom;
    const mainGeom = cached.mainGeom;

    if (roadGeomCache.size > 2500) {
      roadGeomCache.clear();
    }

    const roadColor = road.color || 0x333333;
    const outlineColor = 0x000000;

    return (
      <group position={[anchor[0], 0, anchor[1]]}>
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
    console.warn("Road render error:", e.message);
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
    console.warn("Amenity render error:", e.message);
    return null;
  }
});

// Componente para renderizar o ponto de localização (esfera)
const LocationMarker = memo(function LocationMarker({ position }) {
  if (!position) {
    return null;
  }

  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.06;
      meshRef.current.scale.setScalar(pulse);
      meshRef.current.rotation.x += 0.006;
      meshRef.current.rotation.y += 0.012;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshStandardMaterial
        color={0xff0000}
        metalness={0.5}
        roughness={0.3}
        emissive={0x8a1200}
      />
    </mesh>
  );
});

// Componente principal da cena
function SceneContent({
  mapData,
  moveRef,
  onObserverMove,
  zoom = 50,
  location,
  renderAnchor,
}) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const [pointPosition] = useState([0, 1, 0]); // Sempre fixo no centro
  const keysPressed = useRef({});
  const movementAccumulator = useRef({
    deltaX: 0,
    deltaZ: 0,
    elapsedMs: 0,
  });

  // Estado para frustum culling
  const [visibleBuildingIds, setVisibleBuildingIds] = useState(new Set());
  const [visibleRoadIds, setVisibleRoadIds] = useState(new Set());
  const [visibleAmenityIds, setVisibleAmenityIds] = useState(new Set());
  const frustumRef = useRef(new THREE.Frustum());

  // Controlar movimento com WASD
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    // Mantém o ponto fixo no centro como target do OrbitControls
    if (controlsRef.current) {
      const pos = pointPosition;
      const desiredTarget = new THREE.Vector3(pos[0], pos[1], pos[2]);
      // Suaviza o movimento do target para evitar saltos bruscos
      controlsRef.current.target.lerp(
        desiredTarget,
        Math.min(1, 0.12 + delta * 10),
      );

      // Inicializa a posição da câmera uma vez (mantendo uma distância/offset inicial)
      if (!controlsRef.current.__initialized) {
        const offset = new THREE.Vector3(0, zoom, zoom);
        camera.position.set(
          pos[0] + offset.x,
          pos[1] + offset.y,
          pos[2] + offset.z,
        );
        controlsRef.current.update();
        controlsRef.current.__initialized = true;
      } else {
        // Não sobrescrever camera.position durante a interação — o OrbitControls gerencia órbita/zoom
        controlsRef.current.update();
      }
    }

    // Frustum Culling: Calcular frustum da câmera
    const projMatrix = new THREE.Matrix4();
    projMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustumRef.current.setFromProjectionMatrix(projMatrix);

    // Determinar quais objetos estão no frustum
    if (mapData) {
      const visibleBuildings = new Set();
      const visibleRoads = new Set();
      const visibleAmenities = new Set();

      // Verificar buildings
      mapData.buildings?.forEach((building) => {
        if (building.points && building.points.length >= 3) {
          const mappedPoints = building.points.map((p) => mapToSceneCoord(p));
          const centerX =
            mappedPoints.reduce((sum, p) => sum + p[0], 0) /
            mappedPoints.length;
          const centerY =
            mappedPoints.reduce((sum, p) => sum + p[1], 0) /
            mappedPoints.length;
          const buildingSphere = new THREE.Sphere(
            new THREE.Vector3(centerX, (building.height || 10) / 2, centerY),
            Math.max(
              ...mappedPoints.map((p) =>
                Math.sqrt((p[0] - centerX) ** 2 + (p[1] - centerY) ** 2),
              ),
            ) + 5,
          );
          if (frustumRef.current.intersectsSphere(buildingSphere)) {
            visibleBuildings.add(building.id);
          }
        }
      });

      // Verificar roads
      mapData.roads?.forEach((road) => {
        if (road.points && road.points.length >= 2) {
          const pts = road.points.map((p) => mapToSceneCoord(p));
          let minX = Math.min(...pts.map((p) => p[0]));
          let maxX = Math.max(...pts.map((p) => p[0]));
          let minZ = Math.min(...pts.map((p) => p[1]));
          let maxZ = Math.max(...pts.map((p) => p[1]));
          const centerX = (minX + maxX) / 2;
          const centerZ = (minZ + maxZ) / 2;
          const radius =
            Math.sqrt((maxX - minX) ** 2 + (maxZ - minZ) ** 2) / 2 + 10;
          const roadSphere = new THREE.Sphere(
            new THREE.Vector3(centerX, 0.2, centerZ),
            radius,
          );
          if (frustumRef.current.intersectsSphere(roadSphere)) {
            visibleRoads.add(road.id);
          }
        }
      });

      // Verificar amenities
      mapData.amenities?.forEach((amenity) => {
        if (amenity.position) {
          const pos = mapToSceneCoord(amenity.position);
          const amenitySphere = new THREE.Sphere(
            new THREE.Vector3(pos[0], amenity.position[2] || 1, pos[1]),
            2,
          );
          if (frustumRef.current.intersectsSphere(amenitySphere)) {
            visibleAmenities.add(amenity.id);
          }
        }
      });

      setVisibleBuildingIds(visibleBuildings);
      setVisibleRoadIds(visibleRoads);
      setVisibleAmenityIds(visibleAmenities);
    }

    const keys = keysPressed.current;
    const mobile = moveRef?.current || {};
    const inputX =
      (keys["a"] || mobile.left ? 1 : 0) - (keys["d"] || mobile.right ? 1 : 0);
    const inputZ =
      (keys["w"] || mobile.up ? 1 : 0) - (keys["s"] || mobile.down ? 1 : 0);

    if (inputX !== 0 || inputZ !== 0) {
      const speedMetersPerSecond = MAP_CONFIG.MOVEMENT_SPEED_MPS || 20;
      const inputLength = Math.hypot(inputX, inputZ) || 1;
      const normalizedX = inputX / inputLength;
      const normalizedZ = inputZ / inputLength;
      const stepMeters = speedMetersPerSecond * delta;

      movementAccumulator.current.deltaX +=
        (MIRROR_X ? -normalizedX : normalizedX) * stepMeters;
      movementAccumulator.current.deltaZ += normalizedZ * stepMeters;
    }

    movementAccumulator.current.elapsedMs += delta * 1000;
    const pendingDistance = Math.hypot(
      movementAccumulator.current.deltaX,
      movementAccumulator.current.deltaZ,
    );
    const moveFlushInterval = MAP_CONFIG.MOVEMENT_UPDATE_INTERVAL_MS || 80;
    const moveFlushDistance = MAP_CONFIG.MIN_MOVEMENT_UPDATE_METERS || 0.35;
    const shouldFlush =
      pendingDistance >= moveFlushDistance ||
      movementAccumulator.current.elapsedMs >= moveFlushInterval;

    if (shouldFlush) {
      const hasPendingMovement = pendingDistance > 0.0001;
      if (hasPendingMovement && typeof onObserverMove === "function") {
        onObserverMove(
          movementAccumulator.current.deltaX,
          movementAccumulator.current.deltaZ,
        );
      }
      movementAccumulator.current.deltaX = 0;
      movementAccumulator.current.deltaZ = 0;
      movementAccumulator.current.elapsedMs = 0;
    }
  });

  if (!mapData) {
    return null;
  }

  const buildings = mapData.buildings || [];
  const roads = mapData.roads || [];
  const amenities = mapData.amenities || [];
  const observerDelta = locationDeltaMeters(location, renderAnchor);
  const deltaScene = mapToSceneCoord(observerDelta);
  const maxShift = MAP_CONFIG.ACTIVE_RADIUS_METERS * 0.65;
  const worldShift = [
    Math.max(-maxShift, Math.min(maxShift, -deltaScene[0])),
    0,
    Math.max(-maxShift, Math.min(maxShift, -deltaScene[1])),
  ];

  // Filtrar apenas objetos visíveis
  const visibleBuildings = buildings.filter((b) =>
    visibleBuildingIds.has(b.id),
  );
  const visibleRoads = roads.filter((r) => visibleRoadIds.has(r.id));
  const visibleAmenities = amenities.filter((a) => visibleAmenityIds.has(a.id));

  return (
    <>
      <hemisphereLight
        skyColor={0xd8ecff}
        groundColor={0x48633a}
        intensity={0.74}
      />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[120, 180, 80]}
        intensity={0.85}
        color={0xfff2d6}
      />

      {/* Grupo que contém todo o mapa já relativo ao observador */}
      <group position={worldShift}>
        {/* Solo (ground) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color={0x8ebe6c} roughness={1} metalness={0} />
        </mesh>

        {visibleRoads.map((road) => (
          <Road key={`r-${road.id}`} road={road} />
        ))}

        {visibleBuildings.map((building) => (
          <Building
            key={`b-${building.id}`}
            building={building}
            roads={roads}
          />
        ))}

        {visibleAmenities.map((amenity) => (
          <Amenity key={`a-${amenity.id}`} amenity={amenity} />
        ))}
      </group>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        autoRotate={false}
        enableZoom={true}
        enablePan={false}
        rotateSpeed={0.6}
        minDistance={10}
        maxDistance={1500}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2}
      />

      <LocationMarker position={pointPosition} />
      <fog attach="fog" args={[0x9bd3f2, 90, 2200]} />
    </>
  );
}

export default function Map3DSceneWeb({
  mapData,
  zoom = 50,
  onObserverMove,
  location,
  renderAnchor,
}) {
  const [mobileControls, setMobileControls] = useState(false);
  const moveRef = useRef({ up: false, down: false, left: false, right: false });

  // Detectar se é mobile
  useEffect(() => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
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
    <div className="scene-wrapper">
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
          powerPreference: "high-performance",
          pixelRatio: Math.min(window.devicePixelRatio, 2),
        }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        className="map-canvas"
      >
        <SceneContent
          mapData={mapData}
          moveRef={moveRef}
          onObserverMove={onObserverMove}
          zoom={zoom}
          location={location}
          renderAnchor={renderAnchor}
        />
      </Canvas>

      {mobileControls && (
        <div className="mobile-dpad">
          <div className="dpad-up">
            <button
              type="button"
              className="dpad-btn"
              onMouseDown={() => handleMoveStart("up")}
              onMouseUp={() => handleMoveEnd("up")}
              onTouchStart={() => handleMoveStart("up")}
              onTouchEnd={() => handleMoveEnd("up")}
              onTouchCancel={() => handleMoveEnd("up")}
              onMouseLeave={() => handleMoveEnd("up")}
            >
              ↑
            </button>
          </div>

          <div className="dpad-left">
            <button
              type="button"
              className="dpad-btn"
              onMouseDown={() => handleMoveStart("left")}
              onMouseUp={() => handleMoveEnd("left")}
              onTouchStart={() => handleMoveStart("left")}
              onTouchEnd={() => handleMoveEnd("left")}
              onTouchCancel={() => handleMoveEnd("left")}
              onMouseLeave={() => handleMoveEnd("left")}
            >
              ←
            </button>
          </div>

          <div className="dpad-down">
            <button
              type="button"
              className="dpad-btn"
              onMouseDown={() => handleMoveStart("down")}
              onMouseUp={() => handleMoveEnd("down")}
              onTouchStart={() => handleMoveStart("down")}
              onTouchEnd={() => handleMoveEnd("down")}
              onTouchCancel={() => handleMoveEnd("down")}
              onMouseLeave={() => handleMoveEnd("down")}
            >
              ↓
            </button>
          </div>

          <div className="dpad-right">
            <button
              type="button"
              className="dpad-btn"
              onMouseDown={() => handleMoveStart("right")}
              onMouseUp={() => handleMoveEnd("right")}
              onTouchStart={() => handleMoveStart("right")}
              onTouchEnd={() => handleMoveEnd("right")}
              onTouchCancel={() => handleMoveEnd("right")}
              onMouseLeave={() => handleMoveEnd("right")}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
