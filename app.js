(() => {
"use strict";

/* ======================================================================
   Helpers
   ====================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const rand = (a, b) => a + Math.random() * (b - a);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (n, c = "") => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const copyIc = () => `<span class="copyic">${ic("copy", "i-copy")}${ic("check", "i-check")}</span>`;

/* ======================================================================
   Color math  (no external libraries – works fully offline)
   ====================================================================== */
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();

function hexToRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function chromaRgb(h, c, x, m) {
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}
function hsvToRgb({ h, s, v }) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  return chromaRgb(((h % 360) + 360) % 360, c, x, v - c);
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  return chromaRgb(((h % 360) + 360) % 360, c, x, l - c / 2);
}
const hslToHex = (h, s, l) => { const { r, g, b } = hslToRgb({ h, s, l }); return toHex(r, g, b); };

/** Accepts #abc, #aabbcc, rgb(1,2,3), "1, 2, 3", hsl(260, 48%, 35%). Returns "#RRGGBB" or null. */
function parseColor(input) {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;
  let m;
  if ((m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/))) { const { r, g, b } = hexToRgb(m[1]); return toHex(r, g, b); }
  if ((m = s.match(/^(?:rgb\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/))) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if (r > 255 || g > 255 || b > 255) return null;
    return toHex(r, g, b);
  }
  if ((m = s.match(/^hsl\(\s*(\d{1,3})(?:deg)?\s*[,\s]\s*(\d{1,3})%?\s*[,\s]\s*(\d{1,3})%?\s*\)$/))) {
    const [h, sat, l] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (h > 360 || sat > 100 || l > 100) return null;
    return hslToHex(h, sat / 100, l / 100);
  }
  return null;
}

/* WCAG contrast – same formula as the original app */
function luminance(r, g, b) {
  const a = [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
function contrastRatio(h1, h2) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const l1 = luminance(a.r, a.g, a.b), l2 = luminance(b.r, b.g, b.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const pickText = (hex) => (contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#16131A") ? "#FFFFFF" : "#16131A");

/* Color-vision approximation – same matrices as the original app */
function simulate(hex, type) {
  const { r, g, b } = hexToRgb(hex);
  let o;
  if (type === "protanopia") o = [0.567 * r + 0.433 * g, 0.558 * r + 0.442 * g, 0.242 * g + 0.758 * b];
  else if (type === "deuteranopia") o = [0.625 * r + 0.375 * g, 0.7 * r + 0.3 * g, 0.3 * g + 0.7 * b];
  else if (type === "tritanopia") o = [0.95 * r + 0.05 * g, 0.433 * g + 0.567 * b, 0.475 * g + 0.525 * b];
  else if (type === "achromatopsia") { const y = 0.299 * r + 0.587 * g + 0.114 * b; o = [y, y, y]; }
  else o = [r, g, b];
  return toHex(...o);
}

/* Friendly names: "Dusky violet", "Pale mint" … made unique within a palette */
const HUES = ["Red", "Coral", "Orange", "Amber", "Yellow", "Lime", "Leaf", "Green", "Green", "Jade", "Mint", "Teal", "Aqua", "Sky", "Azure", "Blue", "Indigo", "Violet", "Purple", "Orchid", "Magenta", "Pink", "Rose", "Crimson"];
/** Proper casing: "dusky violet palette" -> "Dusky Violet Palette" (keeps caps you typed, e.g. "UI Kit") */
const titleCase = (t) => String(t).replace(/(^|[\s\-–(])([a-z])/g, (m, p, c) => p + c.toUpperCase());
function colorName(hex) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  if (l < 0.06) return "Ink Black";
  if (l > 0.96) return "Cloud White";
  if (s < 0.1) return l < 0.2 ? "Charcoal" : l < 0.4 ? "Slate" : l < 0.65 ? "Stone" : "Fog";
  let adj;
  if (l < 0.2) adj = "Midnight";
  else if (l < 0.38) adj = s > 0.5 ? "Deep" : "Dusky";
  else if (l < 0.55) adj = s > 0.6 ? "Rich" : "Muted";
  else if (l < 0.74) adj = s > 0.6 ? "Bright" : "Soft";
  else adj = "Pale";
  return `${adj} ${HUES[Math.round(h / 15) % 24]}`;
}
function uniqueNames(colors) {
  const seen = {};
  return colors.map((c) => {
    const n = colorName(c);
    seen[n] = (seen[n] || 0) + 1;
    return seen[n] === 1 ? n : `${n} ${["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][seen[n] - 1] || seen[n]}`;
  });
}

/* ======================================================================
   State (persisted in localStorage – no server, no data usage)
   ====================================================================== */
const KEY = "chromaview.v2";
const MAX_HISTORY = 10;
const defaults = () => ({
  base: "#4B2E83", count: 5, palette: null, history: [], hIndex: -1, saved: [],
  theme: "system", hintDismissed: false, checkColors: null, build: [],
});
let S = defaults();

function validColors(a, min = 1) {
  return Array.isArray(a) && a.length >= min && a.length <= 10 && a.every((c) => typeof c === "string" && parseColor(c));
}
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw), d = defaults();
      S = { ...d, ...o };
      if (!parseColor(S.base)) S.base = d.base;
      S.base = parseColor(S.base);
      S.count = clamp(parseInt(S.count, 10) || 5, 2, 10);
      if (!(S.palette && validColors(S.palette.colors, 1) && Array.isArray(S.palette.locks))) { S.palette = null; S.history = []; S.hIndex = -1; }
      if (!Array.isArray(S.history)) { S.history = []; S.hIndex = -1; }
      S.history = S.history.filter((h) => validColors(h.colors, 1));
      S.hIndex = clamp(S.hIndex, S.palette ? 0 : -1, S.history.length - 1);
      S.saved = (Array.isArray(S.saved) ? S.saved : []).filter((e) => e && validColors(e.colors, 1)).map((e) => ({ ...e, name: titleCase(e.name || "Untitled Palette") }));
      if (S.palette && S.palette.name) S.palette.name = titleCase(S.palette.name);
      if (S.checkColors && !validColors(S.checkColors, 1)) S.checkColors = null;
      S.build = validColors(S.build, 1) ? S.build.map(parseColor) : [];
      if (!["light", "dark", "system"].includes(S.theme)) S.theme = "system";
      return;
    }
    // migrate palettes saved by the first version of ChromaView
    const old = JSON.parse(localStorage.getItem("savedPalettes") || "null");
    if (Array.isArray(old)) {
      S.saved = old.map((p, i) => {
        const e = Array.isArray(p) ? { name: `Palette ${i + 1}`, colors: p } : p;
        const colors = (e.colors || []).map(parseColor).filter(Boolean);
        return colors.length ? { id: "m" + i, name: titleCase(String(e.name || `Palette ${i + 1}`).slice(0, 40)), colors, created: Date.now() } : null;
      }).filter(Boolean);
    }
  } catch { /* storage blocked – app still works for this session */ }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } }

/* ======================================================================
   Toasts, clipboard
   ====================================================================== */
