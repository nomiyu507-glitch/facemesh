/*
 * sketch.js — p5 lifecycle & scene orchestration
 * Unmask Me — p5.js + ml5 faceMesh/handPose + three.js particles
 */

function preload() {
  uiIcons.camera = loadImage("img/camera.png");
  uiIcons.refresh = loadImage("img/refresh.png");
  labelImages.warning = loadImage("img/paper_label_warning.png");
  labelImages.tag = loadImage("img/paper_label_tag.png");
  labelImages.round = loadImage("img/paper_label_round.png");
  labelImages.rect = loadImage("img/paper_label_rect.png");
  labelImages.tape = loadImage("img/paper_label_tape.png");
  labelImages.blue = loadImage("img/Blue Label Clean 1.png");
  labelImages.purple = loadImage("img/Purple Sticky Tab Small 1.png");
  labelImages.folded = loadImage("img/White Label Folded 1.png");
  labelImages.roundedWhite = loadImage("img/Rounded White 1.png");
  labelImages.orangeRound = loadImage("img/Orange Round Subtle Tear 1.png");
}

function setup() {
  const holder = document.getElementById("p5-container");
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent(holder);
  pixelDensity(1);
  textFont(APP_SERIF);

  initVideo();
  initIntroLayers();
  if (typeof ThreeParticles !== "undefined") ThreeParticles.initThreeParticles();
  resetExperience();
  lastFrameMs = millis();
}

