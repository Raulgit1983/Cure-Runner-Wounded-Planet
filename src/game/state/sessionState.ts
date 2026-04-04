export type EmotionTier = 'dim' | 'warming' | 'awake';

export interface PersistentProgress {
  awakeningLevel: number;
  collectedSparks: number;
}

export interface SessionSnapshot extends PersistentProgress {
  noteProgress: number;
  currentPulse: number;
  displayLevel: number;
  tier: EmotionTier;
  currentChain: number;
  bestChain: number;
  recoveryChances: number;
}

export interface SessionTransition {
  before: SessionSnapshot;
  after: SessionSnapshot;
}

type SessionListener = (snapshot: SessionSnapshot) => void;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const baseRecoveryChances = 0;
const basePulse = 1;
const reservePulseRestore = 0.36;

const deriveDisplayLevel = (awakeningLevel: number, currentPulse: number) =>
  clamp01(awakeningLevel * 0.94 + currentPulse * 0.06);

const deriveTier = (displayLevel: number): EmotionTier => {
  if (displayLevel >= 0.72) {
    return 'awake';
  }

  if (displayLevel >= 0.34) {
    return 'warming';
  }

  return 'dim';
};

const createSnapshot = (
  state: PersistentProgress & {
    currentPulse: number;
    currentChain: number;
    bestChain: number;
    recoveryChances: number;
  }
): SessionSnapshot => {
  const displayLevel = deriveDisplayLevel(state.awakeningLevel, state.currentPulse);

  return {
    ...state,
    noteProgress: state.collectedSparks % 100,
    displayLevel,
    tier: deriveTier(displayLevel)
  };
};

export const emotionTierLabel: Record<EmotionTier, string> = {
  dim: 'Dim',
  warming: 'Warming',
  awake: 'Awake'
};

class SessionStateStore {
  private state: PersistentProgress & {
    currentPulse: number;
    currentChain: number;
    bestChain: number;
    recoveryChances: number;
  } = {
    awakeningLevel: 0,
    currentPulse: basePulse,
    collectedSparks: 0,
    currentChain: 0,
    bestChain: 0,
    recoveryChances: baseRecoveryChances
  };

  private listeners = new Set<SessionListener>();

  hydrate(progress: Partial<PersistentProgress>) {
    this.state = {
      awakeningLevel: clamp01(progress.awakeningLevel ?? 0),
      collectedSparks: Math.max(0, Math.floor(progress.collectedSparks ?? 0)),
      currentPulse: basePulse,
      currentChain: 0,
      bestChain: 0,
      recoveryChances: baseRecoveryChances
    };

    this.emit();
  }

  restartRun() {
    this.state = {
      awakeningLevel: this.state.awakeningLevel,
      collectedSparks: this.state.collectedSparks,
      currentPulse: basePulse,
      currentChain: 0,
      bestChain: 0,
      recoveryChances: baseRecoveryChances
    };

    this.emit();
  }

  snapshot(): SessionSnapshot {
    return createSnapshot(this.state);
  }

  subscribe(listener: SessionListener) {
    this.listeners.add(listener);
    listener(this.snapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  pulse(amount: number) {
    this.applyState({
      ...this.state,
      currentPulse: clamp01(this.state.currentPulse + amount)
    });
  }

  coolDown(deltaSeconds: number) {
    void deltaSeconds;
  }

  registerSparkCollection({
    awakeningGain,
    chain
  }: {
    awakeningGain: number;
    chain: number;
  }): SessionTransition {
    const collectedSparks = this.state.collectedSparks + 1;
    const reserveGain = collectedSparks % 100 === 0 ? 1 : 0;

    return this.applyState({
      ...this.state,
      awakeningLevel: clamp01(this.state.awakeningLevel + awakeningGain),
      collectedSparks,
      currentChain: Math.max(1, Math.floor(chain)),
      bestChain: Math.max(this.state.bestChain, Math.max(1, Math.floor(chain))),
      recoveryChances: this.state.recoveryChances + reserveGain
    });
  }

  breakChain(nextChain = 0): SessionTransition {
    return this.applyState({
      ...this.state,
      currentChain: Math.max(0, Math.floor(nextChain))
    });
  }

  registerPulseDrop({
    pulseLoss,
    nextChain = 0
  }: {
    pulseLoss: number;
    nextChain?: number;
  }): SessionTransition {
    const nextPulse = clamp01(this.state.currentPulse - pulseLoss);
    const reserveUsed = nextPulse <= 0.001 && this.state.recoveryChances > 0;

    return this.applyState({
      ...this.state,
      currentPulse: reserveUsed ? reservePulseRestore : nextPulse,
      currentChain: Math.max(0, Math.floor(nextChain)),
      recoveryChances: Math.max(0, this.state.recoveryChances - (reserveUsed ? 1 : 0))
    });
  }

  private applyState(
    nextState: PersistentProgress & {
      currentPulse: number;
      currentChain: number;
      bestChain: number;
      recoveryChances: number;
    }
  ): SessionTransition {
    const previous = this.snapshot();
    this.state = nextState;
    const next = this.snapshot();

    const changed =
      previous.awakeningLevel !== next.awakeningLevel ||
      previous.collectedSparks !== next.collectedSparks ||
      Math.abs(previous.currentPulse - next.currentPulse) > 0.004 ||
      previous.tier !== next.tier ||
      previous.currentChain !== next.currentChain ||
      previous.bestChain !== next.bestChain ||
      previous.recoveryChances !== next.recoveryChances;

    if (changed) {
      this.emit();
    }

    return {
      before: previous,
      after: next
    };
  }

  private emit() {
    const snapshot = this.snapshot();

    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}

export const sessionState = new SessionStateStore();
