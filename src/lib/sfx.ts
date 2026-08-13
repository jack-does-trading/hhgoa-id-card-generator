// Synthesized UI sound — oscillators and noise buffers only, zero audio
// assets to ship or license. Each cue is a few dozen milliseconds; the point
// is tactility (something physically happened), not music, so everything is
// mixed well under the background track.

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (muted) return null;
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers park the context until a gesture touches it; every cue here is
  // gesture-triggered, so a resume attempt is always legal.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSfxMuted(value: boolean) {
  muted = value;
}

/** Short burst of white noise through a band-pass — the basis of the
 *  mechanical cues (shutter, foil rustle). */
function noise(
  duration: number,
  freq: number,
  q: number,
  gain: number,
  type: BiquadFilterType = "bandpass"
) {
  const a = ac();
  if (!a) return;
  const frames = Math.floor(a.sampleRate * duration);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = a.createBufferSource();
  src.buffer = buffer;

  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;

  const amp = a.createGain();
  amp.gain.setValueAtTime(gain, a.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration);

  src.connect(filter).connect(amp).connect(a.destination);
  src.start();
  src.stop(a.currentTime + duration);
}

function tone(
  freq: number,
  endFreq: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine"
) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(1, endFreq),
    a.currentTime + duration
  );

  const amp = a.createGain();
  amp.gain.setValueAtTime(gain, a.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration);

  osc.connect(amp).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + duration);
}

/** Camera shutter — two clacks, mirror up then down. */
export function sfxShutter() {
  noise(0.035, 2600, 1.2, 0.28);
  setTimeout(() => noise(0.055, 1500, 1.0, 0.22), 85);
}

/** The pink title sticker landing: a low thud with a papery slap on top. */
export function sfxStamp() {
  tone(180, 42, 0.18, 0.32);
  noise(0.05, 900, 0.7, 0.2);
}

/** Foil rustle for the card flip — a filtered noise sweep. */
export function sfxFlip() {
  noise(0.22, 3200, 0.6, 0.11, "highpass");
  tone(520, 900, 0.12, 0.05, "triangle");
}

/** Soft confirmation blip for format switching / downloads. */
export function sfxTick() {
  tone(880, 1320, 0.06, 0.07, "square");
}
