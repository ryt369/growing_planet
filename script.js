"use strict";

/* =========================
   1. DOM 元素与全局配置
   ========================= */
const planetContainer = document.querySelector("#planet-container");
const planetSvg = document.querySelector("#planet-svg");
const planetViewport = document.querySelector("#planet-viewport");
const planetBody = document.querySelector("#planet-body");
const planetSurface = document.querySelector("#planet-surface");
const plantsLayer = document.querySelector("#plants-layer");
const statusText = document.querySelector("#status");
const effectsCanvas = document.querySelector("#effects-canvas");
const effectsContext = effectsCanvas.getContext("2d");

const STORAGE_KEY = "planet-data";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PLANET_CENTER = { x: 300, y: 300 };
const PLANET_RADIUS = 250;
const PLANT_TEMPLATES = {
  sprout: `
    <svg class="plant-art plant-art--sprout" x="-36" y="-82" width="72" height="88" viewBox="0 0 72 88">
      <path d="M36 82 C35 61 35 40 37 20" fill="none" stroke="var(--stem-color)" stroke-width="5" stroke-linecap="round"/>
      <path d="M36 49 C22 45 13 34 14 22 C29 22 38 30 38 43 Z" fill="var(--leaf-color)"/>
      <path d="M37 35 C45 21 57 17 65 20 C62 35 52 43 37 45 Z" fill="var(--leaf-light)"/>
      <ellipse cx="36" cy="82" rx="16" ry="4" fill="var(--soil-color)" opacity=".28"/>
    </svg>`,
  grass: `
    <svg class="plant-art plant-art--grass" x="-36" y="-82" width="72" height="88" viewBox="0 0 72 88">
      <path d="M35 82 C30 62 21 43 10 29 C29 36 37 53 38 81 Z" fill="var(--leaf-color)"/>
      <path class="breathing-leaf" d="M37 82 C37 53 43 25 55 10 C58 39 51 63 41 82 Z" fill="var(--leaf-light)"/>
      <path d="M37 82 C39 58 50 45 68 37 C59 58 50 73 42 83 Z" fill="var(--leaf-dark)"/>
      <path d="M35 82 C32 56 27 30 29 14 C42 35 42 60 39 82 Z" fill="var(--stem-color)"/>
    </svg>`,
  flower: `
    <svg class="plant-art plant-art--flower" x="-38" y="-86" width="76" height="92" viewBox="0 0 76 92">
      <defs>
        <radialGradient id="petal-gradient-__ID__" cx="40%" cy="30%" r="75%">
          <stop offset="0" stop-color="var(--flower-light)"/>
          <stop offset="1" stop-color="var(--flower-color)"/>
        </radialGradient>
      </defs>
      <path d="M38 88 C35 67 38 48 38 31" fill="none" stroke="var(--stem-color)" stroke-width="4" stroke-linecap="round"/>
      <path d="M37 66 C24 62 18 54 17 45 C29 44 37 50 39 59 Z" fill="var(--leaf-color)"/>
      <g fill="url(#petal-gradient-__ID__)">
        <ellipse cx="38" cy="18" rx="10" ry="17"/>
        <ellipse cx="38" cy="18" rx="10" ry="17" transform="rotate(72 38 30)"/>
        <ellipse cx="38" cy="18" rx="10" ry="17" transform="rotate(144 38 30)"/>
        <ellipse cx="38" cy="18" rx="10" ry="17" transform="rotate(216 38 30)"/>
        <ellipse cx="38" cy="18" rx="10" ry="17" transform="rotate(288 38 30)"/>
      </g>
      <circle cx="38" cy="30" r="8" fill="var(--flower-center)"/>
    </svg>`,
  pine: `
    <svg class="plant-art plant-art--pine" x="-40" y="-92" width="80" height="98" viewBox="0 0 80 98">
      <path d="M35 65 H45 V94 H35 Z" fill="var(--trunk-color)"/>
      <path d="M40 4 L64 40 H53 L72 68 H8 L27 40 H16 Z" fill="var(--leaf-dark)"/>
      <path d="M40 4 L40 68 H8 L27 40 H16 Z" fill="var(--leaf-color)" opacity=".9"/>
      <path d="M40 18 L55 41 H46 L59 60 H40 Z" fill="var(--leaf-light)" opacity=".55"/>
    </svg>`,
  fern: `
    <svg class="plant-art plant-art--fern" x="-40" y="-86" width="80" height="92" viewBox="0 0 80 92">
      <path d="M39 87 C39 60 36 34 28 10" fill="none" stroke="var(--stem-color)" stroke-width="4" stroke-linecap="round"/>
      <g fill="var(--leaf-color)">
        <ellipse cx="25" cy="25" rx="13" ry="5" transform="rotate(28 25 25)"/>
        <ellipse cx="48" cy="35" rx="14" ry="5" transform="rotate(-30 48 35)"/>
        <ellipse cx="22" cy="45" rx="15" ry="5" transform="rotate(25 22 45)"/>
        <ellipse cx="52" cy="56" rx="15" ry="5" transform="rotate(-24 52 56)"/>
        <ellipse cx="24" cy="66" rx="14" ry="5" transform="rotate(20 24 66)"/>
      </g>
      <circle cx="28" cy="10" r="5" fill="var(--leaf-light)"/>
    </svg>`,
};
const PLANT_TYPES = Object.keys(PLANT_TEMPLATES);
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;
const IDLE_DELAY = 10_000;
const METEOR_SHOWER_DURATION = 3_000;

