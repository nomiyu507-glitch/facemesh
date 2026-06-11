/* intro.js — homepage fog, mesh, hand swipe */

function introMeshPartSeed(partName) {
  let s = 0;
  for (let i = 0; i < partName.length; i++) s += partName.charCodeAt(i) * (i + 3);
  return s;
}

function introMeshGrey(strength, alpha) {
  const c = Math.round(strength);
  return `rgba(${c}, ${c}, ${c}, ${alpha})`;
}

function introMeshInstability() {
  const handInst = introHandProximity * 0.95;
  if (introTransitionPhase === "dissolving" && introDissolveStartTime) {
    const dp = constrain((millis() - introDissolveStartTime) / INTRO_DISSOLVE_MS, 0, 1);
    return handInst + dp * 0.55;
  }
  return handInst;
}

function getIntroMeshTrembleOffset(x, y, t) {
  if (introHandProximity < 0.06) return { dx: 0, dy: 0 };
  const amp = introHandProximity * 2.1;
  const seed = x * 0.06 + y * 0.04;
  return {
    dx: sin(t * 0.048 + seed) * amp,
    dy: cos(t * 0.041 + seed * 1.2) * amp,
  };
}

function introMeshDissolveAlpha() {
  if (introTransitionPhase !== "dissolving" || !introDissolveStartTime) return 1;
  return max(0, 1 - constrain((millis() - introDissolveStartTime) / INTRO_DISSOLVE_MS, 0, 1));
}

function introMeshCollageDebugActive() {
  return state === "collageStudio" && COLLAGE_LAYER_DEBUG;
}

function introMeshResolvedLineWidth(baseLineWidth, segSeed) {
  if (introMeshCollageDebugActive()) return COLLAGE_DEBUG_LINE_WIDTH;
  return baseLineWidth * (0.94 + introDustHash(segSeed + 4.1) * 0.1);
}

function introMeshResolvedPointRadius(basePointRadius, ptSeed) {
  if (introMeshCollageDebugActive()) return 2;
  return basePointRadius * (0.88 + introDustHash(ptSeed + 6.3) * 0.18);
}

function introMeshGreyAlpha(baseAlpha, seed, t) {
  if (introMeshCollageDebugActive()) return COLLAGE_DEBUG_ALPHA / 255;
  const phase = introDustHash(seed * 0.31 + 2.7) * Math.PI * 2;
  const inst = introMeshInstability();
  const breathe =
    0.9 +
    Math.sin(t * 0.00135 + phase) * 0.08 +
    Math.sin(t * 0.00205 + phase * 0.65) * 0.05;
  const slice = Math.floor(t * (0.0048 + inst * 0.005));
  const flickerRoll = introDustHash(seed * 9.7 + slice);
  const flickerCutoff = 0.9 - inst * 0.07;
  const flicker = flickerRoll > flickerCutoff ? 0.32 + introDustHash(seed + slice) * 0.2 : 1;
  return Math.min(0.58, Math.max(0.05, baseAlpha * breathe * flicker * (1 - inst * 0.1)));
}

function introMeshShouldDrop(seed, t) {
  if (introMeshCollageDebugActive()) return false;
  const inst = introMeshInstability();
  const slice = Math.floor(t * (0.0048 + inst * 0.006));
  return introDustHash(seed * 13.1 + slice * 1.9) > 0.968 - inst * 0.048;
}

// ==============================
// Intro layers (HTML + low-res canvas)
// ==============================
function initIntroLayers() {
  introFaceCanvas = document.getElementById("intro-face");
  introMeshCanvas = document.getElementById("intro-mesh");
  if (!introFaceCanvas || !introMeshCanvas) return;

  introFaceCtx = introFaceCanvas.getContext("2d", { alpha: true });
  introMeshCtx = introMeshCanvas.getContext("2d", { alpha: true });
  introFaceBuffer = document.createElement("canvas");
  introFaceBufferCtx = introFaceBuffer.getContext("2d", { alpha: true });
  buildStaticIntroGrain();
  resizeIntroLayers();
}

