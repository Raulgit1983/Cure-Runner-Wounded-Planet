export interface RunTelemetrySnapshot {
  sparksCollected: number;
  obstacleHits: number;
  maxChain: number;
  averagePulse: number;
  runDurationSeconds: number;
}

class RunTelemetryStore {
  private runStartedAtMs = 0;
  private sparksCollected = 0;
  private obstacleHits = 0;
  private maxChain = 0;
  private pulseWeightedTotal = 0;
  private pulseSampledSeconds = 0;

  beginRun(nowMs = performance.now()) {
    this.runStartedAtMs = nowMs;
    this.sparksCollected = 0;
    this.obstacleHits = 0;
    this.maxChain = 0;
    this.pulseWeightedTotal = 0;
    this.pulseSampledSeconds = 0;
  }

  noteSpark(chain: number) {
    this.sparksCollected += 1;
    this.maxChain = Math.max(this.maxChain, Math.max(0, Math.floor(chain)));
  }

  noteObstacleHit() {
    this.obstacleHits += 1;
  }

  samplePulse(pulse: number, deltaSeconds: number) {
    this.pulseWeightedTotal += pulse * deltaSeconds;
    this.pulseSampledSeconds += deltaSeconds;
  }

  snapshot(nowMs = performance.now()): RunTelemetrySnapshot {
    const duration =
      this.runStartedAtMs > 0 ? Math.max(0, (nowMs - this.runStartedAtMs) / 1000) : 0;

    return {
      sparksCollected: this.sparksCollected,
      obstacleHits: this.obstacleHits,
      maxChain: this.maxChain,
      averagePulse:
        this.pulseSampledSeconds > 0 ? this.pulseWeightedTotal / this.pulseSampledSeconds : 0,
      runDurationSeconds: duration
    };
  }
}

export const runTelemetryStore = new RunTelemetryStore();
