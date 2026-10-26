// BuddelRage – Ton: Geräusche (OpenClonk-Sounds, CC-BY) und prozedural erzeugte, beschwingte Hintergrundmusik (WebAudio)
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

// ---------- Prozedurale Musik (beschwingt) ----------
// Kleiner Step-Sequencer in WebAudio: leichte Drums (Kick, Snare/Klatschen, Hi-Hat), hüpfender Bass, Akkord-Tupfer und
// eingängige Melodie-Motive. Vier Stücke: Menü, Tag, Nacht (ruhiger) und Kampf (treibend); Wechsel an Taktgrenzen.
// Alles wird live erzeugt – keine Musikdateien, keine Fremdlizenzen.
const SCALE = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] };
const TRACKS = {
  menu: { bpm: 116, key: 60, sc: 'maj', chords: [0, 4, 5, 3], swing: 0.06,
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', bass: [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, -1, 12, -1, 7, -1, -1],
    mel: [[[4, -1, 4, 5, 7, -1, 5, 4], [4, -1, 2, -1, 1, 2, 4, -1], [5, -1, 5, 7, 9, -1, 7, 5], [4, 2, 3, -1, 2, -1, -1, -1]],
          [[7, -1, 9, 7, 5, -1, 4, -1], [4, 5, 4, 2, 1, -1, -1, -1], [5, 4, 5, 7, 9, 8, 7, -1], [7, -1, 5, -1, 4, -1, -1, -1]]], lead: 'tri', stab: 1 },
  day: { bpm: 124, key: 55, sc: 'maj', chords: [0, 3, 5, 4], swing: 0.08,
    kick: 'x.....x.x.......', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', bass: [0, -1, 12, 0, -1, 7, -1, 0, 0, -1, 12, -1, 7, -1, 5, -1],
    mel: [[[7, 8, 9, -1, 9, 8, 7, -1], [5, -1, 7, 5, 4, -1, 2, -1], [4, 5, 7, -1, 7, 9, 11, 9], [8, -1, 7, -1, -1, 4, 5, -1]],
          [[11, -1, 9, 11, 12, -1, 11, 9], [7, -1, 9, -1, 7, 5, 4, -1], [5, 7, 9, 7, 5, 4, 2, 4], [4, -1, 2, -1, 0, -1, -1, -1]]], lead: 'sq', stab: 1 },
  night: { bpm: 112, key: 57, sc: 'min', chords: [0, 5, 2, 6], swing: 0.1,
    kick: 'x.......x.....x.', snare: '............x...', hat: '..x...x...x...x.', bass: [0, -1, -1, -1, 7, -1, -1, 0, -1, -1, 12, -1, 7, -1, -1, -1],
    mel: [[[4, -1, -1, 2, 4, -1, 6, -1], [7, -1, -1, -1, 6, 4, -1, -1], [2, -1, 4, 2, 0, -1, -1, 1], [2, -1, -1, -1, -1, -1, -1, -1]],
          [[7, -1, 6, 7, 9, -1, 7, -1], [5, -1, 4, -1, 2, -1, -1, -1], [4, -1, 2, 4, 6, -1, 4, 2], [1, -1, 2, -1, -1, -1, -1, -1]]], lead: 'sine', stab: 0 },
  combat: { bpm: 132, key: 50, sc: 'min', chords: [0, 6, 5, 6], swing: 0,
    kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx', bass: [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 10, 0, 7, 0],
    mel: [[[7, -1, 7, 8, 7, -1, 5, -1], [4, -1, 4, 5, 4, -1, 2, -1], [5, -1, 5, 7, 8, -1, 7, 5], [4, -1, 2, -1, 4, 5, 6, -1]],
          [[9, 8, 7, -1, 9, 8, 7, -1], [5, 4, 2, -1, 4, -1, 5, -1], [7, -1, 9, -1, 10, 9, 7, 5], [6, -1, 7, -1, -1, -1, -1, -1]]], lead: 'sq', stab: 1 },
};
const Music = {
  ctx: null, master: null, rev: null, timer: null, next: 0, step: 0, started: false, track: 'menu', want: 'menu', bar: 0, combatUntil: 0, noise: null,
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { this.ctx = new AC(); } catch (e) { return false; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 1.8, buf = c.createBuffer(2, len, c.sampleRate); // kurzer Raumhall
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.rev = c.createConvolver(); this.rev.buffer = buf;
    const wet = c.createGain(); wet.gain.value = 0.32; this.rev.connect(wet); wet.connect(this.master);
    this.dry = c.createGain(); this.dry.gain.value = 0.8; this.dry.connect(this.master);
    this.send = c.createGain(); this.send.gain.value = 1; this.send.connect(this.rev);
    const nl = c.sampleRate * 0.5 | 0; this.noise = c.createBuffer(1, nl, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  },
  start() { // nach erster Nutzer-Interaktion
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
    this.started = true; this.apply();
    if (!this.timer) { this.next = this.ctx.currentTime + 0.2; this.step = 0; this.timer = setInterval(() => this.tick(), 60); }
  },
  level() { return (settings.musicOn && !settings.muted) ? 0.26 * settings.music : 0; },
  apply() {
    if (!this.ctx) return; const t = this.ctx.currentTime, v = this.level();
    this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v, t, v > 0 ? 0.6 : 0.3);
  },
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  kick(t, v) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); this.env(g, t, 0.004, 0.5 * v, 0.22); o.connect(g); g.connect(this.dry); o.start(t); o.stop(t + 0.3); },
  nz(t, type, f, q, peak, d, wet) { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; this.env(g, t, 0.002, peak, d); s.connect(fl); fl.connect(g); g.connect(this.dry); if (wet) g.connect(this.send); s.start(t, Math.random() * 0.3); s.stop(t + d + 0.05); },
  snare(t, v) { this.nz(t, 'bandpass', 1900, 0.8, 0.22 * v, 0.13, 1); const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06); this.env(g, t, 0.002, 0.12 * v, 0.07); o.connect(g); g.connect(this.dry); o.start(t); o.stop(t + 0.12); },
  hat(t, v, open) { this.nz(t, 'highpass', 7600, 0.7, 0.07 * v, open ? 0.12 : 0.035, 0); },
  bass(m, t, len, v) { const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'square'; o2.type = 'triangle'; o.frequency.value = o2.frequency.value = this.hz(m); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + len); f.Q.value = 3; this.env(g, t, 0.005, 0.12 * v, len); const g2 = c.createGain(); g2.gain.value = 0.35; o.connect(g2); g2.connect(f); o2.connect(f); f.connect(g); g.connect(this.dry); o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05); },
  lead(m, t, len, v, kind) { const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = kind === 'sq' ? 'square' : kind === 'sine' ? 'sine' : 'triangle'; o.frequency.value = this.hz(m); const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.5; vg.gain.value = 4; vib.connect(vg); vg.connect(o.detune); f.type = 'lowpass'; f.frequency.value = kind === 'sq' ? 2400 : 4000; this.env(g, t, 0.01, (kind === 'sq' ? 0.05 : 0.09) * v, len * 1.6); o.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.send); o.start(t); vib.start(t); o.stop(t + len * 1.7 + 0.05); vib.stop(t + len * 1.7 + 0.05); },
  stab(ms, t, v) { const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 1500; this.env(g, t, 0.004, 0.035 * v, 0.16); for (const m of ms) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(m); o.connect(f); o.start(t); o.stop(t + 0.25); } f.connect(g); g.connect(this.dry); g.connect(this.send); },
  pad(ms, t, d, v) { const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03 * v, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + d); for (const m of ms) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = this.hz(m); o.connect(f); o.start(t); o.stop(t + d + 0.1); } f.connect(g); g.connect(this.dry); g.connect(this.send); },
  deg(T, d) { const sc = SCALE[T.sc], o = Math.floor(d / 7); return T.key + sc[((d % 7) + 7) % 7] + 12 * o; },
  // Stimmung: Menü / Tag / Nacht / Kampf (Gegner nah am eigenen Buddler oder gerade getroffen)
  mood() {
    const w = G.world; if (!w) return 'menu';
    const me = G.myTeam >= 0 ? w.teams[G.myTeam] : null, c = me && w.clonks.find(o => o.id === me.sel && o.act !== 'dead'), now = performance.now();
    if (c) {
      const near = w.clonks.some(o => o.act !== 'dead' && !o.inside && !w.ally(o.team, c.team) && Math.abs(o.x - c.x) < 130 && Math.abs(o.y - c.y) < 60) || w.monsters.some(m => m.bite > 0 && Math.abs(m.x - c.x) < 90) || c.invT > 0;
      if (near) this.combatUntil = now + 9000;
    }
    if (now < this.combatUntil) return 'combat';
    return w.cfg.daynight !== false && w.daylight && w.daylight() < 0.35 ? 'night' : 'day';
  },
  tick() {
    if (!this.ctx) return;
    if (this.level() === 0) { this.next = Math.max(this.next, this.ctx.currentTime + 0.2); return; }
    const c = this.ctx, ahead = document.hidden ? 1.3 : 0.25;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05; // nach Pause/Hintergrund nicht nachholen
    this.want = this.mood();
    while (this.next < c.currentTime + ahead) {
      const s16 = this.step % 16;
      if (s16 === 0) { if (this.want !== this.track) { this.track = this.want; this.bar = 0; } else this.bar++; }
      const T = TRACKS[this.track], sd = 60 / T.bpm / 4, t = this.next + (s16 % 2 ? T.swing * sd * 2 : 0);
      const barIn4 = this.bar % 4, phrase = Math.floor(this.bar / 8) % 2, breakdown = this.bar % 16 === 15;
      const root = this.deg(T, T.chords[barIn4]), chord = [0, 2, 4].map(k => this.deg(T, T.chords[barIn4] + k));
      const v = this.track === 'night' ? 0.75 : 1;
      if (!breakdown) {
        if (T.kick[s16] === 'x') this.kick(t, v);
        if (T.snare[s16] === 'x') this.snare(t, this.track === 'night' ? 0.5 : 1);
        if (barIn4 === 3 && s16 >= 12 && this.track !== 'night' && (this.bar % 8 === 7)) this.snare(t, 0.55); // kleiner Fill
      }
      if (T.hat[s16] === 'x') this.hat(t, (s16 % 4 === 2 ? 1 : 0.6) * v, s16 === 14 && this.track === 'day');
      const b = T.bass[s16]; if (b >= 0 && !(breakdown && s16 > 0)) this.bass(root - 12 + b, t, sd * (T.bass[(s16 + 1) % 16] < 0 ? 1.8 : 0.9), v);
      if (s16 === 0) { if (T.stab) this.pad(chord.map(m => m), t, sd * 16, 0.7 * v); else this.pad(chord, t, sd * 16, 1); }
      if (T.stab && (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 14) && !breakdown) this.stab(chord.map(m => m + 12), t, v); // Offbeat-Tupfer
      if (s16 % 2 === 0 && this.bar >= 2) { // Melodie in Achteln, Motiv A/B im Wechsel, ab und zu eine Oktave höher
        const note = T.mel[phrase][barIn4][s16 / 2];
        if (note >= 0) { let len = sd * 2; let k = s16 / 2 + 1; while (k < 8 && T.mel[phrase][barIn4][k] < 0 && len < sd * 6) { len += sd * 2; k++; } this.lead(this.deg(T, note) + (this.bar % 32 >= 24 ? 12 : 0), t, len, v, T.lead); }
      }
      this.next += sd; this.step++;
    }
  }
};
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (!Music.started) Music.start(); }, { once: false, passive: true }));
