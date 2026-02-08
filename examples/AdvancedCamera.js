// examples/AdvancedCamera.js
// Exemplo: Câmera avançada com pré-configurações

import React, { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Pré-configurações de câmera
export const CAMERA_PRESETS = {
  topDown: {
    name: 'Vista Superior',
    position: [0, 200, 10],
    target: [0, 0, 0],
    zoom: 1,
    fov: 30,
  },
  isometric: {
    name: 'Vista Isométrica',
    position: [100, 100, 100],
    target: [0, 0, 0],
    zoom: 1,
    fov: 45,
  },
  streetLevel: {
    name: 'Nível da Rua',
    position: [0, 3, 20],
    target: [0, 0, 0],
    zoom: 1,
    fov: 60,
  },
  bird: {
    name: 'Visão de Pássaro',
    position: [50, 150, 50],
    target: [0, 0, 0],
    zoom: 1,
    fov: 35,
  },
  orbit: {
    name: 'Órbita',
    position: [80, 60, 80],
    target: [0, 0, 0],
    zoom: 1,
    fov: 50,
  },
};

// Hook para controlar câmera
export function useCameraControl() {
  const { camera } = useThree();

  const setCameraPreset = (preset) => {
    if (CAMERA_PRESETS[preset]) {
      const p = CAMERA_PRESETS[preset];
      camera.position.set(...p.position);
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
    }
  };

  const focusOn = (point, distance = 50) => {
    camera.position.set(
      point[0] + distance,
      distance,
      point[2] + distance
    );
    camera.lookAt(...point);
    camera.updateProjectionMatrix();
  };

  const animate = (startPos, endPos, duration = 2000) => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      camera.position.x = startPos[0] + (endPos[0] - startPos[0]) * progress;
      camera.position.y = startPos[1] + (endPos[1] - startPos[1]) * progress;
      camera.position.z = startPos[2] + (endPos[2] - startPos[2]) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  };

  return { setCameraPreset, focusOn, animate };
}

// Componente de controle de câmera
export function CameraController({ onPresetChange }) {
  const controlsRef = useRef();
  const { setCameraPreset } = useCameraControl();

  const handlePresetClick = (presetKey) => {
    setCameraPreset(presetKey);
    onPresetChange?.(presetKey);
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      autoRotate={false}
      enableZoom={true}
      enablePan={true}
      minDistance={10}
      maxDistance={500}
    />
  );
}

// Helpers de animação
export const cameraAnimations = {
  // Rotação contínua
  autoRotate: (camera, speed = 0.001) => {
    camera.position.applyAxisAngle(
      { x: 0, y: 1, z: 0 },
      speed
    );
  },

  // Zoom suave
  smoothZoom: (camera, target, duration = 500) => {
    const startPos = camera.position.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const distance = startPos.distanceTo(target);
      const direction = target.clone().sub(startPos).normalize();

      camera.position.copy(
        startPos.clone().add(
          direction.multiplyScalar(distance * progress)
        )
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  },

  // Orbit around point
  orbit: (camera, center, radius, speed = 0.001) => {
    const x = camera.position.x - center[0];
    const z = camera.position.z - center[2];
    const angle = Math.atan2(z, x) + speed;

    camera.position.x = center[0] + radius * Math.cos(angle);
    camera.position.z = center[2] + radius * Math.sin(angle);
    camera.lookAt(...center);
  },

  // Pan
  pan: (camera, direction, distance) => {
    const movement = new (require('three')).Vector3(...direction)
      .normalize()
      .multiplyScalar(distance);

    camera.position.add(movement);
  },

  // Zoom to fit bounding box
  zoomToFit: (camera, boundingBox, padding = 1.2) => {
    const center = new (require('three')).Vector3(
      (boundingBox.min[0] + boundingBox.max[0]) / 2,
      (boundingBox.min[1] + boundingBox.max[1]) / 2,
      (boundingBox.min[2] + boundingBox.max[2]) / 2
    );

    const size = new (require('three')).Vector3(
      boundingBox.max[0] - boundingBox.min[0],
      boundingBox.max[1] - boundingBox.min[1],
      boundingBox.max[2] - boundingBox.min[2]
    );

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    cameraZ *= padding;

    camera.position.copy(center);
    camera.position.z += cameraZ;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  },
};
