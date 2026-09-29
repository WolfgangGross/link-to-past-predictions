// All sound is synthesised with Web Audio: no asset files. `sfx` are one-shots, `music` is a tiny
// step sequencer (one 4-bar loop per map), `ambience` is rain/thunder behind the flat's window.
// The AudioContext is created on the first key press (browsers refuse earlier); calls before that are remembered.

type Bus = GainNode;

let ctx: AudioContext | undefined;
let master: Bus;
let sfxBus: Bus;
let musicBus: Bus;
let noiseBuf: AudioBuffer;
let muted = false;
try {
  muted = localStorage.getItem("muted") === "1";
} catch {
  // storage blocked: start with sound on
}

/** Called after M toggles the mute; the UI shows a toast. */
export const audioHooks = { onMute: (_muted: boolean) => {} };

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

function note(name: string): number {
  const m = /^([a-g])(#?)(\d)$/.exec(name)!;
  return 12 * (Number(m[3]) + 1) + { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1] as "c"] + (m[2] ? 1 : 0);
}

interface ToneOpts {
  f: number;
  /** Slide to this frequency over the note. */
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number;
  bus?: Bus;
}

function tone({ f, to, dur, type = "square", vol = 0.2, at, bus }: ToneOpts): void {
  if (!ctx) return;
  const t = at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus ?? sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(o: { dur: number; vol?: number; at?: number; filter?: BiquadFilterType; freq?: number; bus?: Bus }): void {
  if (!ctx) return;
  const t = o.at ?? ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loopStart = Math.random();
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? "lowpass";
  f.frequency.value = o.freq ?? 1000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(o.bus ?? sfxBus);
  src.start(t, Math.random());
  src.stop(t + o.dur + 0.02);
}

const jingle = (notes: string[], gap: number, o: Partial<ToneOpts> = {}) =>
  notes.forEach((n, i) => tone({ f: mtof(note(n)), dur: gap * 2.2, at: ctx!.currentTime + i * gap, ...o }));

export const sfx = {
  /** One typewriter blip; call for every other character. */
  blip: () => tone({ f: 480 + Math.random() * 140, dur: 0.035, vol: 0.05 }),
  /** Advance a line, pick a menu entry. */
  select: () => jingle(["e5", "b5"], 0.05, { vol: 0.09 }),
  move: () => tone({ f: 330, dur: 0.04, type: "triangle", vol: 0.16 }),
  step: () => noise({ dur: 0.05, vol: 0.06 + Math.random() * 0.02, freq: 350 + Math.random() * 250 }),
  door: () => {
    noise({ dur: 0.35, vol: 0.14, filter: "bandpass", freq: 900 });
    tone({ f: 260, to: 90, dur: 0.3, type: "triangle", vol: 0.16 });
  },
  phoneOpen: () => tone({ f: 420, to: 980, dur: 0.14, vol: 0.09 }),
  phoneClose: () => tone({ f: 900, to: 380, dur: 0.14, vol: 0.09 }),
  tick: () => tone({ f: 760, dur: 0.02, vol: 0.09 }),
  /** The phone is asking TabPFN; a soft two-note bloop while it waits. */
  think: (i: number) => tone({ f: mtof(i % 2 ? 76 : 71), dur: 0.12, type: "sine", vol: 0.13 }),
  /** A prediction arrived. */
  result: () => jingle(["c5", "e5", "g5", "c6"], 0.07, { vol: 0.09, type: "triangle" }),
  /** A sealed guess is revealed. */
  ping: () => jingle(["b5", "e6"], 0.09, { vol: 0.08, type: "sine" }),
  /** The Judgment Card: who bears the cost. */
  card: () => {
    tone({ f: mtof(48), dur: 0.5, type: "triangle", vol: 0.2 });
    jingle(["g5", "d6"], 0.11, { vol: 0.08, type: "triangle" });
  },
  item: () => jingle(["g4", "c5", "e5", "g5", "c6", "e6"], 0.075, { vol: 0.1, type: "square" }),
  page: () => noise({ dur: 0.09, vol: 0.09, filter: "highpass", freq: 2500 }),
  key: () => noise({ dur: 0.02, vol: 0.05, filter: "highpass", freq: 3000 + Math.random() * 1500 }),
  win: () => jingle(["c5", "e5", "g5", "c6", "e6", "g6"], 0.08, { vol: 0.1, type: "triangle" }),
};

// ---- music -------------------------------------------------------------------
// Synthwave: detuned saw pads and leads, a filtered pulsing bass, a dotted-eighth delay, gated drums.

interface Track {
  bpm: number;
  /** One chord (MIDI notes) per bar; the pad holds it, the bass plays its root, the arpeggio walks through it. */
  chords: [number[], number[], number[], number[]];
  /** 32 eighth-note steps: a note name starts a note, "-" holds it, "." is a rest. */
  lead: string;
  bass: "eighth" | "drive";
  drums: "none" | "beat";
  arp: number;
  vol?: number;
}

const TRACKS: Record<string, Track> = {
  // i - VI - III - VII, floating.
  title: {
    bpm: 96,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    lead: "e6 - - - c6 - a5 - a5 - - - c6 - f6 - e6 - - - g6 - e6 - d6 - b5 - g5 - b5 d6",
    bass: "eighth",
    drums: "none",
    arp: 0.8,
  },
  // A slow, warm morning.
  home: {
    bpm: 84,
    chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
    lead: "a5 - - - - - f5 - d6 - - - c6 - a5 - c6 - - - a5 - - - g5 - e5 - g5 - - -",
    bass: "eighth",
    drums: "none",
    arp: 0.7,
    vol: 0.9,
  },
  // Night drive to the school gate.
  street: {
    bpm: 108,
    chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]],
    lead: "b5 - e6 - g6 - e6 - g6 - e6 - c6 - e6 - d6 - g6 - b6 - g6 - a6 - f#6 - d6 - a5 -",
    bass: "drive",
    drums: "beat",
    arp: 1,
  },
  // Cold and pulsing: the numbers are in.
  office: {
    bpm: 100,
    chords: [[48, 51, 55], [44, 48, 51], [51, 55, 58], [46, 50, 53]],
    lead: "g5 - - g5 - c6 - d#6 c6 - - - g#5 - c6 - g5 - - - a#5 - d#6 - f6 - d6 - a#5 - d6 -",
    bass: "drive",
    drums: "beat",
    arp: 1.1,
    vol: 0.95,
  },
  // Open air, the big match.
  field: {
    bpm: 118,
    chords: [[59, 62, 66], [55, 59, 62], [50, 54, 57], [57, 61, 64]],
    lead: "f#6 - - b6 - a6 - f#6 g6 - - b6 - d7 - b6 a6 - f#6 - d6 - f#6 a6 e6 - c#6 - a5 - c#6 e6",
    bass: "drive",
    drums: "beat",
    arp: 1,
    vol: 0.95,
  },
  // Slow and quiet: the day's report.
  evening: {
    bpm: 72,
    chords: [[53, 57, 60], [57, 60, 64], [50, 53, 57], [48, 52, 55]],
    lead: "c6 - - - a5 - - - e6 - - - c6 - - - d6 - - - f6 - a5 - g5 - - - e6 - - -",
    bass: "eighth",
    drums: "none",
    arp: 0.6,
    vol: 0.9,
  },
};

