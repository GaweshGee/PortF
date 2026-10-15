"use strict";

/* =====================================================================
   SETTINGS

   SINHALA  font : any font name (embedded or installed)
            mode : 'legacy'  = old keystroke fonts like the embedded CPS44
                   'unicode' = normal fonts (Iskoola Pota, Nirmala UI, ...)

   INK COLOURS (outline + fill) accept any of these:
     'auto'                         the page's text colour
     '#ff3b00'  'rgb(0 0 0)' ...    any CSS colour
     { type:'linear', angle:90, stops:['#ff3b00','#ffb400','#00c2ff'] }
     { type:'linear', angle:45, stops:[['#ff3b00',0],['#111',0.6],['#00c2ff',1]] }
     { type:'radial', stops:['#fff','#ff3b00'] }
   Gradients are stretched across the whole English word.
   angle: 0 = bottom-to-top, 90 = left-to-right, 180 = top-to-bottom.
   ===================================================================== */
const SETTINGS = {
  sinhala: {
    font: "CPS44",
    mode: "legacy",
    unicodeSegments: ["ආයු", "බෝ", "වන්"],
    legacySegments: [["wd", "hq"], ["fnda"], ["j", "ka"]], // one entry per letter
  },
  english: ["wel", "co", "me"], // the word the hero lands on
  scrollDown: ["Go_", "DE", "EP"], // plays when the visitor scrolls down
  scrollUp: ["ag", "ai", "n?"], // plays when the visitor scrolls up

  holdSinhala: 500, // ms the Sinhala greeting stays before rolling on
  heroLimit: 0.1, // the hero reacts only while scrolled less than this share of its height

  tagline: {
    top: ["Designer & Developer", "Based in Udamattala, Sri Lanka"],
    bottom: ["Scroll to explore", { text: "Available for work", hold: 400 }],
    startDelay: 200, // ms after the ink turns on
    hold: 2800, // ms a line stays fully visible
    gap: 100, // ms of empty space between two lines
    stagger: 25, // ms between letters
    bottomDelay: 1200, // the bottom side starts this much later
    loop: true, // false = stop after the last line
  },

  ink: {
    outline: "rgba(255,255,255,.75)", // colour or gradient
    fill: {
      type: "linear",
      angle: 100,
      stops: ["#6ff2d0", "#6fb4ff", "#a58bff", "#f3a6e8"],
    }, // colour or gradient shown through the mask
    lineWidth: 1.6, // outline thickness (px)
    radius: 2.5, // mask size on desktop, as a multiple of letter height
    radiusMobile: 1.5, // same, on phones
    follow: 0.14, // mask lag per 1/60s (lower = lazier)
    trailFade: 0.12, // trail fade speed (higher = shorter trail)
    idleMs: 1000, // the mask drifts back to the centre after this long without movement
    maskScale: 0.5, // mask is drawn at this share of full size (it is soft anyway, so 0.5 is free speed)
    idleFps: 20, // frame rate once the mask has come to rest
  },
};

/* ===================================================================== */

const INK = SETTINGS.ink;
const root = document.documentElement;
const stage = document.getElementById("stage");
const introStage = document.querySelector(".intro-stage");
const heroEl = document.getElementById("home");
const mobile = matchMedia("(max-width: 720px)");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const vw = () => root.clientWidth;
const vh = () => root.clientHeight;

const segmenter =
  window.Intl && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
const graphemes = (s) =>
  segmenter ? [...segmenter.segment(s)].map((x) => x.segment) : [...s];

const legacy = SETTINGS.sinhala.mode === "legacy";
root.style.setProperty("--sinhala-font", '"' + SETTINGS.sinhala.font + '"');

const WORDS = {
  si: {
    lang: "si",
    segs: legacy
      ? SETTINGS.sinhala.legacySegments
      : SETTINGS.sinhala.unicodeSegments,
  },
  en: { lang: "en", segs: SETTINGS.english },
  down: { lang: "en", segs: SETTINGS.scrollDown },
  up: { lang: "en", segs: SETTINGS.scrollUp },
};

