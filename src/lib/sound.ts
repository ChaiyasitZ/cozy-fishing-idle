/**
 * Tiny WebAudio kit — every sound is synthesised, so the game ships with no
 * audio assets and still feels alive. Created lazily on the first gesture
 * because browsers refuse to start an AudioContext before one.
 */
type Cue = "cast" | "bite" | "catch" | "big" | "miss" | "coin" | "level" | "tap";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicNodes: { stop: () => void } | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
  return ctx;
}

function blip(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.5,
  slideTo?: number,
) {
  const audio = ensureContext();
  if (!audio || !master) return;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, slideTo),
      audio.currentTime + duration,
    );
  }
  env.gain.value = 0;
  env.gain.linearRampToValueAtTime(gain, audio.currentTime + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(env).connect(master);
  osc.start();
  osc.stop(audio.currentTime + duration + 0.02);
}

function splash() {
  const audio = ensureContext();
  if (!audio || !master) return;
  const length = Math.floor(audio.sampleRate * 0.35);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const decay = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * decay * decay * 0.6;
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  source.buffer = buffer;
  source.connect(filter).connect(master);
  source.start();
}

export function playCue(cue: Cue, enabled = true): void {
  if (!enabled) return;
  switch (cue) {
    case "cast":
      splash();
      blip(520, 0.16, "triangle", 0.22, 900);
      break;
    case "bite":
      blip(880, 0.09, "square", 0.18);
      setTimeout(() => blip(1180, 0.09, "square", 0.16), 90);
      break;
    case "tap":
      blip(660, 0.06, "triangle", 0.2);
      break;
    case "catch":
      blip(784, 0.14, "sine", 0.3);
      setTimeout(() => blip(1046, 0.22, "sine", 0.28), 110);
      break;
    case "big":
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => blip(f, 0.26, "sine", 0.3), i * 105),
      );
      break;
    case "coin":
      blip(1320, 0.07, "square", 0.16);
      setTimeout(() => blip(1760, 0.09, "square", 0.14), 60);
      break;
    case "level":
      [659, 880, 1174].forEach((f, i) =>
        setTimeout(() => blip(f, 0.3, "triangle", 0.26), i * 120),
      );
      break;
    case "miss":
      blip(220, 0.24, "sine", 0.22, 120);
      break;
  }
}

/** A slow two-oscillator pad. Deliberately dull — it should fade into the room. */
export function startMusic(): void {
  const audio = ensureContext();
  if (!audio || !master || musicNodes) return;

  const gain = audio.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.055, audio.currentTime + 3);
  gain.connect(master);

  const oscA = audio.createOscillator();
  const oscB = audio.createOscillator();
  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();

  oscA.type = "sine";
  oscA.frequency.value = 174.6;
  oscB.type = "sine";
  oscB.frequency.value = 261.6;
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 5;

  lfo.connect(lfoGain).connect(oscB.frequency);
  oscA.connect(gain);
  oscB.connect(gain);
  oscA.start();
  oscB.start();
  lfo.start();

  musicNodes = {
    stop: () => {
      const now = audio.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      setTimeout(() => {
        oscA.stop();
        oscB.stop();
        lfo.stop();
      }, 1400);
    },
  };
}

export function stopMusic(): void {
  musicNodes?.stop();
  musicNodes = null;
}

export function resumeAudio(): void {
  const audio = ensureContext();
  if (audio?.state === "suspended") void audio.resume();
}