function toast(msg, { action, onAction, ms = 2400 } = {}) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = action;
    b.addEventListener("click", () => { el.remove(); onAction && onAction(); });
    el.appendChild(b);
    ms = Math.max(ms, 6000);
  }
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), ms);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
}
async function doCopy(text, el, label) {
  const ok = await copyText(text);
  toast(ok ? `Copied ${label || text}` : "Couldn't copy – select the text and copy it manually");
  if (ok && el) { el.classList.add("copied"); setTimeout(() => el.classList.remove("copied"), 1500); }
}

/* ======================================================================
   Router + chrome (nav, flow bar, current-palette strip)
   ====================================================================== */
const TABS = [
  { id: "home", label: "Home", icon: "home", title: "ChromaView – Color Palette Studio" },
  { id: "pick", label: "Pick", icon: "pick", title: "Pick a Color · ChromaView" },
  { id: "palette", label: "Palette", icon: "palette", title: "Your Palette · ChromaView" },
  { id: "saved", label: "Saved", icon: "bookmark", title: "Saved Palettes · ChromaView" },
  { id: "check", label: "Check", icon: "contrast", title: "Contrast Check · ChromaView" },
];
let view = "home";

function buildNav() {
  $("#nav").innerHTML = TABS.map((t) => `<a href="#/${t.id}" data-tab="${t.id}">${t.label}</a>`).join("") + '<span class="ind" id="navInd" aria-hidden="true"></span>';
  $("#tabbar").innerHTML = TABS.map((t) => `<a href="#/${t.id}" data-tab="${t.id}">${ic(t.icon)}<span>${t.label}</span></a>`).join("");
}
function route() {
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
  show(TABS.some((t) => t.id === id) ? id : "home");
}
function go(id) { if (location.hash === `#/${id}`) route(); else location.hash = `#/${id}`; }

function show(id) {
  closePopover();
  view = id;
  if (id === "palette" && !S.palette) newPalette();
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + id));
  $$("[data-tab]").forEach((a) => (a.dataset.tab === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.title = TABS.find((t) => t.id === id).title;
  $("#statusbar").hidden = id === "home";
  if (id === "home") renderHome();
  if (id === "pick") { syncWheelSize(); renderPick(); }
  if (id === "palette") renderPalette();
  if (id === "saved") renderSaved();
  if (id === "check") renderCheck();
  renderStrips();
  moveIndicator();
  window.scrollTo({ top: 0, behavior: "instant" });
  updateGenHint();
}

/** Slide the highlight under the active nav link */
function moveIndicator() {
  const a = $("#nav a[aria-current='page']"), ind = $("#navInd");
  if (!ind) return;
  if (!a || !a.offsetWidth) { ind.style.opacity = 0; return; }
  ind.style.width = a.offsetWidth + "px";
  ind.style.transform = `translateX(${a.offsetLeft}px)`;
  ind.style.opacity = 1;
  requestAnimationFrame(() => ind.classList.add("on"));   // animate only after the first placement
}
window.addEventListener("resize", moveIndicator);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);

/** Smooth-scroll to a landing-page section, going Home first when needed */
function scrollToSection(id) {
  const run = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  if (view !== "home") { go("home"); setTimeout(run, 80); } else run();
}

function renderStrips() {
  const colors = S.palette ? S.palette.colors : [S.base];
  const label = S.palette ? "Current palette" : "Starting color";
  $("#strip").innerHTML = `<div class="cur-label"><span>${label}</span>${S.palette && view !== "palette" ? '<a href="#/palette">Open</a>' : ""}</div>
    <div class="strip">${colors.map((c) => `<button type="button" data-copy="${c}" style="background:${c}" aria-label="Copy ${c}" title="${c}"></button>`).join("")}</div>`;
}

/* ======================================================================
   HOME (landing page)
   ====================================================================== */
let heroColors = ["#4B2E83", "#F4A259", "#5B8E7D", "#BC4B51", "#8CB369"];
function renderHome() {
  const box = $("#heroStripes");
  if (box.children.length !== heroColors.length) {
    box.innerHTML = heroColors.map(() => '<div class="hs" role="listitem"><b></b><span></span></div>').join("");
  }
  const names = uniqueNames(heroColors);
  Array.from(box.children).forEach((el, i) => {
    el.style.setProperty("--sw-bg", heroColors[i]);
    el.style.setProperty("--sw-fg", pickText(heroColors[i]));
    $("b", el).textContent = names[i];
    $("span", el).textContent = heroColors[i];
  });
}
$("#heroShuffle").addEventListener("click", () => {
  heroColors = generateColors(Array(5).fill(heroColors[0]), [true, false, false, false, false]);
  renderHome();
});

/* ======================================================================
   PICK
   ====================================================================== */
let pick = rgbToHsv(hexToRgb(S.base));
const pickHex = () => { const { r, g, b } = hsvToRgb(pick); return toHex(r, g, b); };

const wheel = $("#wheel");
const wctx = wheel.getContext("2d");
let wheelImg = null, wheelPx = 0;

function syncWheelSize() {
  const css = wheel.clientWidth;
  if (!css) return;
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(css * dpr);
  if (px === wheelPx) { drawWheel(); return; }
  wheelPx = px; wheel.width = px; wheel.height = px;
  const off = document.createElement("canvas"); off.width = off.height = px;
  const c = off.getContext("2d");
  const img = c.createImageData(px, px);
  const R = px / 2;
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const dx = x - R + 0.5, dy = y - R + 0.5, d = Math.hypot(dx, dy);
    const i = (y * px + x) * 4;
    if (d > R + 1) continue;
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const { r, g, b } = hsvToRgb({ h: hue, s: Math.min(1, d / R), v: 1 });
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
    img.data[i + 3] = clamp((R - d) * 255, 0, 255);
  }
  c.putImageData(img, 0, 0);
  wheelImg = off;
  drawWheel();
}
function drawWheel() {
  if (!wheelImg) return;
  const px = wheelPx, R = px / 2, dpr = px / (wheel.clientWidth || px);
  wctx.clearRect(0, 0, px, px);
  wctx.drawImage(wheelImg, 0, 0);
  wctx.save();
  wctx.globalAlpha = (1 - pick.v) * 0.5;
  wctx.fillStyle = "#000";
  wctx.beginPath(); wctx.arc(R, R, R - 0.5, 0, Math.PI * 2); wctx.fill();
  wctx.restore();
  const a = (pick.h * Math.PI) / 180;
  const x = R + Math.cos(a) * pick.s * (R - 2), y = R + Math.sin(a) * pick.s * (R - 2);
  wctx.beginPath(); wctx.arc(x, y, 11 * dpr, 0, Math.PI * 2);
  wctx.fillStyle = pickHex(); wctx.fill();
  wctx.lineWidth = 3.5 * dpr; wctx.strokeStyle = "#fff"; wctx.shadowColor = "rgba(0,0,0,.45)"; wctx.shadowBlur = 5 * dpr; wctx.stroke();
}
function wheelFromEvent(e) {
  const r = wheel.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const R = r.width / 2;
  pick.h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  pick.s = clamp(Math.hypot(dx, dy) / R, 0, 1);
  applyPick();
}
let wheelDrag = false;
wheel.addEventListener("pointerdown", (e) => { wheelDrag = true; wheel.setPointerCapture(e.pointerId); wheelFromEvent(e); });
wheel.addEventListener("pointermove", (e) => { if (wheelDrag) wheelFromEvent(e); });
wheel.addEventListener("pointerup", () => (wheelDrag = false));
wheel.addEventListener("pointercancel", () => (wheelDrag = false));
wheel.addEventListener("keydown", (e) => {
  const big = e.shiftKey ? 5 : 1;
  const k = e.key;
  if (k === "ArrowLeft") pick.h = (pick.h - 3 * big + 360) % 360;
  else if (k === "ArrowRight") pick.h = (pick.h + 3 * big) % 360;
  else if (k === "ArrowUp") pick.s = clamp(pick.s + 0.03 * big, 0, 1);
  else if (k === "ArrowDown") pick.s = clamp(pick.s - 0.03 * big, 0, 1);
  else return;
  e.preventDefault(); applyPick();
});
new ResizeObserver(() => { if (view === "pick") syncWheelSize(); }).observe(wheel);

