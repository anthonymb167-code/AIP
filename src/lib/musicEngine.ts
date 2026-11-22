import {
  DEFAULT_MUSIC_SPEC,
  type MusicBassStyle,
  type MusicDrumPattern,
  type MusicLeadInstrument,
  type MusicScaleMode,
  type MusicSpec,
} from "../types/kith";

const SCALE_INTERVALS: Record<MusicScaleMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function degreeToMidi(
  rootMidi: number,
  scale: number[],
  degree: number
): number {
  const len = scale.length;
  const octaves = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return rootMidi + octaves * 12 + scale[idx];
}

class BackgroundMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private spec: MusicSpec = DEFAULT_MUSIC_SPEC;
  private playing = false;
  private volume = 0.42; // 0..1
  private ducked = false;

  private schedulerTimer: number | null = null;
  private nextNoteTime = 0;
  private stepIndex = 0;
  private listeners = new Set<(playing: boolean) => void>();

  subscribe(fn: (playing: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emitState() {
    for (const fn of this.listeners) {
      fn(this.playing);
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  private ensureAudioGraph(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const musicBus = ctx.createGain();
      musicBus.gain.value = 1;

      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = "lowpass";
      masterFilter.frequency.value = 3200 + (this.spec.brightness / 100) * 4800;
      masterFilter.Q.value = 0.6;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 3.2;
      compressor.attack.value = 0.015;
      compressor.release.value = 0.18;

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.computeTargetGain();

      // Gentle stereo ambient delay network for warm studio space
      const delayL = ctx.createDelay(1.0);
      const delayR = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.23;
      delayR.delayTime.value = 0.34;

      const feedbackL = ctx.createGain();
      const feedbackR = ctx.createGain();
      feedbackL.gain.value = 0.24;
      feedbackR.gain.value = 0.22;

      const wetFilter = ctx.createBiquadFilter();
      wetFilter.type = "lowpass";
      wetFilter.frequency.value = 2100;

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.24;

      const merger = ctx.createChannelMerger(2);

      musicBus.connect(masterFilter);
      masterFilter.connect(compressor);
      compressor.connect(masterGain);

      // Wet send
      masterFilter.connect(wetFilter);
      wetFilter.connect(delayL);
      wetFilter.connect(delayR);
      delayL.connect(feedbackR);
      feedbackR.connect(delayR);
      delayR.connect(feedbackL);
      feedbackL.connect(delayL);
      delayL.connect(merger, 0, 0);
      delayR.connect(merger, 0, 1);
      merger.connect(wetGain);
      wetGain.connect(masterGain);

      masterGain.connect(ctx.destination);

      // Cached 1-second noise buffer for percussion & breath transients
      const sampleRate = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sampleRate, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;

      this.musicBus = musicBus;
      this.masterFilter = masterFilter;
      this.masterGain = masterGain;
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private computeTargetGain(): number {
    const base = Math.max(0, Math.min(1, this.volume)) * 0.42;
    return this.ducked ? base * 0.28 : base;
  }

  private refreshMasterGain() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.computeTargetGain(), now, 0.08);
  }

  setVolume(volumePercent: number) {
    this.volume = Math.max(0, Math.min(100, volumePercent)) / 100;
    this.refreshMasterGain();
  }

  setDucked(isDucked: boolean) {
    if (this.ducked === isDucked) return;
    this.ducked = isDucked;
    this.refreshMasterGain();
  }

  setSpec(nextSpec: MusicSpec) {
    this.spec = nextSpec;
    if (this.ctx && this.masterFilter) {
      this.masterFilter.frequency.setTargetAtTime(
        2400 + (nextSpec.brightness / 100) * 5600,
        this.ctx.currentTime,
        0.12
      );
    }
  }

  start(nextSpec?: MusicSpec) {
    if (nextSpec) {
      this.setSpec(nextSpec);
    }
    const ctx = this.ensureAudioGraph();
    if (!ctx) return;

    if (this.playing) {
      this.refreshMasterGain();
      return;
    }

    this.playing = true;
    this.stepIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.06;
    this.refreshMasterGain();
    this.emitState();

    this.schedulerTimer = window.setInterval(() => {
      this.scheduleAhead();
    }, 65);
  }

  stop() {
    this.playing = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    this.emitState();
  }

  private scheduleAhead() {
    if (!this.playing || !this.ctx || !this.musicBus) return;
    const lookahead = 0.22;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.stepIndex, this.nextNoteTime);
      const sixteenth = 60 / Math.max(45, Math.min(170, this.spec.bpm)) / 4;
      const swingFactor = (this.spec.swing || 0) / 100;
      const isOdd = this.stepIndex % 2 === 1;
      const stepDur = isOdd
        ? sixteenth * (1 - swingFactor * 0.45)
        : sixteenth * (1 + swingFactor * 0.45);
      this.nextNoteTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  private scheduleStep(step: number, time: number) {
    const scale = SCALE_INTERVALS[this.spec.scaleMode] || SCALE_INTERVALS.minor;
    const chords =
      this.spec.chords && this.spec.chords.length > 0 ? this.spec.chords : [0, 3, 4, 0];
    const melody =
      this.spec.melody && this.spec.melody.length > 0
        ? this.spec.melody
        : DEFAULT_MUSIC_SPEC.melody;

    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const chordDeg = chords[bar % chords.length];
    const sixteenthDur = 60 / Math.max(45, Math.min(170, this.spec.bpm)) / 4;

    // 1. Harmony / Chord Pad at start of each bar (or half-bar for upbeat pop/electronic)
    const chordTrigger =
      this.spec.genre === "pop" || this.spec.genre === "electronic"
        ? stepInBar === 0 || stepInBar === 8
        : stepInBar === 0;
    if (chordTrigger) {
      const chordDur =
        this.spec.genre === "pop" || this.spec.genre === "electronic"
          ? sixteenthDur * 7.5
          : sixteenthDur * 15.2;
      this.playChord(chordDeg, scale, time, chordDur);
    }

    // 2. Bassline
    this.playBassStep(this.spec.bassStyle, stepInBar, chordDeg, scale, time, sixteenthDur);

    // 3. Lead Melody
    const melDegree = melody[stepInBar % melody.length];
    if (melDegree >= 0) {
      const midi = degreeToMidi(this.spec.rootMidi + 12, scale, chordDeg + melDegree);
      const isHold = melody[(stepInBar + 1) % melody.length] === -1;
      const noteDur = isHold ? sixteenthDur * 2.2 : sixteenthDur * 1.25;
      this.playLeadNote(this.spec.leadInstrument, midi, time, noteDur);
    }

    // 4. Percussion / Drums
    this.playDrumStep(this.spec.drumPattern, stepInBar, time);
  }

  private playChord(chordDeg: number, scale: number[], time: number, dur: number) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const notes = [0, 2, 4, 6].slice(0, this.spec.genre === "rap" || this.spec.genre === "classic" ? 4 : 3);

    for (const offset of notes) {
      const midi = degreeToMidi(this.spec.rootMidi, scale, chordDeg + offset);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type =
        this.spec.leadInstrument === "strings" || this.spec.genre === "electronic"
          ? "sawtooth"
          : "triangle";
      osc.frequency.setValueAtTime(midiToFreq(midi), time);
      osc.detune.setValueAtTime((offset - 2) * 3.5, time);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(950 + (this.spec.brightness / 100) * 850, time);

      const peak = this.spec.leadInstrument === "strings" ? 0.055 : 0.045;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peak, time + Math.min(0.22, dur * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }
  }

  private playLeadNote(
    inst: MusicLeadInstrument,
    midi: number,
    time: number,
    dur: number
  ) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const freq = midiToFreq(midi);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = "lowpass";

    if (inst === "piano") {
      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 2, time);
      filter.frequency.setValueAtTime(2800, time);
      filter.frequency.exponentialRampToValueAtTime(700, time + dur);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.16, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.35, dur * 1.4));
    } else if (inst === "acoustic_guitar") {
      osc1.type = "triangle";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);
      filter.frequency.setValueAtTime(2600, time);
      filter.frequency.exponentialRampToValueAtTime(480, time + 0.28);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.14, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.32, dur * 1.2));
    } else if (inst === "synth_pluck") {
      osc1.type = "sawtooth";
      osc2.type = "square";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.004, time);
      filter.Q.value = 3.2;
      filter.frequency.setValueAtTime(3400, time);
      filter.frequency.exponentialRampToValueAtTime(520, time + 0.24);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.11, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.26, dur));
    } else if (inst === "flute") {
      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 2, time);
      filter.frequency.setValueAtTime(2100, time);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.13, time + 0.075);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.35, dur * 1.25));
    } else {
      // strings / warm_pad
      osc1.type = "sawtooth";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 0.996, time);
      filter.frequency.setValueAtTime(1600, time);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.09, time + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.45, dur * 1.3));
    }

    const subGain = ctx.createGain();
    subGain.gain.value = inst === "flute" || inst === "piano" ? 0.22 : 0.45;

    osc1.connect(filter);
    osc2.connect(subGain);
    subGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);

    const stopAt = time + Math.max(0.4, dur * 1.5);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(stopAt);
    osc2.stop(stopAt);
  }

  private playBassStep(
    style: MusicBassStyle,
    stepInBar: number,
    chordDeg: number,
    scale: number[],
    time: number,
    sixteenth: number
  ) {
    if (style === "none" || !this.ctx || !this.musicBus) return;
    const ctx = this.ctx;

    let trigger = false;
    let degreeOffset = 0;
    let dur = sixteenth * 3.5;

    if (style === "cello_drone") {
      trigger = stepInBar === 0;
      dur = sixteenth * 15;
    } else if (style === "sub_808") {
      trigger = stepInBar === 0 || stepInBar === 6 || stepInBar === 10;
      dur = sixteenth * 4.5;
    } else if (style === "synth_pulse") {
      trigger = stepInBar % 2 === 0;
      degreeOffset = stepInBar % 4 === 2 ? 4 : 0;
      dur = sixteenth * 1.6;
    } else if (style === "country_root_fifth") {
      trigger = stepInBar === 0 || stepInBar === 8;
      degreeOffset = stepInBar === 8 ? 4 : 0;
      dur = sixteenth * 5.5;
    } else if (style === "walking_bass") {
      trigger = stepInBar % 4 === 0;
      degreeOffset = (stepInBar / 4) % 4;
      dur = sixteenth * 3.5;
    }

    if (!trigger) return;

    const midi = degreeToMidi(this.spec.rootMidi - 12, scale, chordDeg + degreeOffset);
    const freq = midiToFreq(midi);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = style === "sub_808" ? "sine" : style === "synth_pulse" ? "sawtooth" : "triangle";
    if (style === "sub_808") {
      osc.frequency.setValueAtTime(freq * 1.4, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.06);
    } else {
      osc.frequency.setValueAtTime(freq, time);
    }

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(style === "synth_pulse" ? 560 : 340, time);

    const peak = style === "sub_808" ? 0.24 : 0.16;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private playDrumStep(pattern: MusicDrumPattern, step: number, time: number) {
    if (pattern === "none" || !this.ctx || !this.musicBus) return;

    if (pattern === "boom_bap") {
      if (step === 0 || step === 7 || step === 10) this.triggerKick(time, 0.24);
      if (step === 4 || step === 12) this.triggerSnare(time, 0.12);
      if (step % 2 === 0) this.triggerHat(time, step % 4 === 2 ? 0.05 : 0.03);
    } else if (pattern === "pop_groove") {
      if (step % 4 === 0) this.triggerKick(time, 0.22);
      if (step === 4 || step === 12) this.triggerSnare(time, 0.11);
      if (step % 2 === 1) this.triggerHat(time, 0.045);
    } else if (pattern === "country_brush") {
      if (step === 0 || step === 8) this.triggerKick(time, 0.14);
      if (step % 4 === 2) this.triggerHat(time, 0.045);
      if (step === 4 || step === 12) this.triggerSnare(time, 0.055);
    } else if (pattern === "electronic_pulse") {
      if (step % 4 === 0) this.triggerKick(time, 0.24);
      if (step === 4 || step === 12) this.triggerSnare(time, 0.1);
      if (step % 2 === 0) this.triggerHat(time, 0.04);
    } else if (pattern === "soft_ambient") {
      if (step === 0 || step === 8) this.triggerHat(time, 0.022);
    }
  }

  private triggerKick(time: number, level: number) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(125, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private triggerSnare(time: number, level: number) {
    if (!this.ctx || !this.musicBus || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1750, time);
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    noise.start(time);
    noise.stop(time + 0.16);
  }

  private triggerHat(time: number, level: number) {
    if (!this.ctx || !this.musicBus || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(6400, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    noise.start(time);
    noise.stop(time + 0.07);
  }
}

export const musicEngine = new BackgroundMusicEngine();
