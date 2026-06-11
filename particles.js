/*
 * particles.js — light three.js dust when a face patch is torn off
 */

const ThreeParticles = (() => {
  const MAX = 800;
  let ready = false;
  let scene, camera, renderer, container;
  let pool = [];
  let positions, colors, geometry, material, points;

  function initThreeParticles() {
    if (typeof THREE === "undefined") return false;
    container = document.getElementById("three-container");
    if (!container) return false;

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
      -innerWidth / 2,
      innerWidth / 2,
      innerHeight / 2,
      -innerHeight / 2,
      -500,
      500
    );
    camera.position.z = 200;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    geometry = new THREE.BufferGeometry();
    positions = new Float32Array(MAX * 3);
    colors = new Float32Array(MAX * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    material = new THREE.PointsMaterial({
      size: 4,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.55,
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
    ready = true;
    return true;
  }

  function screenToThree(x, y) {
    return {
      x: x - innerWidth / 2,
      y: -y + innerHeight / 2,
      z: (Math.random() - 0.5) * 80,
    };
  }

  function resizeThreeRenderer() {
    if (!ready) return;
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
  }

  function spawnTearParticles(x, y, count, color) {
    if (!ready) return;
    const c = color || { r: 0.75, g: 0.7, b: 1 };
    const n = Math.min(8, Math.max(4, count || 6));
    for (let i = 0; i < n; i++) {
      if (pool.length >= MAX) pool.shift();
      const p = screenToThree(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2.2;
      pool.push({
        position: new THREE.Vector3(p.x, p.y, p.z),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          (Math.random() - 0.5) * 0.4
        ),
        life: 0.5 + Math.random() * 0.9,
        maxLife: 1.4,
        color: new THREE.Color(c.r, c.g, c.b),
        type: "tear",
      });
    }
  }

  function spawnPortraitGlow(faceBox) {
    if (!ready || !faceBox) return;
    pool.length = 0;
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const cx = faceBox.cx + Math.cos(angle) * faceBox.w * 0.42;
      const cy = faceBox.cy + Math.sin(angle) * faceBox.h * 0.38;
      const p = screenToThree(cx, cy);
      pool.push({
        position: new THREE.Vector3(p.x, p.y, p.z),
        velocity: new THREE.Vector3(
          Math.cos(angle) * 0.08,
          Math.sin(angle) * 0.08,
          (Math.random() - 0.5) * 0.15
        ),
        life: 6 + Math.random() * 4,
        maxLife: 10,
        color: new THREE.Color(0.55, 0.72, 0.95),
        type: "glow",
      });
    }
  }

  function updateThreeParticles(dt, portraitMode = false) {
    if (!ready) return;

    if (portraitMode) {
      material.size = 5.5;
      material.opacity = 0.32;
      if (Math.random() < 0.02 && pool.length < 120) {
        const x = (Math.random() - 0.5) * innerWidth;
        const y = (Math.random() - 0.5) * innerHeight;
        const p = screenToThree(x, y);
        pool.push({
          position: new THREE.Vector3(p.x, p.y, p.z),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12,
            0
          ),
          life: 4 + Math.random() * 3,
          maxLife: 7,
          color: new THREE.Color(0.5, 0.65, 0.9),
          type: "glow",
        });
      }
    } else {
      material.size = 4;
      material.opacity = 0.55;
    }

    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.life -= dt;
      const drag = p.type === "glow" ? 0.992 : 0.96;
      p.position.x += p.velocity.x * (60 * dt);
      p.position.y += p.velocity.y * (60 * dt);
      p.velocity.multiplyScalar(drag);
      if (p.life <= 0) pool.splice(i, 1);
    }

    const count = pool.length;
    for (let i = 0; i < MAX; i++) {
      const idx = i * 3;
      if (i < count) {
        const p = pool[i];
        const t = p.life / p.maxLife;
        positions[idx] = p.position.x;
        positions[idx + 1] = p.position.y;
        positions[idx + 2] = p.position.z;
        colors[idx] = p.color.r * t;
        colors[idx + 1] = p.color.g * t;
        colors[idx + 2] = p.color.b * t;
      } else {
        positions[idx] = positions[idx + 1] = positions[idx + 2] = 0;
        colors[idx] = colors[idx + 1] = colors[idx + 2] = 0;
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    points.geometry.setDrawRange(0, count);
    renderer.render(scene, camera);
  }

  return {
    initThreeParticles,
    spawnTearParticles,
    spawnPortraitGlow,
    updateThreeParticles,
    resizeThreeRenderer,
    isReady: () => ready,
  };
})();
