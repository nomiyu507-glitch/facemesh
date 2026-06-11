/* state.js — shared mutable application state */

let state = "intro";

let capture = null;
let videoReady = false;
let hands = [];
let faces = [];
let faceMeshModel = null;
let ml5ModelsInitialized = false;

let userAnswers = {};
let questionIndex = 0;
let bubbles = [];
let questionTransitionUntil = 0;
let orbDissolveParticles = [];
let pendingQuestionAdvance = false;
let bubbleParticles = [];
let paperFragments = [];
let fragmentCaptureSnapshot = null;
let pendingFragmentCapture = false;
let fragmentCaptureStartedAt = 0;
let fragmentCaptureFlash = 0;
let collageRemovedLabelCount = 0;

let coreLabels = [];
let facePatches = [];
let keptLabels = [];
let removedLabels = [];

let finishFingerWasInside = false;
let restartHover = 0;
let generatingStart = 0;
let generatingLine = 0;
let patchMaskStart = 0;
let finalPortraitStart = 0;
let portraitSnapshot = null;
let portraitFaceBox = null;
let portraitDarken = 0;
let portraitCountdownActive = false;
let portraitCountdownStart = 0;
const PORTRAIT_COUNTDOWN_MS = 3000;

let faceBoxSmoothed = null;
let lastFaceAt = 0;
let lastFrameMs = 0;
let lastFingerPos = null;
let fingerStableFrames = 0;
let smoothedFingerScreen = null;
let introFaceCanvas = null;
let introFaceCtx = null;
let introMeshCanvas = null;
let introMeshCtx = null;
let introFaceBuffer = null;
let introFaceBufferCtx = null;
let introCompSmoothed = null;
let lastIntroWebcamMs = 0;
let lastIntroMeshMs = 0;
const INTRO_SWIPE_MIN_MS = 240;
const INTRO_SWIPE_MAX_MS = 1800;
const INTRO_SWIPE_MIN_DIST_RATIO = 0.22;
const INTRO_SWIPE_MIN_SPEED = 0.04;
const INTRO_SWIPE_COOLDOWN_MS = 4000;
const INTRO_DISSOLVE_MS = 900;
let introTransitionPhase = "idle";
let introDissolveStartTime = null;
let introDissolveParticles = [];
let introAudioCtx = null;
let introSoundPlayed = false;
let lastIntroFaceSnapshot = null;
let introSwipeTrail = [];
let introHandProximity = 0;
let introFogFlash = 0;
let introFogDistort = 0;
let introSwipeCooldownUntil = 0;
let introTransitionTriggered = false;
let lastIntroHandAt = 0;
let introSwipeLockedHand = -1;
let questionHandCursor = null;
let questionHighlightIndex = -1;
let questionPagePhase = null;
let questionPagePhaseStart = 0;
let collageTearCooldownUntil = 0;

const MAX_TRANSIENT_PARTICLES = 300;

function particleTone(r, g, b, alpha = 1) {
  return { r, g, b, alpha };
}

function paperToneForStickerType(type) {
  const tones = {
    warning: particleTone(214, 184, 152, 0.92),
    tag: particleTone(228, 220, 205, 0.92),
    round: particleTone(236, 228, 214, 0.9),
    rect: particleTone(240, 232, 221, 0.92),
    tape: particleTone(232, 226, 212, 0.84),
    blue: particleTone(191, 202, 216, 0.9),
    purple: particleTone(189, 181, 201, 0.9),
    folded: particleTone(235, 231, 224, 0.9),
    roundedWhite: particleTone(244, 239, 232, 0.92),
    orangeRound: particleTone(223, 198, 170, 0.9),
  };
  return tones[type] || tones.rect;
}