/* ------------------------------------------------------------------
   Letter roll: every letter is a clipped window, its text slides inside
------------------------------------------------------------------ */
function makeRow(word) {
  const row = document.createElement("span");
  row.className = "row pre " + word.lang;
  row.setAttribute("aria-hidden", "true");
  if (word.lang === "si" && legacy) row.style.fontSynthesis = "none"; // the legacy font is natively bold

  let i = 0;
  word.segs.forEach((seg) => {
    const group = document.createElement("span");
    group.className = "seg";
    (Array.isArray(seg) ? seg : graphemes(seg)).forEach((g) => {
      const char = document.createElement("span");
      char.className = "char";
      char.style.setProperty("--i", i++);
      const inner = document.createElement("span");
      inner.textContent = g;
      char.appendChild(inner);
      group.appendChild(char);
    });
    row.appendChild(group);
  });
  row.dataset.n = i;
  return row;
}

/* shrink a word that is wider or taller than the screen */
function fit(row) {
  if (!row) return;
  row.style.fontSize = "";
  const r = row.getBoundingClientRect();
  const k = Math.min(1, (vw() - 32) / r.width, (vh() - 32) / r.height);
  if (k < 1) row.style.fontSize = (k * 100).toFixed(2) + "%";
}

let current = null; // the row on screen

async function roll(word) {
  const next = makeRow(word);
  stage.appendChild(next);
  fit(next);
  void next.offsetHeight; // commit the "waiting below" state
  if (current) current.classList.add("out");
  next.classList.remove("pre");
  const n = Math.max(+next.dataset.n, current ? +current.dataset.n : 0);
  await wait(300 + n * 45 + 60); // transition + stagger
  if (current) current.remove();
  current = next;
}

/* ------------------------------------------------------------------
   Intro + scroll reaction
------------------------------------------------------------------ */
let ready = false; // true while the hero is resting on the English word
let heroH = heroEl.offsetHeight;
const inHero = () => window.scrollY < heroH * SETTINGS.heroLimit;

function heroLive() {
  if (!inHero()) return; // never light up while scrolled away
  inkOn();
  tagsIn();
}
function heroIdle() {
  inkOff();
  tagsOut();
}

async function intro() {
  await roll(WORDS.si);
  await wait(SETTINGS.holdSinhala);
  await roll(WORDS.en);
  heroLive();
  ready = true;
}

async function scrollIntent(dir) {
  if (!ready || !inHero()) return;
  ready = false;
  heroIdle();
  await roll(dir > 0 ? WORDS.down : WORDS.up);
  await wait(300);
  await roll(WORDS.en);
  heroLive();
  await wait(250);
  ready = true;
}

/* ------------------------------------------------------------------
   Taglines: lines roll in letter by letter above / below the word
------------------------------------------------------------------ */
const TAG = SETTINGS.tagline;
const tagBoxes = {
  top: document.getElementById("tagsTop"),
  bottom: document.getElementById("tagsBottom"),
};
let tagRun = 0; // bumping this cancels any sequence still playing

function makeTagLine(text) {
  const line = document.createElement("span");
  line.className = "tl";
  let i = 0;
  const words = text.trim().split(/\s+/);
  words.forEach((w, wi) => {
    const word = document.createElement("span");
    word.className = "tw";
    graphemes(w).forEach((g) => {
      const c = document.createElement("span");
      c.className = "tc";
      c.style.setProperty("--i", i++);
      const s = document.createElement("span");
      s.textContent = g;
      c.appendChild(s);
      word.appendChild(c);
    });
    line.appendChild(word);
    if (wi < words.length - 1) line.appendChild(document.createTextNode(" "));
  });
  return line;
}

async function playSide(side, run, extra = 0) {
  const box = tagBoxes[side];
  const items = (TAG[side] || []).map((it) =>
    typeof it === "string" ? { text: it } : it,
  );
  if (!box || !items.length) return;
  box.innerHTML = "";
  box.style.setProperty("--ts", TAG.stagger + "ms");

  await wait(TAG.startDelay + extra);
  let k = 0;
  while (run === tagRun) {
    const it = items[k];
    const line = makeTagLine(it.text);
    box.replaceChildren(line); // only one line exists at a time
    void line.offsetHeight; // commit the "waiting below" state
    line.classList.add("in"); // letters roll in, one by one

    const letters = graphemes(it.text.replace(/\s+/g, "")).length;
    const roll = 600 + Math.max(0, letters - 1) * TAG.stagger + 40;
    await wait(roll + (it.hold != null ? it.hold : TAG.hold));
    if (run !== tagRun) return; // tagsOut already rolled it away

    line.classList.replace("in", "out"); // letters roll out, one by one
    await wait(roll + TAG.gap);

    if (++k >= items.length) {
      if (!TAG.loop) return;
      k = 0;
    }
  }
}

