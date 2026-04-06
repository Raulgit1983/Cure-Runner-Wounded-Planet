export const runnerConfig = {
  hero: {
    screenX: 100,
    runY: 494,
    hitbox: {
      width: 62,
      topOffset: 74,
      bottomOffset: 22
    }
  },
  movement: {
    baseSpeed: 188,
    displaySpeedBonus: 0.16
  },
  jump: {
    maxJumps: 2,
    velocity: 472,
    doubleJumpVelocity: 448,
    riseGravity: 1260,
    fallGravity: 1760,
    holdGravityMultiplier: 0.58,
    releaseGravityMultiplier: 1.46,
    holdMaxSeconds: 0.14,
    airJumpHoldMaxSeconds: 0.1,
    maxFallSpeed: 820,
    coyoteSeconds: 0.12,
    bufferSeconds: 0.13,
    landingBurstVelocity: 240
  },
  spawn: {
    startWorldX: 220,
    leadDistance: 496,
    removalMargin: 88
  },
  rewards: {
    collectRadius: 40,
    missMargin: 52,
    basePulseGain: 0.095,
    baseAwakeningGain: 0.026,
    comboEvery: 3,
    comboPulseBonus: 0.014,
    comboAwakeningBonus: 0.01
  },
  obstacle: {
    pulseLoss: 0.34,
    staggerSeconds: 0.2,
    invulnerabilitySeconds: 0.82,
    speedPenalty: 0.22
  },
  level: {
    endDistance: 9120,
    surfaceStartDistance: 5680,
    finishRevealDistance: 7880,
    finishSlowdownDistance: 260,
    exitCoastDistance: 120
  },
  director: {
    recoveryPulseThreshold: 0.17
  },
  visual: {
    groundLineY: 548
  }
} as const;
