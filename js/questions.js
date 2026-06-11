/* questions.js — gesture question orbs */

function syncQuestionTitle(q) {
  if (!q?.question) return;

  const el = document.getElementById("question-title");
  const p = el?.querySelector("p");
  if (!el || !p) return;

  p.textContent = q.question;
  el.classList.add("is-visible");
  el.setAttribute("aria-hidden", "false");
  document.getElementById("intro-title")?.classList.remove("is-visible");
}

function hideQuestionTitle() {
  const el = document.getElementById("question-title");
  el?.classList.remove("is-visible");
  if (el) {
    el.setAttribute("aria-hidden", "true");
    el.style.opacity = "";
  }
  const p = el?.querySelector("p");
  if (p) {
    p.textContent = "";
    p.style.transform = "";
  }
}

function questionPageEase(t) {
  return t * t * (3 - 2 * t);
}

function getQuestionPageEnterMul(now) {
  if (questionPagePhase !== "enter") return 1;
  const t = constrain((now - questionPagePhaseStart) / QUESTION_PAGE_ENTER_MS, 0, 1);
  return questionPageEase(t);
}

function beginQuestionPageExit(now) {
  pendingQuestionAdvance = false;
  orbDissolveParticles = [];
  questionHighlightIndex = -1;
  questionTransitionUntil = 0;
  bubbles = [];
  questionPagePhase = "exit";
  questionPagePhaseStart = now;
}

function finishQuestionPageExit(now) {
  questionIndex++;

  if (questionIndex >= QUESTIONS.length) {
    questionPagePhase = null;
    setPoeticSceneVisible(true, { showTitle: false, showQuestion: true, collageStudio: true });
    state = "collageStudio";
    initCollageStudio?.();
    syncCollageTitle?.();
    return;
  }

  setupQuestionOrbs(QUESTIONS[questionIndex]);
  questionPagePhase = "enter";
  questionPagePhaseStart = now;

  const el = document.getElementById("question-title");
  const p = el?.querySelector("p");
  if (el) {
    el.classList.add("is-visible");
    el.style.opacity = "0";
  }
  if (p) p.style.transform = "translateY(14px)";
}

function updateQuestionPageTransition(now) {
  const el = document.getElementById("question-title");
  const p = el?.querySelector("p");
  if (!questionPagePhase || !el) return;

  if (questionPagePhase === "exit") {
    const t = constrain((now - questionPagePhaseStart) / QUESTION_PAGE_EXIT_MS, 0, 1);
    const ease = questionPageEase(t);
    el.style.opacity = String(1 - ease);
    if (p) p.style.transform = `translateY(${-12 * ease}px)`;
    if (t >= 1) finishQuestionPageExit(now);
  } else if (questionPagePhase === "enter") {
    const t = constrain((now - questionPagePhaseStart) / QUESTION_PAGE_ENTER_MS, 0, 1);
    const ease = questionPageEase(t);
    el.style.opacity = String(ease);
    if (p) p.style.transform = `translateY(${lerp(14, 0, ease)}px)`;
    if (t >= 1) {
      questionPagePhase = null;
      el.style.opacity = "";
      if (p) p.style.transform = "";
    }
  }
}

function drawQuestionPageVeil(now) {
  if (!questionPagePhase) return;

  let alpha = 0;
  if (questionPagePhase === "exit") {
    const t = constrain((now - questionPagePhaseStart) / QUESTION_PAGE_EXIT_MS, 0, 1);
    alpha = questionPageEase(t) * 42;
  } else if (questionPagePhase === "enter") {
    const t = constrain((now - questionPagePhaseStart) / QUESTION_PAGE_ENTER_MS, 0, 1);
    alpha = (1 - questionPageEase(t)) * 36;
  }

  if (alpha > 0.5) {
    noStroke();
    fill(248, 248, 250, alpha);
    rect(0, 0, width, height);
  }
}

function updateQuestionSceneLayers(now) {
  const liveFace = faces[0];
  const renderFace = liveFace || lastIntroFaceSnapshot;
  const faceBox = renderFace ? getFaceBox(renderFace) : null;
  let comp = faceBox ? smoothIntroComposition(getIntroComposition(faceBox)) : null;
  if (!comp && introCompSmoothed) comp = introCompSmoothed;

  if (introFaceCtx && introFaceCanvas) {
    introFaceCtx.clearRect(0, 0, introFaceCanvas.width, introFaceCanvas.height);
  }

  updateIntroMesh(renderFace, comp);
}

