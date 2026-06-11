/* stages.js — generating, patch mask, final portrait */

function drawGeneratingLabels() {
  fill(5, 5, 10, 220);
  rect(0, 0, width, height);

  const lines = [
    "Generating your five labels...",
    "Mapping choices to face regions...",
    "Building collage mask...",
  ];
  const elapsed = millis() - generatingStart;
  generatingLine = min(lines.length - 1, floor(elapsed / 850));

  textAlign(CENTER, CENTER);
  for (let i = 0; i <= generatingLine; i++) {
    fill(200, 210, 255);
    textSize(22);
    text(lines[i], width / 2, height * 0.42 + i * 34);
  }

  if (elapsed > 2800) {
    state = "patchMask";
    patchMaskStart = millis();
    buildFacePatches(coreLabels);
  }
}

// ==============================
// Patch mask stage
// ==============================
function drawPatchMaskStage(_finger, dt) {
  const face = faces[0];
  const liveBox = smoothFaceBox(face ? getFaceBox(face) : null);

  if (!liveBox || millis() - lastFaceAt > 900) {
    drawCenterMessage("Move your face into the frame.");
    return;
  }

  const faceBox = portraitCountdownActive && portraitFaceBox ? portraitFaceBox : liveBox;

  drawUserChoicesSummary();

  if (portraitCountdownActive) {
    drawAllPatchesShapeOnly(faceBox);
    drawAllPatchTextsOnTop(faceBox);
    updatePortraitCountdown();
    return;
  }

  drawPatchStageHints();

  const finger = getInteractionFinger();
  if (finger) {
    drawFingerGlow(finger.x, finger.y, 30);
    updatePatchTear(finger);
  } else {
    decayPatchHover(6);
  }

  drawAllPatchesShapeOnly(faceBox);
  drawAllPatchTextsOnTop(faceBox);

  drawFinishBubble();
}

function drawPatchStageHints() {
  textAlign(CENTER, CENTER);
  fill(200, 205, 235, 215);
  textSize(15);
  text("Point at one fragment and hold to refuse it.", width / 2, height * 0.055);
  textSize(13);
  fill(150, 158, 195, 190);
  text("Keep what still feels like you.", width / 2, height * 0.085);
}

function drawUserChoicesSummary() {
  const line = getUserChoicesLine();
  if (!line) return;
  push();
  textAlign(LEFT, BOTTOM);
  textSize(12);
  fill(175, 182, 220, 220);
  text(`Your choices: ${line}`, 16, height - 18);
  pop();
}

function updatePatchTear(finger) {
  const faceBox = faceBoxSmoothed;
  if (!faceBox) return;

  const target = findPatchUnderFinger(finger, faceBox);

  for (const patch of facePatches) {
    if (patch.removed || patch.tearing) continue;
    patch.fingerHeld = false;
    if (patch !== target) {
      patch.hoverTime = max(0, patch.hoverTime - 4);
    }
  }

  if (!target) return;

  target.fingerHeld = true;
  target.hoverTime += 2;

  if (target.hoverTime >= PATCH_TEAR_FRAMES) {
    startTearPatch(target, patchScreenVerts(target, faceBox));
  }
}

function startTearPatch(patch, screenVerts) {
  if (patch.tearing || patch.removed) return;
  patch.tearing = true;
  patch.tearStart = millis();

  if (!patch.tearCounted) {
    patch.tearCounted = true;
    removedLabels.push(patch.label);
  }

  const faceBox = faceBoxSmoothed;
  const textPos = faceBox ? getPatchTextPosition(patch, faceBox) : patchCentroid(screenVerts);
  if (typeof ThreeParticles !== "undefined") {
    const col = patch.color.fill;
    ThreeParticles.spawnTearParticles(textPos.x, textPos.y, 7, {
      r: col[0] / 255,
      g: col[1] / 255,
      b: col[2] / 255,
    });
  }
}

function canShowFinish() {
  const tornCount = facePatches.filter((p) => p.removed || p.tearing).length;
  return tornCount >= 1 || millis() - patchMaskStart > CONTINUE_DELAY_MS;
}

function getFinishBubbleDef() {
  return { x: width / 2, y: height * 0.92, r: 54, text: "Finish" };
}