function resizeIntroLayers() {
  if (!introMeshCanvas || !introFaceCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  introMeshCanvas.width = w;
  introMeshCanvas.height = h;
  introFaceCanvas.width = w;
  introFaceCanvas.height = h;
}

function setPoeticSceneVisible(visible, { showTitle = false, showQuestion = false, collageStudio = false } = {}) {
  const stack = document.getElementById("intro-stack");
  const title = document.getElementById("intro-title");
  const questionTitle = document.getElementById("question-title");
  const p5Holder = document.getElementById("p5-container");
  stack?.classList.toggle("is-visible", visible);
  stack?.classList.toggle("is-collage", visible && collageStudio);
  title?.classList.toggle("is-visible", visible && showTitle);
  questionTitle?.classList.toggle("is-visible", visible && showQuestion);
  p5Holder?.classList.toggle("is-intro", visible && !showQuestion && !collageStudio);
  p5Holder?.classList.toggle("is-question", visible && showQuestion && !collageStudio);
  p5Holder?.classList.toggle("is-collage", visible && collageStudio);
  if (stack) stack.setAttribute("aria-hidden", visible ? "false" : "true");
  if (questionTitle) questionTitle.setAttribute("aria-hidden", showQuestion ? "false" : "true");
  if (!showQuestion && questionTitle) questionTitle.classList.remove("is-visible");
  if (!visible && introMeshCtx && introMeshCanvas) {
    introMeshCtx.clearRect(0, 0, introMeshCanvas.width, introMeshCanvas.height);
  }
  if (!visible && introFaceCtx && introFaceCanvas) {
    introFaceCtx.clearRect(0, 0, introFaceCanvas.width, introFaceCanvas.height);
  }
}

function setIntroLayersVisible(visible) {
  setPoeticSceneVisible(visible, { showTitle: visible });
}

function mapScreenToVideo(sx, sy) {
  const vw = capture?.elt?.videoWidth || capture?.width || 960;
  const vh = capture?.elt?.videoHeight || capture?.height || 720;
  return {
    x: map(width - sx, 0, width, 0, vw),
    y: map(sy, 0, height, 0, vh),
  };
}

function getVideoFaceCropRect(face) {
  const box = getFaceBox(face);
  if (!box) return null;

  const vw = capture?.elt?.videoWidth || capture?.width || 960;
  const vh = capture?.elt?.videoHeight || capture?.height || 720;
  const padX = box.w * 0.06;
  const padY = box.h * 0.08;

  const tl = mapScreenToVideo(box.x - padX, box.y - padY);
  const br = mapScreenToVideo(box.x + box.w + padX, box.y + box.h + padY);

  let sx = constrain(min(tl.x, br.x), 0, vw - 1);
  let sy = constrain(min(tl.y, br.y), 0, vh - 1);
  let sw = constrain(abs(br.x - tl.x), 20, vw - sx);
  let sh = constrain(abs(br.y - tl.y), 20, vh - sy);

  return { sx, sy, sw, sh, vw, vh };
}

function buildStaticIntroGrain() {
  const bg = document.getElementById("intro-bg");
  if (!bg) return;

  const grain = document.createElement("canvas");
  grain.width = 256;
  grain.height = 256;
  const ctx = grain.getContext("2d");
  const img = ctx.createImageData(grain.width, grain.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.14 ? 18 : 0;
  }
  ctx.putImageData(img, 0, 0);
  bg.style.backgroundImage = `url(${grain.toDataURL("image/png")})`;
}

function getIntroComposition(faceBox) {
  if (!faceBox) return null;
  const scale = min((width * 0.62) / faceBox.w, (height * 0.6) / faceBox.h, 2.25);
  const displayW = faceBox.w * scale;
  const displayH = faceBox.h * scale;
  return {
    targetCx: width / 2,
    targetCy: height * 0.48,
    offsetX: width / 2 - faceBox.cx,
    offsetY: height * 0.48 - faceBox.cy,
    displayW,
    displayH,
  };
}

function smoothIntroComposition(comp) {
  if (!comp) {
    introCompSmoothed = null;
    return null;
  }
  if (!introCompSmoothed) {
    introCompSmoothed = { ...comp };
    return introCompSmoothed;
  }
  const e = 0.12;
  introCompSmoothed.offsetX = lerp(introCompSmoothed.offsetX, comp.offsetX, e);
  introCompSmoothed.offsetY = lerp(introCompSmoothed.offsetY, comp.offsetY, e);
  introCompSmoothed.displayW = lerp(introCompSmoothed.displayW, comp.displayW, e);
  introCompSmoothed.displayH = lerp(introCompSmoothed.displayH, comp.displayH, e);
  introCompSmoothed.targetCx = comp.targetCx;
  introCompSmoothed.targetCy = comp.targetCy;
  return introCompSmoothed;
}

function ensureIntroFaceBufferSize(bw, bh) {
  if (introFaceBuffer.width !== bw || introFaceBuffer.height !== bh) {
    introFaceBuffer.width = bw;
    introFaceBuffer.height = bh;
  }
}

function applyIntroEdgeFade(ctx, bw, bh) {
  const img = ctx.getImageData(0, 0, bw, bh);
  const d = img.data;
  const edge = min(bw, bh) * 0.14;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const idx = (y * bw + x) * 4 + 3;
      if (d[idx] < 1) continue;
      const dist = min(x, y, bw - 1 - x, bh - 1 - y);
      const fade = constrain(dist / edge, 0, 1);
      d[idx] = floor(d[idx] * fade * fade);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function lightenIntroFaceBuffer(ctx, bw, bh) {
  const img = ctx.getImageData(0, 0, bw, bh);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 1) continue;
    d[i] = min(255, d[i] * 0.82 + 58);
    d[i + 1] = d[i];
    d[i + 2] = d[i];
  }
  ctx.putImageData(img, 0, 0);
}

