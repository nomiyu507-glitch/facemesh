/* patches.js — label patches build & render */

// ==============================
// Labels from user choices
// ==============================
function generateCoreLabels(answers) {
  const pool = [];
  for (const q of QUESTIONS) {
    const ans = resolveAnswerKey(q.id, answers[q.id]);
    const mapped = CHOICE_LABEL_MAP[ans];
    if (mapped) {
      for (const label of mapped) {
        if (!pool.includes(label)) pool.push(label);
      }
    } else if (ans && !pool.includes(ans)) {
      pool.push(ans);
    }
  }

  if (pool.length === 0) {
    return ["기대 이상", "아직 부족", "규칙 준수", "작업 모드", "더 노력"];
  }

  while (pool.length < 5) {
    pool.push(pool[pool.length % max(1, pool.length - 1)] || pool[0]);
  }
  return pool.slice(0, 5);
}

function getUserChoicesLine() {
  return QUESTIONS.map((q) => userAnswers[q.id])
    .filter(Boolean)
    .join(" / ");
}

function buildIrregularVertsFromRegion(rx, ry, rw, rh, seed) {
  const jitter = 0.014;
  const corners = [
    [rx, ry],
    [rx + rw, ry],
    [rx + rw, ry + rh],
    [rx, ry + rh],
  ];
  const out = [];

  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    out.push([
      a[0] + sin(seed + i * 2.1) * jitter,
      a[1] + cos(seed + i * 3.3) * jitter,
    ]);
    const midCount = i % 2 === 0 ? 2 : 1;
    for (let m = 1; m <= midCount; m++) {
      const t = m / (midCount + 1);
      const mx = lerp(a[0], b[0], t);
      const my = lerp(a[1], b[1], t);
      out.push([
        mx + sin(seed + i * 5 + m) * jitter * 0.7,
        my + cos(seed + i * 7 + m) * jitter * 0.7,
      ]);
    }
  }

  return out.slice(0, 14);
}

function buildFacePatches(labels) {
  facePatches = PATCH_LAYOUTS.map((layout, i) => ({
    id: layout.id,
    label: labels[i] || labels[0],
    rx: layout.rx,
    ry: layout.ry,
    rw: layout.rw,
    rh: layout.rh,
    textAnchorX: layout.textAnchorX,
    textAnchorY: layout.textAnchorY,
    drawLayer: layout.drawLayer,
    fillAlphaMul: layout.fillAlphaMul || 1,
    verts: buildIrregularVertsFromRegion(
      layout.rx,
      layout.ry,
      layout.rw,
      layout.rh,
      i * 17.3 + 1.7
    ),
    color: PATCH_COLORS[i % PATCH_COLORS.length],
    textureSeed: i * 91.7 + 3.2,
    hoverTime: 0,
    fingerHeld: false,
    removed: false,
    tearing: false,
    tearStart: 0,
    tearCounted: false,
  }));
}

function getPatchScreenRect(patch, faceBox) {
  return {
    x: faceBox.x + patch.rx * faceBox.w,
    y: faceBox.y + patch.ry * faceBox.h,
    w: patch.rw * faceBox.w,
    h: patch.rh * faceBox.h,
  };
}

function getPatchTextPosition(patch, faceBox) {
  const r = getPatchScreenRect(patch, faceBox);
  return {
    x: r.x + r.w * patch.textAnchorX,
    y: r.y + r.h * patch.textAnchorY,
    maxW: r.w * 0.8,
    rect: r,
  };
}

function patchesSortedByLayer(patches) {
  return [...patches].sort((a, b) => a.drawLayer - b.drawLayer);
}

function patchScreenVerts(patch, faceBox) {
  return patch.verts.map(([rx, ry]) => ({
    x: faceBox.x + rx * faceBox.w,
    y: faceBox.y + ry * faceBox.h,
  }));
}

function patchBounds(verts) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const v of verts) {
    minX = min(minX, v.x);
    maxX = max(maxX, v.x);
    minY = min(minY, v.y);
    maxY = max(maxY, v.y);
  }
  return { minX, maxX, minY, maxY };
}