interface Playing {
  def: Track;
  gain: Bus;
  /** Feeds the shared delay. */
  send: Bus;
  lead: Map<number, { midi: number; len: number }>;
  step: number;
  next: number;
}

let wanted: string | undefined;
let cur: Playing | undefined;
let delay: DelayNode;

interface SynthOpts {
  midi: number;
  dur: number;
  at: number;
  p: Playing;
  type?: OscillatorType;
  /** Detune in cents for each stacked voice. */
  detune?: number[];
  vol: number;
  /** Lowpass cutoff at the start and end of the note. */
  cutoff: [number, number];
  attack?: number;
  wet?: number;
}

/** A stack of detuned oscillators through a lowpass whose cutoff sweeps over the note. */
function synth(o: SynthOpts): void {
  if (!ctx) return;
  const { at: t, dur } = o;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(o.cutoff[0], t);
  filter.frequency.exponentialRampToValueAtTime(o.cutoff[1], t + dur);
  const g = ctx.createGain();
  const attack = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + attack);
  g.gain.setValueAtTime(o.vol, t + Math.max(attack, dur - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  filter.connect(g);
  g.connect(o.p.gain);
  if (o.wet) {
    const w = ctx.createGain();
    w.gain.value = o.wet;
    g.connect(w).connect(o.p.send);
  }
  const detunes = o.detune ?? [0];
  for (const d of detunes) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sawtooth";
    osc.frequency.value = mtof(o.midi);
    osc.detune.value = d;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }
}

