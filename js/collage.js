/* collage.js — final label collage page */

const COLLAGE_CURSOR_LERP = 0.26;
const LABEL_TEAR_HOLD_MS = 360;
const LABEL_PICK_RADIUS = 54;
const LABEL_BIND_LERP = 0.18;
const FRAGMENT_CAPTURE_FLASH_MS = 820;
const FRAGMENT_CAPTURE_SNAPSHOT_DELAY_MS = 48;

const Q1_FACE_BASE_COLORS = {
  Family: [206, 188, 182, 50],
  School: [182, 192, 202, 54],
  Society: [138, 134, 152, 48],
  Appearance: [198, 176, 172, 52],
  Myself: [196, 202, 188, 50],
};

const Q2_DIFFICULT_BASE = [172, 168, 188, 46];

function collageEnsureComp(comp) {
  if (comp) return comp;
  return {
    targetCx: width * 0.5,
    targetCy: height * 0.48,
    displayW: width * 0.36,
    displayH: height * 0.44,
    offsetX: 0,
    offsetY: 0,
  };
}

function collageGetComposition() {
  const renderFace = faces[0] || lastIntroFaceSnapshot;
  if (!renderFace) return { face: null, comp: collageEnsureComp(introCompSmoothed) };

  const faceBox = getFaceBox(renderFace);
  let comp = faceBox ? smoothIntroComposition(getIntroComposition(faceBox)) : null;
  if (!comp && introCompSmoothed) comp = introCompSmoothed;
  return { face: renderFace, comp: collageEnsureComp(comp) };
}

function collageKeypointScreen(face, comp, idx) {
  if (!face) return null;
  const keypoints = getIntroFaceKeypoints(face);
  const kp = keypoints?.[idx];
  if (!kp) return null;
  return mapIntroKeypointToScreen(kp, comp);
}

function collageAvgKeypoints(face, comp, indices) {
  const pts = [];
  for (const idx of indices) {
    const p = collageKeypointScreen(face, comp, idx);
    if (p) pts.push(p);
  }
  if (!pts.length) return null;
  return {
    x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
    y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
  };
}

function collageFaceZone(comp) {
  const c = collageEnsureComp(comp);
  return {
    cx: c.targetCx,
    cy: c.targetCy,
    rx: c.displayW * 0.46,
    ry: c.displayH * 0.54,
  };
}

function collageFaceFrame(comp) {
  const c = collageEnsureComp(comp);
  return {
    cx: c.targetCx,
    cy: c.targetCy,
    w: c.displayW,
    h: c.displayH,
    rx: c.displayW * 0.44,
    ry: c.displayH * 0.52,
  };
}

function collageSoftBumpAt(angle, seed) {
  const n = collageHash(seed * 0.017 + Math.cos(angle) * 3.17 + Math.sin(angle) * 5.23);
  return 0.97 + (n - 0.5) * 0.05;
}

function collageQ1BaseRadii(comp) {
  const c = collageEnsureComp(comp);
  const faceW = c.displayW * 0.64;
  const faceH = c.displayH * 0.58;
  return {
    rx: (faceW * 1.15) / 2,
    ry: (faceH * 1.3) / 2,
  };
}

function collageMaskPaperPath(ctx, cx, cy, rx, ry, seed, notchCount = 0, steps = 64) {
  const notches = [];
  for (let i = 0; i < notchCount; i++) {
    notches.push(collageHash(seed + i * 7.3) * Math.PI * 2);
  }

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    let bump = collageSoftBumpAt(angle, seed);
    for (const na of notches) {
      let diff = angle - na;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.14) bump *= 0.9 - collageHash(seed + na * 3.1) * 0.05;
    }
    const x = cx + Math.cos(angle) * rx * bump;
    const y = cy + Math.sin(angle) * ry * bump;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function collageEllipsePath(ctx, cx, cy, rx, ry, seed, steps = 52) {
  collageMaskPaperPath(ctx, cx, cy, rx, ry, seed, 0, steps);
}

function collageLabelAnchor(comp, region, face) {
  const c = collageEnsureComp(comp);
  const cx = c.targetCx;
  const cy = c.targetCy;
  const w = c.displayW;
  const h = c.displayH;

  const forehead = collageKeypointScreen(face, c, 10);
  const mouthCenter = collageAvgKeypoints(face, c, [13, 14, 78, 308]);
  const leftEye =
    collageAvgKeypoints(face, c, [263, 362, 386, 374, 380]) || { x: cx - w * 0.18, y: cy - h * 0.08 };
  const rightEye =
    collageAvgKeypoints(face, c, [33, 133, 159, 145, 153]) || { x: cx + w * 0.18, y: cy - h * 0.08 };
  const mouth = collageAvgKeypoints(face, c, [13, 14, 78, 308]);

  const leftCheek = collageKeypointScreen(face, c, 234) || collageKeypointScreen(face, c, 93);
  const rightCheek = collageKeypointScreen(face, c, 454) || collageKeypointScreen(face, c, 323);
  const chin = collageKeypointScreen(face, c, 152) || mouth;

  switch (region) {
    case "forehead":
      return forehead || { x: cx, y: cy - h * 0.3 };
    case "leftCheek":
      return leftCheek || { x: cx - w * 0.36, y: cy + h * 0.1 };
    case "rightCheek":
      return rightCheek || { x: cx + w * 0.36, y: cy + h * 0.1 };
    case "chin":
      return chin || { x: cx, y: cy + h * 0.32 };
    case "leftEye":
      return leftEye || { x: cx - w * 0.18, y: cy - h * 0.08 };
    case "rightEye":
      return rightEye || { x: cx + w * 0.18, y: cy - h * 0.08 };
    case "mouth":
      return mouthCenter || mouth || { x: cx, y: cy + h * 0.18 };
    case "temple":
      return { x: cx - w * 0.3, y: cy - h * 0.12 };
    case "rightTemple":
      return { x: cx + w * 0.3, y: cy - h * 0.12 };
    case "leftEdge":
      return { x: cx - w * 0.46, y: cy + h * 0.04 };
    case "rightEdge":
      return { x: cx + w * 0.46, y: cy + h * 0.04 };
    case "foreheadLeft":
      return { x: cx - w * 0.12, y: cy - h * 0.34 };
    case "foreheadRight":
      return { x: cx + w * 0.12, y: cy - h * 0.34 };
    case "leftCheekOuter":
      return { x: cx - w * 0.34, y: cy + h * 0.02 };
    case "rightCheekOuter":
      return { x: cx + w * 0.34, y: cy + h * 0.02 };
    case "leftLowerCheek":
      return { x: cx - w * 0.27, y: cy + h * 0.18 };
    case "rightLowerCheek":
      return { x: cx + w * 0.27, y: cy + h * 0.18 };
    case "belowMouth":
      return { x: cx, y: cy + h * 0.22 };
    case "chinLow":
      return { x: cx, y: cy + h * 0.36 };
    case "maskEdge":
      return { x: cx - w * 0.44, y: cy + h * 0.12 };
    default:
      return { x: cx, y: cy };
  }
}

function collageSafeZoneRect(cx, cy, w, h) {
  return { x: cx - w * 0.5, y: cy - h * 0.5, w, h };
}

function collageRectIntersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collageLabelRectAt(x, y, w, h) {
  return { x: x - w * 0.5, y: y - h * 0.5, w, h };
}

function collageFeatureSafeZones(face, comp) {
  const frame = collageFaceFrame(comp);
  const leftEye = collageEyeMetrics(face, comp, COLLAGE_EYE_LEFT) || {
    cx: frame.cx - frame.w * 0.18,
    cy: frame.cy - frame.h * 0.08,
    w: frame.w * 0.12,
    h: frame.h * 0.06,
  };
  const rightEye = collageEyeMetrics(face, comp, COLLAGE_EYE_RIGHT) || {
    cx: frame.cx + frame.w * 0.18,
    cy: frame.cy - frame.h * 0.08,
    w: frame.w * 0.12,
    h: frame.h * 0.06,
  };
  const mouth = collageMouthMetrics(face, comp) || {
    cx: frame.cx,
    cy: frame.cy + frame.h * 0.18,
    w: frame.w * 0.22,
    h: frame.h * 0.06,
  };
  const noseMetrics = collageNoseMetrics(face, comp);
  const nose = noseMetrics
    ? {
        cx: (noseMetrics.bridgeTop.x + noseMetrics.tip.x) * 0.5,
        cy: (noseMetrics.bridgeTop.y + noseMetrics.tip.y) * 0.5,
        w: frame.w * 0.12,
        h: frame.h * 0.24,
      }
    : {
        cx: frame.cx,
        cy: frame.cy + frame.h * 0.02,
        w: frame.w * 0.12,
        h: frame.h * 0.24,
      };
  const easygoing = q3MaskAnswer() === "Easygoing";
  const eyeWScale = easygoing ? 2.05 : 1.8;
  const eyeHScale = easygoing ? 2.45 : 2.2;
  const mouthWScale = 1.4;
  const mouthHScale = 2.0;

  return [
    collageSafeZoneRect(leftEye.cx, leftEye.cy, leftEye.w * eyeWScale, leftEye.h * eyeHScale),
    collageSafeZoneRect(rightEye.cx, rightEye.cy, rightEye.w * eyeWScale, rightEye.h * eyeHScale),
    collageSafeZoneRect(mouth.cx, mouth.cy, mouth.w * mouthWScale, mouth.h * mouthHScale),
    collageSafeZoneRect(nose.cx, nose.cy, nose.w, nose.h),
  ];
}

