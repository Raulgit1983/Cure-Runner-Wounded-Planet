import Phaser from 'phaser';

import { heroProfile } from '@/game/content/heroProfile';
import { journeyConfig } from '@/game/content/journeyConfig';
import { runnerConfig } from '@/game/content/runnerConfig';
import { audioCueBus } from '@/game/services/audio/audioCueBus';
import { runTelemetryStore } from '@/game/services/telemetry/runTelemetryStore';
import { sessionState } from '@/game/state/sessionState';
import { EmotionController } from '@/game/systems/emotion/EmotionController';
import { RunnerLoopSystem, type RunnerLoopSnapshot } from '@/game/systems/runner/RunnerLoopSystem';

const SHARK_TEXTURE_KEY = 'shark-friend';
const FINISH_MESSAGE =
  'Encontraste el primer ingrediente.\nEl planeta todavía puede sanar.\nSigamos construyendo un mundo nuevo juntos.';

export class JourneyScene extends Phaser.Scene {
  private readonly showDebug =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';
  private readonly emotionController = new EmotionController();
  private readonly feedback = {
    collect: 0,
    chain: 0,
    impact: 0,
    awakening: 0
  };
  private readonly conduitHeights = [124, 156, 108, 168, 116, 144];
  private readonly conduitWidths = [18, 24, 16, 22, 20, 26];
  private readonly conduitOffsets = [12, -8, 18, -14, 10, -4];

  private backdrop!: Phaser.GameObjects.Graphics;
  private finishGlow!: Phaser.GameObjects.Ellipse;
  private heroShadow!: Phaser.GameObjects.Ellipse;
  private heroAura!: Phaser.GameObjects.Ellipse;
  private hero!: Phaser.GameObjects.Image;
  private ingredient!: Phaser.GameObjects.Container;
  private finishMessage!: Phaser.GameObjects.Container;
  private runnerLoop!: RunnerLoopSystem;
  private shark!: Phaser.GameObjects.Container;
  private sharkShadow!: Phaser.GameObjects.Ellipse;
  private debugGraphics?: Phaser.GameObjects.Graphics;

  private baseHeroScale = 1;
  private heroRenderScaleX = 1;
  private heroRenderScaleY = 1;
  private lastBackdropStep = -1;
  private lastBackdropTravelStep = -1;
  private lastSurfaceStep = -1;
  private lastDebugEmit = 0;
  private finishPulse = 0;
  private finishResolved = false;
  private sharkBurst = 0;
  private sharkCooldown = 3.8;
  private sharkDuration = 1.9;
  private sharkProgress = 0;
  private sharkBaseY = 210;
  private sharkActive = false;
  private sharkTagged = false;
  private offAudioCue?: () => void;

  constructor() {
    super('journey');
  }