$("#bright").addEventListener("input", (e) => { pick.v = clamp(e.target.value / 100, 0, 1); applyPick(); });

function setPickFromHex(hex) { pick = rgbToHsv(hexToRgb(hex)); applyPick(); }

function applyPick(except) {
  const hex = pickHex();
  S.base = hex; persist();
  drawWheel();
  const rgb = hexToRgb(hex), hsl = rgbToHsl(rgb);
  const rgbS = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  const hslS = `${Math.round(hsl.h)}°, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%`;
  const pv = $("#preview");
  pv.style.setProperty("--pv", hex); pv.style.setProperty("--pvfg", pickText(hex)); pv.dataset.copy = hex;
  $("#pvHex").textContent = hex;
  $("#chipHex b").textContent = hex; $("#chipHex").dataset.copy = hex;
  $("#chipRgb b").textContent = rgbS; $("#chipRgb").dataset.copy = `rgb(${rgbS})`;
  $("#chipHsl b").textContent = hslS; $("#chipHsl").dataset.copy = `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
  const b = $("#bright");
  b.value = Math.round(pick.v * 100);
  b.style.setProperty("--track", `linear-gradient(90deg, #000, ${hsvHex(pick.h, pick.s, 1)})`);
  if (except !== "hex") $("#hexIn").value = hex;
  if (except !== "rgb") $("#rgbIn").value = rgbS;
  $("#makeSub").textContent = `Build a balanced set around ${hex}.`;
  renderShades(hex);
  if (!S.palette) renderStrips();
}
const hsvHex = (h, s, v) => { const { r, g, b } = hsvToRgb({ h, s, v }); return toHex(r, g, b); };

function renderPick() {
  pick = rgbToHsv(hexToRgb(S.base));
  $("#cntVal").textContent = S.count;
  updateStepper();
  applyPick();
}
function renderShades(hex) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (t, k) => toHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k);
  const list = [[mix(0, 0.6), "Darkest"], [mix(0, 0.4), "Darker"], [mix(0, 0.2), "Dark"], [hex, "Base"], [mix(255, 0.35), "Light"], [mix(255, 0.65), "Lightest"]];
  $("#shades").innerHTML = list.map(([c, n]) => `<button type="button" class="shade" data-copy="${c}" aria-label="Copy ${n} shade ${c}"><i style="background:${c}"></i><span>${c}</span></button>`).join("");
}

/* manual inputs with inline validation (Rule 5) */
function wireInput(id, errId, which) {
  const input = $(id), err = $(errId);
  const showErr = (msg) => { err.textContent = msg; err.hidden = false; input.setAttribute("aria-invalid", "true"); };
  const clearErr = () => { err.hidden = true; input.removeAttribute("aria-invalid"); };
  const tryApply = (strict) => {
    const v = input.value.trim();
    if (!v) { if (strict) showErr("Enter a color, like #4B2E83 or 75, 46, 131."); return; }
    const hex = parseColor(v);
    if (hex) { clearErr(); setPickFromHexExcept(hex, which); }
    else if (strict) showErr("That doesn’t look like a color. Try #4B2E83, 75, 46, 131 or hsl(260, 48%, 35%).");
  };
  input.addEventListener("input", () => tryApply(false));
  input.addEventListener("blur", () => { tryApply(true); if (!input.hasAttribute("aria-invalid")) { input.value = which === "hex" ? S.base : `${hexToRgb(S.base).r}, ${hexToRgb(S.base).g}, ${hexToRgb(S.base).b}`; } });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { tryApply(true); if (!input.hasAttribute("aria-invalid")) input.blur(); } });
}
function setPickFromHexExcept(hex, which) { pick = rgbToHsv(hexToRgb(hex)); applyPick(which); }
wireInput("#hexIn", "#hexErr", "hex");
wireInput("#rgbIn", "#rgbErr", "rgb");

/* stepper */
function updateStepper() {
  $("#cntDown").disabled = S.count <= 2;
  $("#cntUp").disabled = S.count >= 10;
  $("#cntVal").textContent = S.count;
}
$("#cntDown").addEventListener("click", () => { S.count = Math.max(2, S.count - 1); persist(); updateStepper(); });
$("#cntUp").addEventListener("click", () => { S.count = Math.min(10, S.count + 1); persist(); updateStepper(); });