function wrapLabelText(label) {
  const maxLen = /[\u3131-\uD79D]/.test(label) ? 8 : 14;
  if (label.length <= maxLen) return [label];

  const words = label.split(" ");
  if (words.length >= 2) {
    for (let i = 1; i < words.length; i++) {
      const line1 = words.slice(0, i).join(" ");
      const line2 = words.slice(i).join(" ");
      if (line1.length <= 14 || line2.length <= 14) {
        return [line1, line2];
      }
    }
    const mid = ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }

  const mid = floor(label.length / 2);
  return [label.slice(0, mid).trim(), label.slice(mid).trim()];
}

function pickPatchFontSize(label, maxW) {
  const len = label.length;
  const isKo = /[\u3131-\uD79D]/.test(label);
  let size = isKo
    ? len <= 5
      ? 19
      : len <= 8
        ? 16
        : len <= 12
          ? 14
          : 12
    : len <= 10
      ? 21
      : len <= 14
        ? 17
        : len <= 22
          ? 15
          : 13;
  const lines = wrapLabelText(label);

  while (size >= 11) {
    textSize(size);
    const fits = lines.every((ln) => textWidth(ln) <= maxW);
    if (fits) break;
    size--;
  }

  return { lines, fontSize: size, lineHeight: size <= 15 ? 18 : 20 };
}

function fitPatchLabelForPatch(patch, faceBox) {
  const pos = getPatchTextPosition(patch, faceBox);
  return { ...pickPatchFontSize(patch.label, pos.maxW), ...pos };
}

function patchRand(seed, i, j = 0) {
  const x = sin(seed * 12.9898 + i * 78.233 + j * 37.719) * 43758.5453;
  return x - floor(x);
}

function drawPatchPaperTexture(screenVerts, patch, alphaMul) {
  const b = patchBounds(screenVerts);
  const c = patch.color.fill;
  const seed = patch.textureSeed;

  for (let i = 0; i < 42; i++) {
    const px = lerp(b.minX, b.maxX, patchRand(seed, i, 0));
    const py = lerp(b.minY, b.maxY, patchRand(seed, i, 1));
    if (!pointInPolygon(px, py, screenVerts)) continue;
    if (patchRand(seed, i, 2) < 0.55) {
      stroke(c[0] + 18, c[1] + 18, c[2] + 18, 18 * alphaMul);
      strokeWeight(0.4 + patchRand(seed, i, 3) * 0.8);
      point(px, py);
    } else {
      stroke(255, 255, 255, 12 * alphaMul);
      strokeWeight(0.6);
      const len = 2 + patchRand(seed, i, 4) * 5;
      const ang = patchRand(seed, i, 5) * TWO_PI;
      line(px, py, px + cos(ang) * len, py + sin(ang) * len);
    }
  }
}

function drawPatchShape(screenVerts, fillRgb, fillAlpha, strokeAlpha, strokeW) {
  noStroke();
  fill(0, 0, 0, fillAlpha * 0.22);
  beginShape();
  for (const v of screenVerts) vertex(v.x + 5, v.y + 6);
  endShape(CLOSE);

  fill(fillRgb[0], fillRgb[1], fillRgb[2], fillAlpha);
  stroke(255, 255, 255, strokeAlpha);
  strokeWeight(strokeW);
  beginShape();
  for (const v of screenVerts) vertex(v.x, v.y);
  endShape(CLOSE);
}

function drawPatchTextBackdrop(lines, fontSize, lineHeight, cx, cy, maxW, alphaMul) {
  textSize(fontSize);
  let maxLineW = 0;
  for (const ln of lines) maxLineW = max(maxLineW, textWidth(ln));

  const padX = 10;
  const padY = 8;
  const boxW = min(maxW, maxLineW + padX * 2);
  const boxH = lines.length * lineHeight + padY;

  noStroke();
  fill(8, 10, 18, 100 * alphaMul);
  rectMode(CENTER);
  rect(cx, cy, boxW, boxH, 8);
  rectMode(CORNER);
}