  create() {
    const heroY = runnerConfig.hero.runY;
    const heroX = runnerConfig.hero.screenX;
    const width = journeyConfig.logicalSize.width;

    this.lastBackdropStep = -1;
    this.lastBackdropTravelStep = -1;
    this.lastSurfaceStep = -1;
    this.finishPulse = 0;
    this.finishResolved = false;
    this.sharkBurst = 0;
    this.sharkCooldown = 3.8;
    this.sharkActive = false;
    this.sharkTagged = false;

    this.backdrop = this.add.graphics().setDepth(0);
    this.finishGlow = this.add
      .ellipse(width - 22, 186, 164, 320, 0xf2ffce, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(0.6);
    this.heroShadow = this.add
      .ellipse(heroX, runnerConfig.visual.groundLineY + 8, 132, 28, 0x120b14, 0.18)
      .setDepth(1);
    this.heroAura = this.add
      .ellipse(heroX - 8, heroY + 10, 122, 74, 0xa4ff68, 0.035)
      .setDepth(2);

    this.hero = this.add
      .image(heroX, heroY, heroProfile.textureKey)
      .setOrigin(heroProfile.renderOrigin.x, heroProfile.renderOrigin.y)
      .setDepth(5);

    this.baseHeroScale = heroProfile.mobileScale.preferredPx / this.hero.height;
    this.heroRenderScaleX = this.baseHeroScale;
    this.heroRenderScaleY = this.baseHeroScale;
    this.hero.setScale(this.baseHeroScale);
    this.ingredient = this.createIngredient(width - 52, 188);
    this.finishMessage = this.createFinishMessage(width * 0.5, 126);
    this.sharkShadow = this.add
      .ellipse(-120, runnerConfig.visual.groundLineY - 44, 58, 12, 0x09080d, 0.1)
      .setDepth(4.45)
      .setVisible(false);
    this.shark = this.createShark();
    this.debugGraphics = this.showDebug ? this.add.graphics().setDepth(6.8) : undefined;

    runTelemetryStore.beginRun();
    this.runnerLoop = new RunnerLoopSystem(this);
    this.bindAudioFeedback();
    this.renderBackdrop(this.emotionController.getMood(sessionState.snapshot().displayLevel), 0, 0, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(time: number, delta: number) {
    const deltaSeconds = delta / 1000;

    sessionState.coolDown(deltaSeconds);

    const snapshot = sessionState.snapshot();
    const mood = this.emotionController.getMood(snapshot.displayLevel);
    runTelemetryStore.samplePulse(snapshot.currentPulse, deltaSeconds);

    this.runnerLoop.update(deltaSeconds, time, mood, snapshot.displayLevel);
    const loopSnapshot = this.runnerLoop.snapshot();

    this.feedback.collect = Math.max(0, this.feedback.collect - deltaSeconds * 3);
    this.feedback.chain = Math.max(0, this.feedback.chain - deltaSeconds * 1.6);
    this.feedback.impact = Math.max(0, this.feedback.impact - deltaSeconds * 2.4);
    this.feedback.awakening = Math.max(0, this.feedback.awakening - deltaSeconds * 1.5);
    this.finishPulse = Math.max(0, this.finishPulse - deltaSeconds * 1.8);
    this.sharkBurst = Math.max(0, this.sharkBurst - deltaSeconds * 2.8);

    const emotionalLevel = Phaser.Math.Clamp(
      snapshot.displayLevel + this.feedback.chain * 0.08 + this.feedback.awakening * 0.06,
      0,
      1
    );
    const environmentLevel = Phaser.Math.Clamp(
      emotionalLevel * 0.66 + loopSnapshot.surfaceProgress * 0.42 + loopSnapshot.finishRevealProgress * 0.08,
      0,
      1
    );
    const renderMood = this.emotionController.getMood(environmentLevel);
    const backdropStep = Math.round(environmentLevel * journeyConfig.backdropRedrawSteps);
    const backdropTravelStep = Math.round(
      loopSnapshot.distanceTravelled / runnerConfig.visual.backdropTravelStep
    );
    const surfaceStep = Math.round(
      loopSnapshot.surfaceProgress * 24 + loopSnapshot.finishRevealProgress * 14
    );

    if (
      backdropStep !== this.lastBackdropStep ||
      backdropTravelStep !== this.lastBackdropTravelStep ||
      surfaceStep !== this.lastSurfaceStep
    ) {
      this.renderBackdrop(
        renderMood,
        loopSnapshot.distanceTravelled,
        loopSnapshot.surfaceProgress,
        loopSnapshot.finishRevealProgress
      );
      this.lastBackdropStep = backdropStep;
      this.lastBackdropTravelStep = backdropTravelStep;
      this.lastSurfaceStep = surfaceStep;
    }

    this.updateSharkEvent(time, deltaSeconds, loopSnapshot);
    this.updateFinishObjects(time, loopSnapshot);

    const runBob = loopSnapshot.grounded
      ? Math.sin(loopSnapshot.distanceTravelled * 0.095) * (2 + snapshot.displayLevel * 3.6)
      : 0;
    const breath = Math.sin(time * 0.0022 + snapshot.displayLevel * 2.8) * 0.012;
    const driftLift = loopSnapshot.grounded ? 0 : Math.sin(time * 0.0021) * 1.4;
    const squeeze =
      (loopSnapshot.grounded ? 1 : 0.18) * Math.sin(time * 0.0031) * 0.018 +
      loopSnapshot.collectBurst * 0.02;
    const liftTilt = Phaser.Math.Clamp(loopSnapshot.velocityY / 620, -0.18, 0.14);
    const impactDrop = loopSnapshot.staggerAmount * 16 + this.feedback.impact * 10;
    const rise = loopSnapshot.collectBurst * 8 + this.feedback.chain * 6;
    const landingSquash = loopSnapshot.landingBurst * 0.08;
    const heroScale =
      this.baseHeroScale *
      renderMood.heroScale *
      (1 + loopSnapshot.collectBurst * 0.02 + this.feedback.awakening * 0.02 - this.feedback.impact * 0.018);
    const unclampedScaleX =
      heroScale *
      (1 + breath * 0.45 + squeeze * 0.24 + landingSquash * 0.1 - this.sharkBurst * 0.02);
    const unclampedScaleY =
      heroScale *
      (1 - breath * 0.3 - squeeze * 0.16 - landingSquash * 0.26 + this.sharkBurst * 0.04);
    const targetScaleX = Phaser.Math.Clamp(unclampedScaleX, heroScale * 0.97, heroScale * 1.05);
    const targetScaleY = Phaser.Math.Clamp(unclampedScaleY, heroScale * 0.94, heroScale * 1.03);

    this.heroRenderScaleX = Phaser.Math.Linear(this.heroRenderScaleX, targetScaleX, 0.16);
    this.heroRenderScaleY = Phaser.Math.Linear(this.heroRenderScaleY, targetScaleY, 0.16);

    this.hero
      .setPosition(
        loopSnapshot.heroX - this.feedback.impact * 6 - this.sharkBurst * 3,
        loopSnapshot.heroY +
          runBob +
          impactDrop -
          rise +
          landingSquash * 6 +
          driftLift -
          loopSnapshot.surfaceProgress * 6
      )
      .setScale(this.heroRenderScaleX, this.heroRenderScaleY);

    this.hero.rotation = Phaser.Math.Linear(
      this.hero.rotation,
      renderMood.baseRotation +
        0.04 +
        liftTilt +
        this.feedback.chain * 0.02 +
        this.feedback.impact * 0.08 +
        this.sharkBurst * 0.05,
      0.18
    );

    this.heroAura
      .setPosition(this.hero.x - 8, this.hero.y + 8)
      .setScale(
        (renderMood.auraSize / 122) *
          (1 + this.feedback.chain * 0.12 + loopSnapshot.collectBurst * 0.05 + loopSnapshot.finishRevealProgress * 0.14),
        0.7 + environmentLevel * 0.18 + this.feedback.awakening * 0.06
      )
      .setRotation(this.hero.rotation * 0.35)
      .setFillStyle(
        renderMood.auraColor,
        renderMood.auraAlpha * 0.22 +
          this.feedback.collect * 0.04 +
          this.feedback.chain * 0.05 +
          this.feedback.awakening * 0.05 +
          loopSnapshot.surfaceProgress * 0.05 +
          this.finishPulse * 0.08
      );

    this.heroShadow
      .setPosition(this.hero.x - 6, runnerConfig.visual.groundLineY + 8)
      .setFillStyle(renderMood.shadowColor, renderMood.shadowAlpha + this.feedback.impact * 0.06)
      .setScale(
        renderMood.shadowScaleX +
          this.feedback.impact * 0.18 -
          Phaser.Math.Clamp((runnerConfig.hero.runY - loopSnapshot.heroY) / 180, 0, 0.22) +
          landingSquash * 0.2,
        1
      );

    if (this.showDebug) {
      this.renderDebugOverlay(loopSnapshot, time);
    }
  }

  private renderBackdrop(
    mood: ReturnType<EmotionController['getMood']>,
    distanceTravelled: number,
    surfaceProgress: number,
    finishRevealProgress: number
  ) {
    const width = journeyConfig.logicalSize.width;
    const height = journeyConfig.logicalSize.height;
    const floorY = runnerConfig.visual.groundLineY;
    const farOffset = -((distanceTravelled * 0.18) % 88);
    const midOffset = -((distanceTravelled * 0.34) % 92);
    const conduitOffset = -((distanceTravelled * 0.58) % 64);
    const pulseOffset = -((distanceTravelled * 0.88) % 54);
    const hubX = width * 0.52 + farOffset * 0.16;
    const hubY = height * 0.31;
    const hubAlpha = 0.14 - surfaceProgress * 0.04;

    this.backdrop.clear();
    this.backdrop.fillGradientStyle(
      mood.gradientTop,
      mood.gradientTop,
      mood.gradientBottom,
      mood.gradientBottom,
      1,
      1,
      1,
      1
    );
    this.backdrop.fillRect(0, 0, width, height);

    this.backdrop.fillStyle(mood.hazeColor, 0.11);
    this.backdrop.fillEllipse(width * 0.22, height * 0.24, 170, 138);
    this.backdrop.fillEllipse(width * 0.81, height * 0.2, 208, 156);
    this.backdrop.fillEllipse(width * 0.54, height * 0.34, 244, 188);

    this.backdrop.lineStyle(4, mood.floorLineColor, hubAlpha);
    for (let index = 0; index < 6; index += 1) {
      const angle = -1.52 + index * 0.58 + (index % 2 === 0 ? 0.08 : -0.06);
      const length = 58 + (index % 3) * 22;
      const jointX = hubX + Math.cos(angle) * length;
      const jointY = hubY + Math.sin(angle) * length;

      this.backdrop.beginPath();
      this.backdrop.moveTo(hubX, hubY);
      this.backdrop.lineTo(jointX, jointY);
      this.backdrop.lineTo(jointX + (index % 2 === 0 ? 10 : -8), jointY + 14);
      this.backdrop.strokePath();
      this.backdrop.fillStyle(mood.floorColor, 0.16);
      this.backdrop.fillCircle(jointX, jointY, 8 + (index % 2) * 2);
    }

    this.backdrop.lineStyle(2, mood.markerColor, 0.12 - surfaceProgress * 0.03);
    this.backdrop.strokeEllipse(hubX, hubY, 58, 58);
    this.backdrop.fillStyle(mood.markerColor, 0.12);
    this.backdrop.fillCircle(hubX, hubY, 11);

    this.backdrop.fillStyle(0xf2ffd6, 0.04 + surfaceProgress * 0.18 + finishRevealProgress * 0.24);
    this.backdrop.fillEllipse(
      width * 0.98,
      height * 0.28,
      170 + finishRevealProgress * 86,
      304 + surfaceProgress * 144
    );
    this.backdrop.fillStyle(mood.auraColor, 0.03 + surfaceProgress * 0.1 + finishRevealProgress * 0.04);
    this.backdrop.fillRect(width * 0.88, 0, width * 0.18, floorY - 36);
    this.backdrop.fillStyle(0xfff7dc, 0.018 + finishRevealProgress * 0.06);
    this.backdrop.fillEllipse(width * 0.92, height * 0.2, 94 + finishRevealProgress * 42, 180);

    this.backdrop.lineStyle(18, mood.floorColor, 0.12);
    this.backdrop.strokeEllipse(width * 0.28 + farOffset * 0.25, height * 0.38, 230, 292);
    this.backdrop.strokeEllipse(width * 0.82 + farOffset * 0.1, height * 0.42, 196, 262);
    this.backdrop.lineStyle(6, mood.markerColor, 0.08);
    this.backdrop.strokeEllipse(width * 0.53 + farOffset * 0.12, height * 0.26, 138, 176);

    this.backdrop.fillStyle(mood.floorLineColor, 0.16);
    for (let index = 0; index < 7; index += 1) {
      const x = farOffset + index * 72;
      const bodyWidth = this.conduitWidths[index % this.conduitWidths.length]!;
      const bodyHeight = this.conduitHeights[index % this.conduitHeights.length]!;
      const neckShift = this.conduitOffsets[index % this.conduitOffsets.length]!;
      const bodyTop = floorY - 166 - bodyHeight;

      this.backdrop.fillRoundedRect(x, bodyTop, bodyWidth, bodyHeight, 12);
      this.backdrop.fillCircle(x + bodyWidth * 0.5, bodyTop + 20, 12);
      this.backdrop.fillCircle(x + bodyWidth * 0.5 + neckShift * 0.25, bodyTop + bodyHeight - 18, 10);
      this.backdrop.fillRect(x + bodyWidth * 0.32, bodyTop - 18, 6, 22);
    }

    this.backdrop.fillStyle(mood.floorColor, 0.22);
    for (let index = 0; index < 6; index += 1) {
      const x = midOffset + index * 66;
      const y = floorY - 164 + (index % 3) * 12;

      this.backdrop.fillRoundedRect(x, y, 14, 88, 14);
      this.backdrop.fillRoundedRect(x + 18, y + 18, 32, 12, 10);
      this.backdrop.fillCircle(x + 26, y + 24, 14);
      this.backdrop.fillRoundedRect(x + 38, y + 42, 12, 42, 10);
      this.backdrop.fillEllipse(x + 24, y + 72, 34, 16);
    }

    this.backdrop.lineStyle(4, mood.shadowColor, 0.34);
    for (let index = 0; index < 5; index += 1) {
      const startX = conduitOffset + index * 86;
      const offset = index % 2 === 0 ? 12 : -12;

      this.backdrop.beginPath();
      this.backdrop.moveTo(startX, -10);
      this.backdrop.lineTo(startX + 16, 72);
      this.backdrop.lineTo(startX - offset, 144);
      this.backdrop.lineTo(startX + 10, 220);
      this.backdrop.strokePath();

      this.backdrop.beginPath();
      this.backdrop.moveTo(startX + 28, floorY - 14);
      this.backdrop.lineTo(startX + 8, floorY - 82);
      this.backdrop.lineTo(startX + 18 + offset, floorY - 148);
      this.backdrop.strokePath();
    }

    this.backdrop.lineStyle(2, mood.auraColor, 0.22);
    for (let x = pulseOffset - 20; x < width + 40; x += 42) {
      this.backdrop.beginPath();
      this.backdrop.moveTo(x, floorY - 36);
      this.backdrop.lineTo(x + 14, floorY - 64);
      this.backdrop.lineTo(x + 28, floorY - 44);
      this.backdrop.strokePath();
    }

    this.backdrop.fillStyle(mood.floorColor, 0.9);
    this.backdrop.fillRect(-20, floorY, width + 40, height - floorY + 20);

    this.backdrop.lineStyle(4, mood.floorLineColor, 0.72);
    this.backdrop.beginPath();
    this.backdrop.moveTo(0, floorY + 10);
    this.backdrop.lineTo(width * 0.12, floorY + 4);
    this.backdrop.lineTo(width * 0.28, floorY + 12);
    this.backdrop.lineTo(width * 0.46, floorY + 6);
    this.backdrop.lineTo(width * 0.64, floorY + 16);
    this.backdrop.lineTo(width * 0.82, floorY + 8);
    this.backdrop.lineTo(width, floorY + 12);

    this.backdrop.strokePath();

    this.backdrop.fillStyle(mood.hazeColor, 0.14);
    for (let x = pulseOffset - 24; x < width + 60; x += 58) {
      this.backdrop.fillEllipse(x, floorY + 12, 52, 14);
    }

    this.backdrop.lineStyle(2, mood.markerColor, 0.16);
    for (let x = conduitOffset - 30; x < width + 58; x += 48) {
      this.backdrop.beginPath();
      this.backdrop.moveTo(x, floorY - 50);
      this.backdrop.lineTo(x + 8, floorY - 26);
      this.backdrop.lineTo(x + 4, floorY - 6);
      this.backdrop.strokePath();
    }

    this.backdrop.fillStyle(mood.markerColor, 0.12);
    for (let x = pulseOffset - 24; x < width + 54; x += 46) {
      this.backdrop.fillRect(x, floorY + 28, 20, 4);
    }
  }

  private bindAudioFeedback() {
    this.offAudioCue = audioCueBus.subscribe((event) => {
      if (event.type === 'spark_collect') {
        this.feedback.collect = Math.max(this.feedback.collect, Math.min(1, event.intensity * 0.5));
      }

      if (event.type === 'chain_success') {
        this.feedback.chain = Math.max(this.feedback.chain, Math.min(1, event.intensity * 0.22));
      }

      if (event.type === 'pulse_drop') {
        this.feedback.impact = Math.max(this.feedback.impact, Math.min(1, event.intensity * 0.32));
        this.cameras.main.shake(90, 0.0032, true);
      }

      if (event.type === 'awakening_gain') {
        this.feedback.awakening = Math.max(
          this.feedback.awakening,
          Math.min(1, event.intensity * 0.18)
        );
      }
    });
  }

  private handleShutdown() {
    this.offAudioCue?.();
    this.runnerLoop.destroy();
  }

  private createIngredient(x: number, y: number) {
    const halo = this.add
      .ellipse(0, 0, 74, 74, 0xf4ffb6, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    const outerRing = this.add.ellipse(0, 0, 42, 48, 0xffffff, 0).setStrokeStyle(2, 0x8eb0a3, 0.24);
    const innerRing = this.add.ellipse(0, 0, 30, 36, 0xffffff, 0).setStrokeStyle(2, 0xb9e0cf, 0.16);
    const noteHead = this.add.ellipse(-7, 10, 22, 17, 0xfaf5d6, 0.98).setStrokeStyle(2, 0x607368, 0.42);
    const stem = this.add.rectangle(4, -10, 6, 38, 0xfaf5d6, 0.98).setRotation(-0.04).setStrokeStyle(2, 0x607368, 0.32);
    const flag = this.add.triangle(18, -24, -2, 0, 12, -3, 0, 17, 0x96efb2, 0.98).setRotation(-0.18).setStrokeStyle(2, 0x3b6b50, 0.26);
    const core = this.add.ellipse(-4, 6, 8, 8, 0x9bffb3, 0.94);
    const sparkleA = this.add.ellipse(24, -10, 5, 5, 0xfff9e8, 0.84);
    const sparkleB = this.add.ellipse(-18, -18, 4, 4, 0xfff9e8, 0.72);
    const rayA = this.add.rectangle(-28, 2, 10, 2, 0xe8ffd0, 0.54).setRotation(-0.3);
    const rayB = this.add.rectangle(28, 14, 12, 2, 0xe8ffd0, 0.48).setRotation(0.42);

    return this.add
      .container(x, y, [
        halo,
        outerRing,
        innerRing,
        rayA,
        rayB,
        noteHead,
        stem,
        flag,
        core,
        sparkleA,
        sparkleB
      ])
      .setDepth(4.55)
      .setAlpha(0);
  }

  private createShark() {
    const glow = this.add
      .ellipse(0, 0, 86, 62, 0xffffff, 0.06)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shark = this.add.image(0, 0, SHARK_TEXTURE_KEY).setScale(-0.21, 0.21);

    return this.add.container(-120, 210, [glow, shark]).setDepth(4.9).setVisible(false);
  }

  private createFinishMessage(x: number, y: number) {
    const panel = this.add.graphics();
    panel.fillStyle(0x111720, 0.86);
    panel.lineStyle(2, 0xdce9d6, 0.14);
    panel.fillRoundedRect(-148, -66, 296, 132, 24);
    panel.strokeRoundedRect(-148, -66, 296, 132, 24);
    panel.fillStyle(0xf1ffbe, 0.07);
    panel.fillEllipse(-98, -2, 72, 72);
    panel.lineStyle(2, 0x9ee9b6, 0.12);
    panel.strokeEllipse(-98, -2, 54, 54);
    panel.lineStyle(2, 0xdce9d6, 0.08);
    panel.lineBetween(-46, -36, -46, 40);

    const eyebrow = this.add
      .text(14, -40, 'Ingrediente 1', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '10px',
        color: '#cfe8d9',
        letterSpacing: 1.4
      })
      .setOrigin(0, 0.5);
    const title = this.add
      .text(14, -18, 'Nota sol', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '20px',
        color: '#fff8ef'
      })
      .setOrigin(0, 0.5);
    const iconHalo = this.add
      .ellipse(-98, -2, 56, 56, 0xf4ffb6, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD);
    const iconHead = this.add.ellipse(-106, 8, 18, 14, 0xfaf5d6, 0.98).setStrokeStyle(2, 0x607368, 0.36);
    const iconStem = this.add.rectangle(-98, -12, 5, 30, 0xfaf5d6, 0.98).setRotation(-0.04).setStrokeStyle(2, 0x607368, 0.28);
    const iconFlag = this.add.triangle(-82, -26, -2, 0, 10, -2, 0, 14, 0x96efb2, 0.96).setRotation(-0.2);
    const iconSpark = this.add.ellipse(-76, 12, 5, 5, 0xfffae8, 0.82);
    const message = this.add
      .text(14, 16, FINISH_MESSAGE, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '13px',
        color: '#fff7ec',
        align: 'left',
        wordWrap: { width: 176, useAdvancedWrap: true },
        lineSpacing: 6
      })
      .setOrigin(0, 0.5);

    return this.add
      .container(x, y, [
        panel,
        iconHalo,
        iconHead,
        iconStem,
        iconFlag,
        iconSpark,
        eyebrow,
        title,
        message
      ])
      .setDepth(6.6)
      .setAlpha(0)
      .setScale(0.94);
  }

  private updateFinishObjects(time: number, loopSnapshot: RunnerLoopSnapshot) {
    const exitX = journeyConfig.logicalSize.width - 44 + loopSnapshot.finishRevealProgress * 6;
    const exitY = 190 - loopSnapshot.surfaceProgress * 28;
    const hover = Math.sin(time * 0.0042) * 3.6;
    const targetMessageAlpha = this.finishResolved ? 0.98 : 0;
    const nextMessageAlpha = Phaser.Math.Linear(this.finishMessage.alpha, targetMessageAlpha, 0.08);
    const nextMessageScale = Phaser.Math.Linear(
      this.finishMessage.scaleX,
      this.finishResolved ? 1.02 : 0.94,
      0.08
    );

    this.finishGlow
      .setPosition(journeyConfig.logicalSize.width - 18, 180 - loopSnapshot.surfaceProgress * 12)
      .setScale(1 + loopSnapshot.finishRevealProgress * 0.34, 1 + loopSnapshot.surfaceProgress * 0.26)
      .setFillStyle(
        0xf2ffce,
        0.02 + loopSnapshot.surfaceProgress * 0.12 + loopSnapshot.finishRevealProgress * 0.16 + this.finishPulse * 0.16
      );

    this.ingredient
      .setPosition(exitX, exitY + hover)
      .setAlpha(Math.max(loopSnapshot.finishRevealProgress, this.finishResolved ? 1 : 0))
      .setScale(0.92 + loopSnapshot.finishRevealProgress * 0.3 + this.finishPulse * 0.2)
      .setRotation(Math.sin(time * 0.0032) * 0.08 - loopSnapshot.finishRevealProgress * 0.04);

    this.finishMessage
      .setAlpha(nextMessageAlpha)
      .setScale(nextMessageScale)
      .setPosition(journeyConfig.logicalSize.width * 0.5, 124 - this.finishPulse * 6);

    if (loopSnapshot.levelComplete && !this.finishResolved) {
      this.finishResolved = true;
      this.finishPulse = 1;
      this.cameras.main.flash(220, 238, 255, 214, false);
    }
  }

  private updateSharkEvent(time: number, deltaSeconds: number, loopSnapshot: RunnerLoopSnapshot) {
    if (!this.sharkActive) {
      this.sharkCooldown -= deltaSeconds;

      if (
        this.sharkCooldown <= 0 &&
        loopSnapshot.levelProgress > 0.16 &&
        loopSnapshot.levelProgress < 0.84 &&
        !loopSnapshot.levelComplete
      ) {
        this.sharkActive = true;
        this.sharkProgress = 0;
        this.sharkDuration = Phaser.Math.FloatBetween(1.6, 2.1);
        this.sharkBaseY = Phaser.Math.Between(194, 242);
        this.sharkTagged = false;
        this.shark.setVisible(true);
        this.sharkShadow.setVisible(true);
      }

      return;
    }

    this.sharkProgress += deltaSeconds / this.sharkDuration;

    const arc = Math.sin(this.sharkProgress * Math.PI);
    const x = Phaser.Math.Linear(journeyConfig.logicalSize.width + 74, -90, this.sharkProgress);
    const y = this.sharkBaseY + Math.sin(this.sharkProgress * Math.PI * 2) * 12;

    this.shark
      .setPosition(x, y)
      .setScale(0.94 + arc * 0.05, 0.98 - arc * 0.03)
      .setRotation(Math.sin(time * 0.011) * 0.08 - 0.1);
    this.sharkShadow
      .setPosition(x + 6, runnerConfig.visual.groundLineY - 44 + arc * 4)
      .setAlpha(0.05 + arc * 0.05);

    if (!this.sharkTagged && Math.abs(x - this.hero.x) < 42 && Math.abs(y - this.hero.y) < 68) {
      this.sharkTagged = true;
      this.sharkBurst = 1;
    }

    if (this.sharkProgress >= 1) {
      this.sharkActive = false;
      this.shark.setVisible(false);
      this.sharkShadow.setVisible(false);
      this.sharkCooldown = Phaser.Math.FloatBetween(6.8, 10.6);
    }
  }

  private renderDebugOverlay(loopSnapshot: RunnerLoopSnapshot, time: number) {
    if (!this.debugGraphics) {
      return;
    }

    const heroBoundsX = loopSnapshot.heroX - runnerConfig.hero.hitbox.width / 2;
    const heroBoundsY = loopSnapshot.heroY - runnerConfig.hero.hitbox.topOffset;
    const heroCenterY = loopSnapshot.heroY - 26;
    const pulse = 0.2 + Math.sin(time * 0.0045) * 0.04;

    this.debugGraphics.clear();
    this.debugGraphics.fillStyle(0xa8ff6f, 0.07);
    this.debugGraphics.fillRect(loopSnapshot.heroX + 92, 64, 74, 500);
    this.debugGraphics.lineStyle(1, 0xffffff, 0.34);
    this.debugGraphics.strokeRect(
      heroBoundsX,
      heroBoundsY,
      runnerConfig.hero.hitbox.width,
      runnerConfig.hero.hitbox.topOffset + runnerConfig.hero.hitbox.bottomOffset
    );
    this.debugGraphics.strokeCircle(loopSnapshot.heroX + 4, heroCenterY, runnerConfig.rewards.collectRadius);

    if (loopSnapshot.projectedLandingX) {
      this.debugGraphics.lineStyle(2, 0xe6ff81, 0.5 + pulse);
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(loopSnapshot.projectedLandingX, runnerConfig.visual.groundLineY - 18);
      this.debugGraphics.lineTo(loopSnapshot.projectedLandingX, runnerConfig.visual.groundLineY + 22);
      this.debugGraphics.strokePath();
      this.debugGraphics.fillStyle(0xe6ff81, 0.22);
      this.debugGraphics.fillCircle(loopSnapshot.projectedLandingX, runnerConfig.visual.groundLineY + 10, 6);
    }

    if (time - this.lastDebugEmit > 90) {
      window.dispatchEvent(
        new CustomEvent('mateo:runner-debug', {
          detail: {
            phrase: loopSnapshot.currentPhraseLabel,
            coyoteMs: Math.round(loopSnapshot.coyoteSeconds * 1000),
            bufferMs: Math.round(loopSnapshot.jumpBufferSeconds * 1000),
            landingX:
              loopSnapshot.projectedLandingX === null
                ? null
                : Math.round(loopSnapshot.projectedLandingX),
            grounded: loopSnapshot.grounded
          }
        })
      );
      this.lastDebugEmit = time;
    }
  }
}