/* image picker */
const imgFile = $("#imgFile"), imgCanvas = $("#imgCanvas"), imgCtx = imgCanvas.getContext("2d", { willReadFrequently: true });
let imgEl = null, imgMark = null, imgDown = false;
const imgErr = (msg) => { const e = $("#imgErr"); e.textContent = msg || ""; e.hidden = !msg; };
$("#imgBtn").addEventListener("click", () => imgFile.click());
imgFile.addEventListener("change", () => {
  const f = imgFile.files && imgFile.files[0];
  if (!f) return;
  if (!/^image\//.test(f.type)) { imgErr("That file isn’t an image. Please choose a JPG, PNG, WebP or GIF."); imgFile.value = ""; return; }
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    imgErr("");
    const scale = Math.min(1, 640 / Math.max(im.width, im.height));
    imgCanvas.width = Math.max(1, Math.round(im.width * scale));
    imgCanvas.height = Math.max(1, Math.round(im.height * scale));
    imgEl = im; imgMark = null; drawImg();
    $("#imgStage").hidden = false;
    URL.revokeObjectURL(url);
    toast("Image ready – tap it to pick a color");
  };
  im.onerror = () => { URL.revokeObjectURL(url); imgErr("We couldn’t open that image. Try a different file."); };
  im.src = url;
});
function drawImg() {
  if (!imgEl) return;
  imgCtx.drawImage(imgEl, 0, 0, imgCanvas.width, imgCanvas.height);
  if (imgMark) {
    const r = Math.max(8, imgCanvas.width / 50);
    imgCtx.beginPath(); imgCtx.arc(imgMark.x, imgMark.y, r, 0, Math.PI * 2);
    imgCtx.lineWidth = 3; imgCtx.strokeStyle = "#fff"; imgCtx.stroke();
    imgCtx.beginPath(); imgCtx.arc(imgMark.x, imgMark.y, r + 2, 0, Math.PI * 2);
    imgCtx.lineWidth = 1.5; imgCtx.strokeStyle = "rgba(0,0,0,.6)"; imgCtx.stroke();
  }
}
function sampleImg(e, announce) {
  const r = imgCanvas.getBoundingClientRect();
  const x = clamp(Math.floor(((e.clientX - r.left) * imgCanvas.width) / r.width), 0, imgCanvas.width - 1);
  const y = clamp(Math.floor(((e.clientY - r.top) * imgCanvas.height) / r.height), 0, imgCanvas.height - 1);
  imgMark = null; drawImg();
  const d = imgCtx.getImageData(x, y, 1, 1).data;
  const hex = toHex(d[0], d[1], d[2]);
  imgMark = { x, y }; drawImg();
  setPickFromHex(hex);
  if (announce) toast(`Picked from image: ${hex}`);
}
imgCanvas.addEventListener("pointerdown", (e) => { imgDown = true; imgCanvas.setPointerCapture(e.pointerId); sampleImg(e, false); });
imgCanvas.addEventListener("pointermove", (e) => { if (imgDown) sampleImg(e, false); });
imgCanvas.addEventListener("pointerup", (e) => { if (imgDown) { imgDown = false; toast(`Picked from image: ${S.base}`); } });
$("#imgClear").addEventListener("click", () => { imgEl = null; imgMark = null; imgFile.value = ""; $("#imgStage").hidden = true; imgErr(""); toast("Image removed"); });

/* ======================================================================
   PALETTE
   ====================================================================== */
function generateColors(colors, locks) {
  const hsl = rgbToHsl(hexToRgb(colors[0]));
  const schemes = [[0, 30, -30, 60, -60, 90, -90, 120, -120], [0, 180, 150, 210, 30, -30], [0, 120, 240, 60, 180, 300], [0, 150, 210, 30, -30, 180], [0, 90, 180, 270, 45, 225]];
  const off = schemes[Math.floor(Math.random() * schemes.length)];
  let k = 1;
  return colors.map((c, i) => {
    if (i === 0 || locks[i]) return c;
    const o = off[k++ % off.length];
    const h = (hsl.h + o + rand(-12, 12) + 360) % 360;
    const sat = hsl.s < 0.1 ? rand(0.2, 0.5) : rand(0.35, 0.8);
    const l = i % 2 ? rand(0.52, 0.82) : rand(0.28, 0.55);
    return hslToHex(h, sat, l);
  });
}
const autoName = (hex) => `${colorName(hex)} Palette`;
const snap = () => ({ colors: [...S.palette.colors], locks: [...S.palette.locks] });
function pushHistory() {
  S.history = S.history.slice(0, S.hIndex + 1);
  S.history.push(snap());
  if (S.history.length > MAX_HISTORY) S.history.shift();
  S.hIndex = S.history.length - 1;
}
function newPalette(colorsFromSaved, name) {
  const base = colorsFromSaved ? colorsFromSaved[0] : S.base;
  let colors, locks;
  if (colorsFromSaved) { colors = [...colorsFromSaved]; locks = colors.map((_, i) => i === 0); }
  else {
    const seed = Array(S.count).fill(base);
    locks = seed.map((_, i) => i === 0);
    colors = generateColors(seed, locks);
  }
  S.palette = { colors, locks, name: name || autoName(base) };
  S.history = []; S.hIndex = -1;
  pushHistory(); persist();
}
function replacePalette(fn, message) {
  const prev = JSON.stringify({ p: S.palette, h: S.history, i: S.hIndex });
  const had = !!S.palette;
  fn();
  persist();
  go("palette");
  toast(message, had ? { action: "Undo", onAction: () => { const o = JSON.parse(prev); S.palette = o.p; S.history = o.h; S.hIndex = o.i; persist(); go("palette"); renderPalette(); renderStrips(); } } : undefined);
}
function generateAgain() {
  const P = S.palette;
  if (!P || P.locks.every((l, i) => i === 0 || l)) return;
  P.colors = generateColors(P.colors, P.locks);
  pushHistory(); persist(); renderPalette(); renderStrips();
}
function applySnapshot(i) {
  const h = S.history[i]; if (!h) return;
  S.hIndex = i; S.palette.colors = [...h.colors]; S.palette.locks = [...h.locks];
  persist(); renderPalette(); renderStrips();
}
const undo = () => { if (S.hIndex > 0) applySnapshot(S.hIndex - 1); };
const redo = () => { if (S.hIndex < S.history.length - 1) applySnapshot(S.hIndex + 1); };
const isSaved = () => !!S.palette && S.saved.some((e) => e.colors.join() === S.palette.colors.join());

const stripeTpl = `<div class="stripe" role="listitem">
  <div class="stripe-top"><span class="role"></span><div class="s-actions"><button type="button" class="s-btn edit"></button><button type="button" class="s-btn rm"></button><button type="button" class="lock"></button></div></div>
  <div class="stripe-bottom"><div class="cname"></div><button type="button" class="hexbtn"></button><div class="rgbline"></div></div></div>`;

function renderPalette() {
  const P = S.palette; if (!P) return;
  const box = $("#stripes");
  if (box.children.length !== P.colors.length) box.innerHTML = stripeTpl.repeat(P.colors.length);
  box.dataset.n = P.colors.length;
  const names = uniqueNames(P.colors);
  Array.from(box.children).forEach((el, i) => {
    const hex = P.colors[i], fg = pickText(hex), { r, g, b } = hexToRgb(hex);
    el.style.setProperty("--sw-bg", hex); el.style.setProperty("--sw-fg", fg);
    el.dataset.i = i; el.style.setProperty("--i", i);
    const edit = $(".edit", el), rm = $(".rm", el);
    edit.innerHTML = ic("pencil"); edit.setAttribute("aria-label", `Edit ${names[i]}`); edit.title = "Edit color";
    rm.innerHTML = ic("trash"); rm.setAttribute("aria-label", `Remove ${names[i]}`); rm.title = "Remove color"; rm.hidden = i === 0;
    $(".role", el).textContent = `Color ${String(i + 1).padStart(2, "0")}`;
    $(".cname", el).textContent = names[i];
    $(".hexbtn", el).innerHTML = `${hex} ${copyIc()}`;
    $(".hexbtn", el).setAttribute("aria-label", `Copy ${names[i]} ${hex}`);
    $(".rgbline", el).textContent = `RGB ${r} / ${g} / ${b}`;
    const lock = $(".lock", el);
    if (i === 0) {
      lock.disabled = true; lock.innerHTML = `${ic("lock")}<span>Base</span>`;
      lock.setAttribute("aria-label", "Base color is always kept"); lock.removeAttribute("aria-pressed");
    } else {
      const on = !!P.locks[i];
      lock.disabled = false; lock.setAttribute("aria-pressed", on);
      lock.innerHTML = `${ic(on ? "lock" : "unlock")}<span>${on ? "Locked" : "Lock"}</span>`;
      lock.setAttribute("aria-label", `${on ? "Unlock" : "Lock"} ${names[i]}`);
    }
  });
  const nameIn = $("#palName");
  if (document.activeElement !== nameIn) nameIn.value = P.name;
  const allLocked = P.locks.every((l, i) => i === 0 || l);
  const gen = $("#genBtn");
  gen.disabled = allLocked; gen.title = allLocked ? (P.colors.length === 1 ? "Add a few colors first" : "Unlock a color to generate") : "";
  $("#lockNote").hidden = !allLocked;
  $("#lockNote").textContent = P.colors.length === 1 ? "Your palette has one color so far. Use Add color to build it, or Generate from Pick for a ready-made set." : "All colors are locked. Unlock one to generate again.";
  const add = $("#addColor");
  add.disabled = P.colors.length >= 10; add.title = add.disabled ? "Palettes can have up to 10 colors" : "";
  $("#undoBtn").disabled = S.hIndex <= 0;
  $("#redoBtn").disabled = S.hIndex >= S.history.length - 1;
  $("#histBtn").disabled = S.history.length < 2;
  const saved = isSaved(), sb = $("#savePal");
  sb.classList.toggle("saved", saved);
  $("#saveLbl").textContent = saved ? "Saved ✓" : "Save palette";
  $("#hint").hidden = S.hintDismissed;
}

