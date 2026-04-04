import { audioCueBus, type AudioCueEvent } from '@/game/services/audio/audioCueBus';

type AudioContextCtor = typeof AudioContext;
type OscillatorKind = OscillatorType;

const getAudioContextCtor = (): AudioContextCtor | null => {
  const scopedWindow = window as Window & typeof globalThis & { webkitAudioContext?: AudioContextCtor };

  return scopedWindow.AudioContext ?? scopedWindow.webkitAudioContext ?? null;
};

class ReactiveAudioLayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly offCue = audioCueBus.subscribe((event) => {
    this.handleCue(event);
  });
  private readonly offUnlock = audioCueBus.subscribeUnlock(() => {
    void this.resume();
  });

  destroy() {
    this.offCue();
    this.offUnlock();

    if (this.context && this.context.state !== 'closed') {
      void this.context.close().catch(() => undefined);
    }
  }

  private ensureContext() {
    if (this.context && this.master) {
      return {
        context: this.context,
        master: this.master
      };
    }

    const ContextCtor = getAudioContextCtor();

    if (!ContextCtor) {
      return null;
    }

    const context = new ContextCtor();
    const master = context.createGain();

    master.gain.value = 0.075;
    master.connect(context.destination);

    this.context = context;
    this.master = master;

    return {
      context,
      master
    };
  }

  private async resume() {
    const audio = this.ensureContext();

    if (!audio) {
      return;
    }

    if (audio.context.state === 'suspended') {
      await audio.context.resume().catch(() => undefined);
    }
  }

  private handleCue(event: AudioCueEvent) {
    if (!event.unlocked) {
      return;
    }

    const audio = this.ensureContext();

    if (!audio) {
      return;
    }

    if (audio.context.state !== 'running') {
      void audio.context
        .resume()
        .then(() => {
          this.renderCue(audio.context, audio.master, event);
        })
        .catch(() => undefined);
      return;
    }

    this.renderCue(audio.context, audio.master, event);
  }

  private renderCue(context: AudioContext, master: GainNode, event: AudioCueEvent) {
    if (event.type === 'spark_collect') {
      const chainLift = Math.min(0.18, (event.chain ?? 0) * 0.015);
      this.playTone(context, master, {
        from: 620 + chainLift * 600,
        to: 880 + chainLift * 520,
        duration: 0.1,
        volume: 0.04 + Math.min(0.018, event.intensity * 0.006),
        type: 'triangle'
      });
      return;
    }

    if (event.type === 'chain_success') {
      this.playTone(context, master, {
        from: 700,
        to: 1040,
        duration: 0.12,
        volume: 0.038,
        type: 'triangle'
      });
      this.playTone(context, master, {
        from: 960,
        to: 1240,
        duration: 0.11,
        delay: 0.07,
        volume: 0.03,
        type: 'sine'
      });
      return;
    }

    if (event.type === 'pulse_drop') {
      this.playTone(context, master, {
        from: 190,
        to: 108,
        duration: 0.18,
        volume: 0.05 + Math.min(0.02, event.intensity * 0.004),
        type: 'square',
        filterFrequency: 520
      });
      return;
    }

    if (event.type === 'awakening_gain') {
      this.playTone(context, master, {
        from: 480,
        to: 620,
        duration: 0.18,
        volume: 0.026,
        type: 'sine'
      });
      this.playTone(context, master, {
        from: 760,
        to: 980,
        duration: 0.15,
        delay: 0.05,
        volume: 0.022,
        type: 'triangle'
      });
      return;
    }

    if (event.type === 'victory_win') {
      this.playTone(context, master, {
        from: 392,
        to: 523,
        duration: 0.18,
        volume: 0.03,
        type: 'sine'
      });
      this.playTone(context, master, {
        from: 523,
        to: 659,
        duration: 0.22,
        delay: 0.08,
        volume: 0.028,
        type: 'triangle'
      });
      this.playTone(context, master, {
        from: 659,
        to: 784,
        duration: 0.28,
        delay: 0.16,
        volume: 0.024,
        type: 'sine'
      });
    }
  }

  private playTone(
    context: AudioContext,
    master: GainNode,
    options: {
      from: number;
      to: number;
      duration: number;
      volume: number;
      type: OscillatorKind;
      delay?: number;
      filterFrequency?: number;
    }
  ) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const filter = options.filterFrequency ? context.createBiquadFilter() : null;
    const startTime = context.currentTime + (options.delay ?? 0);
    const attack = 0.012;
    const releaseTime = startTime + options.duration;
    const stopTime = releaseTime + 0.05;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.from, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.to), releaseTime);

    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(options.volume, startTime + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, releaseTime);

    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.value = options.filterFrequency ?? 520;
      oscillator.connect(filter);
      filter.connect(envelope);
    } else {
      oscillator.connect(envelope);
    }

    envelope.connect(master);
    oscillator.start(startTime);
    oscillator.stop(stopTime);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      filter?.disconnect();
    };
  }
}

export const createReactiveAudioLayer = () => new ReactiveAudioLayer();
