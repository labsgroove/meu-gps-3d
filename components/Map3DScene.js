// components/Map3DScene.js
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Componente para renderizar edifícios
function Building({ building }) {
  if (!building || !building.points || building.points.length < 3) {
    return null;
  }

  try {
    const shape = new THREE.Shape();
    const points = building.points;

    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], points[i][1]);
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: building.height || 10,
      bevelEnabled: false,
    });

    geometry.translate(0, (building.height || 10) / 2, 0);

    const color = building.color || 0xa9a9a9;

    return (
      <mesh geometry={geometry} position={[0, 0, 0]}>
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
    const points = road.points.map((p) => new THREE.Vector3(p[0], 0.1, p[1]));

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 12, Math.max(0.5, road.width / 4), 4);

    return (
      <mesh geometry={geometry} position={[0, 0, 0]}>
        <meshStandardMaterial color={road.color || 0xffffff} roughness={0.9} />
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
    return (
      <mesh position={amenity.position}>
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

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        autoRotate={false}
        enableZoom={true}
        enablePan={true}
      />

      {buildings.map((building) => (
        <Building key={`b-${building.id}`} building={building} />
      ))}

      {roads.map((road) => (
        <Road key={`r-${road.id}`} road={road} />
      ))}

      {amenities.map((amenity) => (
        <Amenity key={`a-${amenity.id}`} amenity={amenity} />
      ))}

      <gridHelper args={[500, 50]} position={[0, -0.1, 0]} />
      <fog attach="fog" args={[0x87ceeb, 100, 2000]} />
    </>
  );
}

export default function Map3DScene({ mapData, zoom = 50 }) {
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
