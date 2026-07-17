import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* =========================
   1. 场景、相机与渲染器
   ========================= */
const sceneContainer = document.querySelector("#scene-container");
const statusText = document.querySelector("#status");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050d);
scene.fog = new THREE.FogExp2(0x02050d, 0.012);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 1.5, 15);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
sceneContainer.append(renderer.domElement);

/* =========================
   2. OrbitControls 交互控制
   ========================= */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 25;
controls.target.set(0, 0, 0);

/* =========================
   3. 星空背景
   ========================= */
function createStarField() {
  const starCount = 1800;
  const positions = new Float32Array(starCount * 3);

  for (let index = 0; index < starCount; index += 1) {
    const radius = THREE.MathUtils.randFloat(35, 150);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const offset = index * 3;

    positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = radius * Math.cos(phi);
    positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xc7dcff,
    size: 0.12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

const starField = createStarField();

/* =========================
   4. 3D 星球网格
   ========================= */
const PLANET_RADIUS = 5;
const planetGroup = new THREE.Group();
scene.add(planetGroup);

const planetGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 96, 64);
const planetPositions = planetGeometry.getAttribute("position");
const planetColors = [];
const deepBlue = new THREE.Color(0x173f4b);
const livingGreen = new THREE.Color(0x3f7655);

// 根据顶点高度混合深蓝与深绿，形成球面渐变色。
for (let index = 0; index < planetPositions.count; index += 1) {
  const normalizedHeight = THREE.MathUtils.clamp(
    (planetPositions.getY(index) / PLANET_RADIUS + 1) / 2,
    0,
    1,
  );
  const color = deepBlue.clone().lerp(livingGreen, normalizedHeight);

  planetColors.push(color.r, color.g, color.b);
}

planetGeometry.setAttribute(
  "color",
  new THREE.Float32BufferAttribute(planetColors, 3),
);

const planetMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.82,
  metalness: 0.04,
});

const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planetGroup.add(planet);

/* =========================
   5. 环境光与定向光
   ========================= */
const ambientLight = new THREE.AmbientLight(0x8eb8bc, 1.15);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xc8ffe5, 3.2);
directionalLight.position.set(7, 9, 10);
scene.add(directionalLight);

const rimLight = new THREE.DirectionalLight(0x477dff, 1.3);
rimLight.position.set(-8, -2, -7);
scene.add(rimLight);

/* =========================
   6. Raycaster 光线投射
   ========================= */
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerStart = new THREE.Vector2();
const plantedObjects = [];

renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerStart.set(event.clientX, event.clientY);
});

renderer.domElement.addEventListener("pointerup", (event) => {
  const pointerTravel = pointerStart.distanceTo(
    new THREE.Vector2(event.clientX, event.clientY),
  );

  // OrbitControls 拖拽结束时不触发种植。
  if (pointerTravel > 4) return;

  plantAtPointer(event);
});

function plantAtPointer(event) {
  const canvasBounds = renderer.domElement.getBoundingClientRect();

  pointerNdc.x =
    ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
  pointerNdc.y =
    -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;

  raycaster.setFromCamera(pointerNdc, camera);

  const [intersection] = raycaster.intersectObject(planet, false);
  if (!intersection) return;

  createPlantPlaceholder(intersection.point);
}

/* =========================
   7. 3D 植物占位几何体
   ========================= */
function createPlantPlaceholder(surfacePoint) {
  // 球心位于原点，因此碰撞点归一化后就是向外的表面法线。
  const outwardNormal = surfacePoint.clone().normalize();
  const plantHeight = THREE.MathUtils.randFloat(0.55, 1.05);
  const geometry = new THREE.ConeGeometry(
    THREE.MathUtils.randFloat(0.12, 0.22),
    plantHeight,
    7,
  );
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(
      THREE.MathUtils.randFloat(0.28, 0.42),
      0.55,
      0.52,
    ),
    roughness: 0.7,
  });
  const plantMesh = new THREE.Mesh(geometry, material);

  // ConeGeometry 默认沿 Y 轴生长，将其旋转到球面法线方向。
  plantMesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    outwardNormal,
  );
  plantMesh.position.copy(
    outwardNormal.clone().multiplyScalar(PLANET_RADIUS + plantHeight / 2),
  );

  planetGroup.add(plantMesh);
  plantedObjects.push(plantMesh);
  statusText.textContent = `星球上已有 ${plantedObjects.length} 株 3D 植物`;
}

/* =========================
   8. 响应式尺寸更新
   ========================= */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/* =========================
   9. requestAnimationFrame 循环
   ========================= */
function animate() {
  requestAnimationFrame(animate);

  controls.update();
  starField.rotation.y += 0.00008;
  renderer.render(scene, camera);
}

animate();