function resolveCollageLabelPlacement(comp, face, slot, size, seed, safeZones, placedRects) {
  const base = collageLabelAnchor(comp, slot.region, face);
  const attempts = slot.maxAttempts || 20;
  let fallback = { x: base.x + slot.offsetX, y: base.y + slot.offsetY };

  for (let attempt = 0; attempt < attempts; attempt++) {
    const jx = (collageHash(seed + attempt * 2.17) - 0.5) * 2 * (slot.jitterX || 0);
    const jy = (collageHash(seed + attempt * 3.41) - 0.5) * 2 * (slot.jitterY || 0);
    const x = base.x + slot.offsetX + jx;
    const y = base.y + slot.offsetY + jy;
    const rect = collageLabelRectAt(x, y, size.w, size.h);
    fallback = { x, y };

    const hitsSafeZone = safeZones.some((zone) => collageRectIntersects(rect, zone));
    const hitsPlaced = placedRects.some((placed) => collageRectIntersects(rect, placed));
    if (!hitsSafeZone && !hitsPlaced) {
      placedRects.push(rect);
      return { x, y, offsetX: slot.offsetX + jx, offsetY: slot.offsetY + jy };
    }
  }

  placedRects.push(collageLabelRectAt(fallback.x, fallback.y, size.w, size.h));
  return { x: fallback.x, y: fallback.y, offsetX: fallback.x - base.x, offsetY: fallback.y - base.y };
}

function getCollageHandCursor() {
  const tip = getIndexFingerTip();
  if (!tip) {
    collageHandCursor = null;
    return null;
  }
  if (!collageHandCursor) collageHandCursor = { x: tip.x, y: tip.y };
  collageHandCursor.x = lerp(collageHandCursor.x, tip.x, COLLAGE_CURSOR_LERP);
  collageHandCursor.y = lerp(collageHandCursor.y, tip.y, COLLAGE_CURSOR_LERP);
  return collageHandCursor;
}

function collageHash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function collageStructureAlpha(prod255 = 35) {
  return COLLAGE_LAYER_DEBUG ? COLLAGE_DEBUG_ALPHA : prod255;
}

function collageStructureStroke(ctx, r, g, b, prodAlpha255 = 35) {
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `rgba(${r},${g},${b},${collageStructureAlpha(prodAlpha255) / 255})`;
  ctx.lineWidth = 0.65;
  ctx.lineCap = "round";
}

function collageStructureFill(ctx, r, g, b, prodAlpha255 = 30) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(${r},${g},${b},${collageStructureAlpha(prodAlpha255) / 255})`;
}

const Q3_MASK_ALPHA = 130;
const Q3_MASK_ALPHA_STRONG = 148;
const Q3_MASK_ALPHA_LIGHT = 100;

function collageMaskStroke(ctx, r, g, b, alpha = Q3_MASK_ALPHA, lineW = 1.15) {
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha / 255})`;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function collageMaskFill(ctx, r, g, b, alpha) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha / 255})`;
}

function collageMaskText(ctx, text, x, y, size, r, g, b, alpha = Q3_MASK_ALPHA) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha / 255})`;
  ctx.font = `600 ${size}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawMaskCheckMark(ctx, bx, by, box) {
  ctx.beginPath();
  ctx.moveTo(bx + box * 0.18, by + box * 0.52);
  ctx.lineTo(bx + box * 0.4, by + box * 0.74);
  ctx.lineTo(bx + box * 0.86, by + box * 0.22);
  ctx.stroke();
}

function drawMaskArrow(ctx, x0, y0, x1, y1, wing) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(ang) * wing + px * wing, y1 - Math.sin(ang) * wing + py * wing);
  ctx.lineTo(x1 - Math.cos(ang) * wing - px * wing, y1 - Math.sin(ang) * wing - py * wing);
  ctx.closePath();
  ctx.stroke();
}

function q1FaceBaseColor() {
  if (userAnswers?.perception === "Difficult") return Q2_DIFFICULT_BASE;
  const answer = userAnswers?.identity;
  return Q1_FACE_BASE_COLORS[answer] || Q1_FACE_BASE_COLORS.Myself;
}

function q1MaskNotchCount() {
  return userAnswers?.perception === "Difficult" ? 6 : 0;
}

function drawCollageQ1Base(ctx, comp) {
  const { cx, cy } = collageFaceFrame(comp);
  const { rx, ry } = collageQ1BaseRadii(comp);
  const [r, g, b, a] = q1FaceBaseColor();
  const seed = collageFaceBaseSeed;
  const notches = q1MaskNotchCount();

  ctx.save();
  ctx.filter = "blur(18px)";
  ctx.fillStyle = `rgba(${r},${g},${b},${(a * 0.35) / 255})`;
  collageMaskPaperPath(ctx, cx, cy, rx * 1.08, ry * 1.06, seed + 17, notches);
  ctx.fill();

  ctx.filter = "blur(8px)";
  ctx.fillStyle = `rgba(${r},${g},${b},${(a * 0.55) / 255})`;
  collageMaskPaperPath(ctx, cx, cy, rx * 1.02, ry * 1.02, seed + 31, notches);
  ctx.fill();

  ctx.filter = "blur(2px)";
  ctx.fillStyle = `rgba(${r},${g},${b},${(a * 0.72) / 255})`;
  collageMaskPaperPath(ctx, cx, cy, rx, ry, seed, notches);
  ctx.fill();
  ctx.restore();
}

function q4UnseenAnswer() {
  return resolveAnswerKey("unseen", userAnswers?.unseen) || "Fear";
}

const Q3_MASK_OPTIONS = ["Perfect", "Confident", "Productive", "Easygoing", "Untouchable"];

function normalizeQ3Mask(raw) {
  const resolved = resolveAnswerKey("mask", raw);
  if (resolved && Q3_MASK_OPTIONS.includes(resolved)) return resolved;
  if (raw == null || raw === "") return null;
  if (Q3_MASK_OPTIONS.includes(raw)) return raw;
  const trimmed = String(raw).trim();
  if (Q3_MASK_OPTIONS.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return Q3_MASK_OPTIONS.find((opt) => opt.toLowerCase() === lower) || null;
}

function getSavedQ3Mask() {
  return userAnswers?.mask ?? userAnswers?.q3 ?? null;
}

function q3MaskAnswer() {
  return normalizeQ3Mask(getSavedQ3Mask()) || "Easygoing";
}

function drawCollageQ4Fear(ctx, f, seed) {
  const { cx, cy, rx, ry } = f;
  ctx.save();
  collageStructureStroke(ctx, 148, 168, 188, 32);
  for (let i = 0; i < 3; i++) {
    const ang = collageHash(seed + i * 2.1) * Math.PI * 2;
    const r0 = rx * (0.55 + i * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, r0, ang, ang + 0.65);
    ctx.stroke();
  }
  collageStructureFill(ctx, 176, 192, 210, 28);
  collageMaskPaperPath(ctx, cx, cy, rx * 0.88, ry * 0.86, seed + 90);
  ctx.fill();
  ctx.restore();
}

function drawCollageQ4Anger(ctx, f, seed) {
  const { cx, cy, w, h } = f;
  ctx.save();
  collageStructureStroke(ctx, 188, 120, 118, 38);
  for (let i = 0; i < 3; i++) {
    const x0 = cx - w * 0.15 + collageHash(seed + i * 3.3) * w * 0.3;
    const y0 = cy - h * 0.1 + collageHash(seed + i * 5.1) * h * 0.2;
    const x1 = x0 + (collageHash(seed + i * 7.2) - 0.5) * w * 0.14;
    const y1 = y0 + (collageHash(seed + i * 9.4) - 0.2) * h * 0.1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCollageQ4Tiredness(ctx, f, seed) {
  const { cx, cy, w, h } = f;
  ctx.save();
  collageStructureStroke(ctx, 148, 138, 168, 34);
  for (let i = 0; i < 4; i++) {
    const x = cx - w * 0.22 + (i / 3) * w * 0.44;
    const y0 = cy - h * 0.12 + collageHash(seed + i) * h * 0.05;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + w * 0.02, y0 + h * 0.1, x, y0 + h * 0.16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCollageQ4Failure(ctx, f, seed) {
  const { cx, cy, w, h } = f;
  ctx.save();
  collageStructureStroke(ctx, 132, 128, 140, 36);
  for (let i = 0; i < 3; i++) {
    const x = cx + (collageHash(seed + i * 4.2) - 0.5) * w * 0.35;
    const y = cy + (collageHash(seed + i * 6.1) - 0.5) * h * 0.3;
    const len = w * (0.05 + collageHash(seed + i) * 0.04);
    const ang = collageHash(seed + i * 8.3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.moveTo(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5);
    ctx.lineTo(x + Math.cos(ang + 0.9) * len * 0.4, y + Math.sin(ang + 0.9) * len * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCollageQ4Desire(ctx, f, seed) {
  const { cx, cy, rx, ry } = f;
  ctx.save();
  collageStructureStroke(ctx, 210, 148, 132, 35);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + collageHash(seed + i) * 0.25;
    const r0 = rx * 0.2;
    const r1 = rx * (0.42 + collageHash(seed + i * 5) * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * ry / rx * r0);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * ry / rx * r1);
    ctx.stroke();
  }
  ctx.restore();
}

const Q4_TEXTURE_DRAWERS = {
  Fear: drawCollageQ4Fear,
  Anger: drawCollageQ4Anger,
  Tiredness: drawCollageQ4Tiredness,
  Failure: drawCollageQ4Failure,
  Desire: drawCollageQ4Desire,
};

function drawCollageQ4Texture(ctx, comp) {
  const frame = collageFaceFrame(comp);
  const answer = q4UnseenAnswer();
  const drawer = Q4_TEXTURE_DRAWERS[answer] || drawCollageQ4Fear;
  const seed = collageLayerSeed + 311;

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  collageMaskPaperPath(ctx, frame.cx, frame.cy, frame.rx * 1.02, frame.ry * 1.02, seed + 200);
  ctx.clip();
  drawer(ctx, frame, seed);
  for (let i = 0; i < 16; i++) {
    const x = frame.cx + (collageHash(seed + i * 1.7) - 0.5) * frame.w * 0.65;
    const y = frame.cy + (collageHash(seed + i * 2.9) - 0.5) * frame.h * 0.7;
    ctx.fillStyle = `rgba(120, 120, 130, ${(2 + collageHash(seed + i * 4.1) * 4) / 255})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawQ4HiddenLayer(comp) {
  if (!introFaceCtx) return;
  drawCollageQ4Texture(introFaceCtx, comp);
}