class BubbleParticle {
  constructor(x, y, tone) {
    const ang = random(TWO_PI);
    const speed = random(0.035, 0.11);
    this.x = x;
    this.y = y;
    this.vx = cos(ang) * speed * random(0.65, 1.15);
    this.vy = sin(ang) * speed * random(0.65, 1.05);
    this.drag = random(0.94, 0.975);
    this.spin = random(-0.006, 0.006);
    this.rot = random(TWO_PI);
    this.size = random(2.8, 8.4);
    this.alpha = random(0.42, 0.82);
    this.life = random(520, 780);
    this.age = 0;
    this.shape = random(["dot", "square", "paper"]);
    this.tone = tone;
  }

  update(dtMs) {
    this.age += dtMs;
    this.x += this.vx * dtMs;
    this.y += this.vy * dtMs;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.rot += this.spin * dtMs;
  }

  display() {
    const t = constrain(this.age / this.life, 0, 1);
    const fade = 1 - t * t;
    const a = this.tone.alpha * this.alpha * fade * 255;
    if (a <= 1) return;

    push();
    translate(this.x, this.y);
    rotate(this.rot);
    noStroke();
    fill(this.tone.r, this.tone.g, this.tone.b, a);

    if (this.shape === "dot") {
      circle(0, 0, this.size * (1 + t * 0.15));
    } else if (this.shape === "square") {
      rectMode(CENTER);
      rect(0, 0, this.size, this.size, 1.2);
      rectMode(CORNER);
    } else {
      beginShape();
      vertex(-this.size * 0.42, -this.size * 0.36);
      vertex(this.size * 0.48, -this.size * 0.18);
      vertex(this.size * 0.34, this.size * 0.46);
      vertex(-this.size * 0.38, this.size * 0.28);
      endShape(CLOSE);
    }
    pop();
  }

  get dead() {
    return this.age >= this.life;
  }
}

class PaperFragment {
  constructor(x, y, tone) {
    const ang = random(-PI * 0.92, -PI * 0.08);
    const speed = random(0.03, 0.12);
    this.x = x;
    this.y = y;
    this.vx = cos(ang) * speed * random(0.7, 1.2);
    this.vy = sin(ang) * speed * random(0.7, 1.05);
    this.gravity = random(0.00018, 0.00028);
    this.drag = random(0.985, 0.993);
    this.rot = random(TWO_PI);
    this.spin = random(-0.005, 0.005);
    this.size = random(8, 18);
    this.alpha = random(0.5, 0.9);
    this.life = random(2600, 4200);
    this.settleMs = random(900, 1500);
    this.age = 0;
    this.groundY = height - random(14, 54);
    this.resting = false;
    this.tone = tone;
    const vertCount = 4 + floor(random(0, 2));
    this.verts = Array.from({ length: vertCount }, (_, i) => {
      const theta = (i / vertCount) * TWO_PI;
      const rad = this.size * random(0.38, 0.62);
      return { x: cos(theta) * rad, y: sin(theta) * rad };
    });
  }

  update(dtMs) {
    this.age += dtMs;
    if (!this.resting) {
      this.x += this.vx * dtMs;
      this.y += this.vy * dtMs;
      this.vy += this.gravity * dtMs;
      this.vx *= this.drag;
      this.rot += this.spin * dtMs;

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vx *= 0.45;
        this.vy *= -0.12;
        if (abs(this.vy) < 0.01 || this.age > this.settleMs) {
          this.resting = true;
          this.vx = 0;
          this.vy = 0;
          this.spin *= 0.18;
        }
      }
    } else {
      this.rot += this.spin * dtMs;
    }
  }

  display() {
    const t = constrain(this.age / this.life, 0, 1);
    const fade = this.resting ? 1 - max(0, (t - 0.55) / 0.45) : 1 - t * 0.75;
    const a = this.tone.alpha * this.alpha * max(0, fade) * 255;
    if (a <= 1) return;

    push();
    translate(this.x, this.y);
    rotate(this.rot);
    noStroke();
    fill(this.tone.r, this.tone.g, this.tone.b, a);
    beginShape();
    for (const v of this.verts) vertex(v.x, v.y);
    endShape(CLOSE);

    stroke(255, 255, 255, a * 0.16);
    strokeWeight(0.6);
    line(-this.size * 0.28, -this.size * 0.06, this.size * 0.22, this.size * 0.08);
    pop();
  }

  get dead() {
    return this.age >= this.life;
  }
}

