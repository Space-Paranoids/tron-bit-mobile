// Bit: think of a yes/no question and tap it.
//
// The shapes, colours, lighting, tumbling and shape changes are ported from
// the desktop app's renderer (tron-bit-desktop, src/bit.rs). Each facet's
// colour is worked out here exactly as there; WebGL just fills the triangles
// with a depth buffer and antialiasing.
"use strict";

const TAU = Math.PI * 2;
const SHIMMER = 1.6; // neutral's swaps between its two forms per second
const MORPH = 0.3; // seconds to change shape
const TUCKED = 0.5; // scale of a shape tucked inside another
const PULSE = 0.06; // the "speaking" pulse
const YES_SIZE = 1.05;
const COLOR = {
  neutral: [0.48, 0.74, 1.0],
  yes: [1.0, 0.66, 0.0],
  no: [1.0, 0.3, 0.0],
};
const THINK = 0.35; // pause between the tap and the answer
const HOLD = 2.0; // how long a plain yes or no is held
const LONG = { yes: 1.35, no: 1.43 }; // length of "yes yes yes" / "no no no"
const TRIPLE_CHANCE = 0.1; // about 1 answer in 10 is the long version

const canvas = document.getElementById("bit");
const glow = document.getElementById("glow");
const word = document.getElementById("word");
const hint = document.getElementById("hint");

// ---- shapes ---------------------------------------------------------------

// bit.bin: "BIT1", then for neutral, neutral 2, yes and no a u32 triangle
// count and that many triangles (9 x f32, wound outward), little-endian.
function parseShapes(buf) {
  const v = new DataView(buf);
  if (String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)) !== "BIT1") {
    throw new Error("bad model file");
  }
  let at = 4;
  const next = () => {
    const n = v.getUint32(at, true);
    at += 4;
    const tris = new Float32Array(n * 9);
    for (let i = 0; i < n * 9; i++) tris[i] = v.getFloat32(at + i * 4, true);
    at += n * 36;
    return tris;
  };
  const neutral = [next(), next()];
  return { neutral, yes: next(), no: next() };
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function parts(shapes, mood, t) {
  if (mood === "neutral") {
    const w = smoothstep(0.15, 0.85, 0.5 + 0.5 * Math.sin(t * TAU * SHIMMER));
    const grow = (w) => TUCKED + (1 - TUCKED) * Math.min(1, 2 * w);
    return [
      [shapes.neutral[0], grow(w), COLOR.neutral],
      [shapes.neutral[1], grow(1 - w), COLOR.neutral],
    ];
  }
  if (mood === "yes") return [[shapes.yes, YES_SIZE, COLOR.yes]];
  return [[shapes.no, 1, COLOR.no]];
}

// ---- WebGL ----------------------------------------------------------------

const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
let prog, buf, aPos, aCol;
let verts = new Float32Array(0);

function initGL() {
  const vs = `attribute vec3 p; attribute vec3 c; varying vec3 v;
    void main(){ v = c; gl_Position = vec4(p, 1.0); }`;
  const fs = `precision mediump float; varying vec3 v;
    void main(){ gl_FragColor = vec4(v, 1.0); }`;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  aPos = gl.getAttribLocation(prog, "p");
  aCol = gl.getAttribLocation(prog, "c");
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aCol);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 24, 12);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.clearColor(0, 0, 0, 0);
}

const LIGHT = (() => {
  const l = [0.3, 0.8, 0.5];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
})();

