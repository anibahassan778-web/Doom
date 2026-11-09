/**
 * DOOM Web Audio Music Synthesizer & MUS Sequencer.
 * Implements real-time synthesis for DOOM's authentic MUS format (and MIDI)
 * using Web Audio oscillators, FM synthesis, and procedural percussion.
 */

export interface MusEvent {
  timeSec: number;
  type: 'noteOn' | 'noteOff' | 'program' | 'volume' | 'pan' | 'pitch' | 'allOff';
  channel: number;
  note?: number;
  velocity?: number;
  program?: number;
  value?: number;
}

export interface MusSequence {
  durationSec: number;
  events: MusEvent[];
}

export function parseMusData(data: Uint8Array): MusSequence | null {
  if (data.byteLength < 16) return null;

  // Check magic "MUS\x1A"
  const isMus =
    data[0] === 0x4d && data[1] === 0x55 && data[2] === 0x53 && data[3] === 0x1a;

  if (!isMus) {
    // If it's a Standard MIDI File ("MThd")
    const isMidi =
      data[0] === 0x4d && data[1] === 0x54 && data[2] === 0x68 && data[3] === 0x64;
    if (isMidi) {
      return parseMidiData(data);
    }
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const scoreLen = view.getUint16(4, true);
  const scoreStart = view.getUint16(6, true);

  let offset = scoreStart;
  const end = Math.min(data.byteLength, scoreStart + scoreLen);
  let currentTick = 0;
  const events: MusEvent[] = [];
  const channelVolume = new Array<number>(16).fill(100);

  while (offset < end) {
    const desc = data[offset++];
    const last = (desc & 0x80) !== 0;
    const type = (desc >> 4) & 0x07;
    const chan = desc & 0x0f;
    const timeSec = currentTick / 140.0;

    if (type === 0) {
      // Release note
      if (offset >= end) break;
      const note = data[offset++];
      events.push({
        timeSec,
        type: 'noteOff',
        channel: chan,
        note,
      });
    } else if (type === 1) {
      // Play note
      if (offset >= end) break;
      const noteByte = data[offset++];
      const hasVol = (noteByte & 0x80) !== 0;
      const note = noteByte & 0x7f;
      if (hasVol) {
        if (offset >= end) break;
        channelVolume[chan] = data[offset++];
      }
      events.push({
        timeSec,
        type: 'noteOn',
        channel: chan,
        note,
        velocity: channelVolume[chan],
      });
    } else if (type === 2) {
      // Pitch wheel
      if (offset >= end) break;
      const val = data[offset++];
      events.push({
        timeSec,
        type: 'pitch',
        channel: chan,
        value: (val - 128) / 128,
      });
    } else if (type === 3) {
      // System event
      if (offset >= end) break;
      const ctrl = data[offset++];
      if (ctrl === 10 || ctrl === 11 || ctrl === 14) {
        events.push({
          timeSec,
          type: 'allOff',
          channel: chan,
        });
      }
    } else if (type === 4) {
      // Change controller
      if (offset + 1 >= end) break;
      const ctrl = data[offset++];
      const val = data[offset++];
      if (ctrl === 0) {
        // MUS ctrl 0 = Program Change
        events.push({
          timeSec,
          type: 'program',
          channel: chan,
          program: val,
        });
      } else if (ctrl === 3) {
        // Volume
        channelVolume[chan] = val;
        events.push({
          timeSec,
          type: 'volume',
          channel: chan,
          value: val / 127,
        });
      } else if (ctrl === 4) {
        // Pan
        events.push({
          timeSec,
          type: 'pan',
          channel: chan,
          value: (val - 64) / 64,
        });
      }
    } else if (type === 5) {
      // Score end
      break;
    }

    if (last) {
      let delay = 0;
      while (offset < end) {
        const b = data[offset++];
        delay = delay * 128 + (b & 0x7f);
        if ((b & 0x80) === 0) break;
      }
      currentTick += delay;
    }
  }

  const durationSec = Math.max(0.1, currentTick / 140.0);
  return { durationSec, events };
}

function parseMidiData(data: Uint8Array): MusSequence | null {
  const events: MusEvent[] = [];
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const division = view.getUint16(12, false);
    const ticksPerQuarter = (division & 0x8000) === 0 ? division : 120;
    let tempoUsPerBeat = 500000; // default 120 bpm

    let offset = 14;
    const tracks: { offset: number; end: number }[] = [];
    while (offset + 8 <= data.byteLength) {
      const chunkLen = view.getUint32(offset + 4, false);
      const isTrk =
        data[offset] === 0x4d &&
        data[offset + 1] === 0x54 &&
        data[offset + 2] === 0x72 &&
        data[offset + 3] === 0x6b;
      if (isTrk) {
        tracks.push({ offset: offset + 8, end: offset + 8 + chunkLen });
      }
      offset += 8 + chunkLen;
    }

    let maxTimeSec = 0;
    for (const trk of tracks) {
      let pos = trk.offset;
      let runningStatus = 0;
      let tick = 0;

      while (pos < trk.end) {
        // Read delta time
        let delta = 0;
        while (pos < trk.end) {
          const b = data[pos++];
          delta = (delta << 7) | (b & 0x7f);
          if ((b & 0x80) === 0) break;
        }
        tick += delta;
        const timeSec = (tick / ticksPerQuarter) * (tempoUsPerBeat / 1000000);
        if (timeSec > maxTimeSec) maxTimeSec = timeSec;

        let status = data[pos];
        if (status >= 0x80) {
          runningStatus = status;
          pos++;
        } else {
          status = runningStatus;
        }

        const msgType = status & 0xf0;
        const chan = status & 0x0f;

        if (msgType === 0x90) {
          const note = data[pos++];
          const vel = data[pos++];
          if (vel === 0) {
            events.push({ timeSec, type: 'noteOff', channel: chan, note });
          } else {
            events.push({ timeSec, type: 'noteOn', channel: chan, note, velocity: vel });
          }
        } else if (msgType === 0x80) {
          const note = data[pos++];
          pos++; // skip velocity
          events.push({ timeSec, type: 'noteOff', channel: chan, note });
        } else if (msgType === 0xc0) {
          const prog = data[pos++];
          events.push({ timeSec, type: 'program', channel: chan, program: prog });
        } else if (msgType === 0xb0) {
          const cc = data[pos++];
          const val = data[pos++];
          if (cc === 7) events.push({ timeSec, type: 'volume', channel: chan, value: val / 127 });
          else if (cc === 10) events.push({ timeSec, type: 'pan', channel: chan, value: (val - 64) / 64 });
        } else if (msgType === 0xe0) {
          const lsb = data[pos++];
          const msb = data[pos++];
          const bend = ((msb << 7) | lsb) - 8192;
          events.push({ timeSec, type: 'pitch', channel: chan, value: bend / 8192 });
        } else if (status === 0xff) {
          // Meta event
          const metaType = data[pos++];
          let metaLen = 0;
          while (pos < trk.end) {
            const b = data[pos++];
            metaLen = (metaLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          if (metaType === 0x51 && metaLen === 3) {
            tempoUsPerBeat = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
          }
          pos += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          let sysexLen = 0;
          while (pos < trk.end) {
            const b = data[pos++];
            sysexLen = (sysexLen << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) break;
          }
          pos += sysexLen;
        }
      }
    }

    events.sort((a, b) => a.timeSec - b.timeSec);
    return { durationSec: Math.max(0.1, maxTimeSec), events };
  } catch (_) {
    return null;
  }
}

export class DoomMusicSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSeq: MusSequence | null = null;
  private isPlaying = false;
  private isPaused = false;
  private isLooping = true;
  private playbackStartTime = 0;
  private pauseOffset = 0;
  private eventIndex = 0;
  private timerId: number | null = null;
  private activeVoices = new Map<string, { stop: (t: number) => void }>();
  private channelPrograms = new Uint8Array(16);
  private channelPans = new Float32Array(16);
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.8;
  private muted = false;

  constructor(sharedCtx?: AudioContext) {
    if (sharedCtx) this.initContext(sharedCtx);
  }

  public initContext(ctx: AudioContext): void {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, ctx.currentTime);
    this.masterGain.connect(ctx.destination);
    this.initNoiseBuffer();
  }

  private initNoiseBuffer(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  public setVolume(vol: number): void {
    // vol is 0..15 (DOOM engine volume) or 0..1
    const normalized = vol > 1 ? Math.min(1, Math.max(0, vol / 15)) : Math.min(1, Math.max(0, vol));
    this.volume = normalized;
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public playSong(musData: Uint8Array, looping = true): boolean {
    const seq = parseMusData(musData);
    if (!seq || seq.events.length === 0) return false;

    this.stop();
    this.currentSeq = seq;
    this.isLooping = looping;
    this.eventIndex = 0;
    this.pauseOffset = 0;
    this.channelPrograms.fill(0);
    this.channelPans.fill(0);

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.ctx) {
      const CtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (CtxClass) {
        this.initContext(new CtxClass());
      }
    }

    if (!this.ctx) return false;

    this.isPlaying = true;
    this.isPaused = false;
    this.playbackStartTime = this.ctx.currentTime;
    this.startScheduler();
    return true;
  }

  public pause(): void {
    if (!this.isPlaying || this.isPaused || !this.ctx) return;
    this.isPaused = true;
    this.pauseOffset = this.ctx.currentTime - this.playbackStartTime;
    this.stopAllActiveVoices();
    this.stopScheduler();
  }

  public resume(): void {
    if (!this.isPlaying || !this.isPaused || !this.ctx) return;
    this.isPaused = false;
    this.playbackStartTime = this.ctx.currentTime - this.pauseOffset;
    this.startScheduler();
  }

  public stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.stopScheduler();
    this.stopAllActiveVoices();
    this.currentSeq = null;
    this.eventIndex = 0;
    this.pauseOffset = 0;
  }

  private stopScheduler(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private startScheduler(): void {
    this.stopScheduler();
    this.timerId = window.setInterval(() => this.scheduleUpcoming(), 25);
  }

  private stopAllActiveVoices(): void {
    const now = this.ctx?.currentTime || 0;
    for (const voice of this.activeVoices.values()) {
      try {
        voice.stop(now);
      } catch (_) {}
    }
    this.activeVoices.clear();
  }

  private scheduleUpcoming(): void {
    if (!this.isPlaying || this.isPaused || !this.ctx || !this.currentSeq) return;

    const currentTime = this.ctx.currentTime;
    const songTime = currentTime - this.playbackStartTime;
    const lookahead = 0.12; // 120ms schedule lookahead window

    while (this.eventIndex < this.currentSeq.events.length) {
      const ev = this.currentSeq.events[this.eventIndex];
      if (ev.timeSec > songTime + lookahead) break;

      const scheduleTime = Math.max(currentTime, this.playbackStartTime + ev.timeSec);
      this.processEvent(ev, scheduleTime);
      this.eventIndex++;
    }

    // Loop check
    if (songTime >= this.currentSeq.durationSec) {
      if (this.isLooping) {
        this.eventIndex = 0;
        this.playbackStartTime = currentTime;
      } else {
        this.stop();
      }
    }
  }

  private processEvent(ev: MusEvent, time: number): void {
    if (!this.ctx || !this.masterGain) return;

    if (ev.type === 'program') {
      this.channelPrograms[ev.channel] = ev.program ?? 0;
    } else if (ev.type === 'pan') {
      this.channelPans[ev.channel] = ev.value ?? 0;
    } else if (ev.type === 'allOff') {
      for (const [key, voice] of this.activeVoices.entries()) {
        if (key.startsWith(`${ev.channel}:`)) {
          voice.stop(time);
          this.activeVoices.delete(key);
        }
      }
    } else if (ev.type === 'noteOff') {
      const key = `${ev.channel}:${ev.note}`;
      const voice = this.activeVoices.get(key);
      if (voice) {
        voice.stop(time);
        this.activeVoices.delete(key);
      }
    } else if (ev.type === 'noteOn') {
      const note = ev.note ?? 60;
      const vel = (ev.velocity ?? 90) / 127;
      const isDrums = ev.channel === 15 || ev.channel === 9;

      // Stop previous voice on same channel and note
      const key = `${ev.channel}:${note}`;
      const old = this.activeVoices.get(key);
      if (old) {
        old.stop(time);
        this.activeVoices.delete(key);
      }

      if (isDrums) {
        this.playDrum(note, vel, time);
      } else {
        const prog = this.channelPrograms[ev.channel];
        const pan = this.channelPans[ev.channel];
        const voice = this.playTone(note, vel, prog, pan, time);
        if (voice) {
          this.activeVoices.set(key, voice);
        }
      }
    }
  }

  private midiToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private playTone(
    note: number,
    velocity: number,
    program: number,
    pan: number,
    time: number
  ): { stop: (t: number) => void } | null {
    if (!this.ctx || !this.masterGain) return null;

    const freq = this.midiToFreq(note);
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0, time);

    let panner: StereoPannerNode | null = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, time);
      voiceGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      voiceGain.connect(this.masterGain);
    }

    const isDistortedGuitar = program >= 28 && program <= 31;
    const isBass = program >= 32 && program <= 39;
    const isSynthLead = (program >= 80 && program <= 87) || (program >= 60 && program <= 63);

    const osc1 = this.ctx.createOscillator();
    let osc2: OscillatorNode | null = null;
    let filter: BiquadFilterNode | null = null;

    if (isDistortedGuitar) {
      // Crunchy DOOM metal guitar (detuned saws with overdrive filter)
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);

      osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 1.008, time);

      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, time);
      filter.Q.setValueAtTime(4.0, time);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      // Fast punchy attack with slight decay
      const peak = velocity * 0.45;
      voiceGain.gain.setValueAtTime(0.001, time);
      voiceGain.gain.linearRampToValueAtTime(peak, time + 0.015);
      voiceGain.gain.exponentialRampToValueAtTime(peak * 0.75, time + 0.15);
    } else if (isBass) {
      // Tight punchy bass
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);

      osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, time);

      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, time);
      filter.Q.setValueAtTime(2.0, time);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);

      const peak = velocity * 0.55;
      voiceGain.gain.setValueAtTime(0.001, time);
      voiceGain.gain.linearRampToValueAtTime(peak, time + 0.012);
      voiceGain.gain.exponentialRampToValueAtTime(peak * 0.8, time + 0.2);
    } else if (isSynthLead) {
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);

      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, time);

      osc1.connect(filter);
      filter.connect(voiceGain);

      const peak = velocity * 0.4;
      voiceGain.gain.setValueAtTime(0.001, time);
      voiceGain.gain.linearRampToValueAtTime(peak, time + 0.02);
      voiceGain.gain.exponentialRampToValueAtTime(peak * 0.7, time + 0.2);
    } else {
      // General melodic instrument
      osc1.type = program >= 40 && program <= 55 ? 'sawtooth' : 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc1.connect(voiceGain);

      const peak = velocity * 0.4;
      voiceGain.gain.setValueAtTime(0.001, time);
      voiceGain.gain.linearRampToValueAtTime(peak, time + 0.02);
      voiceGain.gain.exponentialRampToValueAtTime(peak * 0.6, time + 0.25);
    }

    osc1.start(time);
    if (osc2) osc2.start(time);

    return {
      stop: (stopTime: number) => {
        const releaseTime = Math.max(stopTime, time + 0.02);
        try {
          voiceGain.gain.cancelScheduledValues(releaseTime);
          voiceGain.gain.setValueAtTime(Math.max(0.0001, voiceGain.gain.value), releaseTime);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, releaseTime + 0.08);
          osc1.stop(releaseTime + 0.09);
          if (osc2) osc2.stop(releaseTime + 0.09);
        } catch (_) {}
      },
    };
  }

  private playDrum(note: number, velocity: number, time: number): void {
    if (!this.ctx || !this.masterGain) return;

    if (note === 35 || note === 36) {
      // Kick drum: 120Hz downward sweep to 35Hz
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);

      const vol = velocity * 0.8;
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.26);
    } else if (note === 38 || note === 40) {
      // Snare drum: tone + noise burst
      const osc = this.ctx.createOscillator();
      const toneGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(70, time + 0.1);

      toneGain.gain.setValueAtTime(velocity * 0.4, time);
      toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(toneGain);
      toneGain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.16);

      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, time);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(velocity * 0.45, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(time);
        noise.stop(time + 0.19);
      }
    } else if (note === 42 || note === 44 || note === 46) {
      // Closed / Open Hi-hat
      if (!this.noiseBuffer) return;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, time);

      const gain = this.ctx.createGain();
      const dur = note === 46 ? 0.35 : 0.06;
      gain.gain.setValueAtTime(velocity * 0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(time);
      noise.stop(time + dur + 0.01);
    } else if (note === 41 || note === 43 || note === 45 || note === 47 || note === 48 || note === 50) {
      // Toms: pitched resonant downward sine sweeps
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const baseFreq = 80 + (note - 41) * 15;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 1.5, time);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, time + 0.2);

      gain.gain.setValueAtTime(velocity * 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.26);
    } else {
      // Cymbal / Crash
      if (!this.noiseBuffer) return;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(5000, time);
      filter.Q.setValueAtTime(1.5, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(velocity * 0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(time);
      noise.stop(time + 0.61);
    }
  }
}