function getQuestionFaceCenter() {
  const renderFace = faces[0] || lastIntroFaceSnapshot;
  const faceBox = renderFace ? getFaceBox(renderFace) : null;
  const comp = faceBox ? introCompSmoothed || getIntroComposition(faceBox) : null;
  if (comp) return { x: comp.targetCx, y: comp.targetCy };
  return { x: width / 2, y: height * 0.48 };
}

function questionOrbToneForOption(opt, index = 0) {
  const qid = QUESTIONS[questionIndex]?.id;
  const palettes = {
    identity: [
      [206, 188, 182],
      [182, 192, 202],
      [138, 134, 152],
      [198, 176, 172],
      [196, 202, 188],
    ],
    perception: [
      [202, 204, 210],
      [188, 199, 194],
      [214, 192, 174],
      [212, 198, 190],
      [178, 168, 182],
    ],
    mask: [
      [226, 220, 214],
      [232, 228, 220],
      [210, 193, 175],
      [185, 198, 210],
      [222, 228, 220],
    ],
    unseen: [
      [182, 176, 196],
      [205, 183, 168],
      [206, 206, 198],
      [188, 182, 194],
      [214, 196, 182],
    ],
  };
  const arr = palettes[qid] || palettes.identity;
  const opts = QUESTIONS[questionIndex]?.options || [];
  const idx = opts.findIndex((item) => (item.key || item) === (opt.key || opt));
  const tone = arr[(idx >= 0 ? idx : index) % arr.length];
  return particleTone(tone[0], tone[1], tone[2], 0.9);
}

function spawnQuestionBubbleParticles(orb) {
  const count = floor(random(20, 41));
  const tone = orb.tint || particleTone(196, 198, 202, 0.88);
  for (let i = 0; i < count; i++) {
    bubbleParticles.push(new BubbleParticle(orb.x, orb.y, tone));
  }
}

function getQuestionHandCursor() {
  const tip = getIndexFingerTip();
  if (!tip) {
    questionHandCursor = null;
    return null;
  }
  if (!questionHandCursor) {
    questionHandCursor = { x: tip.x, y: tip.y };
  } else {
    questionHandCursor.x = lerp(questionHandCursor.x, tip.x, QUESTION_HAND_LERP);
    questionHandCursor.y = lerp(questionHandCursor.y, tip.y, QUESTION_HAND_LERP);
  }
  return questionHandCursor;
}

function drawQuestionHandCursor(cursor, now) {
  if (!cursor) return;

  const pulse = 0.88 + sin(now * 0.0038) * 0.07;
  const ring = 13 + sin(now * 0.005) * 0.6;

  noFill();
  stroke(88, 88, 92, 72 * pulse);
  strokeWeight(1.1);
  circle(cursor.x, cursor.y, ring);

  noStroke();
  fill(52, 52, 56, 185 * pulse);
  circle(cursor.x, cursor.y, 4.2);

  fill(72, 72, 76, 48 * pulse);
  circle(cursor.x, cursor.y, 7.5);
}

function drawGestureQuestion(_finger) {
  const now = millis();
  updateQuestionSceneLayers(now);
  const q = QUESTIONS[questionIndex];
  updateQuestionPageTransition(now);
  if (state === "collageStudio") return;

  if (!questionPagePhase) syncQuestionTitle(q);

  const hand = questionPagePhase ? null : getQuestionHandCursor();
  updateQuestionOrbs(hand, q, now);
  drawQuestionOrbs(hand, now);
  drawOrbDissolveParticles(now);
  drawQuestionPageVeil(now);
  if (!questionPagePhase) drawQuestionHandCursor(hand, now);
}