let idleTimerId = null;
let pendingPlantTimerId = null;
const newlyPlantedIds = new Set();

const effectsState = {
  meteors: [],
  animationFrameId: null,
  lastFrameTime: 0,
  showerStartedAt: 0,
};

const state = {
  plants: [],
  rotation: 0,
  scale: 1,
  isDragging: false,
  hasDragged: false,
  dragStart: { x: 0, rotation: 0 },
};

/* =========================
   2. 应用初始化
   ========================= */
function init() {
  loadPlanetData();
  renderPlants();
  bindEvents();
  updatePlanetTransform();
  resizeEffectsCanvas();
  resetIdleTimer();
}

function bindEvents() {
  planetSvg.addEventListener("click", handlePlanetClick);
  planetSvg.addEventListener("dblclick", handlePlanetDoubleClick);
  planetContainer.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  planetContainer.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("mousedown", registerActivity);
  window.addEventListener("wheel", registerActivity, { passive: true });
  window.addEventListener("resize", resizeEffectsCanvas);
}

/* =========================
   3. 点击星球与植物生成
   ========================= */
function handlePlanetClick(event) {
  if (state.hasDragged) {
    state.hasDragged = false;
    return;
  }

  const clientX = event.clientX;
  const clientY = event.clientY;

  window.clearTimeout(pendingPlantTimerId);
  pendingPlantTimerId = window.setTimeout(() => {
    plantAtPosition(clientX, clientY);
  }, 250);
}

function plantAtPosition(clientX, clientY) {
  const surfaceMatrix = planetSurface.getScreenCTM();

  if (!surfaceMatrix) return;

  // 将浏览器窗口坐标转换为星球所在的 SVG 坐标系。
  const pointer = new DOMPoint(clientX, clientY).matrixTransform(
    surfaceMatrix.inverse(),
  );

  const normalizedX = (pointer.x - PLANET_CENTER.x) / PLANET_RADIUS;
  const normalizedY = (pointer.y - PLANET_CENTER.y) / PLANET_RADIUS;
  const distanceFromCenter = Math.hypot(normalizedX, normalizedY);

  // SVG 包含光晕区域，只有圆形球面内部才能种植。
  if (distanceFromCenter >= 1) return;

  const plant = createPlant(normalizedX, normalizedY);
  state.plants.push(plant);
  newlyPlantedIds.add(plant.id);
  savePlanetData();
  renderPlants();
}

function handlePlanetDoubleClick(event) {
  window.clearTimeout(pendingPlantTimerId);

  if (!isPointInsidePlanet(event.clientX, event.clientY)) return;

  registerActivity();
  startMeteorShower();
}