function tagsIn() {
  const run = ++tagRun;
  playSide("top", run);
  playSide("bottom", run, TAG.bottomDelay);
}

function tagsOut() {
  const r = ++tagRun; // stops any sequence in progress
  Object.values(tagBoxes).forEach((box) => {
    if (!box) return;
    box
      .querySelectorAll(".tl.in")
      .forEach((l) => l.classList.replace("in", "out"));
    setTimeout(() => {
      if (r === tagRun) box.innerHTML = "";
    }, 1200);
  });
}

/* The page is scrolled by the browser, so we listen for the *intent* to
   scroll (wheel / keys / swipe). That also works at the very top. */
let inkSync = 0;
addEventListener(
  "scroll",
  () => {
    if (!inHero()) {
      if (inkActive) heroIdle(); // leaving: off immediately
      return;
    }
    clearTimeout(inkSync); // coming back: on once scrolling settles
    inkSync = setTimeout(() => {
      if (ready && !inkActive && inHero()) heroLive();
    }, 150);
  },
  { passive: true },
);

addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "PageDown") scrollIntent(1);
  else if (e.key === "ArrowUp" || e.key === "PageUp") scrollIntent(-1);
  else if (e.key === " ") scrollIntent(e.shiftKey ? -1 : 1);
});

let touchY = null,
  touchT = 0; // quick flick = scroll, slow drag = move the ink
addEventListener(
  "touchstart",
  (e) => {
    touchY = e.touches[0].clientY;
    touchT = performance.now();
  },
  { passive: true },
);
addEventListener(
  "touchend",
  (e) => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY;
    const quick = performance.now() - touchT < 350;
    touchY = null;
    if (Math.abs(dy) > 60 && quick) scrollIntent(dy < 0 ? 1 : -1); // finger up = page down
  },
  { passive: true },
);

/* ------------------------------------------------------------------
   Ink: outline + colour fill revealed by a soft blob that follows the cursor

   Cost control:
   - everything is drawn on a canvas just big enough for the word, not the screen
   - the outline and the coloured letters are painted ONCE per layout
   - per frame only the small, half-size mask is repainted, then 3 cheap blits
   - frame rate is capped at ~60 and drops to idleFps once the mask is at rest
------------------------------------------------------------------ */
const inkCanvas = document.getElementById("ink");
const ictx = inkCanvas.getContext("2d");
const maskC = document.createElement("canvas");
const mctx = maskC.getContext("2d");
const fillC = document.createElement("canvas"); // coloured letters (static)
const fctx = fillC.getContext("2d");
const lineC = document.createElement("canvas"); // outline (static)
const lctx = lineC.getContext("2d");

const PAD = 8; // breathing room around the word, in px
const BLOB_STEPS = 48;
const BLOB_COS = [],
  BLOB_SIN = [];
for (let i = 0; i <= BLOB_STEPS; i++) {
  const th = (i / BLOB_STEPS) * Math.PI * 2;
  BLOB_COS.push(Math.cos(th));
  BLOB_SIN.push(Math.sin(th));
}

let glyphs = []; // letters in canvas-local px
let bounds = { l: 0, t: 0, r: 0, b: 0 }; // the word, in viewport px
let region = { x: 0, y: 0, w: 0, h: 0 }; // the canvas, in viewport px
let capH = 100;
let radiusPx = 100;

let inkActive = false,
  raf = 0,
  lastFrame = 0,
  lastMove = -1e9;
let mx = 0, // pointer
  my = 0,
  bx = 0, // blob
  by = 0,
  vx = 0, // blob velocity
  vy = 0,
  ang = 0; // blob direction

/* turn a settings value (colour or gradient) into something canvas can paint with */
function makePaint(spec, ctx, box) {
  if (!spec || spec === "auto") return getComputedStyle(document.body).color;
  if (typeof spec === "string") return spec;
  const { l, t, r, b } = box,
    cx = (l + r) / 2,
    cy = (t + b) / 2,
    w = r - l,
    h = b - t;
  let g;
  if (spec.type === "radial") {
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) / 2);
  } else {
    const a = ((spec.angle != null ? spec.angle : 90) * Math.PI) / 180,
      dx = Math.sin(a),
      dy = -Math.cos(a);
    const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    g = ctx.createLinearGradient(
      cx - dx * half,
      cy - dy * half,
      cx + dx * half,
      cy + dy * half,
    );
  }
  spec.stops.forEach((s, i, all) => {
    const [c, p] = Array.isArray(s) ? s : [s, i / Math.max(1, all.length - 1)];
    g.addColorStop(p, c);
  });
  return g;
}