$("#stripes").addEventListener("click", (e) => {
  const stripe = e.target.closest(".stripe"); if (!stripe || !S.palette) return;
  const i = +stripe.dataset.i;
  if (e.target.closest(".edit")) { openColorDialog({ type: "edit", index: i }, S.palette.colors[i]); return; }
  if (e.target.closest(".rm")) {
    if (i === 0 || S.palette.colors.length <= 1) return;
    const [gone] = S.palette.colors.splice(i, 1); S.palette.locks.splice(i, 1);
    pushHistory(); persist(); renderPalette(); renderStrips();
    toast(`Removed ${gone}`, { action: "Undo", onAction: undo });
    return;
  }
  const lock = e.target.closest(".lock");
  if (lock) {
    if (i === 0) return;
    S.palette.locks[i] = !S.palette.locks[i];
    S.history[S.hIndex] = snap(); persist(); renderPalette();
    if (e.detail > 0) lock.blur();   // mouse/touch click: let Space regenerate (keyboard users keep focus)
    return;
  }
  doCopy(S.palette.colors[i], stripe, S.palette.colors[i]);
});
/* add / edit a color by hand */
let cMode = null;
const cErr = (m) => { const e = $("#cErr"); e.textContent = m || ""; e.hidden = !m; m ? $("#cText").setAttribute("aria-invalid", "true") : $("#cText").removeAttribute("aria-invalid"); };
function syncColorUi(hex) { $("#cPrev").style.background = hex; $("#cNative").value = hex.toLowerCase(); }
function openColorDialog(mode, initial) {
  cMode = mode;
  const edit = mode.type === "edit";
  $("#cEyebrow").textContent = edit ? "Fine-tune it" : "Build your own";
  $("#cTitle").textContent = edit ? "Edit color" : "Add a color";
  $("#cSubmit").textContent = edit ? "Save color" : "Add color";
  $("#cPickHex").textContent = S.base;
  const start = initial || S.base;
  $("#cText").value = start; cErr(""); syncColorUi(start);
  $("#colorDlg").showModal();
  $("#cText").focus(); $("#cText").select();
}
$("#cNative").addEventListener("input", (e) => { const hex = e.target.value.toUpperCase(); $("#cText").value = hex; cErr(""); syncColorUi(hex); });
$("#cText").addEventListener("input", (e) => { const hex = parseColor(e.target.value); if (hex) { cErr(""); syncColorUi(hex); } });
$("#cUsePick").addEventListener("click", () => { $("#cText").value = S.base; cErr(""); syncColorUi(S.base); });
$("#colorForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const P = S.palette, v = $("#cText").value.trim(), hex = parseColor(v);
  if (!v) return cErr("Enter a color first, like #F4A259.");
  if (!hex) return cErr("That doesn’t look like a color. Try #F4A259, 244, 162, 89 or hsl(28, 89%, 64%).");
  const others = P.colors.filter((_, i) => !(cMode.type === "edit" && i === cMode.index));
  if (others.includes(hex)) return cErr(`${hex} is already in this palette.`);
  if (cMode.type === "add") {
    if (P.colors.length >= 10) return cErr("A palette can have up to 10 colors.");
    P.colors.push(hex); P.locks.push(true);   // manual colors are locked so Generate keeps them
  } else {
    if (P.colors[cMode.index] === hex) { $("#colorDlg").close(); return; }
    P.colors[cMode.index] = hex;
  }
  pushHistory(); persist(); renderPalette(); renderStrips();
  $("#colorDlg").close();
  toast(cMode.type === "add" ? `Added ${hex}` : `Updated to ${hex}`, { action: "Undo", onAction: undo });
});
$("#addColor").addEventListener("click", () => {
  const P = S.palette; if (!P || P.colors.length >= 10) return;
  const idea = generateColors([P.colors[0], P.colors[0]], [true, false])[1];   // a friendly suggestion to start from
  openColorDialog({ type: "add" }, idea);
});
function newManualPalette() {
  replacePalette(() => {
    S.palette = { colors: [S.base], locks: [true], name: "My Palette" };
    S.history = []; S.hIndex = -1; pushHistory();
  }, "Blank palette ready. Add your first color.");
  setTimeout(() => $("#addColor").click(), 350);
}
$("#newPalBtn").addEventListener("click", newManualPalette);

$("#genBtn").addEventListener("click", () => { askMotion(); generateAgain(); });
$("#undoBtn").addEventListener("click", undo);
$("#redoBtn").addEventListener("click", redo);
$("#copyAll").addEventListener("click", (e) => doCopy(S.palette.colors.join(", "), e.currentTarget, "all HEX codes"));
$("#palName").addEventListener("change", (e) => {
  const v = e.target.value.trim().slice(0, 40);
  S.palette.name = titleCase(v) || autoName(S.palette.colors[0]);
  e.target.value = S.palette.name; persist();
  toast(`Renamed to “${S.palette.name}”`);
});
$("#palName").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
$("#hintOk").addEventListener("click", () => { S.hintDismissed = true; persist(); $("#hint").hidden = true; });

$("#savePal").addEventListener("click", () => {
  const P = S.palette; if (!P) return;
  if (!isSaved()) {
    S.saved.unshift({ id: Date.now().toString(36), name: P.name || autoName(P.colors[0]), colors: [...P.colors], created: Date.now() });
    persist(); renderPalette();
  }
  $("#sName").textContent = `“${P.name}” · ${P.colors.length} colors`;
  $("#sStrip").dataset.n = P.colors.length;
  $("#sStrip").innerHTML = P.colors.map((c) => `<div style="background:${c};color:${pickText(c)}">${c}</div>`).join("");
  $("#savedDlg").showModal();
});
$("#sView").addEventListener("click", () => { $("#savedDlg").close(); go("saved"); });
$("#sCheck").addEventListener("click", () => { $("#savedDlg").close(); S.checkColors = null; persist(); go("check"); });