// Append one shape's visible facets to `out` (from index `k`), lit as on the
// desktop: flat facets in a deep colour with a sharp white glint.
function addShape(out, k, tris, rot, scale, cx, cy, eyeZ, base, W, H, depth) {
  const p = new Float32Array(9);
  for (let f = 0, i = 0; f < tris.length; f += 9, i++) {
    for (let j = 0; j < 3; j++) {
      const x = tris[f + j * 3], y = tris[f + j * 3 + 1], z = tris[f + j * 3 + 2];
      p[j * 3] = (rot[0] * x + rot[1] * y + rot[2] * z) * scale;
      p[j * 3 + 1] = (rot[3] * x + rot[4] * y + rot[5] * z) * scale;
      p[j * 3 + 2] = (rot[6] * x + rot[7] * y + rot[8] * z) * scale;
    }
    const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2];
    const bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (nz <= 0) continue; // facing away
    const mx = (p[0] + p[3] + p[6]) / 3, my = (p[1] + p[4] + p[7]) / 3, mz = (p[2] + p[5] + p[8]) / 3;
    let vx = -mx, vy = -my, vz = eyeZ - mz;
    const vl = Math.hypot(vx, vy, vz) || 1;
    vx /= vl; vy /= vl; vz /= vl;
    const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) + (i % 2 === 0 ? 0.05 : -0.03);
    let hx = LIGHT[0] + vx, hy = LIGHT[1] + vy, hz = LIGHT[2] + vz;
    const hl = Math.hypot(hx, hy, hz) || 1;
    const glint = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), 28);
    const kk = 0.45 + 0.75 * Math.min(1, Math.max(0, diffuse));
    const g = Math.min(0.85, glint * 0.85);
    const r = Math.min(1, base[0] * kk), gg = Math.min(1, base[1] * kk), b = Math.min(1, base[2] * kk);
    const cr = r + (1 - r) * g, cg = gg + (1 - gg) * g, cb = b + (1 - b) * g;
    for (let j = 0; j < 3; j++) {
      out[k++] = ((cx + p[j * 3]) / W) * 2 - 1;
      out[k++] = 1 - ((cy - p[j * 3 + 1]) / H) * 2;
      out[k++] = -p[j * 3 + 2] / depth; // nearer = smaller depth
      out[k++] = cr;
      out[k++] = cg;
      out[k++] = cb;
    }
  }
  return k;
}

// Tumbling: rotation_y(1.3 t) * rotation_x(0.7 t), row-major.
function rotation(t) {
  const sy = Math.sin(t * 1.3), cy = Math.cos(t * 1.3);
  const sx = Math.sin(t * 0.7), cx = Math.cos(t * 0.7);
  return [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx];
}

function draw(shapes, pose, cx, cy, r, W, H) {
  const t = pose.t;
  const e = smoothstep(0, 1, pose.u);
  const pulse = 1 + PULSE * Math.sin(t * 9);
  const rot = rotation(t);
  const eyeZ = 1000 * (W / canvas.clientWidth);
  const depth = r * 4;
  const list = [];
  const push = (mood, k) => {
    for (const [tris, size, base] of parts(shapes, mood, t)) list.push([tris, r * pulse * size * k, base]);
  };
  push(pose.mood, TUCKED + (1 - TUCKED) * e);
  if (pose.u < 1 && pose.before !== pose.mood) push(pose.before, 1 - (1 - TUCKED) * e);
  let need = 0;
  for (const [tris] of list) need += (tris.length / 9) * 18;
  if (verts.length < need) verts = new Float32Array(need);
  let k = 0;
  for (const [tris, scale, base] of list) k = addShape(verts, k, tris, rot, scale, cx, cy, eyeZ, base, W, H, depth);
  gl.viewport(0, 0, W, H);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, k), gl.STREAM_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, k / 6);
}

// ---- sound ----------------------------------------------------------------

const AC = window.AudioContext || window.webkitAudioContext;
let audio = null;
const clips = {};
const raw = {};

async function loadSounds() {
  await Promise.all(
    ["yes", "no", "yesyesyes", "nonono"].map(async (n) => {
      try {
        raw[n] = await (await fetch(`sounds/${n}.mp3`)).arrayBuffer();
      } catch (_) {
        /* no sound for this one */
      }
    })
  );
}

// Browsers only allow sound after a tap, so the audio is set up on the first.
function unlockAudio() {
  if (!AC) return;
  if (!audio) {
    audio = new AC();
    for (const n of Object.keys(raw)) {
      audio.decodeAudioData(raw[n].slice(0), (b) => (clips[n] = b), () => {});
    }
    // iOS needs something played inside the tap itself.
    const s = audio.createBufferSource();
    s.buffer = audio.createBuffer(1, 1, 22050);
    s.connect(audio.destination);
    s.start(0);
  }
  if (audio.state !== "running") audio.resume();
}

// ---- settings: sound and words can each be switched off ---------------------

// Remembered on this device only; if storage is blocked they just reset.
const prefs = { sound: true, text: true };
try {
  const saved = JSON.parse(localStorage.getItem("bit-prefs") || "{}");
  if (saved.sound === false) prefs.sound = false;
  if (saved.text === false) prefs.text = false;
} catch (_) {}

