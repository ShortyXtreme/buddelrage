// BuddelRage – Ton: Geräusche (OpenClonk-Sounds, CC-BY) und prozedural erzeugte, ruhige Hintergrundmusik (WebAudio)
'use strict';
const SETTINGS_DEFAULT = { sfx: 0.8, music: 0.35, musicOn: true, muted: false, hints: true, traj: true, touch: 'auto', tutDone: false, zoom: 1, wheel: 'zoom' };
const settings = Object.assign({}, SETTINGS_DEFAULT, (() => { try { return JSON.parse(localStorage.getItem('br_settings') || '{}'); } catch (e) { return {}; } })());
if (localStorage.getItem('br_muted') === '1' && localStorage.getItem('br_settings') === null) settings.muted = true;
function saveSettings() { try { localStorage.setItem('br_settings', JSON.stringify(settings)); } catch (e) { } }

const SFX = { blast: [3, 0.9], throw: [3, 0.5], punch: [3, 0.6], hurt: [3, 0.7], die: [3, 0.8], splash: [3, 0.6], rock: [3, 0.3], growl: [3, 0.7], dig: [5, 0.35], cash: [1, 0.8], uncash: [1, 0.7], fuse: [1, 0.5], click: [1, 0.6], fanfare: [1, 0.8], error: [1, 0.5], grab: [1, 0.5], build: [1, 0.7], hitliving: [1, 0.6], inflame: [1, 0.5], sizzle: [1, 0.6], swing: [3, 0.6], bow: [3, 0.6], shield: [1, 0.7], arrowhit: [1, 0.4], cannon: [1, 0.9], catapult: [1, 0.8], dump: [1, 0.7], door: [1, 0.5], ding: [1, 0.7], metalhit: [1, 0.6] };
const audio = { pool: {}, get muted() { return settings.muted; }, set muted(v) { settings.muted = !!v; saveSettings(); Music.apply(); } };
for (const [n, [cnt]] of Object.entries(SFX)) { audio.pool[n] = []; for (let i = 1; i <= cnt; i++) { const a = new Audio('assets/sounds/' + n + (cnt > 1 ? i : '') + '.ogg'); a.preload = 'auto'; audio.pool[n].push(a); } }
// Selbst erzeugte Kurz-Geräusche (WebAudio, keine Dateien): Ballon platzt, Chat-Ping
const SYNTH = {
  pop(c, t, v) { const len = c.sampleRate * 0.12 | 0, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4); const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; const g = c.createGain(); g.gain.value = v * 1.6; s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); },
  chat(c, t, v) { for (const [k, hz] of [[0, 880], [0.07, 1320]]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = hz; g.gain.setValueAtTime(0, t + k); g.gain.linearRampToValueAtTime(v * 0.25, t + k + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + k + 0.16); o.connect(g); g.connect(c.destination); o.start(t + k); o.stop(t + k + 0.2); } },
};
const SYNTH_VOL = { pop: 0.7, chat: 0.6 };
function playSnd(n, x, y, vmul) {
  if (settings.muted || settings.sfx <= 0) return;
  if (SYNTH[n]) {
    let vol = SYNTH_VOL[n] * settings.sfx * (vmul || 1);
    if (G.world && (x || y)) { const S = R.scale, cx = R.cam.x + cv.width / S / 2, cy = R.cam.y + cv.height / S / 2; vol *= Math.max(0, 1 - Math.hypot(x - cx, y - cy) / 450); }
    if (vol < 0.03 || !Music.init || !Music.init()) return;
    try { const c = Music.ctx; if (c.state === 'suspended') c.resume(); SYNTH[n](c, c.currentTime + 0.01, vol); } catch (e) { }
    return;
  }
  if (!audio.pool[n] || !SFX[n]) return;
  let vol = SFX[n][1] * settings.sfx * (vmul || 1);
  if (G.world && (x || y)) { const S = R.scale, cx = R.cam.x + cv.width / S / 2, cy = R.cam.y + cv.height / S / 2; const d = Math.hypot(x - cx, y - cy); vol *= Math.max(0, 1 - d / 450); }
  if (vol < 0.03) return;
  const list = audio.pool[n]; const a = list[Math.floor(Math.random() * list.length)].cloneNode();
  a.volume = Math.min(1, vol); a.play().catch(() => { });
}
function uiSnd() { playSnd('click', 0, 0, 0.5); }

// ---------- Prozedurale Ambient-Musik ----------
// Langsame Flächenakkorde (a-Moll – F – C – G – …) mit sanftem Tiefpass und Hall, dazu vereinzelte Glockentöne
// aus der Pentatonik. Alles wird live erzeugt – keine Musikdateien, keine Fremdlizenzen.
const Music = {
  ctx: null, master: null, rev: null, timer: null, next: 0, step: 0, started: false,
  CHORDS: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67], [57, 60, 64, 71], [50, 57, 62, 65], [53, 60, 64, 69], [52, 55, 59, 64]],
  PENTA: [69, 72, 74, 76, 79, 81, 84],
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { this.ctx = new AC(); } catch (e) { return false; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
    // Hall aus generiertem Rauschen
    const len = c.sampleRate * 3.2, buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = c.createConvolver(); this.rev.buffer = buf;
    const wet = c.createGain(); wet.gain.value = 0.55; this.rev.connect(wet); wet.connect(this.master);
    this.dry = c.createGain(); this.dry.gain.value = 0.6; this.dry.connect(this.master); this.dry.connect(this.rev);
    return true;
  },
  start() { // nach erster Nutzer-Interaktion
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
    this.started = true; this.apply();
    if (!this.timer) { this.next = this.ctx.currentTime + 0.3; this.timer = setInterval(() => this.tick(), 400); }
  },
  level() { return (settings.musicOn && !settings.muted) ? 0.16 * settings.music : 0; },
  apply() {
    if (!this.ctx) return; const t = this.ctx.currentTime, v = this.level();
    this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v, t, v > 0 ? 1.2 : 0.4);
  },
  pad(midi, t, dur) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f.frequency.linearRampToValueAtTime(650, t + dur); f.Q.value = 0.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    for (const det of [-6, 5]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = this.hz(midi); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 1.6); }
    f.connect(g); g.connect(this.dry);
  },
  bell(midi, t) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = this.hz(midi); o2.type = 'sine'; o2.frequency.value = this.hz(midi) * 2.01;
    const g2 = c.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g); o.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    g.connect(this.dry); o.start(t); o2.start(t); o.stop(t + 3.3); o2.stop(t + 3.3);
  },
  tick() {
    if (!this.ctx || this.level() === 0) { if (this.ctx) this.next = Math.max(this.next, this.ctx.currentTime + 0.5); return; }
    const c = this.ctx, BAR = 9;
    while (this.next < c.currentTime + 1.5) {
      const ch = this.CHORDS[this.step % this.CHORDS.length], t = this.next;
      this.pad(ch[0] - 12, t, BAR); for (let i = 1; i < ch.length; i++) this.pad(ch[i], t + i * 0.12, BAR);
      const nb = 2 + ((Math.random() * 3) | 0);
      for (let k = 0; k < nb; k++) { const n = this.PENTA[(Math.random() * this.PENTA.length) | 0]; this.bell(n, t + 1 + Math.random() * (BAR - 2)); }
      this.next += BAR; this.step++;
    }
  }
};
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (!Music.started) Music.start(); }, { once: false, passive: true }));
