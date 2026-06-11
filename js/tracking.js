/* tracking.js — camera, ml5, hands, face */

// ==============================
// Video & ML5
// ==============================
function initVideo() {
  capture = createCapture(
    { video: { facingMode: "user" }, audio: false },
    () => {
      videoReady = true;
      capture.size(960, 720);
      capture.hide();
      initML5Models();
      ensureIntroAudioContext();
      resumeIntroAudioContext();
    }
  );
}

function drawWebcamBackground() {
  if (!videoReady || !capture) {
    fill(20, 18, 30);
    rect(0, 0, width, height);
    fill(200, 200, 220);
    textAlign(CENTER, CENTER);
    textSize(18);
    text("Loading camera...", width / 2, height / 2);
    return;
  }

  const removedCount = facePatches.filter((p) => p.removed).length;
  const clarity = map(removedCount, 0, 5, 0.72, 1, true);

  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 255 * clarity);
  image(capture, 0, 0, width, height);
  noTint();
  pop();

  noStroke();
  fill(8, 6, 18, state === "patchMask" ? 55 : 40);
  rect(0, 0, width, height);
}

function initML5Models() {
  if (typeof ml5 === "undefined" || ml5ModelsInitialized) return;
  ml5ModelsInitialized = true;

  if (ml5.handPose) {
    const handModel = ml5.handPose(capture, () => {});
    if (handModel?.detectStart) handModel.detectStart(capture, gotHands);
    else if (handModel?.on) handModel.on("predict", gotHands);
  } else if (ml5.handpose) {
    const handModel = ml5.handpose(capture, () => {});
    handModel.on("predict", gotHands);
  }

  if (ml5.faceMesh) {
    faceMeshModel = ml5.faceMesh(capture, { maxFaces: 1 }, () => {});
    if (faceMeshModel?.detectStart) faceMeshModel.detectStart(capture, gotFaces);
    else if (faceMeshModel?.on) {
      faceMeshModel.on("predict", gotFaces);
      faceMeshModel.on("face", gotFaces);
    }
  } else if (ml5.facemesh) {
    faceMeshModel = ml5.facemesh(capture, () => {});
    if (faceMeshModel?.on) {
      faceMeshModel.on("predict", gotFaces);
      faceMeshModel.on("face", gotFaces);
    }
  }
}

function gotHands(results) {
  hands = results || [];
}

function gotFaces(results) {
  faces = results || [];
  if (faces.length > 0) {
    lastFaceAt = millis();
    lastIntroFaceSnapshot = faces[0];
  }
}

function getFingerOrDebug() {
  if (state === "gestureQuestion") return getQuestionHandCursor();
  if (state === "collageStudio") return getCollageHandCursor?.() || getIndexFingerTip();
  const tip = getIndexFingerTip();
  if (tip) return tip;
  if (mouseIsPressed) return { x: mouseX, y: mouseY };
  return null;
}

function getStableFinger(minStable = 10, maxJump = 12) {
  const tip = getIndexFingerTip();
  if (!tip) {
    lastFingerPos = null;
    fingerStableFrames = 0;
    return null;
  }

  if (lastFingerPos) {
    const jump = dist(tip.x, tip.y, lastFingerPos.x, lastFingerPos.y);
    if (jump < maxJump) fingerStableFrames++;
    else fingerStableFrames = 0;
  } else {
    fingerStableFrames = 0;
  }

  lastFingerPos = { x: tip.x, y: tip.y };
  return fingerStableFrames >= minStable ? tip : null;
}

function getTearFinger() {
  return getIndexFingerTip();
}

function getInteractionFinger() {
  const visual = getIndexFingerVisual();
  const raw = getIndexFingerTip();
  if (visual && raw) {
    return smoothFingerScreen({
      x: lerp(raw.x, visual.x, 0.55),
      y: lerp(raw.y, visual.y, 0.55),
    });
  }
  return smoothFingerScreen(visual || raw);
}

function decayPatchHover(rate = 10) {
  for (const patch of facePatches) {
    if (patch.removed || patch.tearing) continue;
    patch.fingerHeld = false;
    patch.hoverTime = max(0, patch.hoverTime - rate);
  }
}

function lmXY(pt) {
  if (!pt) return null;
  return { x: Array.isArray(pt) ? pt[0] : pt.x, y: Array.isArray(pt) ? pt[1] : pt.y };
}

function extendPoint(from, to, ratio) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { x: to.x + dx * ratio, y: to.y + dy * ratio };
}