/* color vision sheet */
let vType = "protanopia";
let visionColors = null;
function renderVision() {
  const colors = visionColors || S.palette.colors;
  $("#vOrig").dataset.n = colors.length; $("#vSim").dataset.n = colors.length;
  $("#vOrig").innerHTML = colors.map((c) => `<div style="background:${c};color:${pickText(c)}">${c}</div>`).join("");
  const sim = colors.map((c) => simulate(c, vType));
  $("#vSim").innerHTML = sim.map((c) => `<div style="background:${c};color:${pickText(c)}">${c}</div>`).join("");
  $("#vLabel").textContent = vType;
  $$("#vTabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.v === vType));
}
$("#visionBtn").addEventListener("click", () => { visionColors = null; renderVision(); $("#visionDlg").showModal(); });
$("#vTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { vType = b.dataset.v; renderVision(); } });
$$("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
});

/* history popover */
$("#histBtn").addEventListener("click", (e) => {
  const items = S.history.map((h, i) => ({ h, i })).reverse();
  openPopover(e.currentTarget, `<p class="pop-title">Recent palettes</p>` + items.map(({ h, i }) =>
    `<button type="button" class="pop-item" data-hist="${i}" ${i === S.hIndex ? 'aria-current="true"' : ""}><span>${i === S.hIndex ? "Current" : `Version ${i + 1}`}</span><span class="mini">${h.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span></button>`).join(""));
});

/* shake to regenerate (phones) */
let motionAsked = false, lastShake = 0;
function askMotion() {
  if (motionAsked) return; motionAsked = true;
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    DeviceMotionEvent.requestPermission().catch(() => {});
  }
}
window.addEventListener("devicemotion", (e) => {
  if (view !== "palette") return;
  const a = e.accelerationIncludingGravity; if (!a) return;
  const m = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
  const now = Date.now();
  if (m > 38 && now - lastShake > 900) { lastShake = now; generateAgain(); }
});
function updateGenHint() {
  const touch = matchMedia("(pointer: coarse)").matches;
  $("#hintText").textContent = touch ? "Lock the colors you like, then tap Generate again or shake your phone to refresh the rest." : "Lock the colors you like, then press Space to refresh the rest.";
}
document.addEventListener("keydown", (e) => {
  if (view !== "palette" || $("dialog[open]")) return;
  const t = e.target, typing = t.matches && t.matches("input, textarea, select, button, a");
  if (e.code === "Space" && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); generateAgain(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(t.matches && t.matches("input, textarea"))) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !(t.matches && t.matches("input, textarea"))) { e.preventDefault(); redo(); }
});

/* ======================================================================
   SAVED
   ====================================================================== */