function trimTransientParticles() {
  const total = bubbleParticles.length + paperFragments.length;
  if (total <= MAX_TRANSIENT_PARTICLES) return;

  const overflow = total - MAX_TRANSIENT_PARTICLES;
  if (paperFragments.length >= overflow) {
    paperFragments.splice(0, overflow);
  } else {
    const rest = overflow - paperFragments.length;
    paperFragments = [];
    bubbleParticles.splice(0, min(rest, bubbleParticles.length));
  }
}

function updateAndDrawTransientEffects(dtMs) {
  if (bubbleParticles.length) {
    bubbleParticles = bubbleParticles.filter((p) => {
      p.update(dtMs);
      p.display();
      return !p.dead;
    });
  }

  if (paperFragments.length) {
    paperFragments = paperFragments.filter((p) => {
      p.update(dtMs);
      p.display();
      return !p.dead;
    });
  }

  trimTransientParticles();
}

// Collage studio
const labelImages = {
  warning: null,
  tag: null,
  round: null,
  rect: null,
  tape: null,
  blue: null,
  purple: null,
  folded: null,
  roundedWhite: null,
  orangeRound: null,
};

const uiIcons = {
  camera: null,
  refresh: null,
};

const collageLabelPools = translatedLabelWordsKo;

const collageLabelTypePools = {
  q1: {
    Family: ["rect", "roundedWhite", "orangeRound"],
    School: ["blue", "rect", "tape"],
    Society: ["purple", "folded", "warning"],
    Appearance: ["roundedWhite", "round", "tape"],
    Myself: ["roundedWhite", "folded", "rect"],
  },
  q2: {
    Quiet: ["tape", "folded", "roundedWhite"],
    Useful: ["tag", "blue", "rect"],
    Successful: ["round", "orangeRound", "tag"],
    Kind: ["round", "roundedWhite", "rect"],
    Difficult: ["warning", "orangeRound", "purple"],
  },
  q3: {
    Perfect: ["roundedWhite", "folded", "rect"],
    Confident: ["orangeRound", "tag", "round"],
    Productive: ["blue", "tag", "rect"],
    Easygoing: ["roundedWhite", "round", "tape"],
    Untouchable: ["purple", "warning", "folded", "tape"],
  },
  q4: {
    Fear: ["purple", "folded", "tape"],
    Anger: ["warning", "orangeRound", "tape"],
    Tiredness: ["folded", "tape", "roundedWhite"],
    Failure: ["warning", "folded", "purple"],
    Desire: ["orangeRound", "round", "folded"],
  },
  system: ["tag", "blue", "purple"],
};

let dynamicLabels = [];
let collageHandCursor = null;
let collageHighlightedLabelId = null;
let collageLabelSeed = 0;
let collageFaceBaseSeed = 0;
let collageLayerSeed = 0;
let collageDebugLogged = false;
let collageCursorTrail = [];
let collageCaptureFingerInside = false;
let collageRefreshFingerInside = false;
let collageCaptureHoldMs = 0;
let collageRefreshHoldMs = 0;
let resultSaveHoldMs = 0;
let resultRefreshHoldMs = 0;
let collageCaptureLatched = false;
let collageRefreshLatched = false;
let resultSaveLatched = false;
let resultRefreshLatched = false;
let fragmentSaveCooldownUntil = 0;
let fragmentSaveNoticeUntil = 0;
let fragmentSaveNoticeText = "";
let fragmentHasSavedOnce = false;
let fragmentAutoSaved = false;