function drawFinishBubble() {
  if (!canShowFinish()) {
    finishFingerWasInside = false;
    return;
  }

  const b = getFinishBubbleDef();
  const finger = getIndexFingerTip();
  const pointer = finger ? { x: finger.x, y: finger.y } : { x: mouseX, y: mouseY };
  drawClickButton(b, pointer);

  const inside = finger && isPointerOnBubble(b, finger.x, finger.y);
  if (inside && !finishFingerWasInside) {
    startPortraitCountdown();
  }
  finishFingerWasInside = inside;
}

function startPortraitCountdown() {
  if (portraitCountdownActive) return;

  keptLabels = facePatches.filter((p) => !p.removed).map((p) => p.label);

  const face = faces[0];
  const box = smoothFaceBox(face ? getFaceBox(face) : null) || faceBoxSmoothed;
  if (box) {
    portraitFaceBox = {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      cx: box.cx,
      cy: box.cy,
    };
  }

  portraitCountdownActive = true;
  portraitCountdownStart = millis();
  finishFingerWasInside = false;
}

function updatePortraitCountdown() {
  const elapsed = millis() - portraitCountdownStart;
  const remaining = max(1, ceil((PORTRAIT_COUNTDOWN_MS - elapsed) / 1000));

  fill(0, 0, 0, 100);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  fill(210, 215, 240, 220);
  textSize(18);
  text("Capturing your portrait...", width / 2, height * 0.36);

  fill(255, 255, 255, 245);
  textSize(96);
  text(remaining, width / 2, height * 0.52);

  textSize(13);
  fill(150, 158, 195, 200);
  text("Hold still", width / 2, height * 0.64);

  if (elapsed >= PORTRAIT_COUNTDOWN_MS) {
    portraitCountdownActive = false;
    enterFinalPortrait();
  }
}

function capturePortraitSnapshot() {
  if (!capture || !videoReady) return;
  portraitSnapshot = createGraphics(width, height);
  portraitSnapshot.push();
  portraitSnapshot.translate(width, 0);
  portraitSnapshot.scale(-1, 1);
  portraitSnapshot.image(capture, 0, 0, width, height);
  portraitSnapshot.pop();
}

function enterFinalPortrait() {
  if (!keptLabels.length) {
    keptLabels = facePatches.filter((p) => !p.removed).map((p) => p.label);
  }

  capturePortraitSnapshot();
  portraitDarken = 0;
  finalPortraitStart = millis();
  state = "finalPortrait";

  if (typeof ThreeParticles !== "undefined" && portraitFaceBox) {
    ThreeParticles.spawnPortraitGlow(portraitFaceBox);
  }
}

function drawPortraitSnapshot() {
  if (portraitSnapshot) {
    image(portraitSnapshot, 0, 0, width, height);
    return;
  }
  drawWebcamBackground();
}

function drawPortraitVignette() {
  const t = portraitDarken;
  noStroke();
  fill(4, 4, 14, 175 * t);
  rect(0, 0, width, height);
  fill(4, 4, 14, 120 * t);
  rect(0, 0, width, height * 0.14);
  rect(0, height * 0.86, width, height * 0.14);
  rect(0, 0, width * 0.1, height);
  rect(width * 0.9, 0, width * 0.1, height);

  if (portraitFaceBox) {
    const f = portraitFaceBox;
    fill(255, 252, 248, 6 * t);
    ellipse(f.cx, f.cy, f.w * 1.05, f.h * 1.08);
  }
}

function drawRefusedFragments() {
  if (!removedLabels.length) return;

  textAlign(CENTER, CENTER);
  textSize(11);
  removedLabels.forEach((label, i) => {
    const edge = i % 4;
    let x = width * 0.5;
    let y = height * 0.5;
    const drift = sin(millis() * 0.0008 + i * 1.7) * 6;

    if (edge === 0) {
      x = width * 0.08 + (i % 3) * 28;
      y = height * (0.18 + (i % 4) * 0.12) + drift;
    } else if (edge === 1) {
      x = width * 0.92 - (i % 3) * 28;
      y = height * (0.22 + (i % 4) * 0.11) + drift;
    } else if (edge === 2) {
      x = width * (0.2 + (i % 5) * 0.12);
      y = height * 0.94 + drift;
    } else {
      x = width * (0.55 + (i % 4) * 0.1);
      y = height * 0.06 + drift;
    }

    push();
    rotate(sin(millis() * 0.0005 + i) * 0.06);
    fill(170, 178, 210, 42);
    text(label, x, y);
    pop();
  });
}

