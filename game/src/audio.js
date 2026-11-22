// Procedural sound for THE BRASS CROW (WebAudio, no audio files).
// Footsteps tell you where a guard is: their volume falls with distance
// and their pan follows the guard's side. Everything is lazy and guarded,
// so a browser without audio still plays silently.
export function createAudio() {
  const audio = {
    ctx: null, muted: false,
    ensure() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
        return;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio.ctx = new Ctx();
      } catch {
        audio.ctx = null;
      }
    },
    tone(freq, dur, type, gain, when = 0, slideTo = null) {
      if (!audio.ctx || audio.muted) return;
      try {
        const t0 = audio.ctx.currentTime + when;
        const osc = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(audio.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      } catch { /* sound is decoration, never a crash */ }
    },
    noise(dur, freq, gain, pan = 0) {
      if (!audio.ctx || audio.muted) return;
      try {
        const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
        const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        const g = audio.ctx.createGain();
        g.gain.value = gain;
        const panner = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : null;
        if (panner) {
          panner.pan.value = Math.max(-1, Math.min(1, pan));
          src.connect(filter).connect(g).connect(panner).connect(audio.ctx.destination);
        } else {
          src.connect(filter).connect(g).connect(audio.ctx.destination);
        }
        src.start();
      } catch { /* sound is decoration, never a crash */ }
    },
    pickup() { audio.tone(880, 0.12, 'sine', 0.12); audio.tone(1320, 0.18, 'sine', 0.1, 0.07); },
    seal() { [523, 659, 784, 1046].forEach((f, i) => audio.tone(f, 0.2, 'triangle', 0.12, i * 0.08)); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => audio.tone(f, 0.25, 'triangle', 0.12, i * 0.09)); },
    caught() { audio.tone(220, 0.4, 'sawtooth', 0.15, 0, 110); },
    alertSting() { audio.tone(660, 0.15, 'square', 0.08); audio.tone(440, 0.2, 'square', 0.08, 0.15); },
    coinClink() { audio.tone(2093, 0.08, 'sine', 0.1); audio.tone(1568, 0.12, 'sine', 0.08, 0.06); },
    smokeHiss() { audio.noise(0.5, 3000, 0.08); },
    douse() { audio.noise(0.25, 800, 0.1); },
    playerStep(sneaking) { audio.noise(0.06, sneaking ? 500 : 900, sneaking ? 0.03 : 0.06); },
    guardStep(pan, dist) {
      const gain = Math.max(0.01, 0.14 * (1 - dist / 420));
      audio.noise(0.07, 700, gain, pan);
    },
  };
  return audio;
}