function drawCollageBackLayers(comp) {
  if (!introFaceCtx) return;
  drawCollageQ1Base(introFaceCtx, comp);
  drawQ4HiddenLayer(comp);
}

function drawMaskPerfect(ctx, f, seed) {
  const { cx, cy, rx, ry } = f;
  const mark = rx * 0.13;
  const [r, g, b] = [174, 166, 190];

  ctx.save();
  collageMaskStroke(ctx, r, g, b, 72, 1.05);
  collageMaskPaperPath(ctx, cx, cy, rx * 0.98, ry * 0.96, seed + 12);
  ctx.stroke();
  collageMaskStroke(ctx, r, g, b, Q3_MASK_ALPHA, 1.1);
  collageMaskPaperPath(ctx, cx, cy, rx * 0.9, ry * 0.88, seed + 24);
  ctx.stroke();

  const corners = [
    [cx - rx * 0.9, cy - ry * 0.86],
    [cx + rx * 0.9, cy - ry * 0.86],
    [cx - rx * 0.9, cy + ry * 0.82],
    [cx + rx * 0.9, cy + ry * 0.82],
  ];
  collageMaskStroke(ctx, r, g, b, Q3_MASK_ALPHA_STRONG, 1.15);
  for (const [x, y] of corners) {
    const sx = x < cx ? 1 : -1;
    const sy = y < cy ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sx * mark, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + sy * mark);
    ctx.stroke();
  }

  collageMaskStroke(ctx, r, g, b, 78, 0.85);
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry * 0.86);
  ctx.lineTo(cx, cy + ry * 0.82);
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    const y = cy + i * ry * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.48, y);
    ctx.lineTo(cx + rx * 0.48, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMaskConfident(ctx, f, seed) {
  const { cx, cy, rx, ry } = f;
  const [r, g, b] = [98, 142, 136];

  ctx.save();
  collageMaskFill(ctx, r, g, b, 20);
  collageMaskPaperPath(ctx, cx, cy, rx * 1.01, ry * 0.98, seed + 40);
  ctx.fill();

  collageMaskStroke(ctx, r, g, b, 74, 1.08);
  const rayAngles = [-Math.PI * 0.92, -Math.PI / 2, -Math.PI / 6, Math.PI / 7, Math.PI * 0.44];
  for (let i = 0; i < rayAngles.length; i++) {
    const ang = rayAngles[i];
    const x0 = cx + Math.cos(ang) * rx * 0.9;
    const y0 = cy + Math.sin(ang) * ry * 0.88;
    const x1 = cx + Math.cos(ang) * rx * 1.15;
    const y1 = cy + Math.sin(ang) * ry * 1.12;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  const arrowAngles = [-Math.PI * 0.88, -Math.PI / 2, -Math.PI * 0.18, Math.PI * 0.18, Math.PI * 0.92];
  collageMaskStroke(ctx, r, g, b, 96, 1.18);
  for (const ang of arrowAngles) {
    const x0 = cx + Math.cos(ang) * rx * 0.92;
    const y0 = cy + Math.sin(ang) * ry * 0.9;
    const x1 = cx + Math.cos(ang) * rx * 1.2;
    const y1 = cy + Math.sin(ang) * ry * 1.16;
    drawMaskArrow(ctx, x0, y0, x1, y1, rx * 0.055);
  }

  collageMaskStroke(ctx, r, g, b, 82, 1.02);
  for (let i = 0; i < 3; i++) {
    const spread = -0.18 + i * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.1, cy - ry * 0.05 + spread * ry);
    ctx.lineTo(cx + rx * 0.14, cy - ry * 0.16 + spread * ry * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMaskProductive(ctx, f, seed) {
  const { cx, cy, w, h, rx, ry } = f;
  const [r, g, b] = [198, 172, 146];
  const [ar, ag, ab] = [142, 160, 180];

  ctx.save();
  collageMaskStroke(ctx, r, g, b, 44, 0.92);
  const gx0 = cx - rx * 0.22;
  const gy0 = cy - ry * 0.26;
  const gw = rx * 0.46;
  const gh = ry * 0.34;
  for (let c = 1; c < 3; c++) {
    const x = gx0 + (c / 3) * gw;
    ctx.beginPath();
    ctx.moveTo(x, gy0);
    ctx.lineTo(x, gy0 + gh);
    ctx.stroke();
  }
  for (let row = 1; row < 3; row++) {
    const y = gy0 + (row / 3) * gh;
    ctx.beginPath();
    ctx.moveTo(gx0, y);
    ctx.lineTo(gx0 + gw, y);
    ctx.stroke();
  }

  const barY = cy + ry * 0.84;
  const barW = rx * 0.7;
  const barH = h * 0.038;
  collageMaskStroke(ctx, r, g, b, 92, 1.02);
  ctx.strokeRect(cx - barW * 0.5, barY, barW, barH);
  collageMaskFill(ctx, r, g, b, 100);
  ctx.fillRect(cx - barW * 0.5, barY, barW * (0.42 + collageHash(seed) * 0.28), barH);

  const tboxW = w * 0.12;
  const tboxH = tboxW * 0.62;
  const tx = cx + rx * 0.62;
  collageMaskStroke(ctx, ar, ag, ab, 88, 1.02);
  ctx.strokeRect(tx, cy - ry * 0.08, tboxW, tboxH);
  ctx.strokeRect(tx, cy + ry * 0.2, tboxW, tboxH);
  collageMaskText(ctx, "TASK 1", tx + 4, cy - ry * 0.08 + tboxH * 0.5, 9, ar, ag, ab, 88);
  collageMaskText(ctx, "TASK 2", tx + 4, cy + ry * 0.2 + tboxH * 0.5, 9, ar, ag, ab, 88);
  ctx.restore();
}

function drawMaskHandArc(ctx, cx, cy, rx, ry, startA, endA, seed, r, g, b, alpha, lineW = 1) {
  collageMaskStroke(ctx, r, g, b, alpha, lineW);
  ctx.beginPath();
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startA + (endA - startA) * t;
    const wobble = (collageHash(seed + i * 2.7) - 0.5) * Math.min(rx, ry) * 0.07;
    const x = cx + Math.cos(a) * rx + wobble * 0.35;
    const y = cy + Math.sin(a) * ry + wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawMaskEasygoing(ctx, f, seed) {
  const { cx, cy, rx, ry } = f;
  const green = [172, 204, 168];
  const cream = [238, 228, 198];
  const rad = Math.min(rx, ry) * 0.26;
  const x0 = cx - rx * 0.93;
  const y0 = cy - ry * 0.89;
  const rw = rx * 1.86;
  const rh = ry * 1.74;

  ctx.save();

  collageMaskStroke(ctx, cream[0], cream[1], cream[2], 82, 0.95);
  ctx.beginPath();
  ctx.moveTo(x0 + rad, y0);
  ctx.lineTo(x0 + rw - rad, y0);
  ctx.quadraticCurveTo(x0 + rw, y0, x0 + rw, y0 + rad);
  ctx.lineTo(x0 + rw, y0 + rh - rad);
  ctx.quadraticCurveTo(x0 + rw, y0 + rh, x0 + rw - rad, y0 + rh);
  ctx.lineTo(x0 + rad, y0 + rh);
  ctx.quadraticCurveTo(x0, y0 + rh, x0, y0 + rh - rad);
  ctx.lineTo(x0, y0 + rad);
  ctx.quadraticCurveTo(x0, y0, x0 + rad, y0);
  ctx.closePath();
  ctx.stroke();

  const wrapArcs = [
    { cx: cx - rx * 0.66, cy: cy - ry * 0.1, rx: rx * 0.34, ry: ry * 0.38, s: -0.25, e: 1.05, a: 100 },
    { cx: cx - rx * 0.58, cy: cy + ry * 0.2, rx: rx * 0.3, ry: ry * 0.32, s: 0.55, e: 1.82, a: 92 },
    { cx: cx + rx * 0.66, cy: cy - ry * 0.1, rx: rx * 0.34, ry: ry * 0.38, s: 2.09, e: 3.39, a: 100 },
    { cx: cx + rx * 0.58, cy: cy + ry * 0.2, rx: rx * 0.3, ry: ry * 0.32, s: 1.32, e: 2.59, a: 92 },
    { cx: cx, cy: cy - ry * 0.66, rx: rx * 0.5, ry: ry * 0.2, s: 0.25, e: 2.89, a: 86 },
  ];

  for (let i = 0; i < wrapArcs.length; i++) {
    const a = wrapArcs[i];
    drawMaskHandArc(ctx, a.cx, a.cy, a.rx, a.ry, a.s, a.e, seed + i * 7.3, green[0], green[1], green[2], a.a, 1.08);
  }

  ctx.restore();
}

function drawMaskUntouchable(ctx, f, seed) {
  const { cx, cy, rx, ry, w, h } = f;
  const cool = [95, 95, 120];
  const deep = [75, 80, 100];
  const accent = [130, 70, 85];
  const arcs = [
    { rx: rx * 1.02, ry: ry * 0.98, s: Math.PI * 0.94, e: Math.PI * 1.63, a: 86 },
    { rx: rx * 1.1, ry: ry * 1.08, s: Math.PI * 1.72, e: Math.PI * 0.2, a: 72 },
    { rx: rx * 0.94, ry: ry * 1.12, s: Math.PI * 0.1, e: Math.PI * 0.72, a: 96 },
  ];

  ctx.save();
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i];
    drawMaskHandArc(ctx, cx, cy, arc.rx, arc.ry, arc.s, arc.e, seed + i * 11.7, cool[0], cool[1], cool[2], arc.a, 1.08);
  }

  collageMaskStroke(ctx, deep[0], deep[1], deep[2], 104, 1.05);
  const boundaries = [
    [cx - rx * 0.98, cy - ry * 0.42, cx - rx * 0.82, cy - ry * 0.58],
    [cx + rx * 0.82, cy - ry * 0.56, cx + rx * 1.02, cy - ry * 0.38],
    [cx - rx * 0.9, cy + ry * 0.36, cx - rx * 0.76, cy + ry * 0.5],
    [cx + rx * 0.74, cy + ry * 0.52, cx + rx * 0.96, cy + ry * 0.34],
  ];
  for (const [x0, y0, x1, y1] of boundaries) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  const frameX = cx - w * 0.36;
  const frameY = cy - h * 0.28;
  const frameW = w * 0.72;
  const frameH = h * 0.56;
  collageMaskStroke(ctx, deep[0], deep[1], deep[2], 78, 0.98);
  ctx.beginPath();
  ctx.moveTo(frameX, frameY + frameH * 0.18);
  ctx.lineTo(frameX, frameY);
  ctx.lineTo(frameX + frameW * 0.24, frameY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(frameX + frameW * 0.78, frameY);
  ctx.lineTo(frameX + frameW, frameY);
  ctx.lineTo(frameX + frameW, frameY + frameH * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(frameX, frameY + frameH * 0.78);
  ctx.lineTo(frameX, frameY + frameH);
  ctx.lineTo(frameX + frameW * 0.18, frameY + frameH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(frameX + frameW * 0.82, frameY + frameH);
  ctx.lineTo(frameX + frameW, frameY + frameH);
  ctx.lineTo(frameX + frameW, frameY + frameH * 0.8);
  ctx.stroke();

  collageMaskStroke(ctx, accent[0], accent[1], accent[2], 82, 0.8);
  for (let i = 0; i < 4; i++) {
    const x = cx + (i - 1.5) * rx * 0.22;
    const y = cy - ry * 0.78 + collageHash(seed + i * 3.9) * 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.035, y - h * 0.016);
    ctx.stroke();
  }
  ctx.restore();
}

const Q3_MASK_DRAWERS = {
  Perfect: drawMaskPerfect,
  Confident: drawMaskConfident,
  Productive: drawMaskProductive,
  Easygoing: drawMaskEasygoing,
  Untouchable: drawMaskUntouchable,
};

const COLLAGE_EYE_RIGHT = { outer: 33, inner: 133, top: 159, bottom: 145 };
const COLLAGE_EYE_LEFT = { outer: 362, inner: 263, top: 386, bottom: 374 };

function getExpressionParams(q3Answer) {
  const table = {
    Perfect: {
      eyeOpenness: 0.68,
      eyeCurve: 0,
      eyeShiftY: 0,
      eyeScaleX: 1.04,
      eyeScaleY: 0.98,
      eyeColorRight: [192, 186, 206],
      eyeColorLeft: [198, 192, 212],
      linerLift: 0.02,
      linerArcRy: 0.22,
      linerTilt: 0,
      asymmetry: 0,
      lineWobble: 0.008,
      mouthCurve: 0.005,
      mouthWidth: 0.8,
      mouthColor: [214, 198, 208],
      mouthLineColor: [98, 90, 104],
      lineAlpha: 118,
      mouthWashAlpha: 54,
      mouthLineWidth: 0.82,
      mouthLowerLip: false,
      mouthProgressBar: false,
    },
    Confident: {
      eyeOpenness: 1.06,
      eyeCurve: 0.18,
      eyeShiftY: -9,
      eyeScaleX: 1.16,
      eyeScaleY: 1.28,
      eyeColorRight: [108, 148, 142],
      eyeColorLeft: [98, 140, 134],
      linerLift: 0.16,
      linerArcRy: 0.36,
      linerTilt: 0.14,
      asymmetry: 0.08,
      lineWobble: 0.028,
      mouthCurve: 0.11,
      mouthWidth: 0.92,
      mouthColor: [238, 188, 168],
      mouthLineColor: [90, 84, 88],
      lineAlpha: 156,
      mouthWashAlpha: 68,
      mouthLineWidth: 1.18,
      mouthLowerLip: false,
      mouthFirm: true,
      mouthProgressBar: false,
    },
    Productive: {
      eyeOpenness: 0.86,
      eyeCurve: 0,
      eyeShiftY: 0,
      eyeScaleX: 1.06,
      eyeScaleY: 1.08,
      eyeColorRight: [148, 164, 184],
      eyeColorLeft: [152, 168, 188],
      linerLift: 0.02,
      linerArcRy: 0.28,
      linerTilt: 0,
      asymmetry: 0,
      lineWobble: 0.012,
      mouthCurve: -0.01,
      mouthWidth: 0.92,
      mouthColor: [220, 194, 174],
      mouthLineColor: [88, 90, 100],
      lineAlpha: 138,
      mouthWashAlpha: 54,
      mouthLineWidth: 1.02,
      mouthLowerLip: false,
      mouthProgressBar: true,
    },
    Easygoing: {
      eyeSmileArc: true,
      eyeOpenness: 0.84,
      eyeShiftY: 10,
      eyeScaleX: 1.12,
      eyeScaleY: 0.98,
      eyeColorRight: [192, 206, 188],
      eyeColorLeft: [232, 210, 206],
      eyeColorAccent: [238, 228, 204],
      eyeSmileWashColor: [236, 214, 206],
      eyeWashAlpha: 72,
      eyeLinerColor: [82, 96, 90],
      eyeLinerAlpha: 148,
      eyeSmileLineWidth: 1.42,
      asymmetry: 0.07,
      lineWobble: 0.02,
      mouthCurve: 0.28,
      mouthWidth: 1.06,
      mouthColor: [244, 208, 198],
      mouthLineColor: [96, 88, 90],
      lineAlpha: 148,
      mouthWashAlpha: 138,
      mouthLineWidth: 0.88,
      mouthLowerLip: true,
      mouthSoft: true,
      mouthProgressBar: false,
    },
    Untouchable: {
      eyeOpenness: 0.35,
      eyeCurve: 0.08,
      eyeShiftY: 2,
      eyeScaleX: 1.02,
      eyeScaleY: 0.84,
      eyeColorRight: [140, 145, 165],
      eyeColorLeft: [140, 145, 165],
      eyeWashAlpha: 58,
      eyeLinerColor: [75, 80, 100],
      eyeLinerAlpha: 150,
      linerLift: 0.04,
      linerArcRy: 0.18,
      linerTilt: 0.18,
      eyeTilt: 0.18,
      asymmetry: 0.05,
      lineWobble: 0.01,
      mouthCurve: -0.05,
      mouthWidth: 0.72,
      mouthColor: [150, 105, 120],
      mouthLineColor: [75, 80, 100],
      lineAlpha: 150,
      mouthWashAlpha: 72,
      mouthLineWidth: 0.98,
      mouthLowerLip: false,
      mouthProgressBar: false,
      mouthStyle: "tight_flat",
      eyeStyle: "narrow_cold",
      structureStyle: "protective_boundary",
      symmetry: "medium",
      structureColor: [95, 95, 120],
      accentColor: [130, 70, 85],
    },
  };
  return table[q3Answer] || table.Easygoing;
}

function q3MaskExpression() {
  return getExpressionParams(q3MaskAnswer());
}

const ABSTRACT_WASH_ALPHA = 128;
const ABSTRACT_LINE_ALPHA = 150;
const ABSTRACT_LINE_FAINT = 92;
const ABSTRACT_NOSE_ALPHA = 110;
const ABSTRACT_INK = [68, 62, 78];

function collageDist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function collageFillRgba(rgb, alpha255) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha255 / 255})`;
}

function collageEyeMetrics(face, comp, spec) {
  const outer = collageKeypointScreen(face, comp, spec.outer);
  const inner = collageKeypointScreen(face, comp, spec.inner);
  const top = collageKeypointScreen(face, comp, spec.top);
  const bottom = collageKeypointScreen(face, comp, spec.bottom);
  if (!outer || !inner || !top || !bottom) return null;

  const cx = (outer.x + inner.x + top.x + bottom.x) * 0.25;
  const cy = (outer.y + inner.y + top.y + bottom.y) * 0.25;
  const w = collageDist(outer.x, outer.y, inner.x, inner.y) * 1.12;
  const h = collageDist(top.x, top.y, bottom.x, bottom.y) * 1.2;
  const angle = Math.atan2(inner.y - outer.y, inner.x - outer.x);
  return { cx, cy, w, h, angle };
}

function collageMouthMetrics(face, comp) {
  const left = collageKeypointScreen(face, comp, 61);
  const right = collageKeypointScreen(face, comp, 291);
  const top = collageKeypointScreen(face, comp, 13);
  const bottom = collageKeypointScreen(face, comp, 14);
  if (!left || !right || !top || !bottom) return null;

  const cx = (left.x + right.x) * 0.5;
  const cy = (top.y + bottom.y) * 0.5;
  const w = collageDist(left.x, left.y, right.x, right.y) * 1.02;
  const h = Math.max(collageDist(top.x, top.y, bottom.x, bottom.y) * 1.15, w * 0.18);
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  return { cx, cy, w, h, angle };
}

function collageNoseMetrics(face, comp) {
  const bridgeTop = collageKeypointScreen(face, comp, 168);
  const tip = collageKeypointScreen(face, comp, 4) || collageKeypointScreen(face, comp, 1);
  if (!bridgeTop || !tip) return null;
  const brushW = comp.displayW * 0.026;
  return { bridgeTop, tip, brushW };
}

function collageSoftEllipse(ctx, cx, cy, rx, ry, angle, rgba, blurPx = 0) {
  ctx.save();
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba;
  ctx.fill();
  ctx.restore();
}

function collageSoftArc(ctx, cx, cy, rx, ry, startA, endA, angle, seed, strokeRgba, lineW, wobbleMul = 0.08) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = strokeRgba;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startA + (endA - startA) * t;
    const wobble = (collageHash(seed + i * 3.1) - 0.5) * ry * wobbleMul;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry + wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function smileEyeArcPoints(halfW, h, amp, wobble, seed, steps = 12) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -halfW + t * halfW * 2;
    const y = -amp * Math.sin(t * Math.PI) + (collageHash(seed + i * 2.1) - 0.5) * wobble;
    pts.push({ x, y });
  }
  return pts;
}

function strokeSmileEyeArc(ctx, pts, rgba, lineW, blur = 0) {
  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.strokeStyle = rgba;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
    else ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function normalizeSmileEyeAngle(angle) {
  let a = angle || 0;
  if (a > Math.PI / 2) a -= Math.PI;
  if (a < -Math.PI / 2) a += Math.PI;
  return a;
}

function drawEasygoingSmileEye(ctx, metrics, fillRgb, seed, side, params) {
  if (!metrics) return;
  const sign = side === "left" ? -1 : 1;
  const asym = params.asymmetry ?? 0.06;
  const { cx, cy, w, h, angle } = metrics;
  const drawAngle = normalizeSmileEyeAngle(angle);
  const eyeCy = cy + (params.eyeShiftY || 0);
  const openFactor = 0.76 + (params.eyeOpenness ?? 0.78) * 0.38;
  const halfW = w * 0.595 * (params.eyeScaleX || 1);
  const arcH = h * (0.54 + openFactor * 0.12) * (params.eyeScaleY || 1);
  const wobble = h * (params.lineWobble ?? 0.03) * 0.12;
  const washAlpha = params.eyeWashAlpha ?? 122;
  const accent = params.eyeColorAccent || [238, 228, 204];
  const washRgb = params.eyeSmileWashColor || accent;
  const sideSkew = sign * asym * 0.9;

  ctx.save();
  ctx.translate(cx + sign * 0.5 * asym, eyeCy);
  ctx.rotate(drawAngle + sign * 0.012 * asym);

  collageSoftEllipse(
    ctx,
    0,
    h * 0.16,
    halfW * 0.82,
    h * 0.14 * openFactor,
    0,
    collageFillRgba(washRgb, Math.round(washAlpha * 0.22)),
    7
  );

  ctx.restore();
}

function drawEasygoingSmileEyeLiner(ctx, metrics, seed, side, params) {
  if (!metrics) return;
  const sign = side === "left" ? -1 : 1;
  const asym = params.asymmetry ?? 0.06;
  const { cx, cy, w, h, angle } = metrics;
  const drawAngle = normalizeSmileEyeAngle(angle);
  const eyeCy = cy + (params.eyeShiftY || 0);
  const openFactor = 0.76 + (params.eyeOpenness ?? 0.78) * 0.38;
  const halfW = w * 0.595 * (params.eyeScaleX || 1);
  const arcH = h * (0.54 + openFactor * 0.12) * (params.eyeScaleY || 1);
  const wobble = h * (params.lineWobble ?? 0.03) * 0.12;
  const linerRgb = params.eyeLinerColor || [72, 88, 78];
  const linerAlpha = params.eyeLinerAlpha ?? 152;
  const sideSkew = sign * asym * 0.9;
  const leftX = -halfW;
  const rightX = halfW;
  const baseY = h * (0.06 + sideSkew * 0.02);
  const startY = baseY;
  const endY = baseY;
  const cp1x = -halfW * 0.24;
  const cp2x = halfW * 0.24;
  const cpY =
    -arcH +
    (collageHash(seed + 11.4) - 0.5) * wobble -
    Math.abs(sideSkew) * h * 0.01;

  ctx.save();
  ctx.translate(cx + sign * 0.5 * asym, eyeCy);
  ctx.rotate(drawAngle + sign * 0.016 * asym);

  ctx.strokeStyle = collageFillRgba(linerRgb, linerAlpha);
  ctx.lineWidth = params.eyeSmileLineWidth ?? 1.65;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(leftX, startY);
  ctx.bezierCurveTo(cp1x, cpY, cp2x, cpY, rightX, endY);
  ctx.stroke();

  ctx.restore();
}

function drawWatercolorEye(ctx, metrics, fillRgb, alpha255, seed, side, params) {
  if (!metrics) return;
  if (params.eyeSmileArc) {
    drawEasygoingSmileEye(ctx, metrics, fillRgb, seed, side, params);
    return;
  }
  const sign = side === "left" ? -1 : 1;
  const asym = params.asymmetry ?? 0.2;
  const { cx, cy, w, h, angle } = metrics;
  const eyeCy = cy + (params.eyeShiftY || 0);
  const dx = sign * 1.2 * asym;
  const rot = sign * 0.02 * asym;
  const openMul = 0.72 + (params.eyeOpenness ?? 0.7) * 0.38;
  const rx = w * 0.54 * 0.5 * (params.eyeScaleX || 1);
  const ry = h * 0.48 * 0.5 * (params.eyeScaleY || 1) * openMul;
  const eyeWashAlpha = params.eyeWashAlpha ?? alpha255;
  const tint = collageFillRgba(fillRgb, eyeWashAlpha);

  collageSoftEllipse(ctx, cx + dx, eyeCy, rx * 1.1, ry * 1.06, angle + rot, collageFillRgba(fillRgb, eyeWashAlpha * 0.5), 6);
  collageSoftEllipse(ctx, cx + dx * 0.4, eyeCy, rx, ry, angle + rot, tint, 2);
  collageSoftEllipse(ctx, cx, eyeCy, rx * 0.92, ry * 0.86, angle + rot, collageFillRgba(fillRgb, Math.min(eyeWashAlpha + 12, 148)), 0);
}

function drawWatercolorEyeLiner(ctx, metrics, seed, side, params) {
  if (!metrics) return;
  if (params.eyeSmileArc) {
    drawEasygoingSmileEyeLiner(ctx, metrics, seed, side, params);
    return;
  }
  const sign = side === "left" ? -1 : 1;
  const asym = params.asymmetry ?? 0.2;
  const { cx, cy, w, h, angle } = metrics;
  const eyeCy = cy + (params.eyeShiftY || 0);
  const eyeOpen = params.eyeOpenness ?? 0.7;
  const eyeCurve = params.eyeCurve ?? 0;
  const lift = (params.linerLift || 0) * h;
  const tilt = (params.linerTilt || 0) * h;
  const wobble = params.lineWobble ?? 0.06;
  const rx = w * 0.46;
  const ry = h * (params.linerArcRy ?? 0.26) * (0.55 + eyeOpen * 0.55) * (1 + eyeCurve * 0.35);
  const lineAlpha = params.eyeLinerAlpha ?? params.lineAlpha ?? ABSTRACT_LINE_ALPHA;
  const arcSoft = params.eyeArcSoft ? h * 0.035 : 0;

  ctx.save();
  ctx.translate(cx + sign * 0.8 * asym, eyeCy);
  ctx.rotate(angle + sign * 0.02 * asym);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (eyeOpen < 0.4) {
    const inkRgb = params.eyeLinerColor || ABSTRACT_INK;
    ctx.strokeStyle = collageFillRgba(inkRgb, lineAlpha);
    ctx.lineWidth = 1.08;
    ctx.beginPath();
    const y = h * 0.04 + lift;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = -rx * 0.86 + t * rx * 1.72;
      const droop = Math.sin(t * Math.PI) * h * (0.04 - eyeCurve * 0.05);
      const wy = (collageHash(seed + i * 2.1) - 0.5) * h * wobble * 0.22;
      if (i === 0) ctx.moveTo(x, y + droop + wy);
      else ctx.lineTo(x, y + droop + wy);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const inkRgb = params.eyeLinerColor || ABSTRACT_INK;
  const upperY = -h * (0.08 + eyeOpen * 0.07) + lift - eyeCurve * h * 0.06;
  ctx.strokeStyle = collageFillRgba(inkRgb, lineAlpha);
  ctx.lineWidth = eyeOpen > 0.85 ? 1.25 : 1.12;
  ctx.beginPath();
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.PI * 1.06 + t * Math.PI * 0.88;
    let x = Math.cos(a) * rx;
    let y = Math.sin(a) * ry + upperY;
    const outer = sign > 0 ? x > 0 : x < 0;
    if (outer && tilt) y -= tilt * (Math.abs(x) / rx);
    if (outer && params.linerTailDown) y += params.linerTailDown * h * (Math.abs(x) / rx);
    if (params.eyeArcSoft) y += arcSoft * (0.35 + (Math.abs(x) / rx) * 0.65);
    y += (collageHash(seed + i * 2.7) - 0.5) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (eyeOpen > 0.55) {
    ctx.strokeStyle = collageFillRgba(inkRgb, Math.round(lineAlpha * 0.62));
    ctx.lineWidth = 0.85;
    const lowerY = h * (0.1 - eyeOpen * 0.02) + eyeCurve * h * 0.04;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = Math.PI * 0.14 + t * Math.PI * 0.72;
      const x = Math.cos(a) * rx * 0.9;
      const y = Math.sin(a) * ry * 0.48 + lowerY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawWatercolorNose(ctx, nose, seed) {
  if (!nose) return;
  const { bridgeTop, tip, brushW } = nose;
  const bend = (collageHash(seed + 4.2) - 0.5) * brushW * 1.2;
  const wash = collageFillRgba([238, 206, 198], ABSTRACT_NOSE_ALPHA);
  const tipWash = collageFillRgba([234, 198, 190], ABSTRACT_NOSE_ALPHA - 8);

  ctx.save();
  ctx.filter = "blur(4px)";
  ctx.strokeStyle = wash;
  ctx.lineWidth = brushW * 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bridgeTop.x + bend * 0.2, bridgeTop.y);
  ctx.quadraticCurveTo(
    (bridgeTop.x + tip.x) * 0.5 + bend,
    (bridgeTop.y + tip.y) * 0.52,
    tip.x + bend * 0.15,
    tip.y
  );
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(2px)";
  ctx.fillStyle = tipWash;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y + brushW * 0.2, brushW * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  collageSoftArc(
    ctx,
    tip.x,
    tip.y + brushW * 0.45,
    brushW * 1.1,
    brushW * 0.55,
    Math.PI * 0.15,
    Math.PI * 0.85,
    collageHash(seed) * 0.2 - 0.1,
    seed + 9,
    collageFillRgba(ABSTRACT_INK, ABSTRACT_LINE_FAINT),
    0.85
  );
}

function drawAbstractMouth(ctx, metrics, seed, params) {
  if (!metrics) return;
  const { cx, cy, w, h, angle } = metrics;
  const mouthCurve = params.mouthCurve ?? 0;
  const mouthWidth = params.mouthWidth ?? 1;
  const mouthColor = params.mouthColor || [232, 186, 194];
  const lineAlpha = params.lineAlpha ?? ABSTRACT_LINE_ALPHA;
  const mouthWashAlpha = params.mouthWashAlpha ?? ABSTRACT_WASH_ALPHA;
  const lineWobble = params.lineWobble ?? 0.04;
  const mouthLineWidth = params.mouthLineWidth ?? 1.05;

  const mouthW = w * mouthWidth;
  const halfW = mouthW * 0.5;
  const curveDepth = mouthCurve * h * 0.95;
  const cornerLift = mouthCurve > 0.08 ? mouthCurve * h * (params.mouthSoft ? 0.18 : 0.22) : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  if (params.mouthProgressBar) {
    const barH = h * 0.22;
    const barW = mouthW * 1.08;
    const r = barH * 0.22;
    const bx = -barW * 0.5;
    const by = -barH * 0.5;
    ctx.fillStyle = collageFillRgba(mouthColor, 42);
    ctx.strokeStyle = collageFillRgba(mouthColor, 68);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + barW - r, by);
    ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + r);
    ctx.lineTo(bx + barW, by + barH - r);
    ctx.quadraticCurveTo(bx + barW, by + barH, bx + barW - r, by + barH);
    ctx.lineTo(bx + r, by + barH);
    ctx.quadraticCurveTo(bx, by + barH, bx, by + barH - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (mouthWashAlpha > 0) {
    const soft = params.mouthSoft;
    const lipH = h * (soft ? 0.28 + Math.abs(mouthCurve) * 0.32 : 0.22 + Math.abs(mouthCurve) * 0.28);
    const wash = collageFillRgba(mouthColor, mouthWashAlpha);
    const blurOuter = soft ? 5 : 4;
    const blurInner = soft ? 2.5 : 1.2;
    collageSoftEllipse(
      ctx,
      0,
      h * 0.02,
      halfW * (soft ? 0.98 : 0.92),
      lipH * (soft ? 0.58 : 0.5),
      0,
      collageFillRgba(mouthColor, mouthWashAlpha * 0.45),
      blurOuter
    );
    collageSoftEllipse(ctx, 0, 0, halfW * (soft ? 0.88 : 0.82), lipH * (soft ? 0.48 : 0.42), 0, wash, blurInner);
  }

  const mouthLineRgb = params.mouthLineColor || ABSTRACT_INK;
  const ink = collageFillRgba(mouthLineRgb, lineAlpha);
  const steps = params.mouthFirm ? 16 : params.mouthSoft ? 18 : 14;
  ctx.strokeStyle = ink;
  ctx.lineWidth = mouthLineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  const wobbleScale = params.mouthSoft ? 0.55 : params.asymmetry === 0 ? 0.35 : 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -halfW + t * mouthW;
    const centerBend = -4 * t * (1 - t) * curveDepth;
    const cornerBend = -cornerLift * (Math.pow(Math.abs(t - 0.5) * 2, params.mouthSoft ? 1.35 : 1.6));
    const wy = (collageHash(seed + i * 2.3) - 0.5) * h * lineWobble * wobbleScale;
    const y = centerBend + cornerBend + wy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (params.mouthFirm) {
    ctx.strokeStyle = collageFillRgba(ABSTRACT_INK, Math.min(lineAlpha + 18, 175));
    ctx.lineWidth = mouthLineWidth * 0.55;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = -halfW * 0.28 + t * mouthW * 0.28;
      const y = -4 * t * (1 - t) * curveDepth * 1.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  if (params.mouthLowerLip) {
    const lowerRy = h * (params.mouthSoft ? 0.07 + mouthCurve * 0.14 : 0.05 + mouthCurve * 0.12);
    collageSoftArc(
      ctx,
      0,
      h * (params.mouthSoft ? 0.12 : 0.1) + mouthCurve * h * 0.04,
      halfW * (params.mouthSoft ? 0.78 : 0.72),
      lowerRy,
      Math.PI * 1.1,
      Math.PI * 1.9,
      0,
      seed + 33,
      collageFillRgba(params.mouthLineColor || ABSTRACT_INK, Math.round(lineAlpha * (params.mouthSoft ? 0.48 : 0.58))),
      mouthLineWidth * (params.mouthSoft ? 0.68 : 0.72),
      lineWobble * (params.mouthSoft ? 0.6 : 0.85)
    );
  }

  ctx.restore();
}

function drawCollageAbstractFeatures(ctx, face, comp, seed) {
  const params = getExpressionParams(q3MaskAnswer());
  const rightEye = collageEyeMetrics(face, comp, COLLAGE_EYE_RIGHT);
  const leftEye = collageEyeMetrics(face, comp, COLLAGE_EYE_LEFT);
  const mouth = collageMouthMetrics(face, comp);
  const nose = collageNoseMetrics(face, comp);

  const eyeColorRight = params.eyeColorRight || [196, 206, 220];
  const eyeColorLeft = params.eyeColorLeft || [214, 196, 212];

  const eyeWashRight = params.eyeWashAlpha ?? 122;
  const eyeWashLeft = params.eyeWashAlpha ?? 128;

  drawWatercolorEye(ctx, rightEye, eyeColorRight, eyeWashRight, seed, "right", params);
  drawWatercolorEye(ctx, leftEye, eyeColorLeft, eyeWashLeft, seed + 11, "left", params);

  drawWatercolorNose(ctx, nose, seed + 27);
  drawAbstractMouth(ctx, mouth, seed + 41, params);

  drawWatercolorEyeLiner(ctx, rightEye, seed + 3, "right", params);
  drawWatercolorEyeLiner(ctx, leftEye, seed + 19, "left", params);
}

function updateCollageAbstractFace(face, comp) {
  if (!introMeshCtx || !introMeshCanvas) return;

  introMeshCtx.clearRect(0, 0, introMeshCanvas.width, introMeshCanvas.height);
  if (!face || !comp) return;

  const ctx = introMeshCtx;
  ctx.save();
  ctx.globalAlpha = 1;
  drawCollageAbstractFeatures(ctx, face, comp, collageLayerSeed + 503);
  ctx.restore();
}

function drawQ3Structure(comp) {
  if (!introMeshCtx) return;
  const frame = collageFaceFrame(comp);
  const answer = q3MaskAnswer();
  const drawer = Q3_MASK_DRAWERS[answer] || drawMaskEasygoing;
  const seed = collageLayerSeed + 97;
  const ctx = introMeshCtx;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  collageMaskPaperPath(ctx, frame.cx, frame.cy, frame.rx * 1.12, frame.ry * 1.1, seed + 55);
  ctx.clip();
  drawer(ctx, frame, seed);
  ctx.restore();
}

function drawCollageMaskLayer(comp) {
  drawQ3Structure(comp);
}

function sampleLabelEntries(pool, count, seedOffset) {
  if (!pool?.length || count <= 0) return [];
  const keyed = pool.map((item, i) => ({
    item,
    score: collageHash(collageLabelSeed + seedOffset + i * 17.3),
  }));
  keyed.sort((a, b) => a.score - b.score);
  return keyed.slice(0, Math.min(count, pool.length)).map((entry) => entry.item);
}

function sampleUniqueLabelEntries(pool, count, seedOffset, used = new Set()) {
  if (!pool?.length || count <= 0) return [];
  const keyed = pool.map((item, i) => ({
    item,
    score: collageHash(collageLabelSeed + seedOffset + i * 17.3),
  }));
  keyed.sort((a, b) => a.score - b.score);

  const out = [];
  for (const entry of keyed) {
    if (used.has(entry.item)) continue;
    out.push(entry.item);
    used.add(entry.item);
    if (out.length >= Math.min(count, pool.length)) break;
  }
  return out;
}

function sampleLabelTypes(pool, count, seedOffset) {
  const types = pool?.length ? pool : ["rect"];
  const keyed = types.map((type, i) => ({
    type,
    score: collageHash(collageLabelSeed + seedOffset + i * 13.7),
  }));
  keyed.sort((a, b) => a.score - b.score);

  const ordered = keyed.map((entry) => entry.type);
  const out = [];
  for (let i = 0; i < count; i++) out.push(ordered[i % ordered.length]);
  return out;
}

function buildLabelEntries(textPool, count, seedOffset, typePool) {
  const texts = sampleLabelEntries(textPool, count, seedOffset);
  const types = sampleLabelTypes(typePool, texts.length, seedOffset + 5.1);
  return texts.map((text, i) => ({
    text,
    type: types[i] || "rect",
  }));
}

function labelsFromAnswers() {
  const q1 = resolveAnswerKey("identity", userAnswers?.identity) || "Myself";
  const q2 = resolveAnswerKey("perception", userAnswers?.perception) || "Quiet";
  const q3 = q3MaskAnswer();
  const q4 = resolveAnswerKey("unseen", userAnswers?.unseen) || "Fear";
  const used = new Set();
  const q1Count = 1 + (collageHash(collageLabelSeed + 4.9) > 0.5 ? 1 : 0);
  const q4Count = 1 + (collageHash(collageLabelSeed + 12.7) > 0.48 ? 1 : 0);

  const out = [];
  const q1Texts = sampleUniqueLabelEntries(collageLabelPools.q1[q1], q1Count, 11, used);
  const q2Texts = sampleUniqueLabelEntries(collageLabelPools.q2[q2], 2, 37, used);
  const q3Texts = sampleUniqueLabelEntries(collageLabelPools.q3[q3], 2, 73, used);
  const q4Texts = sampleUniqueLabelEntries(collageLabelPools.q4[q4], q4Count, 101, used);
  const systemTexts = sampleUniqueLabelEntries(collageLabelPools.system, 1, 151, used);

  out.push(...buildLabelEntries(q1Texts, q1Texts.length, 11, collageLabelTypePools.q1[q1]));
  out.push(...buildLabelEntries(q2Texts, q2Texts.length, 37, collageLabelTypePools.q2[q2]));
  out.push(...buildLabelEntries(q3Texts, q3Texts.length, 73, collageLabelTypePools.q3[q3]));
  out.push(...buildLabelEntries(q4Texts, q4Texts.length, 101, collageLabelTypePools.q4[q4]));
  out.push(...buildLabelEntries(systemTexts, systemTexts.length, 151, collageLabelTypePools.system));
  return out.slice(0, 8);
}

function collageLabelSlots() {
  return [
    { region: "foreheadLeft", offsetX: -8, offsetY: -38, jitterX: 14, jitterY: 10 },
    { region: "foreheadRight", offsetX: 8, offsetY: -36, jitterX: 14, jitterY: 10 },
    { region: "leftCheekOuter", offsetX: -70, offsetY: 2, jitterX: 16, jitterY: 20 },
    { region: "rightCheekOuter", offsetX: 70, offsetY: 0, jitterX: 16, jitterY: 20 },
    { region: "leftLowerCheek", offsetX: -58, offsetY: 22, jitterX: 16, jitterY: 18 },
    { region: "rightLowerCheek", offsetX: 58, offsetY: 22, jitterX: 16, jitterY: 18 },
    { region: "belowMouth", offsetX: 0, offsetY: 44, jitterX: 18, jitterY: 12 },
    { region: "chinLow", offsetX: 0, offsetY: 78, jitterX: 14, jitterY: 10 },
    { region: "maskEdge", offsetX: -30, offsetY: 8, jitterX: 14, jitterY: 16 },
  ];
}

function labelSizeForType(type, seed) {
  const wBase = {
    tag: 92,
    rect: 98,
    round: 86,
    tape: 112,
    warning: 96,
    blue: 102,
    purple: 86,
    folded: 104,
    roundedWhite: 96,
    orangeRound: 90,
  };
  const hBase = {
    tag: 38,
    rect: 42,
    round: 40,
    tape: 34,
    warning: 40,
    blue: 42,
    purple: 30,
    folded: 40,
    roundedWhite: 42,
    orangeRound: 40,
  };
  return {
    w: (wBase[type] || 94) + collageHash(seed + 4.3) * 18,
    h: (hBase[type] || 40) + collageHash(seed + 7.1) * 10,
  };
}

function buildDynamicLabels(comp, face) {
  const words = labelsFromAnswers();
  const slots = collageLabelSlots();
  const safeZones = collageFeatureSafeZones(face, comp);
  const placedRects = [];

  dynamicLabels = words.map((word, i) => {
    const slot = slots[i % slots.length];
    const seed = collageLabelSeed + i * 19.7;
    const img = labelImages[word.type] || labelImages.rect;
    const size = labelSizeForType(word.type, seed);
    const placed = resolveCollageLabelPlacement(comp, face, slot, size, seed, safeZones, placedRects);
    return {
      id: `label_${i}`,
      text: word.text,
      type: word.type,
      img,
      region: slot.region,
      x: placed.x,
      y: placed.y,
      offsetX: placed.offsetX,
      offsetY: placed.offsetY,
      w: size.w,
      h: size.h,
      rot: (collageHash(seed + 8.2) - 0.5) * 0.28,
      seed,
      torn: false,
      tearing: false,
      tearVy: 0,
      tearVx: 0,
      tearRot: 0,
      alpha: 1,
      hoverMs: 0,
    };
  });
}

function syncCollageTitle() {
  const titleEl = document.getElementById("question-title");
  const titleP = titleEl?.querySelector("p");
  if (titleEl && titleP) {
    titleP.textContent = "마음에 들지 않는 라벨을 손으로 떼어내세요.";
    titleEl.classList.add("is-visible");
    titleEl.setAttribute("aria-hidden", "false");
    titleEl.style.opacity = "";
    titleP.style.transform = "";
  }
  document.getElementById("intro-title")?.classList.remove("is-visible");
}

function hideCollageTitle() {
  const titleEl = document.getElementById("question-title");
  titleEl?.classList.remove("is-visible");
  if (titleEl) titleEl.setAttribute("aria-hidden", "true");
}

function getCaptureFragmentsButtonDef() {
  return { x: width * 0.56, y: height * 0.91, r: 38, hitR: 50, icon: "camera" };
}

function getRestartFragmentsButtonDef() {
  return { x: width * 0.44, y: height * 0.91, r: 38, hitR: 50, icon: "refresh" };
}

function drawCaptureButtonHint(button) {
  push();
  textAlign(CENTER, TOP);
  textFont("Chiron GoRound TC");
  textSize(12.5);
  fill(95, 99, 106, 220);
  text("카메라 버튼을 클릭해 사진을 저장하세요.", button.x, button.y + button.r + 16);
  pop();
}

function canCaptureFragments() {
  return state === "collageStudio" && collageRemovedLabelCount > 0 && !pendingFragmentCapture;
}

function collageCaptureButtonEnabled() {
  return (
    state === "collageStudio" &&
    collageRemovedLabelCount > 0 &&
    !pendingFragmentCapture &&
    !fragmentCaptureSnapshot
  );
}

function startFragmentCapture() {
  if (!canCaptureFragments()) return false;
  pendingFragmentCapture = true;
  fragmentCaptureStartedAt = millis();
  fragmentCaptureFlash = 1;
  return true;
}

function fragmentCaptureFlashAlpha(elapsed) {
  const rise = 110;
  const hold = 90;
  const fade = max(1, FRAGMENT_CAPTURE_FLASH_MS - rise - hold);
  if (elapsed < rise) return elapsed / rise;
  if (elapsed < rise + hold) return 1;
  return max(0, 1 - (elapsed - rise - hold) / fade);
}

function captureCollageComposite() {
  const g = createGraphics(width, height);
  g.clear();
  g.background(245, 245, 247);

  if (introFaceCanvas?.width && introFaceCanvas?.height) {
    g.drawingContext.drawImage(introFaceCanvas, 0, 0, width, height);
  }
  if (introMeshCanvas?.width && introMeshCanvas?.height) {
    g.drawingContext.drawImage(introMeshCanvas, 0, 0, width, height);
  }

  for (const label of dynamicLabels) {
    drawLabelObject(label, g);
  }

  fragmentCaptureSnapshot = g;
}

function updateFragmentCaptureFlow() {
  if (!pendingFragmentCapture) return;

  const elapsed = millis() - fragmentCaptureStartedAt;

  if (!fragmentCaptureSnapshot && elapsed >= FRAGMENT_CAPTURE_SNAPSHOT_DELAY_MS) {
    captureCollageComposite();
  }

  fragmentCaptureFlash = fragmentCaptureFlashAlpha(elapsed);
  if (fragmentCaptureFlash > 0.01) {
    noStroke();
    fill(255, 255, 255, fragmentCaptureFlash * 252);
    rect(0, 0, width, height);
  }

  if (elapsed >= FRAGMENT_CAPTURE_FLASH_MS && fragmentCaptureSnapshot) {
    pendingFragmentCapture = false;
    fragmentCaptureFlash = 0;
    hideCollageTitle();
    state = "resultFragments";
    if (!fragmentAutoSaved) {
      fragmentAutoSaved = true;
      saveFragmentsImageToLocal?.();
    }
  }
}

function initCollageStudio() {
  dynamicLabels = [];
  collageHandCursor = null;
  collageHighlightedLabelId = null;
  collageCursorTrail = [];
  collageTearCooldownUntil = 0;
  fragmentCaptureSnapshot = null;
  pendingFragmentCapture = false;
  fragmentCaptureStartedAt = 0;
  fragmentCaptureFlash = 0;
  collageRemovedLabelCount = 0;
  collageCaptureFingerInside = false;
  collageRefreshFingerInside = false;
  collageCaptureHoldMs = 0;
  collageRefreshHoldMs = 0;
  collageCaptureLatched = false;
  collageRefreshLatched = false;
  resultSaveHoldMs = 0;
  resultRefreshHoldMs = 0;
  resultSaveLatched = false;
  resultRefreshLatched = false;
  fragmentSaveCooldownUntil = 0;
  fragmentSaveNoticeUntil = 0;
  fragmentSaveNoticeText = "";
  fragmentHasSavedOnce = false;
  fragmentAutoSaved = false;
  collageLabelSeed = Math.floor(Math.random() * 1e9);
  collageFaceBaseSeed = Math.floor(Math.random() * 1e9);
  collageLayerSeed = Math.floor(Math.random() * 1e9);
  syncCollageTitle();

  if (COLLAGE_ANSWER_DEBUG && !collageDebugLogged) {
    collageDebugLogged = true;
    console.info("[collage answers]", {
      q1_identity: userAnswers.identity,
      q2_perception: userAnswers.perception,
      q3_mask_raw: getSavedQ3Mask(),
      q3_mask_resolved: q3MaskAnswer(),
      q4_unseen: userAnswers.unseen,
      userAnswers,
    });
  }
}

function drawCollageAnswerDebug() {
  if (!COLLAGE_ANSWER_DEBUG) return;

  const q2 = optionLabelForKey("perception", resolveAnswerKey("perception", userAnswers?.perception)) || "(none)";
  const q3 = optionLabelForKey("mask", q3MaskAnswer());

  push();
  drawingContext.save();
  noStroke();
  fill(248, 248, 250, 230);
  rect(12, height - 54, min(width - 24, 320), 42, 6);
  fill(32, 32, 38, 235);
  textFont(APP_SERIF);
  textAlign(LEFT, TOP);
  textSize(13);
  text(`Q2: ${q2}`, 22, height - 46);
  text(`Q3: ${q3}`, 22, height - 28);
  drawingContext.restore();
  pop();
}

function updateBoundLabels(comp, face) {
  for (const label of dynamicLabels) {
    if (label.torn || label.tearing) continue;
    const anchor = collageLabelAnchor(comp, label.region, face);
    label.x = lerp(label.x, anchor.x + label.offsetX, LABEL_BIND_LERP);
    label.y = lerp(label.y, anchor.y + label.offsetY, LABEL_BIND_LERP);
  }
}

function pointInsideLabel(p, label) {
  const r = LABEL_PICK_RADIUS + max(label.w, label.h) * 0.22;
  return dist(p.x, p.y, label.x, label.y) < r;
}

function spawnPaperFragmentsForLabel(label) {
  const count = floor(random(6, 13));
  const tone = paperToneForStickerType(label.type);
  for (let i = 0; i < count; i++) {
    const jitterX = random(-label.w * 0.18, label.w * 0.18);
    const jitterY = random(-label.h * 0.18, label.h * 0.18);
    paperFragments.push(new PaperFragment(label.x + jitterX, label.y + jitterY, tone));
  }
}

function findHoveredLabel(cursor) {
  if (!cursor) return null;
  for (let i = dynamicLabels.length - 1; i >= 0; i--) {
    const label = dynamicLabels[i];
    if (!label.torn && !label.tearing && pointInsideLabel(cursor, label)) return label;
  }
  return null;
}

function tearLabel(label, impulse = { x: 0, y: 0 }) {
  if (!label || label.tearing || label.torn) return;
  label.tearing = true;
  label.tearImpulse = impulse;
  label.tearStart = millis();
  label.hoverMs = 0;
  collageTearCooldownUntil = label.tearStart + 360;
}

function tearCollageLabelAt(x, y) {
  if (state !== "collageStudio") return false;
  if (millis() < collageTearCooldownUntil) return false;
  const label = findHoveredLabel({ x, y });
  if (!label) return false;
  tearLabel(label, { x: random(-0.5, 0.5), y: -0.5 });
  return true;
}

function updateLabelRemoval(cursor) {
  const now = millis();
  const dt = deltaTime || 16;
  let hasActiveTear = false;
  for (const label of dynamicLabels) {
    if (label.tearing) {
      hasActiveTear = true;
      if (millis() - label.tearStart >= 200) {
        spawnPaperFragmentsForLabel(label);
        collageRemovedLabelCount += 1;
        label.torn = true;
        label.tearing = false;
      }
      continue;
    }
  }

  const canAcquireHover = !hasActiveTear && now >= collageTearCooldownUntil;
  const hovered = canAcquireHover ? findHoveredLabel(cursor) : null;
  collageHighlightedLabelId = hovered?.id || null;

  for (const label of dynamicLabels) {
    if (label.tearing) continue;
    if (hovered?.id === label.id && cursor) {
      label.hoverMs += dt;
      if (label.hoverMs >= LABEL_TEAR_HOLD_MS) {
        tearLabel(label, { x: (label.x - cursor.x) * 0.01, y: -0.2 });
      }
    } else {
      label.hoverMs = max(0, label.hoverMs - dt * 2);
    }
  }

  dynamicLabels = dynamicLabels.filter((label) => !label.torn);
}

function fitCollageLabelLines(text, maxW, pg) {
  const measure = (txt, size) => {
    if (pg) {
      pg.textSize(size);
      return pg.textWidth(txt);
    }
    textSize(size);
    return textWidth(txt);
  };

  let size = constrain(maxW * 0.13, 9, 14);
  while (size > 8 && measure(text, size) > maxW) size -= 0.35;
  if (measure(text, size) <= maxW) return { lines: [text], size };

  const mid = ceil(text.length / 2);
  const line1 = text.slice(0, mid);
  const line2 = text.slice(mid);
  while (size > 7 && (measure(line1, size) > maxW || measure(line2, size) > maxW)) size -= 0.35;
  return { lines: [line1, line2], size };
}

function drawLabelObject(label, pg) {
  if (label.torn) return;

  const highlighted = label.id === collageHighlightedLabelId && !label.tearing;
  const alpha = label.alpha * (highlighted ? 1 : 0.92);
  const hoverT = constrain(label.hoverMs / LABEL_TEAR_HOLD_MS, 0, 1);
  const shakeT = label.tearing ? constrain((millis() - label.tearStart) / 200, 0, 1) : 0;
  const shakeX = label.tearing ? sin(millis() * 0.1 + label.seed) * 2.8 * (1 - shakeT * 0.35) : 0;
  const shakeY = label.tearing ? cos(millis() * 0.085 + label.seed) * 1.6 * (1 - shakeT * 0.35) : 0;
  const shakeRot = label.tearing ? sin(millis() * 0.12 + label.seed) * 0.05 * (1 - shakeT * 0.3) : 0;
  const dc = pg ? pg.drawingContext : drawingContext;

  const doPush = () => (pg ? pg.push() : push());
  const doPop = () => (pg ? pg.pop() : pop());
  const doTranslate = (x, y) => (pg ? pg.translate(x, y) : translate(x, y));
  const doRotate = (a) => (pg ? pg.rotate(a) : rotate(a));
  const doScale = (s) => (pg ? pg.scale(s) : scale(s));
  const doImageMode = (m) => (pg ? pg.imageMode(m) : imageMode(m));
  const doTint = (...a) => (pg ? pg.tint(...a) : tint(...a));
  const doNoTint = () => (pg ? pg.noTint() : noTint());
  const doNoStroke = () => (pg ? pg.noStroke() : noStroke());
  const doFill = (...a) => (pg ? pg.fill(...a) : fill(...a));
  const doRectMode = (m) => (pg ? pg.rectMode(m) : rectMode(m));
  const doRect = (...a) => (pg ? pg.rect(...a) : rect(...a));
  const doTextFont = (f) => (pg ? pg.textFont(f) : textFont(f));
  const doTextAlign = (...a) => (pg ? pg.textAlign(...a) : textAlign(...a));
  const doTextSize = (s) => (pg ? pg.textSize(s) : textSize(s));
  const doTextStyle = (s) => (pg ? pg.textStyle(s) : textStyle(s));
  const doText = (...a) => (pg ? pg.text(...a) : text(...a));
  const doImage = (...a) => (pg ? pg.image(...a) : image(...a));

  doPush();
  doTranslate(label.x + shakeX, label.y + shakeY);
  doRotate(label.rot + sin(millis() * 0.002 + label.seed) * 0.01 + shakeRot);
  doScale(label.tearing ? 1.02 : highlighted ? 1.03 : 1);

  if (label.img) {
    doImageMode(CENTER);
    doTint(255, alpha * 255);
    doImage(label.img, 0, 0, label.w, label.h);
    doNoTint();
  } else {
    doNoStroke();
    doFill(230, 224, 208, alpha * 210);
    doRectMode(CENTER);
    doRect(0, 0, label.w, label.h, 6);
  }

  dc.save();
  dc.globalAlpha = alpha;
  dc.filter = "blur(0.2px)";
  doFill(28, 28, 32, 190 + hoverT * 45);
  doNoStroke();
  doTextFont(APP_SERIF);
  doTextAlign(CENTER, CENTER);
  doTextStyle(BOLD);
  const fitted = fitCollageLabelLines(label.text, label.w * 0.88, pg);
  doTextSize(fitted.size);
  const lineGap = fitted.size * 1.05;
  const startY = fitted.lines.length > 1 ? -(lineGap * 0.5) + 1 : 1;
  fitted.lines.forEach((line, i) => {
    doText(line, 0, startY + i * lineGap);
  });
  doTextStyle(NORMAL);
  dc.restore();
  doPop();
}

function drawDynamicLabels() {
  for (const label of dynamicLabels) drawLabelObject(label);
}

function drawCollageHandCursor(cursor) {
  if (!cursor) return;
  noFill();
  stroke(84, 84, 88, 60);
  strokeWeight(0.9);
  circle(cursor.x, cursor.y, 12);
  noStroke();
  fill(46, 46, 50, 165);
  circle(cursor.x, cursor.y, 3.6);
}

function drawCollageStudio(_finger, _dt) {
  syncCollageTitle();

  const { face, comp } = collageGetComposition();
  const activeComp = collageEnsureComp(comp);

  // Layer order: fog → Q1 base → Q4 hidden → abstract blocks → abstract lines → Q3 mask → Q2 labels
  updateIntroWebcam(face, activeComp);
  drawCollageBackLayers(activeComp);
  if (!dynamicLabels.length) buildDynamicLabels(activeComp, face);

  const suppressUi = pendingFragmentCapture;
  const cursor = suppressUi ? null : getCollageHandCursor();
  updateBoundLabels(activeComp, face);
  updateLabelRemoval(cursor);

  updateCollageAbstractFace(face, activeComp);
  drawQ3Structure(activeComp);
  drawDynamicLabels();
  if (!suppressUi) drawCollageHandCursor(cursor);
  if (!suppressUi) drawCollageAnswerDebug();
  if (!suppressUi) {
    const captureButton = {
      ...getCaptureFragmentsButtonDef(),
      disabled: !collageCaptureButtonEnabled(),
    };
    const refreshButton = {
      ...getRestartFragmentsButtonDef(),
      progress: collageRefreshHoldMs / 320,
    };
    if (!fragmentCaptureSnapshot) {
      drawIconButton(captureButton, { x: mouseX, y: mouseY });
      drawCaptureButtonHint(captureButton);
    }
    drawIconButton(refreshButton, { x: mouseX, y: mouseY });
    collageCaptureHoldMs = 0;
    collageCaptureLatched = false;
    collageCaptureFingerInside = false;

    const refreshInside = !!cursor && isPointerOnBubble(refreshButton, cursor.x, cursor.y);
    if (refreshInside) {
      collageRefreshHoldMs += deltaTime || 16;
      if (collageRefreshHoldMs >= 320 && !collageRefreshLatched) {
        resetExperience();
        collageRefreshLatched = true;
      }
    } else {
      collageRefreshHoldMs = 0;
      collageRefreshLatched = false;
    }
    collageRefreshFingerInside = refreshInside;
  }

  noTint();
  drawingContext.globalAlpha = 1;
}
