import Phaser from 'phaser';

import { emotionPalette } from '@/game/content/emotionPalette';

export interface MoodSnapshot {
  gradientTop: number;
  gradientBottom: number;
  hazeColor: number;
  floorColor: number;
  floorLineColor: number;
  auraColor: number;
  markerColor: number;
  sparkColor: number;
  sparkEdgeColor: number;
  shadowColor: number;
  heroScale: number;
  bobAmplitude: number;
  baseRotation: number;
  auraAlpha: number;
  auraSize: number;
  shadowScaleX: number;
  shadowAlpha: number;
  targetPulseSpeed: number;
  sparkHaloAlpha: number;
  sparkHoverAmplitude: number;
}

const mixHex = (from: number, to: number, value: number) => {
  const start = Phaser.Display.Color.ValueToColor(from);
  const end = Phaser.Display.Color.ValueToColor(to);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(
    start,
    end,
    100,
    Math.round(value * 100)
  );

  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
};

export class EmotionController {
  getMood(displayLevel: number): MoodSnapshot {
    const t = Phaser.Math.Clamp(displayLevel, 0, 1);

    return {
      gradientTop: mixHex(emotionPalette.dim.gradientTop, emotionPalette.alive.gradientTop, t),
      gradientBottom: mixHex(emotionPalette.dim.gradientBottom, emotionPalette.alive.gradientBottom, t),
      hazeColor: mixHex(emotionPalette.dim.haze, emotionPalette.alive.haze, t),
      floorColor: mixHex(emotionPalette.dim.floor, emotionPalette.alive.floor, t),
      floorLineColor: mixHex(emotionPalette.dim.line, emotionPalette.alive.line, t),
      auraColor: mixHex(emotionPalette.dim.aura, emotionPalette.alive.aura, t),
      markerColor: mixHex(emotionPalette.dim.marker, emotionPalette.alive.marker, t),
      sparkColor: mixHex(emotionPalette.dim.spark, emotionPalette.alive.spark, t),
      sparkEdgeColor: mixHex(emotionPalette.dim.sparkEdge, emotionPalette.alive.sparkEdge, t),
      shadowColor: mixHex(emotionPalette.dim.shadow, emotionPalette.alive.shadow, t),
      heroScale: Phaser.Math.Linear(0.96, 1.05, t),
      bobAmplitude: Phaser.Math.Linear(4, 12, t),
      baseRotation: Phaser.Math.DegToRad(Phaser.Math.Linear(-7, -1.5, t)),
      auraAlpha: Phaser.Math.Linear(0.08, 0.32, t),
      auraSize: Phaser.Math.Linear(84, 132, t),
      shadowScaleX: Phaser.Math.Linear(1.14, 0.92, t),
      shadowAlpha: Phaser.Math.Linear(0.2, 0.12, t),
      targetPulseSpeed: Phaser.Math.Linear(1.1, 1.8, t),
      sparkHaloAlpha: Phaser.Math.Linear(0.12, 0.24, t),
      sparkHoverAmplitude: Phaser.Math.Linear(4, 10, t)
    };
  }
}