function getHandPalmVideoXY(hand) {
  if (!hand) return null;
  if (hand.landmarks?.length >= 18) {
    const ids = [0, 1, 5, 9, 13, 17];
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const i of ids) {
      const p = lmXY(hand.landmarks[i]);
      if (!p) continue;
      sx += p.x;
      sy += p.y;
      n++;
    }
    if (n > 0) return { x: sx / n, y: sy / n };
  }
  if (hand.landmarks?.length >= 1) return lmXY(hand.landmarks[0]);
  if (hand.keypoints?.length) {
    const wrist = hand.keypoints.find((k) => k.name === "wrist") || hand.keypoints[0];
    if (wrist) return lmXY(wrist);
  }
  return null;
}

function pickIntroHand(comp) {
  if (!hands.length) return null;

  if (introSwipeLockedHand >= 0 && introSwipeLockedHand < hands.length) {
    const lockedPalm = getHandPalmVideoXY(hands[introSwipeLockedHand]);
    if (lockedPalm) {
      return { pt: mapVideoToScreen(lockedPalm.x, lockedPalm.y), index: introSwipeLockedHand };
    }
  }

  const faceZone = comp
    ? getIntroFaceZone(comp)
    : { cx: width / 2, cy: height / 2, x: 0, y: 0, w: width, h: height };

  let bestIndex = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < hands.length; i++) {
    const palm = getHandPalmVideoXY(hands[i]);
    if (!palm) continue;
    const pt = mapVideoToScreen(palm.x, palm.y);
    const dx = pt.x - faceZone.cx;
    const dy = pt.y - faceZone.cy;
    const dist = Math.hypot(dx, dy);
    const score = dist + abs(dx) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) {
    const fallback = getHandPalmVideoXY(hands[0]);
    if (fallback) return { pt: mapVideoToScreen(fallback.x, fallback.y), index: 0 };
    const tip = getIndexFingerTip();
    return tip ? { pt: tip, index: 0 } : null;
  }

  const palm = getHandPalmVideoXY(hands[bestIndex]);
  return { pt: mapVideoToScreen(palm.x, palm.y), index: bestIndex };
}

function getIntroFaceZone(comp) {
  const padX = comp.displayW * 0.28;
  const padY = comp.displayH * 0.32;
  return {
    x: comp.targetCx - comp.displayW / 2 - padX,
    y: comp.targetCy - comp.displayH / 2 - padY,
    w: comp.displayW + padX * 2,
    h: comp.displayH + padY * 2,
    cx: comp.targetCx,
    cy: comp.targetCy,
  };
}

function getIntroApproachZone(comp) {
  const padX = comp.displayW * 0.55;
  const padY = comp.displayH * 0.55;
  return {
    x: comp.targetCx - comp.displayW / 2 - padX,
    y: comp.targetCy - comp.displayH / 2 - padY,
    w: comp.displayW + padX * 2,
    h: comp.displayH + padY * 2,
    cx: comp.targetCx,
    cy: comp.targetCy,
  };
}

function pointInIntroZone(p, zone) {
  return p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h;
}

function pointNearIntroZone(p, zone, padRatio = 0.38) {
  const padX = zone.w * padRatio;
  const padY = zone.h * padRatio;
  return (
    p.x >= zone.x - padX &&
    p.x <= zone.x + zone.w + padX &&
    p.y >= zone.y - padY &&
    p.y <= zone.y + zone.h + padY
  );
}

function updateIntroHandProximity(hand, faceZone, approachZone) {
  if (!hand) {
    introHandProximity = lerp(introHandProximity, 0, 0.1);
    return;
  }
  if (!pointInIntroZone(hand, approachZone)) {
    introHandProximity = lerp(introHandProximity, 0, 0.14);
    return;
  }
  const dx = hand.x - faceZone.cx;
  const dy = hand.y - faceZone.cy;
  const dist = Math.hypot(dx, dy);
  const maxDist = Math.max(faceZone.w, faceZone.h) * 0.62;
  let target = 1 - constrain(dist / maxDist, 0, 1);
  if (pointInIntroZone(hand, faceZone)) target = max(target, 0.72);
  introHandProximity = lerp(introHandProximity, target, 0.2);
}