function drawSinglePatchText(patch, faceBox, alphaMul = 1, opts = {}) {
  const info = fitPatchLabelForPatch(patch, faceBox);
  const { lines, fontSize, lineHeight, x, y } = info;
  const totalH = (lines.length - 1) * lineHeight;
  const startY = y - totalH / 2;
  const textA = 255 * alphaMul * (opts.textAlphaMul || 1);

  textFont(APP_SERIF);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  if (!opts.skipBackdrop) {
    drawPatchTextBackdrop(lines, fontSize, lineHeight, x, y, info.maxW, alphaMul * 0.85);
  }

  fill(255, 255, 255, textA);
  for (let i = 0; i < lines.length; i++) {
    textSize(fontSize);
    text(lines[i], x, startY + i * lineHeight);
  }
  textStyle(NORMAL);
}

function getPatchVisualStyle(patch, opts = {}) {
  if (opts.portraitSoft === true) {
    const glow = 0.5 + sin(millis() * 0.0012 + patch.textureSeed) * 0.5;
    return {
      ready: false,
      tearProgress: 0,
      keptStyle: true,
      fillAlpha: 78 + glow * 28,
      strokeAlpha: 95 + glow * 35,
      strokeW: 1.2,
      scaleFactor: 1,
      shakeX: 0,
      shakeY: 0,
      textAlpha: 0.88,
    };
  }

  const finalKept = opts.finalKept === true;
  const warming = !finalKept && patch.fingerHeld && patch.hoverTime > 0;
  const ready = warming && patch.hoverTime >= PATCH_READY_FRAMES;
  const tearProgress = constrain(patch.hoverTime / PATCH_TEAR_FRAMES, 0, 1);
  const keptStyle = finalKept || !patch.fingerHeld;

  let fillAlpha = PATCH_BASE_ALPHA * patch.fillAlphaMul;
  if (keptStyle) {
    fillAlpha =
      map(
        sin(millis() * 0.0018 + patch.textureSeed),
        -1,
        1,
        PATCH_KEPT_ALPHA_MIN,
        PATCH_KEPT_ALPHA_MAX
      ) * patch.fillAlphaMul;
  } else if (warming) {
    fillAlpha = (PATCH_BASE_ALPHA + tearProgress * 20) * patch.fillAlphaMul;
  }

  let scaleFactor = 1;
  let shakeX = 0;
  let shakeY = 0;
  if (ready) {
    scaleFactor = map(patch.hoverTime, PATCH_READY_FRAMES, PATCH_TEAR_FRAMES, 1, 1.05, true);
    shakeX = sin(millis() * 0.075) * 2.8;
    shakeY = cos(millis() * 0.065) * 2.2;
  }

  const strokeW = ready ? lerp(2, 3.5, tearProgress) : 2;
  const strokeAlpha = ready
    ? 180 + tearProgress * 50
    : keptStyle
      ? 180 + sin(millis() * 0.002 + patch.textureSeed) * 40
      : 195;

  return {
    ready,
    warming,
    tearProgress,
    keptStyle,
    fillAlpha: constrain(fillAlpha, 145, 185),
    strokeAlpha: constrain(strokeAlpha, 180, 230),
    strokeW,
    scaleFactor,
    shakeX,
    shakeY,
    textAlpha: 1,
  };
}

function drawPatchShapeOnly(patch, faceBox, style) {
  const screenVerts = patchScreenVerts(patch, faceBox);
  const center = patchCentroid(screenVerts);
  const c = patch.color;

  push();
  translate(center.x + style.shakeX, center.y + style.shakeY);
  scale(style.scaleFactor);
  translate(-center.x, -center.y);

  drawPatchShape(screenVerts, c.fill, style.fillAlpha, style.strokeAlpha, style.strokeW);
  drawPatchPaperTexture(screenVerts, patch, 1);

  if (style.ready) {
    noFill();
    stroke(255, 255, 255, 90 + sin(millis() * 0.1) * 50);
    strokeWeight(2);
    beginShape();
    for (const v of screenVerts) vertex(v.x, v.y);
    endShape(CLOSE);

    noFill();
    stroke(255, 255, 255, 210);
    strokeWeight(2.5);
    arc(center.x, center.y, 44, 44, -HALF_PI, -HALF_PI + TWO_PI * style.tearProgress);
  } else if (style.warming) {
    noFill();
    stroke(180, 210, 255, 120 + style.tearProgress * 80);
    strokeWeight(2);
    beginShape();
    for (const v of screenVerts) vertex(v.x, v.y);
    endShape(CLOSE);
  } else if (style.keptStyle) {
    noFill();
    stroke(255, 255, 255, 50 + sin(millis() * 0.002 + patch.textureSeed) * 25);
    strokeWeight(1.5);
    beginShape();
    for (const v of screenVerts) vertex(v.x, v.y);
    endShape(CLOSE);
  }
  pop();

  return { screenVerts, center };
}

