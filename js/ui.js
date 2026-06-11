/* ui.js — buttons, pointer, glow helpers */

function drawClickButton(b, pointer) {
  const hovered = pointer && dist(pointer.x, pointer.y, b.x, b.y) < b.r;

  push();
  translate(b.x, b.y);

  noFill();
  stroke(hovered ? 170 : 130, hovered ? 195 : 150, 255, hovered ? 220 : 140);
  strokeWeight(2);
  circle(0, 0, b.r * 2 + (hovered ? 6 : 0));

  noStroke();
  fill(hovered ? 32 : 22, hovered ? 34 : 24, hovered ? 52 : 42, hovered ? 240 : 215);
  circle(0, 0, b.r * 2);

  fill(245, 247, 255);
  textFont(state === "finalPortrait" || state === "resultFragments" ? APP_DOSIS : APP_SERIF);
  textAlign(CENTER, CENTER);
  textSize(b.text.length > 10 ? 11 : 13);
  text(b.text, 0, 0);
  pop();
}

function drawIconButton(b, pointer) {
  const disabled = b.disabled === true;
  const hovered = !disabled && pointer && dist(pointer.x, pointer.y, b.x, b.y) < (b.hitR || b.r);
  const icon = uiIcons[b.icon];
  const progress = constrain(b.progress || 0, 0, 1);

  push();
  translate(b.x, b.y);

  if (hovered) {
    noStroke();
    fill(255, 255, 255, 28);
    circle(0, 0, b.r * 2.15);
  }

  if (!disabled && progress > 0.001) {
    noFill();
    stroke(32, 36, 46, 44);
    strokeWeight(2.2);
    circle(0, 0, b.r * 2.15);
    stroke(44, 48, 58, disabled ? 90 : 188);
    strokeWeight(2.8);
    arc(0, 0, b.r * 2.15, b.r * 2.15, -HALF_PI, -HALF_PI + TWO_PI * progress);
  }

  if (icon && (icon.width || icon.canvas?.width)) {
    imageMode(CENTER);
    tint(28, 30, 36, disabled ? 120 : 255);
    const iconSize = b.r * (hovered ? 1.95 : 1.85);
    image(icon, 0, 0, iconSize, iconSize);
    noTint();
  }
  pop();
}

function showFragmentSaveNotice(message = "저장되었습니다") {
  fragmentSaveNoticeText = message;
  fragmentSaveNoticeUntil = millis() + 2800;
}

function saveFragmentsImageToLocal() {
  const now = typeof millis === "function" ? millis() : Date.now();
  if (now < fragmentSaveCooldownUntil) return false;
  fragmentSaveCooldownUntil = now + 900;

  if (!fragmentCaptureSnapshot && state === "collageStudio") {
    captureCollageComposite?.();
  }

  if (fragmentCaptureSnapshot?.canvas) {
    saveCanvas(fragmentCaptureSnapshot.canvas, "unmask-me-fragments", "png");
    showFragmentSaveNotice("다운로드 폴더에 저장되었습니다");
    return true;
  }

  if (fragmentCaptureSnapshot) {
    saveCanvas(fragmentCaptureSnapshot, "unmask-me-fragments", "png");
    showFragmentSaveNotice("다운로드 폴더에 저장되었습니다");
    return true;
  }

  saveCanvas("unmask-me-fragments", "png");
  showFragmentSaveNotice("다운로드 폴더에 저장되었습니다");
  return true;
}

function drawFragmentSaveNotice() {
  if (millis() >= fragmentSaveNoticeUntil) return;

  const remaining = fragmentSaveNoticeUntil - millis();
  const fadeIn = constrain((2800 - remaining) / 220, 0, 1);
  const fadeOut = constrain(remaining / 520, 0, 1);
  const alpha = fadeIn * fadeOut;

  push();
  drawingContext.save();
  textFont(APP_SERIF);
  textAlign(CENTER, CENTER);
  textSize(15);
  const msg = fragmentSaveNoticeText || "저장되었습니다";
  const padX = 28;
  const boxW = min(width - 48, textWidth(msg) + padX * 2);
  const boxH = 44;
  const boxX = width / 2 - boxW / 2;
  const boxY = height * 0.865;

  noStroke();
  fill(32, 34, 40, alpha * 228);
  rect(boxX, boxY, boxW, boxH, 12);
  fill(248, 248, 252, alpha * 255);
  text(msg, width / 2, boxY + boxH / 2);
  drawingContext.restore();
  pop();
}

function isPointerOnBubble(b, x, y) {
  return dist(x, y, b.x, b.y) < (b.hitR || b.r);
}

function handleUiClick(x, y) {
  if (state === "intro") return;

  if (state === "gestureQuestion" && !questionPagePhase && !pendingQuestionAdvance) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bubble = bubbles[i];
      if (bubble.dissolving || bubble.hidden) continue;
      if (isPointerOnBubble(bubble, x, y)) {
        selectQuestionOrb(bubble, QUESTIONS[questionIndex]);
        return;
      }
    }
  }

  if (state === "collageStudio") {
    if (pendingFragmentCapture) return;
    if (collageCaptureButtonEnabled?.() && isPointerOnBubble(getCaptureFragmentsButtonDef(), x, y)) {
      startFragmentCapture?.();
      return;
    }
    if (isPointerOnBubble(getRestartFragmentsButtonDef(), x, y)) {
      resetExperience();
      return;
    }
    tearCollageLabelAt?.(x, y);
    return;
  }

  if (state === "patchMask" && canShowFinish()) {
    if (isPointerOnBubble(getFinishBubbleDef(), x, y)) startPortraitCountdown();
    return;
  }

  if (state === "finalPortrait") {
    const saveBubble = { x: width * 0.32, y: height * 0.96, r: 58, text: "Save Portrait" };
    const restartBubble = { x: width * 0.68, y: height * 0.96, r: 50, text: "Restart" };
    if (isPointerOnBubble(saveBubble, x, y)) {
      save("unmask-me-real-me-portrait.png");
    } else if (isPointerOnBubble(restartBubble, x, y)) {
      resetExperience();
    }
  }

  if (state === "resultFragments") {
    if (isPointerOnBubble(getFragmentResultRetryButton(), x, y)) {
      resetExperience();
    }
  }
}

function mousePressed() {
  handleUiClick(mouseX, mouseY);
}

function touchEnded() {
  handleUiClick(mouseX, mouseY);
}

// ==============================
// Helpers
// ==============================
function drawCenterMessage(msg) {
  fill(240, 242, 255);
  textFont(APP_SERIF);
  textAlign(CENTER, CENTER);
  textSize(20);
  text(msg, width / 2, height / 2);
}

function drawFingerGlow(x, y, r) {
  noStroke();
  for (let i = 3; i > 0; i--) {
    fill(120, 180, 255, 30 * i);
    circle(x, y, r * i * 1.4);
  }
  fill(255, 255, 255, 200);
  circle(x, y, 8);
}
