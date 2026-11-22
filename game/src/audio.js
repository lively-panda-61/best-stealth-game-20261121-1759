// Procedural sound for SHADOW PROTOCOL — WebAudio only, no audio assets.
// Footsteps tell you where a guard is (panned by direction, quieter with
// distance); a rising sting marks detection, a chime marks a core pickup.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    stepCount: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') void audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch {
      audio.ctx = null;
    }
  };

  function tone(freq, dur, type, gainValue, when = 0, slideTo = null) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainValue, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, gainValue, pan, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.value = gainValue;
    const panner = audio.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(audio.master);
    source.start(t0);
  }

  // A guard's footstep: pan -1 (left) .. 1 (right) by relative x, volume by distance.
  audio.guardStep = (pan, distancePx) => {
    const volume = Math.max(0, 0.22 * (1 - distancePx / 420));
    if (volume <= 0.01) return;
    noiseBurst(0.07, volume, pan, 500);
  };

  audio.playerStep = (sneaking) => {
    noiseBurst(0.05, sneaking ? 0.03 : 0.09, 0, 700);
  };

  audio.pickup = () => {
    tone(880, 0.12, 'sine', 0.18);
    tone(1318, 0.18, 'sine', 0.15, 0.07);
  };

  audio.alertSting = () => {
    tone(220, 0.35, 'sawtooth', 0.12, 0, 440);
    tone(233, 0.35, 'sawtooth', 0.1, 0.05, 466);
  };

  audio.caught = () => {
    tone(196, 0.5, 'sawtooth', 0.16, 0, 98);
    tone(147, 0.7, 'sawtooth', 0.14, 0.15, 73);
  };

  audio.win = () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.11));
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    return audio.muted;
  };

  return audio;
}