function startTrack(): void {
  if (!ctx) return;
  if (cur) {
    const old = cur;
    old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => {
      old.gain.disconnect();
      old.send.disconnect();
    }, 2500);
    cur = undefined;
  }
  const def = wanted ? TRACKS[wanted] : undefined;
  if (!def) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(def.vol ?? 1, ctx.currentTime + 1);
  gain.connect(musicBus);
  const send = ctx.createGain();
  send.connect(delay);
  delay.delayTime.setValueAtTime(45 / def.bpm, ctx.currentTime); // dotted eighth
  const lead = new Map<number, { midi: number; len: number }>();
  const tokens = def.lead.trim().split(/\s+/);
  tokens.forEach((tok, i) => {
    if (tok === "." || tok === "-") return;
    let len = 1;
    while (tokens[i + len] === "-") len++;
    lead.set(i, { midi: note(tok), len });
  });
  cur = { def, gain, send, lead, step: 0, next: ctx.currentTime + 0.1 };
}

/** One sixteenth note; 64 of them make the four-bar loop. */
function playStep(p: Playing, t: number): void {
  const { def, step } = p;
  const sixteenth = 15 / def.bpm;
  const bar = Math.floor(step / 16) % 4;
  const inBar = step % 16;
  const chord = def.chords[bar];
  let root = chord[0];
  while (root > 47) root -= 12;
  while (root < 40) root += 12;

  // Pad: the whole chord, swelling in once per bar.
  if (inBar === 0) {
    for (const m of chord) synth({ midi: m, dur: sixteenth * 16, at: t, p, detune: [-9, 9], vol: 0.035, cutoff: [500, 1600], attack: 0.5, wet: 0.2 });
  }

  // Lead: a supersaw, on the eighth-note grid.
  const lead = inBar % 2 === 0 ? p.lead.get(step / 2) : undefined;
  if (lead) {
    synth({ midi: lead.midi, dur: lead.len * sixteenth * 2 * 0.97, at: t, p, detune: [-12, 0, 12], vol: 0.075, cutoff: [3800, 1800], attack: 0.015, wet: 0.45 });
  }

  // Bass: pumping eighths, or a driving sixteenth line with the octave on the off-beats.
  if (def.bass === "drive") {
    const up = inBar % 4 === 2 ? 12 : 0;
    synth({ midi: root + up, dur: sixteenth * 0.9, at: t, p, vol: inBar % 4 === 0 ? 0.3 : 0.22, cutoff: [900, 260] });
  } else if (inBar % 2 === 0) {
    synth({ midi: root, dur: sixteenth * 1.9, at: t, p, vol: 0.28, cutoff: [700, 260] });
  }

  // Arpeggio: sixteenths through the chord, echoing.
  const seq = [0, 1, 2, 3, 2, 1, 2, 1];
  const idx = seq[inBar % 8];
  const arpMidi = idx === 3 ? chord[0] + 24 : chord[idx] + 12;
  synth({ midi: arpMidi, dur: sixteenth * 0.8, at: t, p, type: "square", vol: 0.028 * def.arp, cutoff: [3200, 900], wet: 0.5 });

  if (def.drums === "beat") {
    if (inBar % 4 === 0) tone({ f: 150, to: 42, dur: 0.16, type: "sine", vol: 0.75, at: t, bus: p.gain });
    if (inBar === 4 || inBar === 12) {
      noise({ dur: 0.2, vol: 0.32, at: t, filter: "bandpass", freq: 1900, bus: p.gain });
      tone({ f: 200, to: 120, dur: 0.1, type: "triangle", vol: 0.25, at: t, bus: p.gain });
    }
    if (inBar % 2 === 0) noise({ dur: inBar % 4 === 2 ? 0.1 : 0.035, vol: inBar % 4 === 2 ? 0.14 : 0.07, at: t, filter: "highpass", freq: 7500, bus: p.gain });
  }
}

