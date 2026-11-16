// Synthesised SFX via WebAudio — no audio files, no network.
let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noiseBurst(dur, freq, gain, type = 'lowpass') {
  const c = ac(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start();
}
function tone(freq, dur, gain, type = 'square', slideTo = null) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  const g = c.createGain(); g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
}
export const sfx = {
  shot(kind) {
    if (kind === 'lr90') { noiseBurst(0.22, 900, 0.5); tone(140, 0.18, 0.25, 'sawtooth', 60); }
    else if (kind === 's12') { noiseBurst(0.18, 1400, 0.45); }
    else if (kind === 'vk47') { noiseBurst(0.09, 2200, 0.32); }
    else { noiseBurst(0.07, 3000, 0.25); }
  },
  hit() { tone(1200, 0.06, 0.12, 'square'); },
  kill() { tone(660, 0.08, 0.15, 'square'); setTimeout(() => tone(990, 0.1, 0.15, 'square'), 70); },
  hurt() { tone(180, 0.12, 0.2, 'sawtooth', 90); },
  reload() { tone(500, 0.05, 0.1, 'square'); setTimeout(() => tone(700, 0.05, 0.1, 'square'), 120); },
  buy() { tone(880, 0.07, 0.12, 'sine'); setTimeout(() => tone(1320, 0.09, 0.12, 'sine'), 80); },
  denied() { tone(220, 0.15, 0.15, 'square', 160); },
  horn(win) { tone(win ? 523 : 392, 0.35, 0.2, 'sawtooth'); setTimeout(() => tone(win ? 784 : 523, 0.4, 0.2, 'sawtooth'), 200); },
  click() { tone(600, 0.04, 0.08, 'square'); },
};
