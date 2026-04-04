export type AudioCueType =
  | 'spark_collect'
  | 'chain_success'
  | 'pulse_drop'
  | 'awakening_gain'
  | 'victory_win';

export interface AudioCueEvent {
  type: AudioCueType;
  timestamp: number;
  intensity: number;
  unlocked: boolean;
  chain?: number;
  amount?: number;
}

type AudioCueListener = (event: AudioCueEvent) => void;
type AudioUnlockListener = () => void;

class AudioCueBus {
  private listeners = new Set<AudioCueListener>();
  private unlockListeners = new Set<AudioUnlockListener>();
  private unlocked = false;

  unlockFromGesture() {
    this.unlocked = true;
    this.unlockListeners.forEach((listener) => {
      listener();
    });
  }

  subscribe(listener: AudioCueListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeUnlock(listener: AudioUnlockListener) {
    this.unlockListeners.add(listener);

    if (this.unlocked) {
      listener();
    }

    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  emit(event: Omit<AudioCueEvent, 'timestamp' | 'unlocked'>) {
    const payload: AudioCueEvent = {
      ...event,
      timestamp: performance.now(),
      unlocked: this.unlocked
    };

    this.listeners.forEach((listener) => {
      listener(payload);
    });
  }
}

export const audioCueBus = new AudioCueBus();