/* measure every letter on screen, size the canvases, paint the static layers */
function inkLayout() {
  glyphs = [];
  capH = 0;
  if (!current) return;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const found = [];
  const o = introStage.getBoundingClientRect();
  let l = 1e9,
    t = 1e9,
    r = -1e9,
    b = -1e9;

  current.querySelectorAll(".char").forEach((c) => {
    const rc = c.getBoundingClientRect(),
      cs = getComputedStyle(c),
      fs = parseFloat(cs.fontSize),
      ch = c.textContent.toUpperCase(),
      font = "900 " + fs + "px " + cs.fontFamily;
    ictx.font = font;
    const m = ictx.measureText(ch);
    const A =
      m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent : fs * 0.88;
    const D =
      m.fontBoundingBoxDescent != null ? m.fontBoundingBoxDescent : fs * 0.21;
    const base = rc.top - o.top + (rc.height - (A + D)) / 2 + A;
    const top = base - m.actualBoundingBoxAscent,
      bot = base + m.actualBoundingBoxDescent;
    found.push({ ch, font, x: rc.left - o.left, base });
    l = Math.min(l, rc.left - o.left - m.actualBoundingBoxLeft);
    r = Math.max(r, rc.left - o.left + m.actualBoundingBoxRight);
    t = Math.min(t, top);
    b = Math.max(b, bot);
    capH = Math.max(capH, bot - top);
  });
  if (!found.length) return;

  bounds = { l, t, r, b };
  const pad = PAD + Math.ceil(INK.lineWidth);
  region = {
    x: Math.floor(l - pad),
    y: Math.floor(t - pad),
    w: Math.ceil(r - l + pad * 2),
    h: Math.ceil(b - t + pad * 2),
  };
  radiusPx = Math.max(
    40,
    capH * (mobile.matches ? INK.radiusMobile : INK.radius),
  );
  glyphs = found.map((g) => ({
    ...g,
    x: g.x - region.x,
    base: g.base - region.y,
  }));

  /* canvas sizes (setting width/height also resets the context state) */
  [inkCanvas, fillC, lineC].forEach((c) => {
    c.width = Math.round(region.w * DPR);
    c.height = Math.round(region.h * DPR);
  });
  maskC.width = Math.max(1, Math.round(region.w * INK.maskScale));
  maskC.height = Math.max(1, Math.round(region.h * INK.maskScale));
  [ictx, fctx, lctx].forEach((c) => c.setTransform(DPR, 0, 0, DPR, 0, 0));
  mctx.setTransform(INK.maskScale, 0, 0, INK.maskScale, 0, 0);
  ictx.imageSmoothingQuality = "low";

  Object.assign(inkCanvas.style, {
    left: region.x + "px",
    top: region.y + "px",
    width: region.w + "px",
    height: region.h + "px",
  });

  paintStaticLayers();
}

/* Outline = a stroke twice as wide as wanted with the letter interior erased:
   one clean line of constant width, none of the font's overlapping inner contours.
   The coloured letters are widened by the same stroke so they merge with the outline. */
function paintStaticLayers() {
  const box = {
    l: bounds.l - region.x,
    t: bounds.t - region.y,
    r: bounds.r - region.x,
    b: bounds.b - region.y,
  };
  const linePaint = makePaint(INK.outline, lctx, box);
  const fillPaint = makePaint(INK.fill, fctx, box);

  [lctx, fctx].forEach((c) => {
    c.lineWidth = INK.lineWidth * 2;
    c.lineJoin = "miter";
    c.miterLimit = 2;
    c.textBaseline = "alphabetic";
    c.textAlign = "left";
  });

  lctx.strokeStyle = linePaint;
  glyphs.forEach((g) => {
    lctx.font = g.font;
    lctx.strokeText(g.ch, g.x, g.base);
  });
  lctx.globalCompositeOperation = "destination-out";
  glyphs.forEach((g) => {
    lctx.font = g.font;
    lctx.fillText(g.ch, g.x, g.base);
  });
  lctx.globalCompositeOperation = "source-over";

  fctx.fillStyle = fctx.strokeStyle = fillPaint;
  glyphs.forEach((g) => {
    fctx.font = g.font;
    fctx.strokeText(g.ch, g.x, g.base);
    fctx.fillText(g.ch, g.x, g.base);
  });
}