function setupQuestionOrbs(q) {
  bubbles = [];
  questionHighlightIndex = -1;

  const introTitle = document.getElementById("intro-title");
  introTitle?.classList.remove("is-visible");
  syncQuestionTitle(q);

  const cx = width / 2;
  const cy = height * 0.52;
  const orbitBase = min(width, height);
  const orbitX = orbitBase * ORB_ORBIT_X;
  const orbitY = orbitBase * ORB_ORBIT_Y;
  const count = q.options.length;

  q.options.forEach((opt, i) => {
    const key = opt.key || opt;
    const label = opt.label || opt;
    const angle = (i / count) * TWO_PI - HALF_PI + random(-0.1, 0.1);
    const distMul = 0.94 + random(-0.04, 0.05);
    const sideBoost = 1 + ORB_SIDE_SPREAD * abs(cos(angle));
    const ax = cx + cos(angle) * orbitX * distMul * sideBoost;
    const ay = cy + sin(angle) * orbitY * distMul;
    const r = constrain(64 + label.length * 3.4, 68, 104);
    bubbles.push({
      key,
      text: label,
      x: ax,
      y: ay,
      baseX: ax,
      baseY: ay,
      anchorX: ax,
      anchorY: ay,
      r,
      hoverMs: 0,
      selected: false,
      dissolving: false,
      alpha: 1,
      breathPhase: random(TWO_PI),
      floatPhase: random(TWO_PI),
      driftPhase: random(TWO_PI),
      grainSeed: random(1000),
      dust: [],
      tint: questionOrbToneForOption({ key }, i),
      selectedAt: 0,
      hidden: false,
    });
  });
}

function findHighlightedOrbIndex(hand) {
  if (!hand) return -1;

  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.dissolving || b.hidden) continue;
    const d = dist(hand.x, hand.y, b.x, b.y);
    if (d < b.r + ORB_HIT_PAD && d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function updateQuestionOrbs(hand, q, now) {
  if (pendingQuestionAdvance) {
    if (now >= questionTransitionUntil) beginQuestionPageExit(now);
    return;
  }

  if (questionPagePhase === "exit") return;

  const dt = min(32, max(8, deltaTime || 16));
  questionHighlightIndex = findHighlightedOrbIndex(hand);

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.hidden) continue;

    const t = now * 0.001 + b.floatPhase;
    const driftT = now * 0.001 * ORB_DRIFT_SPEED + b.driftPhase;
    if (!b.dissolving) {
      b.anchorX = b.baseX + cos(driftT + i * 0.7) * ORB_DRIFT_AMP;
      b.anchorY = b.baseY + sin(driftT * 0.86 + i * 1.1) * ORB_DRIFT_AMP * 0.82;
      b.x = b.anchorX + sin(t * ORB_FLOAT_SPEED) * ORB_FLOAT_AMP_X;
      b.y = b.anchorY + cos(t * ORB_FLOAT_SPEED * 0.86) * ORB_FLOAT_AMP_Y;
    } else if (now - b.selectedAt > min(260, ORB_DISSOLVE_MS * 0.42)) {
      b.hidden = true;
    }

    if (i === questionHighlightIndex && hand) {
      b.hoverMs += dt;
      if (b.hoverMs >= ORB_HOVER_MS) selectQuestionOrb(b, q);
    } else {
      b.hoverMs = max(0, b.hoverMs - dt * 2.4);
    }
  }

  if (hand && questionHighlightIndex >= 0 && !pendingQuestionAdvance) {
    const b = bubbles[questionHighlightIndex];
    const d = dist(hand.x, hand.y, b.x, b.y);
    const target = constrain(1 - d / (b.r + ORB_HIT_PAD + 40), 0, 0.9);
    introHandProximity = lerp(introHandProximity, target, 0.14);
  } else {
    introHandProximity = lerp(introHandProximity, 0, 0.1);
  }
}

function drawQuestionOrbs(hand, now) {
  const enterMul = getQuestionPageEnterMul(now);
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.hidden) continue;
    const highlighted = i === questionHighlightIndex;
    drawQuestionOrb(b, highlighted, now, enterMul);
  }
}