function drawPatchTearing(patch, faceBox) {
  const screenVerts = patchScreenVerts(patch, faceBox);
  const center = patchCentroid(screenVerts);
  const c = patch.color;
  const t = constrain((millis() - patch.tearStart) / PATCH_TEAR_ANIM_MS, 0, 1);

  if (t >= 1) {
    patch.removed = true;
    patch.tearing = false;
    return false;
  }

  push();
  translate(center.x, center.y);
  rotate(sin(millis() * 0.06) * 0.14 * (1 - t));
  scale(1.05 + t * 0.22);
  translate(-center.x, -center.y);
  drawPatchShape(screenVerts, c.fill, 170 * (1 - t), 200 * (1 - t * 0.5), 3);
  drawPatchPaperTexture(screenVerts, patch, 1 - t * 0.6);
  pop();

  drawSinglePatchText(patch, faceBox, 1 - t);
  return true;
}

function drawAllPatchesShapeOnly(faceBox, opts = {}) {
  const visible = facePatches.filter((p) => !p.removed || p.tearing);
  for (const patch of patchesSortedByLayer(visible)) {
    if (patch.tearing) {
      if (!drawPatchTearing(patch, faceBox)) continue;
      continue;
    }
    const style = getPatchVisualStyle(patch, opts);
    drawPatchShapeOnly(patch, faceBox, style);
  }
}

function drawAllPatchTextsOnTop(faceBox, opts = {}) {
  const visible = facePatches.filter((p) => !p.removed && !p.tearing);
  const textMul = opts.textAlphaMul || 1;
  for (const patch of patchesSortedByLayer(visible)) {
    drawSinglePatchText(patch, faceBox, textMul, {
      textAlphaMul: opts.portraitSoft ? 0.9 : 1,
      skipBackdrop: opts.portraitSoft === true,
    });
  }
}

function patchCentroid(screenVerts) {
  let sx = 0;
  let sy = 0;
  for (const v of screenVerts) {
    sx += v.x;
    sy += v.y;
  }
  return { x: sx / screenVerts.length, y: sy / screenVerts.length };
}

function pointInPolygon(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x;
    const yi = verts[i].y;
    const xj = verts[j].x;
    const yj = verts[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function patchHitTest(patch, faceBox, fx, fy) {
  const screenVerts = patchScreenVerts(patch, faceBox);
  if (pointInPolygon(fx, fy, screenVerts)) return true;

  const r = getPatchScreenRect(patch, faceBox);
  const pad = patch.id === "centerNosePatch" ? PATCH_HIT_PAD_CENTER : PATCH_HIT_PAD;
  if (fx >= r.x - pad && fx <= r.x + r.w + pad && fy >= r.y - pad && fy <= r.y + r.h + pad) {
    return true;
  }

  const anchor = getPatchTextPosition(patch, faceBox);
  const hitR = patch.id === "centerNosePatch" ? FINGER_HIT_RADIUS_CENTER : FINGER_HIT_RADIUS;
  return dist(fx, fy, anchor.x, anchor.y) < hitR;
}

function findPatchUnderFinger(finger, faceBox) {
  const points = [finger];
  const visual = getIndexFingerVisual();
  if (visual) points.push(visual);

  let best = null;
  let bestDist = Infinity;

  for (const pt of points) {
    for (const patch of facePatches) {
      if (patch.removed || patch.tearing) continue;
      if (!patchHitTest(patch, faceBox, pt.x, pt.y)) continue;

      const anchor = getPatchTextPosition(patch, faceBox);
      const d = dist(pt.x, pt.y, anchor.x, anchor.y);
      if (d < bestDist) {
        bestDist = d;
        best = patch;
      }
    }
  }

  return best;
}