function drawPortraitKeptPatches() {
  if (!portraitFaceBox) return;
  const kept = facePatches.filter((p) => !p.removed);
  for (const patch of patchesSortedByLayer(kept)) {
    const style = getPatchVisualStyle(patch, { portraitSoft: true });
    drawPatchShapeOnly(patch, portraitFaceBox, style);
  }
  drawAllPatchTextsOnTop(portraitFaceBox, {
    portraitSoft: true,
    textAlphaMul: 0.92,
  });
}

function drawPortraitTitle() {
  textFont(APP_DOSIS);
  textAlign(LEFT, TOP);
  fill(220, 225, 245, 220);
  textSize(13);
  text("Unmask Me", 20, 20);
  textSize(11);
  fill(150, 158, 195, 180);
  text("Beyond Fast Definitions", 20, 38);
}

function drawPortraitMainText() {
  const removed = removedLabels.length;
  const kept = keptLabels.length;

  textFont(APP_DOSIS);
  textAlign(CENTER, CENTER);
  fill(245, 248, 255, 240);
  textSize(26);
  text("Real Me is what remains — for now.", width / 2, height * 0.88);

  textSize(14);
  fill(175, 182, 215, 200);
  if (removed === 0) {
    text("I choose to hold these fragments — for now.", width / 2, height * 0.93);
  } else if (kept === 0) {
    text("No label fully defines me.", width / 2, height * 0.93);
  }
}

function drawFinalPortrait(finger) {
  portraitDarken = min(1, portraitDarken + 0.012);

  drawPortraitSnapshot();
  drawPortraitVignette();
  drawPortraitKeptPatches();
  drawRefusedFragments();
  drawPortraitTitle();
  drawPortraitMainText();

  const saveBubble = { x: width * 0.32, y: height * 0.96, r: 58, text: "Save Portrait" };
  const restartBubble = { x: width * 0.68, y: height * 0.96, r: 50, text: "Restart" };
  const pointer = { x: mouseX, y: mouseY };

  drawClickButton(saveBubble, pointer);
  drawClickButton(restartBubble, pointer);

  textFont(APP_DOSIS);
  textAlign(CENTER, TOP);
  textSize(11);
  fill(130, 135, 170);
  text("Click to save or restart", width / 2, height * 0.99);
}

function getFragmentResultRetryButton() {
  return { x: width * 0.5, y: height * 0.9, r: 38, hitR: 50, icon: "refresh" };
}

function drawFragmentResultPage() {
  background(245, 245, 247);

  const snap = fragmentCaptureSnapshot;
  const snapW = snap?.width || snap?.canvas?.width || width;
  const snapH = snap?.height || snap?.canvas?.height || height;
  const frameW = width * 0.52;
  const frameH = height * 0.68;
  const scale = snap ? min(frameW / snapW, frameH / snapH) : 1;
  const drawW = snap ? snapW * scale : frameW;
  const drawH = snap ? snapH * scale : frameH;
  const drawX = width / 2 - drawW / 2;
  const drawY = height / 2 - drawH / 2 - height * 0.04;

  noStroke();
  fill(255, 255, 255, 210);
  rect(drawX - 16, drawY - 16, drawW + 32, drawH + 32, 18);
  fill(220, 224, 232, 70);
  rect(drawX - 8, drawY - 8, drawW + 16, drawH + 16, 14);

  if (snap) {
    imageMode(CORNER);
    image(snap, drawX, drawY, drawW, drawH);
  }

  drawFragmentSaveNotice?.();

  const retryButton = getFragmentResultRetryButton();
  const finger = getIndexFingerTip?.();

  if (finger) {
    const retryInside = isPointerOnBubble(retryButton, finger.x, finger.y);
    if (retryInside) {
      resultRefreshHoldMs += deltaTime || 16;
      if (resultRefreshHoldMs >= 320 && !resultRefreshLatched) {
        resetExperience();
        resultRefreshLatched = true;
      }
    } else {
      resultRefreshHoldMs = 0;
      resultRefreshLatched = false;
    }
  } else {
    resultRefreshHoldMs = 0;
    resultRefreshLatched = false;
  }

  resultSaveHoldMs = 0;
  resultSaveLatched = false;

  drawIconButton(
    { ...retryButton, progress: resultRefreshHoldMs / 320 },
    { x: mouseX, y: mouseY }
  );
}