/* smooth organic blob: gentle wobble, stretched along the direction of movement */
function blob(c, x, y, R, t, stretch, a) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    sq = Math.sqrt(stretch);
  c.beginPath();
  for (let i = 0; i <= BLOB_STEPS; i++) {
    const th = (i / BLOB_STEPS) * 6.2832;
    const r =
      R *
      (1 +
        0.055 * Math.sin(3 * th + t * 0.0016) +
        0.04 * Math.sin(5 * th - t * 0.0012 + 1.3) +
        0.018 * Math.sin(9 * th + t * 0.0021 + 0.7));
    const ox = BLOB_COS[i] * r,
      oy = BLOB_SIN[i] * r;
    const u = (ox * ca + oy * sa) * stretch,
      v = (-ox * sa + oy * ca) / sq;
    const X = x + u * ca - v * sa,
      Y = y + u * sa + v * ca;
    i ? c.lineTo(X, Y) : c.moveTo(X, Y);
  }
  c.closePath();
  c.fill();
}

function inkFrame(t) {
  if (!inkActive) return;
  raf = requestAnimationFrame(inkFrame);

  /* target in stage-local px (the stage scrolls, the pointer doesn't) */
  const o = introStage.getBoundingClientRect();
  let tx = mx - o.left,
    ty = my - o.top;
  if (t - lastMove > INK.idleMs) {
    tx = (bounds.l + bounds.r) / 2;
    ty = (bounds.t + bounds.b) / 2;
  }

  const dt = t - lastFrame;
  const resting =
    Math.abs(tx - bx) < 0.3 &&
    Math.abs(ty - by) < 0.3 &&
    Math.hypot(vx, vy) < 0.05;
  if (dt < (resting ? 1000 / INK.idleFps : 15)) return;
  lastFrame = t;

  const step = Math.min(dt, 50) / 16.67;
  const kf = 1 - Math.pow(1 - INK.follow, step);
  const dx = (tx - bx) * kf,
    dy = (ty - by) * kf;
  bx += dx;
  by += dy;
  const kv = 1 - Math.pow(0.8, step);
  vx += (dx - vx) * kv;
  vy += (dy - vy) * kv;
  const speed = Math.hypot(vx, vy);
  if (speed > 0.4) ang = Math.atan2(vy, vx);
  const stretch = 1 + Math.min(speed / 45, 0.3);

  const W = region.w,
    H = region.h,
    lx = bx - region.x,
    ly = by - region.y;

  /* mask: fade the old trail, stamp a soft halo then the solid blob */
  mctx.globalCompositeOperation = "destination-out";
  mctx.fillStyle = "rgba(0,0,0," + INK.trailFade + ")";
  mctx.fillRect(0, 0, W, H);
  mctx.globalCompositeOperation = "source-over";
  mctx.fillStyle = "#000";
  mctx.globalAlpha = 0.28;
  blob(mctx, lx, ly, radiusPx * 1.16, t, stretch, ang);
  mctx.globalAlpha = 1;
  blob(mctx, lx, ly, radiusPx, t, stretch, ang);

  /* coloured letters, cut by the mask, with the outline slid in behind */
  ictx.globalCompositeOperation = "copy";
  ictx.drawImage(fillC, 0, 0, W, H);
  ictx.globalCompositeOperation = "destination-in";
  ictx.drawImage(maskC, 0, 0, W, H);
  ictx.globalCompositeOperation = "destination-over";
  ictx.drawImage(lineC, 0, 0, W, H);
  ictx.globalCompositeOperation = "source-over";
}

function inkOn() {
  if (!current || !current.classList.contains("en") || !inHero()) return;
  inkLayout();
  if (performance.now() - lastMove > INK.idleMs) {
    bx = (bounds.l + bounds.r) / 2;
    by = (bounds.t + bounds.b) / 2;
  } else {
    const o = introStage.getBoundingClientRect();
    bx = mx - o.left;
    by = my - o.top;
  }
  vx = vy = 0;
  mctx.clearRect(0, 0, region.w, region.h);
  inkActive = true;
  current.classList.add("ink");
  inkCanvas.style.opacity = 1;
  cancelAnimationFrame(raf);
  lastFrame = 0;
  raf = requestAnimationFrame(inkFrame);
}

