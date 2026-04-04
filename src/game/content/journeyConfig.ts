export const journeyConfig = {
  logicalSize: {
    width: 360,
    height: 640
  },
  floorY: 538,
  hero: {
    followSharpness: 6.4,
    roamPaddingX: 40,
    roamTop: 156,
    roamBottom: 500,
    baseYOffset: 42
  },
  spark: {
    spawnPaddingX: 60,
    spawnTop: 136,
    spawnBottom: 430,
    awakeningGain: 0.08,
    pulseGain: 0.2
  },
  backdropRedrawSteps: 40
} as const;