let editingId = null;
function renderSaved() {
  const box = $("#savedGrid");
  if (!S.saved.length) {
    box.innerHTML = `<div class="empty"><div class="doodle" aria-hidden="true"><i style="background:#4B2E83"></i><i style="background:#F4A259"></i><i style="background:#5B8E7D"></i><i style="background:#BC4B51"></i><i style="background:#8CB369"></i></div>
      <h2>Your next favorite is waiting.</h2><p class="muted">Make a palette that feels like you, then save it here for later.</p>
      <button class="btn primary" type="button" data-act="new-manual">Create your first palette ${ic("arrow")}</button></div>`;
    return;
  }
  box.className = "saved-grid";
  box.innerHTML = S.saved.map((e, idx) => {
    const d = new Date(e.created || Date.now());
    const title = editingId === e.id
      ? `<label class="sr" for="rn-${e.id}">Palette name</label><input type="text" id="rn-${e.id}" maxlength="40" value="${esc(e.name)}" data-rename="${e.id}">`
      : `<h3>${esc(e.name)}</h3>`;
    return `<article class="saved-card" data-id="${e.id}" style="--i:${Math.min(idx, 8)}">
      <div class="sc-head"><div class="sc-title">${title}<p class="meta">${e.colors.length} colors · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p></div>
        <div class="sc-icons">
          <button class="icon-btn ghost" type="button" data-export="${e.id}" aria-label="Export ${esc(e.name)} as JSON" title="Export as JSON">${ic("download")}</button>
          <button class="icon-btn ghost danger" type="button" data-del="${e.id}" aria-label="Delete ${esc(e.name)}" title="Delete">${ic("trash")}</button>
        </div></div>
      <div class="mini">${e.colors.map((c) => `<button type="button" data-copy="${c}" style="background:${c}" aria-label="Copy ${c}" title="${c}"></button>`).join("")}</div>
      <div class="card-actions">
        <button class="btn primary sm" type="button" data-load="${e.id}">Load</button>
        <button class="btn sm" type="button" data-checkpal="${e.id}">Check</button>
        <button class="btn sm" type="button" data-edit="${e.id}">${ic("pencil")}Rename</button>
      </div></article>`;
  }).join("");
  const input = $("[data-rename]", box);
  if (input) { input.focus(); input.select(); }
}
function commitRename(id, value, cancel) {
  const e = S.saved.find((x) => x.id === id);
  editingId = null;
  if (e && !cancel) { const v = titleCase(value.trim().slice(0, 40)); if (v && v !== e.name) { const old = e.name; e.name = v; persist(); toast(`Renamed to “${v}”`, { action: "Undo", onAction: () => { e.name = old; persist(); renderSaved(); } }); } }
  renderSaved();
}
$("#savedGrid").addEventListener("click", (ev) => {
  const t = ev.target.closest("button"); if (!t) return;
  const id = t.dataset.load || t.dataset.checkpal || t.dataset.edit || t.dataset.export || t.dataset.del;
  const e = S.saved.find((x) => x.id === id);
  if (t.dataset.load && e) replacePalette(() => newPalette(e.colors, e.name), `Loaded “${e.name}”`);
  else if (t.dataset.checkpal && e) { S.checkColors = [...e.colors]; persist(); go("check"); toast(`Checking “${e.name}”`); }
  else if (t.dataset.edit) { editingId = id; renderSaved(); }
  else if (t.dataset.export && e) exportPalette(e);
  else if (t.dataset.del && e) {
    const idx = S.saved.indexOf(e);
    S.saved.splice(idx, 1); persist(); renderSaved();
    toast(`Deleted “${e.name}”`, { action: "Undo", onAction: () => { S.saved.splice(idx, 0, e); persist(); if (view === "saved") renderSaved(); } });
  }
});
$("#savedGrid").addEventListener("keydown", (ev) => {
  const i = ev.target.closest("[data-rename]"); if (!i) return;
  if (ev.key === "Enter") commitRename(i.dataset.rename, i.value);
  if (ev.key === "Escape") commitRename(i.dataset.rename, i.value, true);
});
$("#savedGrid").addEventListener("focusout", (ev) => {
  const i = ev.target.closest && ev.target.closest("[data-rename]");
  if (i && editingId === i.dataset.rename) commitRename(i.dataset.rename, i.value);
});
function exportPalette(e) {
  const blob = new Blob([JSON.stringify({ name: e.name, colors: e.colors, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${e.name.replace(/[^\w\- ]+/g, "").trim() || "palette"}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported “${e.name}”`);
}

/* ======================================================================
   CHECK
   ====================================================================== */
const checkList = () => S.checkColors ?? (S.palette ? S.palette.colors : [S.base]);
let onlyPass = false;

function setChecks(arr, msg) {
  const prev = S.checkColors;
  S.checkColors = arr; persist(); renderCheck();
  if (msg) toast(msg, { action: "Undo", onAction: () => { S.checkColors = prev; persist(); renderCheck(); } });
}
function ratingOf(r) {
  if (r >= 7) return { k: "ok", t: "AAA", n: "Great for all text", i: "✓" };
  if (r >= 4.5) return { k: "ok", t: "AA", n: "Good for normal text", i: "✓" };
  if (r >= 3) return { k: "warn", t: "AA Large", n: "Big text only", i: "!" };
  return { k: "bad", t: "Fail", n: "Hard to read", i: "✕" };
}
function renderCheck() {
  const colors = checkList();
  $("#chkChips").innerHTML = colors.map((c, i) => `<span class="cchip"><i style="background:${c}"></i><span>${c}</span><button type="button" data-rm="${i}" aria-label="Remove ${c}">${ic("x")}</button></span>`).join("");
  $("#chkReset").disabled = S.checkColors === null;
  $("#addColorBtn").disabled = colors.length >= 10;
  $("#onlyPass").checked = onlyPass;
  const box = $("#pairs");
  if (colors.length < 2) {
    box.innerHTML = `<div class="pairs-empty"><p>Add at least one more color to compare.</p><button class="btn primary" type="button" id="emptyAdd">${ic("plus")}Add a color</button></div>`;
    return;
  }
  let pairs = [];
  for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) pairs.push({ bg: colors[i], fg: colors[j], ratio: contrastRatio(colors[i], colors[j]) });
  pairs.sort((a, b) => b.ratio - a.ratio);
  const total = pairs.length;
  if (onlyPass) pairs = pairs.filter((p) => p.ratio >= 4.5);
  if (!pairs.length) {
    box.innerHTML = `<div class="pairs-empty"><p>None of the ${total} pairs reach AA (4.5:1) yet.</p><button class="btn" type="button" id="showAll">Show all pairs</button></div>`;
    return;
  }
  box.innerHTML = pairs.map((p, idx) => {
    const r = ratingOf(p.ratio);
    return `<article class="pair" style="--i:${Math.min(idx, 10)}"><div class="pair-demo" style="background:${p.bg};color:${p.fg}">
      <span class="aa" aria-hidden="true">Aa</span><div><strong>Sample text</strong><small>On this background</small></div>
      <span class="pair-hex" style="color:${pickText(p.bg)}">${p.fg} on ${p.bg}</span></div>
      <div class="pair-foot"><span class="muted tiny">Contrast ratio</span><span class="ratio">${p.ratio.toFixed(2)}:1</span>
      <span class="badge ${r.k}" title="${r.n}">${r.i} ${r.t}</span><span class="muted tiny" style="flex-basis:100%">${r.n}</span></div></article>`;
  }).join("");
}
$("#chkChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]"); if (!b) return;
  const colors = checkList().slice(); const [rm] = colors.splice(+b.dataset.rm, 1);
  setChecks(colors, `Removed ${rm}`);
});
$("#chkReset").addEventListener("click", () => setChecks(null, "Back to your current palette"));
$("#pairs").addEventListener("click", (e) => {
  if (e.target.closest("#showAll")) { onlyPass = false; renderCheck(); }
  if (e.target.closest("#emptyAdd")) openAddForm();
});
$("#onlyPass").addEventListener("change", (e) => { onlyPass = e.target.checked; renderCheck(); });

function openAddForm() { $("#addForm").hidden = false; $("#chkIn").focus(); $("#addForm").scrollIntoView({ block: "center", behavior: "smooth" }); }
$("#addColorBtn").addEventListener("click", openAddForm);
$("#addCancel").addEventListener("click", () => { $("#addForm").hidden = true; $("#chkIn").value = ""; clearChkErr(); });
const clearChkErr = () => { $("#chkErr").hidden = true; $("#chkIn").removeAttribute("aria-invalid"); };
$("#chkIn").addEventListener("input", clearChkErr);
$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#chkIn").value.trim(), hex = parseColor(v);
  const fail = (m) => { $("#chkErr").textContent = m; $("#chkErr").hidden = false; $("#chkIn").setAttribute("aria-invalid", "true"); $("#chkIn").focus(); };
  if (!v) return fail("Enter a color first, like #F4A259.");
  if (!hex) return fail("That doesn’t look like a color. Try #F4A259, 244, 162, 89 or hsl(28, 89%, 64%).");
  const cur = checkList();
  if (cur.includes(hex)) return fail(`${hex} is already in this check.`);
  if (cur.length >= 10) return fail("You can compare up to 10 colors.");
  clearChkErr(); $("#chkIn").value = "";
  setChecks([...cur, hex], `Added ${hex}`);
  $("#chkIn").focus();
});
$("#usePalBtn").addEventListener("click", (e) => {
  if (!S.saved.length) { openPopover(e.currentTarget, `<p class="pop-empty">No saved palettes yet. Save one from the Palette screen and it will show up here.</p>`); return; }
  openPopover(e.currentTarget, `<p class="pop-title">Saved palettes</p>` + S.saved.map((p) =>
    `<button type="button" class="pop-item" data-usepal="${p.id}"><span>${esc(p.name)}</span><span class="mini">${p.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span></button>`).join(""));
});

/* ======================================================================
   Popover
   ====================================================================== */
const pop = $("#pop");
let popAnchor = null;
function openPopover(anchor, html) {
  if (!pop.hidden && popAnchor === anchor) { closePopover(); return; }
  pop.innerHTML = html; pop.hidden = false; popAnchor = anchor;
  const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth;
  pop.style.left = clamp(r.right - pw, 12, innerWidth - pw - 12) + "px";
  const below = r.bottom + 8, h = pop.offsetHeight;
  pop.style.top = (below + h > innerHeight - 12 ? Math.max(12, r.top - h - 8) : below) + "px";
}
function closePopover() { pop.hidden = true; popAnchor = null; }
pop.addEventListener("click", (e) => {
  const h = e.target.closest("[data-hist]");
  if (h) { applySnapshot(+h.dataset.hist); closePopover(); return; }
  const th = e.target.closest("[data-theme-set]");
  if (th) { S.theme = th.dataset.themeSet; persist(); applyTheme(); closePopover(); toast(`Appearance: ${S.theme === "system" ? "Auto" : S.theme[0].toUpperCase() + S.theme.slice(1)}`); return; }
  const u = e.target.closest("[data-usepal]");
  if (u) { const p = S.saved.find((x) => x.id === u.dataset.usepal); closePopover(); if (p) setChecks([...p.colors], `Using “${p.name}”`); }
});
document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && !popAnchor.contains(e.target)) closePopover(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopover(); });
window.addEventListener("resize", closePopover);

/* ======================================================================
   Global delegation: copy buttons, go buttons, make palette
   ====================================================================== */
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-copy]");
  if (c && !c.closest("#stripes") && c.dataset.copy) { doCopy(c.dataset.copy, c, c.dataset.copy); return; }
  const sc = e.target.closest("[data-scroll]");
  if (sc) { e.preventDefault(); scrollToSection(sc.dataset.scroll); return; }
  const soon = e.target.closest("[data-soon]");
  if (soon) { e.preventDefault(); toast(soon.dataset.soon + " Coming soon."); return; }
  const g = e.target.closest("[data-go]");
  if (g) { go(g.dataset.go); return; }
  if (e.target.closest("[data-act='new-manual']")) { newManualPalette(); return; }
  if (e.target.closest("[data-act='make-palette']")) {
    askMotion();
    replacePalette(() => newPalette(), "Palette ready – lock any color you love");
  }
});

/* ---- Build your own palette (Pick tab) ---- */
const bHist = [];           // in-memory undo stack for the builder
let bNew = -1;
const bSaved = () => S.build.length > 0 && S.saved.some((e) => e.colors.join() === S.build.join());
function bSnapshot() { bHist.push([...S.build]); if (bHist.length > 20) bHist.shift(); }
function bError(msg) { const e = $("#bErr"); e.hidden = !msg; e.textContent = msg || ""; $("#bIn").setAttribute("aria-invalid", msg ? "true" : "false"); }
function renderBuild() {
  const n = S.build.length;
  $("#bCount").textContent = `${n} of 10`;
  $("#bRow").innerHTML = S.build.map((c, i) =>
    `<div class="b-item${i === bNew ? " new" : ""}" role="listitem"><button type="button" class="b-sw" data-copy="${c}" style="background:${c}" aria-label="Copy ${c}" title="Copy ${c}"></button><button type="button" class="b-rm" data-b-rm="${i}" aria-label="Remove ${c}" title="Remove">${ic("x")}</button><span class="b-hex">${c}</span></div>`).join("");
  bNew = -1;
  $("#bEmpty").hidden = n > 0;
  $("#bUndo").disabled = bHist.length === 0;
  $("#bReset").disabled = n === 0;
  $("#bSave").disabled = n === 0;
  $("#bSave").classList.toggle("saved", bSaved());
  $("#bSaveLbl").textContent = bSaved() ? "Saved ✓" : "Save";
  $("#bVision").disabled = n === 0;
  $("#bCheck").disabled = n < 2;
  $("#bHint").textContent = n === 1 ? "Add one more color to check contrast." : "";
  const full = n >= 10;
  $("#bIn").disabled = full; $("#bForm .btn.primary").disabled = full; $("#bPicked").disabled = full;
}
function addBuild(hex) {
  if (S.build.length >= 10) { bError("A palette can have up to 10 colors."); return false; }
  if (S.build.includes(hex)) { bError(`${hex} is already in your palette.`); return false; }
  bSnapshot(); S.build.push(hex); bNew = S.build.length - 1; bError(""); persist(); renderBuild(); return true;
}
$("#bForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#bIn").value.trim();
  if (!v) { bError("Type a color first, like #FF909E or 255, 144, 158."); return; }
  const hex = parseColor(v);
  if (!hex) { bError("That doesn't look like a color. Try #FF909E or 255, 144, 158."); return; }
  if (addBuild(hex)) { $("#bIn").value = ""; $("#bIn").focus(); }
});
$("#bIn").addEventListener("input", () => bError(""));
$("#bPicked").addEventListener("click", () => addBuild(S.base));
$("#bRow").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-b-rm]"); if (!rm) return;
  const i = +rm.dataset.bRm, [gone] = S.build.slice(i, i + 1);
  bSnapshot(); S.build.splice(i, 1); persist(); renderBuild();
  toast(`Removed ${gone}`, { action: "Undo", onAction: bUndo });
});
function bUndo() { if (!bHist.length) return; S.build = bHist.pop(); bError(""); persist(); renderBuild(); }
$("#bUndo").addEventListener("click", bUndo);
$("#bReset").addEventListener("click", () => {
  if (!S.build.length) return;
  bSnapshot(); S.build = []; persist(); renderBuild();
  toast("Palette reset", { action: "Undo", onAction: bUndo });
});
$("#bSave").addEventListener("click", () => {
  if (!S.build.length) return;
  const colors = [...S.build];
  const name = autoName(colors[0]);
  if (!bSaved()) { S.saved.unshift({ id: Date.now().toString(36), name, colors, created: Date.now() }); persist(); renderBuild(); renderSaved(); }
  toast(`Saved “${S.saved.find((e) => e.colors.join() === colors.join()).name}” to Saved`, { action: "View", onAction: () => go("saved") });
});
$("#bCheck").addEventListener("click", () => { if (S.build.length < 2) return; S.checkColors = [...S.build]; persist(); go("check"); });
$("#bVision").addEventListener("click", () => { if (!S.build.length) return; visionColors = [...S.build]; renderVision(); $("#visionDlg").showModal(); });
renderBuild();

/* ======================================================================
   Theme + offline support
   ====================================================================== */
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  const ico = { light: "sun", dark: "moon", system: "monitor" }[S.theme];
  $("#themeCycle").innerHTML = ic(ico);
  $("#themeCycle").setAttribute("aria-label", `Appearance: ${S.theme === "system" ? "Auto" : S.theme}. Tap to change.`);
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    $("meta[name=theme-color]").setAttribute("content", bg);
  });
}
$("#themeCycle").setAttribute("aria-haspopup", "true");
$("#themeCycle").addEventListener("click", (e) => {
  const opts = [["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "Auto (match my device)", "monitor"]];
  openPopover(e.currentTarget, `<p class="pop-title">Appearance</p>` + opts.map(([k, l, i]) =>
    `<button type="button" class="pop-item" data-theme-set="${k}" ${S.theme === k ? 'aria-current="true"' : ""}><span class="row">${ic(i)}${l}${S.theme === k ? " ✓" : ""}</span></button>`).join(""));
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* Install-on-this-device button (shown only when the browser offers it) */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; $("#installBtn").hidden = false; });
$("#installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch { /* ignore */ }
  deferredInstall = null; $("#installBtn").hidden = true;
});
window.addEventListener("appinstalled", () => { $("#installBtn").hidden = true; toast("ChromaView is installed"); });

/* Scroll reveal: landing sections and cards fade up as they come into view */
(function () {
  const items = $$(".reveal, .stagger");
  if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  items.forEach((el) => io.observe(el));
})();

/* ======================================================================
   Boot
   ====================================================================== */
loadState();
pick = rgbToHsv(hexToRgb(S.base));
buildNav();
applyTheme();
window.addEventListener("hashchange", route);
route();
})();