function inkOff() {
  inkActive = false;
  cancelAnimationFrame(raf);
  inkCanvas.style.opacity = 0;
  if (current) current.classList.remove("ink");
}

const point = (e) => {
  mx = e.clientX;
  my = e.clientY;
  lastMove = performance.now();
};
addEventListener("pointermove", point, { passive: true });
addEventListener("pointerdown", point, { passive: true });
addEventListener(
  "scroll",
  () => {
    if (inkActive && !inHero()) inkOff();
  },
  { passive: true },
);

/* ------------------------------------------------------------------
   Starfield: painted once (seeded, so it stays stable on resize)
------------------------------------------------------------------ */
const starCanvas = document.getElementById("stars");
const sctx = starCanvas.getContext("2d");
let starSize = "";

function drawStars() {
  const W = vw(),
    H = vh(),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (starSize === W + "x" + H) return;
  starSize = W + "x" + H;

  starCanvas.width = Math.round(W * dpr);
  starCanvas.height = Math.round(H * dpr);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0, n = Math.round((W * H) / 8000); i < n; i++) {
    const x = rnd() * W,
      y = rnd() * H,
      r = 0.35 + Math.pow(rnd(), 3) * 1.1,
      a = (0.15 + rnd() * 0.55).toFixed(2),
      k = rnd();
    sctx.fillStyle =
      k < 0.15
        ? "rgba(170,200,255," + a + ")"
        : k < 0.25
          ? "rgba(200,255,235," + a + ")"
          : "rgba(235,240,255," + a + ")";
    sctx.beginPath();
    sctx.arc(x, y, r, 0, 6.2832);
    sctx.fill();
  }
}
drawStars();

/* ------------------------------------------------------------------
   Resize (debounced)
------------------------------------------------------------------ */
let resizeTimer = 0;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    heroH = heroEl.offsetHeight;
    fit(current);
    drawStars();
    if (inkActive) inkLayout();
  }, 120);
});

/* ------------------------------------------------------------------
   Start once the fonts the intro needs are ready
------------------------------------------------------------------ */
Promise.all([
  document.fonts.load('900 100px "' + SETTINGS.sinhala.font + '"', "wd"),
  document.fonts.load('900 100px "Montserrat"', "WELCOME"),
])
  .then(intro)
  .catch(intro);

/* ------------------------------------------------------------------
   Mobile menu
------------------------------------------------------------------ */
const toggle = document.querySelector(".toggle");
const menu = document.querySelector(".menu");

if (toggle && menu) {
  const setMenu = (open) => {
    menu.classList.toggle("show", open);
    toggle.classList.toggle("change", open);
    menu.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () =>
    setMenu(!menu.classList.contains("show")),
  );
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });
}

/* ------------------------------------------------------------------
   GSAP: About reveal + smooth nav scrolling
------------------------------------------------------------------ */
if (window.gsap) {
  const plugins = [window.ScrollTrigger, window.ScrollToPlugin].filter(Boolean);
  gsap.registerPlugin(...plugins);

  /* About: each word slides up from behind its mask */
  const about = document.getElementById("about");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (about && window.ScrollTrigger && !reduceMotion) {
    const words = about.querySelectorAll(".about-word");
    const desc = about.querySelector(".about-desc");

    // hidden from JS (not CSS), so the page stays readable if scripts fail
    gsap.set(words, { yPercent: 110, opacity: 0 });
    gsap.set(desc, { y: 24, opacity: 0 });

    gsap
      .timeline({
        scrollTrigger: {
          trigger: about,
          start: "top 65%",
          toggleActions: "play none none reverse",
        },
      })
      .to(words, {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
      })
      .to(
        desc,
        { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" },
        "-=0.4",
      );
  }

  /* nav links glide to their section */
  if (window.ScrollToPlugin) {
    document
      .querySelectorAll(
        '.hero .titelBar a[href^="#"], .hero .menu a[href^="#"]',
      )
      .forEach((link) => {
        link.addEventListener("click", (e) => {
          const id = link.getAttribute("href");
          const target = document.querySelector(id);
          if (!target) return;
          e.preventDefault();

          gsap.to(window, {
            duration: 1,
            scrollTo: { y: target, autoKill: true },
            ease: "power2.inOut",
            // coming back to the top replays the roll
            onComplete: () => id === "#home" && scrollIntent(-1),
          });
        });
      });
  }
}