function detectIntroHandSwipe(zone, now) {
  const trail = introSwipeTrail.filter((p) => now - p.t <= INTRO_SWIPE_MAX_MS);
  if (trail.length < 4) return false;

  const oldest = trail[0];
  const newest = trail[trail.length - 1];
  const dt = newest.t - oldest.t;
  if (dt < INTRO_SWIPE_MIN_MS || dt > INTRO_SWIPE_MAX_MS) return false;

  let minX = Infinity;
  let maxX = -Infinity;
  let pathLen = 0;
  let hitsFaceZone = false;
  for (let i = 0; i < trail.length; i++) {
    minX = min(minX, trail[i].x);
    maxX = max(maxX, trail[i].x);
    if (pointInIntroZone(trail[i], zone) || pointNearIntroZone(trail[i], zone, 0.45)) {
      hitsFaceZone = true;
    }
  }
  for (let i = 1; i < trail.length; i++) {
    pathLen += dist(trail[i].x, trail[i].y, trail[i - 1].x, trail[i - 1].y);
  }

  const span = maxX - minX;
  const minSpan = max(zone.w * INTRO_SWIPE_MIN_DIST_RATIO, width * 0.1);
  if (span < minSpan) return false;
  if (pathLen < minSpan * 0.45) return false;
  if (span / dt < INTRO_SWIPE_MIN_SPEED) return false;
  if (!hitsFaceZone) return false;

  const centerX = zone.cx ?? zone.x + zone.w * 0.5;
  const crossedFaceCenter = minX < centerX - zone.w * 0.03 && maxX > centerX + zone.w * 0.03;
  const crossedScreenMid = minX < width * 0.4 && maxX > width * 0.6;

  const slice = max(1, floor(trail.length * 0.22));
  let startX = 0;
  let endX = 0;
  for (let i = 0; i < slice; i++) startX += trail[i].x;
  for (let i = trail.length - slice; i < trail.length; i++) endX += trail[i].x;
  startX /= slice;
  endX /= slice;

  const rightToLeft = startX - endX >= minSpan * 0.22;
  const leftToRight = endX - startX >= minSpan * 0.22;
  const netRightToLeft = oldest.x - newest.x >= minSpan * 0.18;
  const netLeftToRight = newest.x - oldest.x >= minSpan * 0.18;

  return (
    crossedFaceCenter ||
    crossedScreenMid ||
    rightToLeft ||
    leftToRight ||
    netRightToLeft ||
    netLeftToRight
  );
}

function ensureIntroAudioContext() {
  if (!introAudioCtx) {
    introAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function resumeIntroAudioContext() {
  if (introAudioCtx?.state === "suspended") introAudioCtx.resume();
}

function playIntroTransitionSound() {
  if (introSoundPlayed) return;
  introSoundPlayed = true;
  ensureIntroAudioContext();
  resumeIntroAudioContext();
  const ctx = introAudioCtx;
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.72;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.16, now + 0.08);
  master.gain.exponentialRampToValueAtTime(0.11, now + 0.32);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const pulse = ctx.createOscillator();
  pulse.type = "sine";
  pulse.frequency.setValueAtTime(188, now);
  pulse.frequency.exponentialRampToValueAtTime(210, now + 0.22);
  pulse.frequency.exponentialRampToValueAtTime(172, now + duration);

  const breath = ctx.createOscillator();
  breath.type = "triangle";
  breath.frequency.setValueAtTime(420, now);
  breath.frequency.exponentialRampToValueAtTime(280, now + duration * 0.85);

  const pulseGain = ctx.createGain();
  pulseGain.gain.value = 0.55;
  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0.0001, now);
  breathGain.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
  breathGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.75);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 520;
  filter.Q.value = 0.6;

  const delay = ctx.createDelay(0.35);
  delay.delayTime.value = 0.14;
  const delayMix = ctx.createGain();
  delayMix.gain.value = 0.22;

  pulse.connect(pulseGain);
  breath.connect(breathGain);
  pulseGain.connect(filter);
  breathGain.connect(filter);
  filter.connect(master);
  filter.connect(delay);
  delay.connect(delayMix);
  delayMix.connect(master);
  master.connect(ctx.destination);

  pulse.start(now);
  breath.start(now);
  pulse.stop(now + duration);
  breath.stop(now + duration);
}

function spawnIntroDissolveParticles(face, comp) {
  introDissolveParticles = [];
  const keypoints = getIntroFaceKeypoints(face);
  const indices = [...FACE_FEATURE_INDEX_SET];
  const step = max(1, floor(indices.length / 110));

  for (let i = 0; i < indices.length; i += step) {
    const idx = indices[i];
    const kp = keypoints[idx];
    if (!kp) continue;
    const p = mapIntroKeypointToScreen(kp, comp);
    const h1 = introDustHash(idx * 2.1);
    const h2 = introDustHash(idx * 3.7 + 11);
    introDissolveParticles.push({
      x: p.x,
      y: p.y,
      vx: (h1 - 0.5) * 2.4,
      vy: (h2 - 0.5) * 2.4 - 0.35,
      radius: 0.35 + introDustHash(idx + 5.2) * 0.85,
      baseAlpha: 0.12 + introDustHash(idx + 9.4) * 0.16,
    });
  }
}

function updateIntroDissolveParticles() {
  for (const p of introDissolveParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy *= 0.985;
  }
}

