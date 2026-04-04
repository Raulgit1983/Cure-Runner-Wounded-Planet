export type EmotionTier = 'dim' | 'warming' | 'awake';

export interface PersistentProgress {
  awakeningLevel: number;
  collectedSparks: number;
}

export interface SessionSnapshot extends PersistentProgress {
  currentPulse: number;
  displayLevel: number;
  tier: EmotionTier;
  currentChain: number;
  bestChain: number;
}

export interface SessionTransition {
  before: SessionSnapshot;
  after: SessionSnapshot;
}

type SessionListener = (snapshot: SessionSnapshot) => void;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const deriveDisplayLevel = (awakeningLevel: number, currentPulse: number) =>
  clamp01(awakeningLevel * 0.78 + currentPulse * 0.22);

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
  state: PersistentProgress & { currentPulse: number; currentChain: number; bestChain: number }
): SessionSnapshot => {
  const displayLevel = deriveDisplayLevel(state.awakeningLevel, state.currentPulse);

  return {
    ...state,
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
  private state: PersistentProgress & { currentPulse: number; currentChain: number; bestChain: number } =
    {
    awakeningLevel: 0,
    currentPulse: 0.08,
    collectedSparks: 0,
    currentChain: 0,
    bestChain: 0
  };

  private listeners = new Set<SessionListener>();

  hydrate(progress: Partial<PersistentProgress>) {
    this.state = {
      awakeningLevel: clamp01(progress.awakeningLevel ?? 0),
      collectedSparks: Math.max(0, Math.floor(progress.collectedSparks ?? 0)),
      currentPulse: 0.08,
      currentChain: 0,
      bestChain: 0
    };

    this.emit();
  }

  restartRun() {
    this.state = {
      awakeningLevel: this.state.awakeningLevel,
      collectedSparks: this.state.collectedSparks,
      currentPulse: 0.08,
      currentChain: 0,
      bestChain: 0
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
    const floor = Math.min(0.26, 0.06 + this.state.awakeningLevel * 0.08);
    const nextPulse =
      this.state.currentPulse >= floor
        ? Math.max(floor, this.state.currentPulse - deltaSeconds * 0.085)
        : Math.min(floor, this.state.currentPulse + deltaSeconds * 0.05);

    this.applyState({
      ...this.state,
      currentPulse: nextPulse
    });
  }

  registerSparkCollection({
    awakeningGain,
    pulseGain,
    chain
  }: {
    awakeningGain: number;
    pulseGain: number;
    chain: number;
  }): SessionTransition {
    return this.applyState({
      awakeningLevel: clamp01(this.state.awakeningLevel + awakeningGain),
      currentPulse: clamp01(this.state.currentPulse + pulseGain),
      collectedSparks: this.state.collectedSparks + 1,
      currentChain: Math.max(1, Math.floor(chain)),
      bestChain: Math.max(this.state.bestChain, Math.max(1, Math.floor(chain)))
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
    return this.applyState({
      ...this.state,
      currentPulse: clamp01(this.state.currentPulse - pulseLoss),
      currentChain: Math.max(0, Math.floor(nextChain))
    });
  }

  private applyState(
    nextState: PersistentProgress & { currentPulse: number; currentChain: number; bestChain: number }
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
      previous.bestChain !== next.bestChain;

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