function createPlant(x, y) {
  const nextId = state.plants.reduce(
    (largestId, plant) => Math.max(largestId, Number(plant.id) || 0),
    -1,
  ) + 1;

  return {
    id: nextId,
    x,
    y,
    template: randomItem(PLANT_TYPES),
    size: randomNumber(0.3, 0.8),
    rotation: randomNumber(-25, 25),
  };
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

/* =========================
   4. 拖拽旋转交互
   ========================= */
function handleMouseDown(event) {
  if (event.button !== 0 || !isPointInsidePlanet(event.clientX, event.clientY)) {
    return;
  }

  state.isDragging = true;
  state.hasDragged = false;
  state.dragStart.x = event.clientX;
  state.dragStart.rotation = state.rotation;
  planetSvg.classList.add("is-dragging");
  event.preventDefault();
}

function handleMouseMove(event) {
  if (!state.isDragging) return;

  registerActivity();

  const horizontalDistance = event.clientX - state.dragStart.x;

  if (Math.abs(horizontalDistance) > 3) {
    state.hasDragged = true;
  }

  // 每水平移动 1px，旋转 0.5°。
  state.rotation = state.dragStart.rotation + horizontalDistance * 0.5;
  updatePlanetTransform();
  renderPlants();
}

function handleMouseUp() {
  if (!state.isDragging) return;

  state.isDragging = false;
  planetSvg.classList.remove("is-dragging");
  savePlanetData();

  // click 会紧随 mouseup 触发；下一轮事件循环后即可恢复正常种植。
  if (state.hasDragged) {
    window.setTimeout(() => {
      state.hasDragged = false;
    }, 0);
  }
}

function isPointInsidePlanet(clientX, clientY) {
  const surfaceMatrix = planetSurface.getScreenCTM();

  if (!surfaceMatrix) return false;

  const point = new DOMPoint(clientX, clientY).matrixTransform(
    surfaceMatrix.inverse(),
  );
  const x = (point.x - PLANET_CENTER.x) / PLANET_RADIUS;
  const y = (point.y - PLANET_CENTER.y) / PLANET_RADIUS;

  return Math.hypot(x, y) < 1;
}

/* =========================
   5. 滚轮缩放交互
   ========================= */
function handleWheel(event) {
  if (!isPointInsidePlanet(event.clientX, event.clientY)) return;

  event.preventDefault();

  const direction = event.deltaY < 0 ? 1 : -1;
  const nextScale = state.scale + direction * SCALE_STEP;

  state.scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  updatePlanetTransform();
  savePlanetData();
}

function updatePlanetTransform() {
  // 外层负责缩放，内层负责旋转，两种变换可以安全叠加。
  planetViewport.style.transform = `scale(${state.scale})`;
  planetBody.setAttribute(
    "transform",
    `rotate(${state.rotation} ${PLANET_CENTER.x} ${PLANET_CENTER.y})`,
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* =========================
   6. 空闲检测与昼夜模式
   ========================= */
function registerActivity() {
  exitNightMode();
  resetIdleTimer();
}

function resetIdleTimer() {
  window.clearTimeout(idleTimerId);
  idleTimerId = window.setTimeout(enterNightMode, IDLE_DELAY);
}

function enterNightMode() {
  document.body.classList.add("night-mode");
}

function exitNightMode() {
  document.body.classList.remove("night-mode");
}

/* =========================
   7. Canvas 流星雨特效
   ========================= */
function resizeEffectsCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;

  effectsCanvas.width = Math.round(window.innerWidth * pixelRatio);
  effectsCanvas.height = Math.round(window.innerHeight * pixelRatio);
  effectsContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function startMeteorShower() {
  const meteorCount = Math.floor(randomNumber(15, 21));
  const now = performance.now();

  effectsState.showerStartedAt = now;
  effectsState.meteors = Array.from({ length: meteorCount }, () =>
    createMeteor(now),
  );

  if (effectsState.animationFrameId === null) {
    effectsState.lastFrameTime = now;
    effectsState.animationFrameId = requestAnimationFrame(renderEffects);
  }
}

function createMeteor(createdAt) {
  const angle = (randomNumber(30, 60) * Math.PI) / 180;
  const speed = randomNumber(520, 900);

  return {
    x: randomNumber(window.innerWidth * 0.68, window.innerWidth * 1.08),
    y: randomNumber(-80, window.innerHeight * 0.28),
    velocityX: -Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    length: randomNumber(80, 190),
    width: randomNumber(1, 2.4),
    delay: randomNumber(0, 650),
    createdAt,
  };
}

function renderEffects(timestamp) {
  const deltaTime = Math.min((timestamp - effectsState.lastFrameTime) / 1000, 0.05);
  effectsState.lastFrameTime = timestamp;
  effectsContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // 其他粒子系统可在这里绘制；各系统维护自己的数组，互不干扰。
  drawMeteors(timestamp, deltaTime);

  const showerIsActive =
    timestamp - effectsState.showerStartedAt < METEOR_SHOWER_DURATION;

  if (showerIsActive && effectsState.meteors.length > 0) {
    effectsState.animationFrameId = requestAnimationFrame(renderEffects);
  } else {
    effectsState.meteors = [];
    effectsState.animationFrameId = null;
    effectsContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

function drawMeteors(timestamp, deltaTime) {
  effectsState.meteors.forEach((meteor) => {
    if (timestamp - meteor.createdAt < meteor.delay) return;

    meteor.x += meteor.velocityX * deltaTime;
    meteor.y += meteor.velocityY * deltaTime;

    const speed = Math.hypot(meteor.velocityX, meteor.velocityY);
    const tailX = meteor.x - (meteor.velocityX / speed) * meteor.length;
    const tailY = meteor.y - (meteor.velocityY / speed) * meteor.length;
    const trailGradient = effectsContext.createLinearGradient(
      meteor.x,
      meteor.y,
      tailX,
      tailY,
    );

    trailGradient.addColorStop(0, "rgba(235, 250, 255, 0.95)");
    trailGradient.addColorStop(0.25, "rgba(145, 213, 255, 0.7)");
    trailGradient.addColorStop(1, "rgba(100, 185, 255, 0)");

    effectsContext.beginPath();
    effectsContext.moveTo(meteor.x, meteor.y);
    effectsContext.lineTo(tailX, tailY);
    effectsContext.strokeStyle = trailGradient;
    effectsContext.lineWidth = meteor.width;
    effectsContext.lineCap = "round";
    effectsContext.shadowColor = "rgba(120, 210, 255, 0.9)";
    effectsContext.shadowBlur = 10;
    effectsContext.stroke();

    effectsContext.beginPath();
    effectsContext.arc(meteor.x, meteor.y, meteor.width * 1.7, 0, Math.PI * 2);
    effectsContext.fillStyle = "rgba(245, 252, 255, 0.95)";
    effectsContext.shadowBlur = 16;
    effectsContext.fill();
    effectsContext.shadowBlur = 0;
  });
}

/* =========================
   8. localStorage 数据持久化
   ========================= */
function loadPlanetData() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEY);

    if (!savedText) return;

    const savedData = JSON.parse(savedText);

    if (!savedData || typeof savedData !== "object") return;

    state.plants = Array.isArray(savedData.plants) ? savedData.plants : [];
    state.rotation = Number.isFinite(savedData.rotation)
      ? savedData.rotation
      : 0;
    state.scale = Number.isFinite(savedData.zoom)
      ? clamp(savedData.zoom, MIN_SCALE, MAX_SCALE)
      : 1;
  } catch (error) {
    console.warn("星球数据读取失败，已恢复默认状态。", error);
    state.plants = [];
    state.rotation = 0;
    state.scale = 1;
  }
}

function savePlanetData() {
  const planetData = {
    plants: state.plants,
    rotation: state.rotation,
    zoom: state.scale,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(planetData));
  } catch (error) {
    console.warn("星球数据保存失败。", error);
  }
}

/* =========================
   9. SVG 植物渲染
   ========================= */
function renderPlants() {
  plantsLayer.replaceChildren();

  state.plants.forEach((plant) => {
    const angle = (state.rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotatedX = plant.x * cos - plant.y * sin;
    const rotatedY = plant.x * sin + plant.y * cos;
    const svgX = PLANET_CENTER.x + rotatedX * PLANET_RADIUS;
    const svgY = PLANET_CENTER.y + rotatedY * PLANET_RADIUS;
    const plantGroup = document.createElementNS(SVG_NAMESPACE, "g");
    const plantVisual = document.createElementNS(SVG_NAMESPACE, "g");
    const templateName = PLANT_TEMPLATES[plant.template]
      ? plant.template
      : PLANT_TYPES[Math.abs(Number(plant.id) || 0) % PLANT_TYPES.length];

    plantGroup.dataset.plantId = String(plant.id);
    plantGroup.classList.add("plant");
    if (newlyPlantedIds.has(plant.id)) {
      plantGroup.classList.add("is-growing");
    }
    plantGroup.setAttribute(
      "transform",
      `translate(${svgX} ${svgY}) rotate(${plant.rotation + state.rotation})`,
    );

    plantVisual.classList.add("plant-visual");
    plantVisual.style.setProperty("--size", plant.size);
    plantVisual.innerHTML = PLANT_TEMPLATES[templateName].replaceAll(
      "__ID__",
      String(plant.id),
    );

    plantGroup.append(plantVisual);
    plantsLayer.append(plantGroup);
    newlyPlantedIds.delete(plant.id);
  });

  statusText.textContent = state.plants.length
    ? `星球上已有 ${state.plants.length} 株植物`
    : "点击星球，种下第一株植物";
}

/* =========================
   10. 启动应用
   ========================= */
init();