function setupToggle(id, key) {
  const btn = document.getElementById(id);
  const show = () => btn.setAttribute("aria-pressed", String(prefs[key]));
  show();
  btn.addEventListener("click", () => {
    prefs[key] = !prefs[key];
    show();
    if (key === "text" && !prefs.text) word.classList.remove("on");
    try {
      localStorage.setItem("bit-prefs", JSON.stringify(prefs));
    } catch (_) {}
  });
}
setupToggle("t-sound", "sound");
setupToggle("t-text", "text");

function say(name, when) {
  if (!audio || !prefs.sound) return;
  const play = () => {
    const b = clips[name];
    if (!b) return;
    const s = audio.createBufferSource();
    s.buffer = b;
    s.connect(audio.destination);
    s.start();
  };
  setTimeout(play, Math.max(0, when * 1000));
}

// ---- answering --------------------------------------------------------------

// One fair bit from the browser's secure random generator, as on the desktop.
function randomByte() {
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return b[0];
}

const state = {
  before: "neutral",
  mood: "neutral",
  changed: -10, // when the current shape change started
  busyUntil: 0, // no new question until then
  backAt: Infinity, // when it goes back to neutral
};

function ask(now) {
  if (now < state.busyUntil) return;
  unlockAudio();
  hint.classList.add("gone");
  const answer = randomByte() & 1 ? "yes" : "no";
  const triple = randomByte() < 256 * TRIPLE_CHANCE;
  const start = now + THINK;
  const hold = triple ? LONG[answer] + 0.6 : HOLD;
  setTimeout(() => {
    state.before = state.mood;
    state.mood = answer;
    state.changed = start;
    glow.dataset.mood = answer;
    word.textContent = triple ? `${answer} ${answer} ${answer}` : answer;
    word.dataset.mood = answer;
    if (prefs.text) word.classList.add("on");
  }, THINK * 1000);
  say(triple ? answer.repeat(3) : answer, THINK);
  state.backAt = start + hold;
  state.busyUntil = start + hold + MORPH;
}

function settle(now) {
  if (now >= state.backAt) {
    state.backAt = Infinity;
    state.before = state.mood;
    state.mood = "neutral";
    state.changed = now;
    glow.dataset.mood = "neutral";
    word.classList.remove("on");
  }
}

// ---- motion and the frame loop ---------------------------------------------

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let bit = { x: 0, y: 0, r: 1 };

// A small, gentle drift that keeps Bit near the middle of the screen.
function place(t, w, h) {
  const r = Math.min(Math.min(w, h) * 0.3, 140); // phone-sized, capped on big screens
  const ax = reduced ? 0.01 : 0.04, ay = reduced ? 0.01 : 0.03;
  const x = w / 2 + w * ax * (0.6 * Math.sin(t * 0.31) + 0.4 * Math.sin(t * 0.53 + 1.3));
  const y = h / 2 + h * ay * (0.6 * Math.sin(t * 0.43 + 0.7) + 0.4 * Math.sin(t * 0.71 + 2.1));
  return { x, y, r };
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}

function start(shapes) {
  initGL();
  const t0 = performance.now();
  const frame = (ms) => {
    const now = (ms - t0) / 1000;
    settle(now);
    const dpr = resize();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    bit = place(now, w, h);
    const u = Math.min(1, Math.max(0, (now - state.changed) / MORPH));
    draw(shapes, { t: now, before: state.before, mood: state.mood, u }, bit.x * dpr, bit.y * dpr, bit.r * dpr, canvas.width, canvas.height);
    glow.style.transform = `translate(${bit.x}px, ${bit.y}px) translate(-50%, -50%)`;
    glow.style.width = glow.style.height = `${bit.r * 3}px`;
    word.style.transform = `translate(${bit.x}px, ${bit.y + bit.r * 1.55}px) translate(-50%, 0)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Tap (or click) on or near Bit asks it; Space or Enter does too.
  const t = () => (performance.now() - t0) / 1000;
  canvas.addEventListener("click", (ev) => {
    const dx = ev.clientX - bit.x, dy = ev.clientY - bit.y;
    if (Math.hypot(dx, dy) <= bit.r * 2) ask(t());
  });
  window.addEventListener("keydown", (ev) => {
    if (ev.target.closest && ev.target.closest("button")) return; // a toggle has focus
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      ask(t());
    }
  });
}

(async () => {
  if (!gl) {
    hint.textContent = "This browser can't draw Bit (WebGL is off).";
    return;
  }
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => location.reload());
  const [shapes] = await Promise.all([
    fetch("bit.bin").then((r) => r.arrayBuffer()).then(parseShapes),
    loadSounds(),
  ]);
  start(shapes);
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