function getRawIndexFingerVideoXY() {
  if (!hands.length) return null;
  const hand = hands[0];

  if (hand.landmarks?.length >= 9) {
    const tip = lmXY(hand.landmarks[8]);
    if (tip) return tip;
  }

  if (hand.keypoints?.length) {
    const tipKp = hand.keypoints.find(
      (k) => k.name === "index_finger_tip" || k.part === "index_finger_tip"
    );
    if (tipKp) return lmXY(tipKp);
  }

  if (hand.annotations?.indexFinger?.length >= 4) {
    const finger = hand.annotations.indexFinger;
    const pip = lmXY(finger[2]);
    const dip = lmXY(finger[3]);
    if (pip && dip) return extendPoint(pip, dip, 0.22);
  }

  return null;
}

function getIndexFingerTip() {
  const v = getRawIndexFingerVideoXY();
  if (!v) return null;
  return mapVideoToScreen(v.x, v.y);
}

function getIndexFingerVisual() {
  if (!hands.length) return getIndexFingerTip();
  const hand = hands[0];
  const tip = hand.landmarks?.length >= 9 ? lmXY(hand.landmarks[8]) : null;
  const dip = hand.landmarks?.length >= 8 ? lmXY(hand.landmarks[7]) : null;

  if (tip && dip) {
    const v = extendPoint(dip, tip, 0.16);
    return mapVideoToScreen(v.x, v.y);
  }

  return getIndexFingerTip();
}

function smoothFingerScreen(pos) {
  if (!pos) {
    smoothedFingerScreen = null;
    return null;
  }
  if (!smoothedFingerScreen) {
    smoothedFingerScreen = { x: pos.x, y: pos.y };
  } else {
    smoothedFingerScreen.x = lerp(smoothedFingerScreen.x, pos.x, 0.5);
    smoothedFingerScreen.y = lerp(smoothedFingerScreen.y, pos.y, 0.5);
  }
  return { x: smoothedFingerScreen.x, y: smoothedFingerScreen.y };
}

function mapVideoToScreen(x, y) {
  const vw = capture?.elt?.videoWidth || capture?.width || 960;
  const vh = capture?.elt?.videoHeight || capture?.height || 720;
  let px = x;
  let py = y;
  if (px >= 0 && px <= 1.05 && py >= 0 && py <= 1.05) {
    px *= vw;
    py *= vh;
  }
  return {
    x: width - map(px, 0, vw, 0, width),
    y: map(py, 0, vh, 0, height),
  };
}

// ==============================
// Face box
// ==============================
function extractFaceLandmarks(face) {
  if (!face) return [];
  if (face.keypoints?.length) {
    return face.keypoints.map((p) => ({
      x: p.x !== undefined ? p.x : p[0],
      y: p.y !== undefined ? p.y : p[1],
    }));
  }
  if (face.scaledMesh?.length) {
    return face.scaledMesh.map((p) => ({ x: p[0], y: p[1] }));
  }
  if (face.mesh?.length) {
    return face.mesh.map((p) => ({
      x: Array.isArray(p) ? p[0] : p.x,
      y: Array.isArray(p) ? p[1] : p.y,
    }));
  }
  return [];
}

function getFaceBox(face) {
  const pts = extractFaceLandmarks(face);
  if (!pts.length) return null;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    const s = mapVideoToScreen(p.x, p.y);
    minX = min(minX, s.x);
    maxX = max(maxX, s.x);
    minY = min(minY, s.y);
    maxY = max(maxY, s.y);
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  if (rawW < 12 || rawH < 12) return null;

  const padX = rawW * 0.08;
  const padY = rawH * 0.1;
  const x = constrain(minX - padX, 0, width);
  const y = constrain(minY - padY, 0, height);
  const w = constrain(rawW + padX * 2, 60, width - x);
  const h = constrain(rawH + padY * 2, 60, height - y);

  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function smoothFaceBox(box) {
  if (!box) return faceBoxSmoothed;
  if (!faceBoxSmoothed) {
    faceBoxSmoothed = { ...box };
    return faceBoxSmoothed;
  }
  const e = 0.14;
  faceBoxSmoothed.x = lerp(faceBoxSmoothed.x, box.x, e);
  faceBoxSmoothed.y = lerp(faceBoxSmoothed.y, box.y, e);
  faceBoxSmoothed.w = lerp(faceBoxSmoothed.w, box.w, e);
  faceBoxSmoothed.h = lerp(faceBoxSmoothed.h, box.h, e);
  faceBoxSmoothed.cx = faceBoxSmoothed.x + faceBoxSmoothed.w / 2;
  faceBoxSmoothed.cy = faceBoxSmoothed.y + faceBoxSmoothed.h / 2;
  return faceBoxSmoothed;
}