function draw() {
  const now = millis();
  const dt = constrain((now - lastFrameMs) / 1000, 0.001, 0.05);
  lastFrameMs = now;

  if (state === "intro" || state === "gestureQuestion" || state === "collageStudio") {
    clear();
  } else {
    background(5, 5, 10);
  }

  if (
    state !== "intro" &&
    state !== "gestureQuestion" &&
    state !== "generatingLabels" &&
    state !== "collageStudio" &&
    state !== "finalPortrait"
  ) {
    drawWebcamBackground();
  }

  const finger = getFingerOrDebug();
  if (
    finger &&
    state !== "intro" &&
    state !== "gestureQuestion" &&
    state !== "collageStudio" &&
    state !== "patchMask"
  ) {
    drawFingerGlow(finger.x, finger.y, 32);
  }

  if (state === "collageStudio") updateFragmentCaptureFlow();

  switch (state) {
    case "intro":
      drawIntro(finger);
      break;
    case "gestureQuestion":
      drawGestureQuestion(finger);
      break;
    case "collageStudio":
      drawCollageStudio(finger, dt);
      break;
    case "generatingLabels":
      drawGeneratingLabels();
      break;
    case "patchMask":
      drawPatchMaskStage(finger, dt);
      break;
    case "finalPortrait":
      drawFinalPortrait(finger);
      break;
    case "resultFragments":
      drawFragmentResultPage();
      break;
  }

  updateAndDrawTransientEffects(dt * 1000);

  if (
    typeof ThreeParticles !== "undefined" &&
    ThreeParticles.isReady() &&
    state !== "intro" &&
    state !== "gestureQuestion" &&
    state !== "collageStudio"
  ) {
    ThreeParticles.updateThreeParticles(dt, state === "finalPortrait");
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (typeof ThreeParticles !== "undefined") ThreeParticles.resizeThreeRenderer();
  if (state === "gestureQuestion") setupQuestionOrbs(QUESTIONS[questionIndex]);
  if (state === "collageStudio") initCollageStudio();
  resizeIntroLayers();
}

function resetExperience() {
  state = "intro";
  hideQuestionTitle();
  setIntroLayersVisible(true);
  userAnswers = {};
  questionIndex = 0;
  bubbles = [];
  questionTransitionUntil = 0;
  orbDissolveParticles = [];
  pendingQuestionAdvance = false;
  bubbleParticles = [];
  paperFragments = [];
  fragmentCaptureSnapshot = null;
  pendingFragmentCapture = false;
  fragmentCaptureStartedAt = 0;
  fragmentCaptureFlash = 0;
  collageRemovedLabelCount = 0;
  coreLabels = [];
  facePatches = [];
  keptLabels = [];
  removedLabels = [];
  finishFingerWasInside = false;
  restartHover = 0;
  faceBoxSmoothed = null;
  portraitSnapshot = null;
  portraitFaceBox = null;
  portraitDarken = 0;
  portraitCountdownActive = false;
  portraitCountdownStart = 0;
  finalPortraitStart = 0;
  lastFingerPos = null;
  fingerStableFrames = 0;
  smoothedFingerScreen = null;
  introCompSmoothed = null;
  lastIntroWebcamMs = 0;
  lastIntroMeshMs = 0;
  introTransitionPhase = "idle";
  introDissolveStartTime = null;
  introDissolveParticles = [];
  introSoundPlayed = false;
  lastIntroFaceSnapshot = null;
  introSwipeTrail = [];
  introHandProximity = 0;
  introFogFlash = 0;
  introFogDistort = 0;
  introSwipeCooldownUntil = 0;
  introTransitionTriggered = false;
  lastIntroHandAt = 0;
  introSwipeLockedHand = -1;
  questionHandCursor = null;
  questionHighlightIndex = -1;
  questionPagePhase = null;
  questionPagePhaseStart = 0;

  dynamicLabels = [];
  collageHandCursor = null;
  collageHighlightedLabelId = null;
  collageLabelSeed = 0;
  collageLayerSeed = 0;
  collageDebugLogged = false;
  collageCursorTrail = [];
  collageTearCooldownUntil = 0;
  collageCaptureFingerInside = false;
  collageRefreshFingerInside = false;
  collageCaptureHoldMs = 0;
  collageRefreshHoldMs = 0;
  resultSaveHoldMs = 0;
  resultRefreshHoldMs = 0;
  collageCaptureLatched = false;
  collageRefreshLatched = false;
  resultSaveLatched = false;
  resultRefreshLatched = false;
  fragmentSaveCooldownUntil = 0;
  fragmentSaveNoticeUntil = 0;
  fragmentSaveNoticeText = "";
  fragmentHasSavedOnce = false;
  fragmentAutoSaved = false;
}

// ==============================
// Scene transitions
// ==============================
function startExperience() {
  setPoeticSceneVisible(true, { showTitle: false, showQuestion: true });
  document.getElementById("intro-title")?.classList.remove("is-visible");
  syncQuestionTitle(QUESTIONS[0]);
  state = "gestureQuestion";
  questionIndex = 0;
  questionTransitionUntil = 0;
  orbDissolveParticles = [];
  pendingQuestionAdvance = false;
  bubbleParticles = [];
  paperFragments = [];
  fragmentCaptureSnapshot = null;
  pendingFragmentCapture = false;
  fragmentCaptureStartedAt = 0;
  fragmentCaptureFlash = 0;
  collageRemovedLabelCount = 0;
  introHandProximity = 0;
  introTransitionPhase = "idle";
  introDissolveStartTime = null;
  introDissolveParticles = [];
  introFogFlash = 0;
  introFogDistort = 0;
  introTransitionTriggered = false;
  introSwipeTrail = [];
  introSwipeLockedHand = -1;
  questionHandCursor = null;
  questionHighlightIndex = -1;
  questionPagePhase = null;
  questionPagePhaseStart = 0;

  dynamicLabels = [];
  collageHandCursor = null;
  collageHighlightedLabelId = null;
  collageLabelSeed = 0;
  collageCursorTrail = [];
  collageTearCooldownUntil = 0;
  collageCaptureFingerInside = false;
  collageRefreshFingerInside = false;
  collageCaptureHoldMs = 0;
  collageRefreshHoldMs = 0;
  resultSaveHoldMs = 0;
  resultRefreshHoldMs = 0;
  collageCaptureLatched = false;
  collageRefreshLatched = false;
  resultSaveLatched = false;
  resultRefreshLatched = false;
  fragmentSaveCooldownUntil = 0;
  fragmentSaveNoticeUntil = 0;
  fragmentSaveNoticeText = "";
  fragmentHasSavedOnce = false;
  fragmentAutoSaved = false;
  if (introFaceCtx && introFaceCanvas) {
    introFaceCtx.clearRect(0, 0, introFaceCanvas.width, introFaceCanvas.height);
  }
  setupQuestionOrbs(QUESTIONS[0]);
}

function enterMainScene() {
  if (state !== "intro") return;
  startExperience();
}
