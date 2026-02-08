// AppWeb.js - Versão Web pura
import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

export default function AppWeb() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Inicializar Three.js
    if (!mountRef.current) return;

    try {
      const width = window.innerWidth;
      const height = window.innerHeight * 0.85; // Deixar espaço para status bar

      // Criar cena
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87ceeb);
      scene.fog = new THREE.Fog(0x87ceeb, 100, 2000);
      sceneRef.current = scene;

      // Criar câmera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      camera.position.set(0, 60, 60);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Criar renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Iluminação
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(100, 100, 100);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
      scene.add(hemisphereLight);

      // Grid
      const gridHelper = new THREE.GridHelper(500, 50);
      gridHelper.position.y = -0.1;
      scene.add(gridHelper);

      // Renderizar cena
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Controles
      let mouseDown = false;
      let mouseX = 0;
      let mouseY = 0;
      let targetRotationX = 0;
      let targetRotationY = 0;

      renderer.domElement.addEventListener('mousedown', (e) => {
        mouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
      });

      renderer.domElement.addEventListener('mousemove', (e) => {
        if (!mouseDown) return;
        const deltaX = e.clientX - mouseX;
        const deltaY = e.clientY - mouseY;
        targetRotationY += deltaX * 0.01;
        targetRotationX += deltaY * 0.01;
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Aplicar rotação suave
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01);
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();
        camera.position.applyAxisAngle(right, deltaY * 0.01);
        camera.lookAt(0, 0, 0);
      });

      renderer.domElement.addEventListener('mouseup', () => {
        mouseDown = false;
      });

      // Zoom
      renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const direction = camera.position.clone().normalize();
        const distance = camera.position.length();
        const newDistance = distance + e.deltaY * 0.1;
        if (newDistance > 10 && newDistance < 500) {
          camera.position.copy(direction.multiplyScalar(newDistance));
        }
      });

      // Carregar dados
      const loadMapData = async () => {
        try {
          setLoading(true);
          setError(null);

          const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `[out:json];(
              way["building"](-23.60,-46.70,-23.50,-46.60);
              way["highway"](-23.60,-46.70,-23.50,-46.60);
            );out geom;`,
          });

          if (!response.ok) {
            throw new Error('API error: ' + response.status);
          }

          const data = await response.json();
          console.log('Dados recebidos:', data);

          if (data.elements && data.elements.length > 0) {
            // Renderizar prédios
            data.elements.forEach((element) => {
              if (element.type === 'way' && element.tags) {
                if (element.tags.building && element.geometry) {
                  renderBuilding(scene, element, -23.5505, -46.6333);
                }
                if (element.tags.highway && element.geometry) {
                  renderRoad(scene, element, -23.5505, -46.6333);
                }
              }
            });

            setMapData({
              buildings: data.elements.filter((e) => e.type === 'way' && e.tags?.building).length,
              roads: data.elements.filter((e) => e.type === 'way' && e.tags?.highway).length,
            });
          }

          setLoading(false);
        } catch (err) {
          console.error('Erro:', err);
          setError('Erro ao carregar dados: ' + err.message);
          setLoading(false);
        }
      };

      loadMapData();

      // Handle resize
      const handleResize = () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight * 0.85;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    } catch (err) {
      console.error('Erro ao inicializar:', err);
      setError('Erro ao inicializar: ' + err.message);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        * { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            zIndex: 10,
          }}
        >
          <div
            style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #2c3e50',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px',
            }}
          ></div>
          <div style={{ fontSize: '16px', color: '#666' }}>
            {error || 'Carregando mapa 3D...'}
          </div>
        </div>
      )}

      <div
        ref={mountRef}
        style={{ flex: 1, backgroundColor: '#87ceeb', position: 'relative' }}
      />

      {mapData && !loading && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#2c3e50',
            color: '#fff',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          <div>📍 Lat: -23.550500 | Lon: -46.633300</div>
          <div>🏗️ Prédios: {mapData.buildings} | 🛣️ Ruas: {mapData.roads}</div>
          <div>💡 Dica: Arraste para rotacionar, role para zoom</div>
        </div>
      )}
    </div>
  );
}

function renderBuilding(scene, element, centerLat, centerLon) {
  try {
    const geometry = element.geometry;
    if (!geometry || geometry.length < 3) return;

    const points = geometry.map((coord) => {
      const x = (coord.lon - centerLon) * 111000 * Math.cos((centerLat * Math.PI) / 180);
      const z = (coord.lat - centerLat) * 111000;
      return new THREE.Vector2(x, z);
    });

    const shape = new THREE.Shape(points);
    const height = Math.random() * 30 + 10;

    const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });

    extrudeGeometry.translate(0, height / 2, 0);

    const color = new THREE.Color().setHSL(Math.random(), 0.3, 0.6);
    const mesh = new THREE.Mesh(
      extrudeGeometry,
      new THREE.MeshStandardMaterial({ color })
    );

    scene.add(mesh);
  } catch (e) {
    console.warn('Erro ao renderizar prédio:', e.message);
  }
}

function renderRoad(scene, element, centerLat, centerLon) {
  try {
    const geometry = element.geometry;
    if (!geometry || geometry.length < 2) return;

    const points = geometry.map((coord) => {
      const x = (coord.lon - centerLon) * 111000 * Math.cos((centerLat * Math.PI) / 180);
      const z = (coord.lat - centerLat) * 111000;
      return new THREE.Vector3(x, 0.05, z);
    });

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 12, 2, 4);

    const mesh = new THREE.Mesh(
      tubeGeometry,
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );

    scene.add(mesh);
  } catch (e) {
    console.warn('Erro ao renderizar rua:', e.message);
  }
}