function drawIntroDissolveParticles(ctx) {
  const dp = constrain((millis() - introDissolveStartTime) / INTRO_DISSOLVE_MS, 0, 1);
  ctx.fillStyle = INTRO_MESH_DUST;
  for (const p of introDissolveParticles) {
    ctx.globalAlpha = p.baseAlpha * (1 - dp * 0.82);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (1 + dp * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function beginIntroDissolve(now, face, comp) {
  if (introTransitionPhase === "dissolving") return;
  introTransitionPhase = "dissolving";
  introDissolveStartTime = now;
  introTransitionTriggered = true;
  introFogFlash = 1;
  introFogDistort = 1;
  introSwipeCooldownUntil = now + INTRO_SWIPE_COOLDOWN_MS;
  introSwipeTrail = [];
  introSwipeLockedHand = -1;
  spawnIntroDissolveParticles(face, comp);
  playIntroTransitionSound();
}

function updateIntroSwipeInteraction(now, face, comp) {
  if (state !== "intro") return;

  if (introTransitionPhase === "dissolving") {
    if (now - introDissolveStartTime >= INTRO_DISSOLVE_MS) enterMainScene();
    return;
  }

  if (face) lastIntroFaceSnapshot = face;
  if (!comp) {
    introHandProximity = lerp(introHandProximity, 0, 0.1);
    return;
  }

  if (introTransitionTriggered || now < introSwipeCooldownUntil) return;

  const faceZone = getIntroFaceZone(comp);
  const approachZone = getIntroApproachZone(comp);
  const pick = pickIntroHand(comp);
  const hand = pick?.pt;

  updateIntroHandProximity(hand, faceZone, approachZone);

  introSwipeTrail = introSwipeTrail.filter((p) => now - p.t <= INTRO_SWIPE_MAX_MS);

  if (hand) {
    lastIntroHandAt = now;
    if (introSwipeTrail.length === 0 && pick) introSwipeLockedHand = pick.index;
    introSwipeTrail.push({ x: hand.x, y: hand.y, t: now });
  } else if (now - lastIntroHandAt > 450) {
    introSwipeTrail = [];
    introSwipeLockedHand = -1;
  }

  if (introSwipeTrail.length >= 4 && detectIntroHandSwipe(faceZone, now)) {
    ensureIntroAudioContext();
    resumeIntroAudioContext();
    beginIntroDissolve(now, face || lastIntroFaceSnapshot, comp);
  }
}

function updateIntroWebcam(face, comp) {
  if (!introFaceCtx || !introFaceBufferCtx || !videoReady || !capture?.elt) return;

  const cw = introFaceCanvas.width;
  const ch = introFaceCanvas.height;
  introFaceCtx.clearRect(0, 0, cw, ch);

  const isCollage = state === "collageStudio";
  if (!face || !comp || (state !== "intro" && !isCollage)) return;

  const crop = getVideoFaceCropRect(face);
  if (!crop) return;

  const aspect = crop.sw / crop.sh;
  let bw = INTRO_FACE_BUFFER_MAX;
  let bh = floor(bw / aspect);
  if (bh > INTRO_FACE_BUFFER_MAX) {
    bh = INTRO_FACE_BUFFER_MAX;
    bw = floor(bh * aspect);
  }
  ensureIntroFaceBufferSize(bw, bh);

  introFaceBufferCtx.clearRect(0, 0, bw, bh);
  introFaceBufferCtx.save();
  introFaceBufferCtx.translate(bw, 0);
  introFaceBufferCtx.scale(-1, 1);
  introFaceBufferCtx.filter = "grayscale(1) blur(12px)";
  introFaceBufferCtx.drawImage(capture.elt, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, bw, bh);
  introFaceBufferCtx.filter = "none";
  introFaceBufferCtx.restore();

  lightenIntroFaceBuffer(introFaceBufferCtx, bw, bh);
  applyIntroEdgeFade(introFaceBufferCtx, bw, bh);

  const drawX = comp.targetCx - comp.displayW / 2;
  const drawY = comp.targetCy - comp.displayH / 2;
  introFogFlash = max(0, introFogFlash - 0.032);
  introFogDistort = max(0, introFogDistort - 0.038);
  const dissolveMul =
    introTransitionPhase === "dissolving" ? introMeshDissolveAlpha() : 1;
  const brighten = introFogFlash * 0.42;
  const fogAlpha = isCollage
    ? 0.22
    : 0.34 * (1 + brighten) * dissolveMul;
  if (fogAlpha <= 0.008) return;

  const distortX = sin(millis() * 0.019) * introFogDistort * 6;
  const distortY = cos(millis() * 0.016) * introFogDistort * 3;
  introFaceCtx.globalAlpha = fogAlpha;
  introFaceCtx.drawImage(
    introFaceBuffer,
    drawX + distortX,
    drawY + distortY,
    comp.displayW,
    comp.displayH
  );
  if (introFogFlash > 0.02) {
    introFaceCtx.globalAlpha = introFogFlash * 0.28;
    introFaceCtx.fillStyle = "rgba(235, 235, 240, 1)";
    introFaceCtx.fillRect(drawX, drawY, comp.displayW, comp.displayH);
  }
  introFaceCtx.globalAlpha = 1;
}

function mapIntroKeypointToScreen(kp, comp) {
  const x = kp.x !== undefined ? kp.x : kp[0];
  const y = kp.y !== undefined ? kp.y : kp[1];
  const s = mapVideoToScreen(x, y);
  const px = s.x + comp.offsetX;
  const py = s.y + comp.offsetY;
  const shake = getIntroMeshTrembleOffset(px, py, millis());
  return { x: px + shake.dx, y: py + shake.dy };
}

// MediaPipe / ml5 face feature contours (eyes, brows, lips, iris, nose) — not full tesselation
const FACE_MESH_FEATURE_PARTS = {
  lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
  lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  rightEyeUpper0: [246, 161, 160, 159, 158, 157, 173],
  rightEyeLower0: [33, 7, 163, 144, 145, 153, 154, 155, 133],
  rightEyeUpper1: [247, 30, 29, 27, 28, 56, 190],
  rightEyeLower1: [130, 25, 110, 24, 23, 22, 26, 112, 243],
  rightEyeUpper2: [113, 225, 224, 223, 222, 221, 189],
  rightEyeLower2: [226, 31, 228, 229, 230, 231, 232, 233, 244],
  rightEyeLower3: [143, 111, 117, 118, 119, 120, 121, 128, 245],
  rightEyebrowUpper: [156, 70, 63, 105, 66, 107, 55, 193],
  rightEyebrowLower: [35, 124, 46, 53, 52, 65],
  rightEyeIris: [473, 474, 475, 476, 477],
  leftEyeUpper0: [466, 388, 387, 386, 385, 384, 398],
  leftEyeLower0: [263, 249, 390, 373, 374, 380, 381, 382, 362],
  leftEyeUpper1: [467, 260, 259, 257, 258, 286, 414],
  leftEyeLower1: [359, 255, 339, 254, 253, 252, 256, 341, 463],
  leftEyeUpper2: [342, 445, 444, 443, 442, 441, 413],
  leftEyeLower2: [446, 261, 448, 449, 450, 451, 452, 453, 464],
  leftEyeLower3: [372, 340, 346, 347, 348, 349, 350, 357, 465],
  leftEyebrowUpper: [383, 300, 293, 334, 296, 336, 285, 417],
  leftEyebrowLower: [265, 353, 276, 283, 282, 295],
  leftEyeIris: [468, 469, 470, 471, 472],
  noseBridge: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2],
  noseWings: [98, 97, 2, 326, 327],
};

const INTRO_ML5_FACE_PARTS = [
  "lips",
  "leftEye",
  "rightEye",
  "leftEyebrow",
  "rightEyebrow",
  "leftIris",
  "rightIris",
];

const FACE_FEATURE_INDEX_SET = (() => {
  const set = new Set();
  for (const indices of Object.values(FACE_MESH_FEATURE_PARTS)) {
    for (const i of indices) set.add(i);
  }
  return set;
})();

function introDustHash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// Sparse anchors: eyes, nose, mouth only — one or two drifting fragments each
const INTRO_FRAGMENT_SPECS = [
  { idx: 468, count: 2 }, // left iris
  { idx: 473, count: 2 }, // right iris
  { idx: 159, count: 1 }, // right upper lid
  { idx: 386, count: 1 }, // left upper lid
  { idx: 145, count: 1 }, // right lower lid
  { idx: 374, count: 1 }, // left lower lid
  { idx: 1, count: 1 },   // nose tip
  { idx: 4, count: 1 },   // nose bridge
  { idx: 98, count: 1 },  // right nostril
  { idx: 327, count: 1 }, // left nostril
  { idx: 13, count: 1 },  // upper lip center
  { idx: 14, count: 1 },  // lower lip center
  { idx: 61, count: 1 },  // mouth corner
  { idx: 291, count: 1 }, // mouth corner
];

let introDataFragments = null;

function ensureIntroDataFragments() {
  if (introDataFragments) return;
  introDataFragments = [];
  for (const { idx, count } of INTRO_FRAGMENT_SPECS) {
    for (let i = 0; i < count; i++) {
      const h1 = introDustHash(idx * 17.3 + i * 5.9);
      const h2 = introDustHash(idx * 11.7 + i * 9.1 + 40);
      const h3 = introDustHash(idx * 23.1 + i * 7.3 + 90);
      introDataFragments.push({
        landmarkIdx: idx,
        angle: h1 * Math.PI * 2,
        dist: 0.8 + h2 * 2.2,
        phase: h3 * Math.PI * 2,
        driftAmp: 0.45 + h1 * 0.85,
        radius: 0.32 + h2 * 0.38,
        alpha: 0.07 + h3 * 0.09,
      });
    }
  }
}

function drawIntroMeshParticles(face, comp, ctx) {
  const keypoints = getIntroFaceKeypoints(face);
  if (keypoints.length < 10) return;

  ensureIntroDataFragments();

  const t = millis() * 0.00011;
  ctx.fillStyle = INTRO_MESH_DUST;

  for (const frag of introDataFragments) {
    const kp = keypoints[frag.landmarkIdx];
    if (!kp) continue;

    const base = mapIntroKeypointToScreen(kp, comp);
    const anchorX = base.x + Math.cos(frag.angle) * frag.dist;
    const anchorY = base.y + Math.sin(frag.angle) * frag.dist;
    const driftT = t + frag.phase;
    const x = anchorX + Math.sin(driftT) * frag.driftAmp;
    const y = anchorY + Math.cos(driftT * 0.83) * frag.driftAmp * 0.72;

    ctx.globalAlpha = frag.alpha;
    ctx.beginPath();
    ctx.arc(x, y, frag.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function getIntroFaceKeypoints(face) {
  if (face?.scaledMesh?.length >= 468) return face.scaledMesh;
  if (face?.mesh?.length >= 468) return face.mesh;
  if (face?.keypoints?.length) return face.keypoints;
  return extractFaceLandmarks(face);
}

function getIntroFeatureConnections() {
  const raw =
    faceMeshModel?.getConnections?.() ||
    faceMeshModel?.getConnections ||
    ml5?.faceMesh?.getConnections?.();
  if (!raw?.length) return null;
  return raw.filter(([a, b]) => FACE_FEATURE_INDEX_SET.has(a) && FACE_FEATURE_INDEX_SET.has(b));
}

function drawIntroFeatureContour(ctx, keypoints, indices, comp, { closed = false, partName = "" } = {}) {
  const points = [];
  for (const idx of indices) {
    const kp = keypoints[idx];
    if (!kp) continue;
    points.push({ idx, ...mapIntroKeypointToScreen(kp, comp) });
  }
  if (points.length < 2) return;

  const emphasized = INTRO_MESH_EMPHASIS_PARTS.has(partName);
  const baseLineAlpha = emphasized ? 0.52 : 0.42;
  const basePointAlpha = emphasized ? 0.48 : 0.4;
  const lineStrength = emphasized ? 105 : 111;
  const pointStrength = emphasized ? 112 : 119;
  const baseLineWidth = emphasized ? INTRO_MESH_LINE_WIDTH_EMPHASIS : INTRO_MESH_LINE_WIDTH;
  const basePointRadius = emphasized ? INTRO_MESH_POINT_RADIUS_EMPHASIS : INTRO_MESH_POINT_RADIUS;
  const partSeed = introMeshPartSeed(partName);
  const t = millis();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 0; i < points.length - 1; i++) {
    const segSeed = partSeed * 100 + i;
    if (introMeshShouldDrop(segSeed, t)) continue;
    const alpha = introMeshGreyAlpha(baseLineAlpha, segSeed, t);
    if (alpha < 0.03) continue;
    ctx.strokeStyle = introMeshGrey(lineStrength, alpha);
    ctx.lineWidth = introMeshResolvedLineWidth(baseLineWidth, segSeed);
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }

  if (closed && points.length > 2) {
    const segSeed = partSeed * 100 + points.length;
    if (!introMeshShouldDrop(segSeed, t)) {
      const alpha = introMeshGreyAlpha(baseLineAlpha, segSeed, t);
      if (alpha >= 0.03) {
        ctx.strokeStyle = introMeshGrey(lineStrength, alpha);
        ctx.lineWidth = introMeshResolvedLineWidth(baseLineWidth, segSeed);
        ctx.beginPath();
        ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineTo(points[0].x, points[0].y);
        ctx.stroke();
      }
    }
  }

  for (const p of points) {
    const ptSeed = partSeed * 1000 + p.idx;
    if (introMeshShouldDrop(ptSeed, t)) continue;
    const alpha = introMeshGreyAlpha(basePointAlpha, ptSeed, t);
    if (alpha < 0.03) continue;
    ctx.fillStyle = introMeshGrey(pointStrength, alpha);
    const radius = introMeshResolvedPointRadius(basePointRadius, ptSeed);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIntroMeshFromMl5Parts(face, comp, ctx) {
  let drew = false;
  const t = millis();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const partName of INTRO_ML5_FACE_PARTS) {
    const part = face[partName];
    if (!part?.keypoints?.length) continue;
    drew = true;
    const points = part.keypoints.map((kp) => mapIntroKeypointToScreen(kp, comp));
    if (points.length < 2) continue;

    const partSeed = introMeshPartSeed(partName);
    const closed = partName.includes("Eye") || partName.includes("Iris") || partName === "lips";
    const segmentCount = closed ? points.length : points.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const j = (i + 1) % points.length;
      const segSeed = partSeed * 100 + i;
      if (introMeshShouldDrop(segSeed, t)) continue;
      const alpha = introMeshGreyAlpha(0.42, segSeed, t);
      if (alpha < 0.03) continue;
      ctx.strokeStyle = introMeshGrey(111, alpha);
      ctx.lineWidth = introMeshResolvedLineWidth(INTRO_MESH_LINE_WIDTH, segSeed);
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[j].x, points[j].y);
      ctx.stroke();
    }

    for (let i = 0; i < points.length; i++) {
      const ptSeed = partSeed * 1000 + i;
      if (introMeshShouldDrop(ptSeed, t)) continue;
      const alpha = introMeshGreyAlpha(0.4, ptSeed, t);
      if (alpha < 0.03) continue;
      ctx.fillStyle = introMeshGrey(119, alpha);
      const radius = introMeshResolvedPointRadius(INTRO_MESH_POINT_RADIUS, ptSeed);
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return drew;
}

function drawIntroMeshFromAnnotations(face, comp, ctx) {
  const keypoints = getIntroFaceKeypoints(face);
  if (keypoints.length < 10) return false;

  ctx.strokeStyle = INTRO_MESH_LINE;
  ctx.lineWidth = introMeshCollageDebugActive() ? COLLAGE_DEBUG_LINE_WIDTH : INTRO_MESH_LINE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const parts = Object.entries(FACE_MESH_FEATURE_PARTS);
  for (const [partName, indices] of parts) {
    if (INTRO_MESH_EMPHASIS_PARTS.has(partName)) continue;
    const closed = partName.includes("Iris") || partName.includes("Eye");
    drawIntroFeatureContour(ctx, keypoints, indices, comp, { closed, partName });
  }
  for (const [partName, indices] of parts) {
    if (!INTRO_MESH_EMPHASIS_PARTS.has(partName)) continue;
    const closed = partName.includes("Iris") || partName.includes("Eye");
    drawIntroFeatureContour(ctx, keypoints, indices, comp, { closed, partName });
  }
  return true;
}

function drawIntroMeshConnections(face, comp, ctx) {
  const connections = getIntroFeatureConnections();
  const keypoints = getIntroFaceKeypoints(face);
  if (!connections?.length || keypoints.length < 10) return false;

  const t = millis();
  ctx.lineCap = "round";

  for (const pair of connections) {
    const [a, b] = pair;
    const kpA = keypoints[a];
    const kpB = keypoints[b];
    if (!kpA || !kpB) continue;
    const segSeed = a * 17 + b * 31;
    if (introMeshShouldDrop(segSeed, t)) continue;
    const alpha = introMeshGreyAlpha(0.4, segSeed, t);
    ctx.strokeStyle = introMeshGrey(111, alpha);
    ctx.lineWidth = introMeshResolvedLineWidth(INTRO_MESH_LINE_WIDTH * 0.9, segSeed);
    const pA = mapIntroKeypointToScreen(kpA, comp);
    const pB = mapIntroKeypointToScreen(kpB, comp);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }

  for (const idx of FACE_FEATURE_INDEX_SET) {
    const kp = keypoints[idx];
    if (!kp) continue;
    const ptSeed = idx * 53;
    if (introMeshShouldDrop(ptSeed, t)) continue;
    const alpha = introMeshGreyAlpha(0.38, ptSeed, t);
    ctx.fillStyle = introMeshGrey(119, alpha);
    const p = mapIntroKeypointToScreen(kp, comp);
    const radius = introMeshResolvedPointRadius(INTRO_MESH_POINT_RADIUS * 0.95, ptSeed);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return true;
}

function updateIntroMesh(face, comp) {
  if (!introMeshCtx || !introMeshCanvas) return;

  introMeshCtx.clearRect(0, 0, introMeshCanvas.width, introMeshCanvas.height);
  if (!face || !comp) return;

  const ctx = introMeshCtx;
  const t = millis();

  if (state === "intro" && introTransitionPhase === "dissolving") {
    updateIntroDissolveParticles();
    const dissolveAlpha = introMeshDissolveAlpha();
    if (dissolveAlpha > 0.02) {
      ctx.globalAlpha = dissolveAlpha * (0.93 + Math.sin(t * 0.00105) * 0.05);
      if (drawIntroMeshFromMl5Parts(face, comp, ctx)) {
        /* drawn */
      } else if (drawIntroMeshConnections(face, comp, ctx)) {
        /* drawn */
      } else {
        drawIntroMeshFromAnnotations(face, comp, ctx);
      }
    }
    ctx.globalAlpha = 1;
    drawIntroDissolveParticles(ctx);
    return;
  }

  ctx.globalAlpha = introMeshCollageDebugActive()
    ? 1
    : 0.93 + Math.sin(t * 0.00105) * 0.05 + Math.sin(t * 0.00185) * 0.03;

  if (drawIntroMeshFromMl5Parts(face, comp, ctx)) {
    ctx.globalAlpha = 1;
    drawIntroMeshParticles(face, comp, ctx);
    return;
  }
  if (drawIntroMeshConnections(face, comp, ctx)) {
    ctx.globalAlpha = 1;
    drawIntroMeshParticles(face, comp, ctx);
    return;
  }
  if (drawIntroMeshFromAnnotations(face, comp, ctx)) {
    ctx.globalAlpha = 1;
    drawIntroMeshParticles(face, comp, ctx);
  } else {
    ctx.globalAlpha = 1;
  }
}

function updateIntroLayers(now) {
  if (state !== "intro") return;

  const liveFace = faces[0];
  const dissolving = introTransitionPhase === "dissolving";
  const renderFace = liveFace || (dissolving ? lastIntroFaceSnapshot : null);

  const faceBox = renderFace ? getFaceBox(renderFace) : null;
  let comp = faceBox ? smoothIntroComposition(getIntroComposition(faceBox)) : null;
  if (!comp && introCompSmoothed) comp = introCompSmoothed;

  updateIntroSwipeInteraction(now, liveFace, comp);

  const needsSmoothFog =
    dissolving || introHandProximity > 0.04 || introFogFlash > 0.01;
  if (needsSmoothFog || now - lastIntroWebcamMs >= INTRO_WEBCAM_MS) {
    updateIntroWebcam(renderFace, comp);
    lastIntroWebcamMs = now;
  }

  updateIntroMesh(renderFace, comp);
}

function drawIntro(_finger) {
  updateIntroLayers(millis());
}
