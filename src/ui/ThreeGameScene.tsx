import { useEffect, useRef } from "react";

type ThreeRuntime = typeof import("three");
type ThreeGameSceneKind = "cup-pong" | "darts" | "battleship";
type ThreeGroup = import("three").Group;
type ThreeMesh = import("three").Mesh;
type ThreeObject = import("three").Object3D;
type ThreeRenderer = import("three").WebGLRenderer;

interface ThreeGameSceneProps {
  kind: ThreeGameSceneKind;
  stateKey: string;
  intensity?: number;
  className?: string;
}

export function ThreeGameScene({ kind, stateKey, intensity = 0, className = "" }: ThreeGameSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let renderer: ThreeRenderer | undefined;
    let root: ThreeGroup | undefined;

    void (async () => {
      const THREE = await import("three");
      if (disposed) return;

      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      } catch {
        host.dataset.webgl = "unavailable";
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 3.2, 6.2);
      camera.lookAt(0, 0.25, 0);

      const ambient = new THREE.AmbientLight(0xffffff, 1.4);
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(3, 5, 4);
      const rim = new THREE.DirectionalLight(0x8ee7ff, 1.1);
      rim.position.set(-4, 3, -3);
      scene.add(ambient, key, rim);

      root = new THREE.Group();
      scene.add(root);
      buildScene(THREE, kind, root, intensity);

      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const animate = () => {
        if (disposed || !renderer || !root) return;
        frame = requestAnimationFrame(animate);
        const time = performance.now() / 1000;
        root.rotation.y = Math.sin(time * 0.36) * 0.055;
        root.children.forEach((child, index) => {
          child.position.y += Math.sin(time * 1.3 + index) * 0.0008;
        });
        renderer.render(scene, camera);
      };
      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (root) disposeObject(root);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [kind, stateKey, intensity]);

  return <div className={`three-game-scene ${kind}-three-scene ${className}`} ref={hostRef} aria-hidden="true" />;
}

function buildScene(THREE: ThreeRuntime, kind: ThreeGameSceneKind, root: ThreeGroup, intensity: number) {
  if (kind === "cup-pong") buildCupPongScene(THREE, root, intensity);
  if (kind === "darts") buildDartsScene(THREE, root, intensity);
  if (kind === "battleship") buildBattleshipScene(THREE, root, intensity);
}

function buildCupPongScene(THREE: ThreeRuntime, root: ThreeGroup, intensity: number) {
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(4.9, 0.18, 6.2),
    new THREE.MeshStandardMaterial({ color: 0x126353, roughness: 0.62, metalness: 0.05 })
  );
  table.position.y = -0.42;
  root.add(table);

  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.02, 5.6),
    new THREE.MeshStandardMaterial({ color: 0xf9f0d6, roughness: 0.8 })
  );
  line.position.y = -0.28;
  root.add(line);

  const cupRows = [
    [[0, -2.05]],
    [[-0.42, -1.55], [0.42, -1.55]],
    [[-0.84, -1.05], [0, -1.05], [0.84, -1.05]]
  ];
  cupRows.flat().forEach(([x, z], index) => root.add(createCup(THREE, x, z, 0xe7332f, index === 0 ? 1 + intensity * 0.16 : 1)));
  cupRows.flat().forEach(([x, z], index) => root.add(createCup(THREE, x, -z, 0x236fd9, index === 0 ? 1.05 : 1)));

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.34 })
  );
  ball.position.set(intensity * 0.35, 0.8 + intensity * 0.38, 0.15);
  root.add(ball);
}

function createCup(THREE: ThreeRuntime, x: number, z: number, color: number, scale = 1) {
  const group = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.18, 0.46, 32, 1, true),
    new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.02, side: THREE.DoubleSide })
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.025, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.28 })
  );
  rim.position.y = 0.23;
  rim.rotation.x = Math.PI / 2;
  group.add(cup, rim);
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  return group;
}

function buildDartsScene(THREE: ThreeRuntime, root: ThreeGroup, intensity: number) {
  const back = new THREE.Mesh(
    new THREE.CylinderGeometry(1.82, 1.82, 0.12, 80),
    new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.72 })
  );
  back.rotation.x = Math.PI / 2;
  back.position.z = -0.04;
  root.add(back);

  [
    { radius: 1.62, color: 0xf6ebd2 },
    { radius: 1.24, color: 0x101820 },
    { radius: 0.9, color: 0xdf3d35 },
    { radius: 0.58, color: 0x2bbf8e },
    { radius: 0.2, color: 0xdf3d35 },
    { radius: 0.1, color: 0x2bbf8e }
  ].forEach((ring, index) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(ring.radius, ring.radius, 0.035, 96),
      new THREE.MeshStandardMaterial({ color: ring.color, roughness: 0.6 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = index * 0.025;
    root.add(mesh);
  });

  for (let index = 0; index < 3; index += 1) {
    const dart = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.92, 12),
      new THREE.MeshStandardMaterial({ color: 0xf9f0d6, roughness: 0.36 })
    );
    shaft.rotation.x = Math.PI / 2;
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: index % 2 ? 0x2674d9 : 0xe7332f, roughness: 0.42 })
    );
    fin.position.z = 0.48;
    fin.rotation.x = -Math.PI / 2;
    dart.add(shaft, fin);
    dart.position.set(-0.62 + index * 0.5 + intensity * 0.08, 0.28 - index * 0.18, 0.72 + index * 0.09);
    dart.rotation.z = -0.35 + index * 0.16;
    root.add(dart);
  }
}

function buildBattleshipScene(THREE: ThreeRuntime, root: ThreeGroup, intensity: number) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.4, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0x6dcbe3, roughness: 0.44, metalness: 0.08 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.38;
  root.add(water);

  const shipColors = [0x4d6876, 0x344b5a, 0x607d8b];
  for (let index = 0; index < 4; index += 1) {
    const ship = new THREE.Mesh(
      new THREE.BoxGeometry(0.42 + index * 0.18, 0.18, 0.16),
      new THREE.MeshStandardMaterial({ color: shipColors[index % shipColors.length], roughness: 0.48, metalness: 0.18 })
    );
    ship.position.set(-1.45 + index * 0.92, -0.18, -0.72 + Math.sin(index) * 0.55);
    ship.rotation.y = index % 2 ? 0.18 : -0.24;
    root.add(ship);
  }

  const splashCount = Math.min(7, 2 + Math.round(intensity));
  for (let index = 0; index < splashCount; index += 1) {
    const splash = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + index * 0.012, 16, 8),
      new THREE.MeshStandardMaterial({ color: index % 2 ? 0xffffff : 0xffd33d, roughness: 0.2, emissive: index % 2 ? 0x2aa8d8 : 0xb05b00, emissiveIntensity: 0.35 })
    );
    splash.position.set(-1 + index * 0.34, 0.05 + Math.sin(index) * 0.16, 0.88 - index * 0.2);
    root.add(splash);
  }
}

function disposeObject(object: ThreeObject) {
  object.traverse((child) => {
    const mesh = child as ThreeMesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose?.();
  });
}