function schedule(): void {
  if (!ctx || ctx.state !== "running" || !cur) return;
  cur.next = Math.max(cur.next, ctx.currentTime + 0.03);
  while (cur.next < ctx.currentTime + 0.3) {
    playStep(cur, cur.next);
    cur.next += 15 / cur.def.bpm;
    cur.step = (cur.step + 1) % 64;
  }
}

export const music = {
  /** A track name (title, home, street, office, field, evening) or undefined for silence. */
  play(name: string | undefined): void {
    if (name === wanted) return;
    wanted = name;
    startTrack();
  },
};

// ---- ambience ----------------------------------------------------------------

let rain: { src: AudioBufferSourceNode; gain: GainNode } | undefined;
let thunderTimer: ReturnType<typeof setTimeout> | undefined;
let wantedSky: string | undefined;

function applyAmbience(): void {
  if (!ctx) return;
  const on = wantedSky === "rain" || wantedSky === "thunder";
  if (on && !rain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400; // heard through a window
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(sfxBus);
    src.start();
    rain = { src, gain };
  }
  if (rain) rain.gain.gain.setTargetAtTime(on ? (wantedSky === "thunder" ? 0.09 : 0.05) : 0, ctx.currentTime, 0.4);
  clearTimeout(thunderTimer);
  if (wantedSky === "thunder") {
    const roll = () => {
      noise({ dur: 1.6, vol: 0.5, freq: 160 });
      tone({ f: 70, to: 35, dur: 1.2, type: "sawtooth", vol: 0.12 });
      thunderTimer = setTimeout(roll, 3200);
    };
    thunderTimer = setTimeout(roll, 400);
  }
}

export const ambience = {
  /** The sky outside the flat's window; only rain and thunder make a sound. */
  set(sky: string | undefined): void {
    if (sky === wantedSky) return;
    wantedSky = sky;
    applyAmbience();
  },
};

// ---- setup -------------------------------------------------------------------

function unlock(): void {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.35;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
    delay = ctx.createDelay(1);
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2600;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    delay.connect(echoTone);
    echoTone.connect(feedback).connect(delay);
    echoTone.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    setInterval(schedule, 60);
    startTrack();
    applyAmbience();
  }
  if (ctx.state !== "running") void ctx.resume();
}

window.addEventListener("keydown", (e) => {
  unlock();
  if (e.code !== "KeyM" || e.repeat) return;
  muted = !muted;
  try {
    localStorage.setItem("muted", muted ? "1" : "0");
  } catch {
    // storage blocked: the choice lasts for this visit
  }
  master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx!.currentTime, 0.05);
  audioHooks.onMute(muted);
});
window.addEventListener("pointerdown", unlock);

/** Every sfx is a no-op until the first key press has created the context. */
for (const key of Object.keys(sfx) as (keyof typeof sfx)[]) {
  const fn = sfx[key] as (...a: never[]) => void;
  (sfx[key] as unknown) = (...a: never[]) => {
    if (ctx && ctx.state === "running") fn(...a);
  };
}