function drawQuestionOrb(b, highlighted, now, enterMul = 1) {
  const hoverT = constrain(b.hoverMs / ORB_HOVER_MS, 0, 1);
  const breathe = sin(now * ORB_BREATH_SPEED + b.breathPhase) * ORB_BREATH_AMP;
  const tremble = highlighted ? sin(now * 0.038) * (0.8 + hoverT * 1.4) : 0;
  const burstT = b.dissolving ? constrain((now - b.selectedAt) / 240, 0, 1) : 0;
  const burstScale = b.dissolving ? 1 + sin(burstT * PI) * 0.08 : 1;
  const bubbleAlpha = b.dissolving ? 1 - burstT * 0.96 : 1;
  const scaleMul =
    (1 + breathe + (highlighted ? hoverT * 0.07 : 0)) * burstScale * lerp(0.86, 1, enterMul);
  const tone = b.tint || particleTone(196, 198, 202, 0.88);

  push();
  const ctx = drawingContext;
  ctx.save();
  ctx.globalAlpha *= enterMul * bubbleAlpha;
  translate(b.x + tremble, b.y + tremble * 0.3);
  scale(scaleMul);

  if (highlighted) {
    const glow = ctx.createRadialGradient(0, 0, b.r * 0.2, 0, 0, b.r * 1.35);
    glow.addColorStop(0, `rgba(90,90,94,${0.08 + hoverT * 0.1})`);
    glow.addColorStop(1, "rgba(210,210,214,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 1.35, 0, TWO_PI);
    ctx.fill();
  }

  const grd = ctx.createRadialGradient(0, 0, b.r * 0.05, 0, 0, b.r);
  const coreR = lerp(tone.r, 242, 0.72);
  const coreG = lerp(tone.g, 242, 0.72);
  const coreB = lerp(tone.b, 242, 0.72);
  const midR = lerp(tone.r, 206, 0.32);
  const midG = lerp(tone.g, 206, 0.32);
  const midB = lerp(tone.b, 206, 0.32);
  grd.addColorStop(0, `rgba(${coreR},${coreG},${coreB},${0.48 + hoverT * 0.18})`);
  grd.addColorStop(0.45, `rgba(${midR},${midG},${midB},${0.28 + hoverT * 0.1})`);
  grd.addColorStop(0.78, `rgba(${tone.r},${tone.g},${tone.b},0.08)`);
  grd.addColorStop(1, "rgba(228,228,232,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, TWO_PI);
  ctx.fill();

  ctx.save();
  ctx.filter = "blur(5px)";
  ctx.globalAlpha = 0.35 + hoverT * 0.15;
  ctx.fillStyle = `rgba(${tone.r},${tone.g},${tone.b},0.16)`;
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 1.08, 0, TWO_PI);
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  noStroke();
  for (let i = 0; i < 16; i++) {
    const h = introDustHash(b.grainSeed + i * 3.7);
    const gx = (h - 0.5) * b.r * 1.45;
    const gy = (introDustHash(b.grainSeed + i * 5.1) - 0.5) * b.r * 1.45;
    if (gx * gx + gy * gy > b.r * b.r * 0.72) continue;
    fill(max(0, tone.r - 22), max(0, tone.g - 22), max(0, tone.b - 18), 9 + hoverT * 14);
    circle(gx, gy, 0.55 + h * 0.75);
  }

  if (highlighted) drawOrbAmbientParticles(b, hoverT, now);

  const textAlpha = highlighted ? 168 + hoverT * 80 : 130;
  const textTone = highlighted ? 34 + hoverT * 14 : 46;
  fill(textTone, textTone, textTone + 4, textAlpha);
  textFont(APP_SERIF);
  textAlign(CENTER, CENTER);
  textSize(constrain(b.r * 0.17, 10, 14));
  text(b.text, 0, 0);
  ctx.restore();
  pop();
}

function drawOrbAmbientParticles(b, hoverT, now) {
  if (b.dust.length < 8) {
    for (let i = b.dust.length; i < 8; i++) {
      b.dust.push({
        angle: random(TWO_PI),
        dist: b.r * random(0.6, 1.05),
        phase: random(TWO_PI),
        radius: random(0.3, 0.7),
      });
    }
  }
  fill(100, 100, 104, 26 + hoverT * 50);
  noStroke();
  for (const p of b.dust) {
    const drift = sin(now * 0.0026 + p.phase) * 1.8;
    const x = cos(p.angle) * (p.dist + drift);
    const y = sin(p.angle) * (p.dist + drift * 0.55);
    circle(x, y, p.radius);
  }
}

function selectQuestionOrb(orb, q) {
  if (pendingQuestionAdvance || orb.dissolving) return;
  orb.selected = true;
  orb.dissolving = true;
  orb.selectedAt = millis();
  const answerKey = orb.key || resolveAnswerKey(q.id, orb.text) || orb.text;
  userAnswers[q.id] = answerKey;
  if (q.id === "mask") userAnswers.q3 = answerKey;
  if (q.id === "identity") userAnswers.q1 = answerKey;
  if (q.id === "perception") userAnswers.q2 = answerKey;
  if (q.id === "unseen") userAnswers.q4 = answerKey;
  pendingQuestionAdvance = true;
  questionTransitionUntil = orb.selectedAt + ORB_DISSOLVE_MS;
  questionHighlightIndex = -1;
  spawnQuestionBubbleParticles(orb);
}

function drawOrbDissolveParticles(now) {
  return;
}
