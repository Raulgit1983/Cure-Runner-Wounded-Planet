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
const DEBUG_DECORATIVE_FAMILIES = ['backdrop', 'ground-markers', 'shark-friend'] as const;
const FINISH_TITLE = 'Primera nota despertada';
const FINISH_LABEL = 'La cura comienza';
const FINISH_BODY = 'El planeta ha sentido tu esfuerzo.';
const FINISH_CLOSING = 'La luz vuelve poco a poco.';
const FAIL_TITLE = 'Aún puedes seguir.';
const FAIL_BODY = 'La luz no se apaga aquí.';
const FAIL_CLOSING = 'Toca para intentarlo de nuevo.';
const HOME_BUTTON_LABEL = 'Volver al inicio';
const CONTINUE_BUTTON_LABEL = 'Continuar';
const CONTINUE_TITLE = 'Respira.';
const CONTINUE_BODY = 'Las cosas bonitas también se construyen paso a paso.';
const CONTINUE_CLOSING = 'Sigamos despertando este mundo juntos, con mamá también.';
const FIRST_HIT_REACTION = 'Ay!!';
const SECOND_HIT_REACTION = 'Ñó!!!';
const SHARK_PULSE_RESTORE = 0.26;
const SUPPORTIVE_LINES = [
  'Sigue subiendo.',
  'Cada paso lo despierta un poco más.',
  'La luz vuelve poco a poco.'
] as const;
const SHARK_LINES = ['Respira.', 'Arriba.', 'Toma aire.'] as const;

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
  private finishScrim!: Phaser.GameObjects.Rectangle;
  private finishGlow!: Phaser.GameObjects.Ellipse;
  private heroShadow!: Phaser.GameObjects.Ellipse;
  private heroAura!: Phaser.GameObjects.Ellipse;
  private hero!: Phaser.GameObjects.Image;
  private hitReaction!: Phaser.GameObjects.Container;
  private hitReactionText!: Phaser.GameObjects.Text;
  private ingredient!: Phaser.GameObjects.Container;
  private finishStage!: Phaser.GameObjects.Container;
  private continueStage!: Phaser.GameObjects.Container;
  private finishReward!: Phaser.GameObjects.Container;
  private finishMessage!: Phaser.GameObjects.Container;
  private failStage!: Phaser.GameObjects.Container;
  private retryOverlay!: Phaser.GameObjects.Rectangle;
  private runnerLoop!: RunnerLoopSystem;
  private shark!: Phaser.GameObjects.Container;
  private sharkShadow!: Phaser.GameObjects.Ellipse;
  private debugGraphics?: Phaser.GameObjects.Graphics;

  private baseHeroScale = 1;
  private heroRenderScaleX = 1;
  private heroRenderScaleY = 1;
  private backdropDistance = 0;
  private backdropSurfaceProgress = 0;
  private backdropFinishRevealProgress = 0;
  private backdropEnvironmentLevel = 0;
  private lastBackdropRenderDistance = Number.NaN;
  private lastBackdropRenderSurface = Number.NaN;
  private lastBackdropRenderFinish = Number.NaN;
  private lastBackdropRenderLevel = Number.NaN;
  private lastDebugEmit = 0;
  private finishPulse = 0;
  private finishResolved = false;
  private continueResolved = false;
  private finishSequence = 0;
  private failResolved = false;
  private victoryFrozen = false;
  private restartQueued = false;
  private returnHomeQueued = false;
  private hitReactionTimer = 0;
  private hitReactionDuration = 0.56;
  private hitReactionStrength = 0;
  private sharkBurst = 0;
  private sharkCooldown = 3.8;
  private sharkDuration = 1.9;
  private sharkProgress = 0;
  private sharkBaseY = 210;
  private sharkActive = false;
  private sharkTagged = false;
  private lastGuidanceAt = -9999;
  private guidanceIndex = 0;
  private sharkGuidanceIndex = 0;
  private lastSeenPhraseId = '';
  private surfaceGuidanceShown = false;
  private offAudioCue?: () => void;

  constructor() {
    super('journey');
  }

  create() {
    const heroY = runnerConfig.hero.runY;
    const heroX = runnerConfig.hero.screenX;
    const width = journeyConfig.logicalSize.width;

    this.backdropDistance = 0;
    this.backdropSurfaceProgress = 0;
    this.backdropFinishRevealProgress = 0;
    this.backdropEnvironmentLevel = sessionState.snapshot().displayLevel;
    this.lastBackdropRenderDistance = Number.NaN;
    this.lastBackdropRenderSurface = Number.NaN;
    this.lastBackdropRenderFinish = Number.NaN;
    this.lastBackdropRenderLevel = Number.NaN;
    this.finishPulse = 0;
    this.finishResolved = false;
    this.continueResolved = false;
    this.finishSequence = 0;
    this.failResolved = false;
    this.victoryFrozen = false;
    this.restartQueued = false;
    this.returnHomeQueued = false;
    this.hitReactionTimer = 0;
    this.hitReactionStrength = 0;
    this.sharkBurst = 0;
    this.sharkCooldown = 3.8;
    this.sharkActive = false;
    this.sharkTagged = false;
    this.lastGuidanceAt = -9999;
    this.guidanceIndex = 0;
    this.sharkGuidanceIndex = 0;
    this.lastSeenPhraseId = '';
    this.surfaceGuidanceShown = false;

    this.emitVictoryState(false);
    this.emitFocusMode(false);
    this.backdrop = this.add.graphics().setDepth(0);
    this.finishScrim = this.add
      .rectangle(width * 0.5, journeyConfig.logicalSize.height * 0.5, width, journeyConfig.logicalSize.height, 0x0a0d12, 0)
      .setDepth(5.8);
    this.finishGlow = this.add
      .ellipse(width - 20, 192, 128, 248, 0xf2ffce, 0)
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
    const hitReaction = this.createHitReaction();
    this.hitReaction = hitReaction.container;
    this.hitReactionText = hitReaction.text;

    this.baseHeroScale = heroProfile.mobileScale.preferredPx / this.hero.height;
    this.heroRenderScaleX = this.baseHeroScale;
    this.heroRenderScaleY = this.baseHeroScale;
    this.hero.setScale(this.baseHeroScale);
    this.ingredient = this.createIngredient(width - 52, 188);
    this.finishReward = this.createIngredient(0, -92).setAlpha(1).setScale(0.96);
    this.finishMessage = this.createFinishMessage(0, 44);
    this.finishStage = this.add
      .container(width * 0.63, 310, [this.finishReward, this.finishMessage])
      .setDepth(6.65)
      .setAlpha(0)
      .setScale(0.88);
    this.continueStage = this.createContinueStage(width * 0.63, 314);
    this.failStage = this.createFailStage(width * 0.5, 316);
    this.retryOverlay = this.add
      .rectangle(width * 0.5, journeyConfig.logicalSize.height * 0.5, width, journeyConfig.logicalSize.height, 0x000000, 0.001)
      .setDepth(6.76)
      .setAlpha(0)
      .setVisible(false);
    this.sharkShadow = this.add
      .ellipse(-120, runnerConfig.visual.groundLineY - 44, 58, 12, 0x09080d, 0.1)
      .setDepth(4.45)
      .setVisible(false);
    this.shark = this.createShark();
    this.debugGraphics = this.showDebug ? this.add.graphics().setDepth(6.8) : undefined;

    runTelemetryStore.beginRun();
    this.runnerLoop = new RunnerLoopSystem(this, this.showDebug);
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

    if (loopSnapshot.runFailed && !this.failResolved && !this.finishResolved) {
      this.beginFailureBeat();
    }

    if (this.finishResolved) {
      this.finishSequence = Math.min(1, this.finishSequence + deltaSeconds * 2.6);

      if (!this.victoryFrozen) {
        this.runnerLoop.setFrozen(true);
        this.victoryFrozen = true;
      }
    }

    this.feedback.collect = Math.max(0, this.feedback.collect - deltaSeconds * 3);
    this.feedback.chain = Math.max(0, this.feedback.chain - deltaSeconds * 1.6);
    this.feedback.impact = Math.max(0, this.feedback.impact - deltaSeconds * 2.4);
    this.feedback.awakening = Math.max(0, this.feedback.awakening - deltaSeconds * 1.5);
    this.finishPulse = Math.max(0, this.finishPulse - deltaSeconds * 1.8);
    this.hitReactionTimer = Math.max(0, this.hitReactionTimer - deltaSeconds);
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
    const backdropFollow =
      1 - Math.exp(-deltaSeconds * journeyConfig.backdrop.followSharpness);

    this.backdropDistance = Phaser.Math.Linear(
      this.backdropDistance,
      loopSnapshot.distanceTravelled,
      backdropFollow
    );
    this.backdropSurfaceProgress = Phaser.Math.Linear(
      this.backdropSurfaceProgress,
      loopSnapshot.surfaceProgress,
      backdropFollow
    );
    this.backdropFinishRevealProgress = Phaser.Math.Linear(
      this.backdropFinishRevealProgress,
      loopSnapshot.finishRevealProgress,
      backdropFollow
    );
    this.backdropEnvironmentLevel = Phaser.Math.Linear(
      this.backdropEnvironmentLevel,
      environmentLevel,
      backdropFollow
    );

    if (this.shouldRenderBackdrop()) {
      const renderMood = this.emotionController.getMood(this.backdropEnvironmentLevel);

      this.renderBackdrop(
        renderMood,
        this.backdropDistance,
        this.backdropSurfaceProgress,
        this.backdropFinishRevealProgress
      );
      this.lastBackdropRenderDistance = this.backdropDistance;
      this.lastBackdropRenderSurface = this.backdropSurfaceProgress;
      this.lastBackdropRenderFinish = this.backdropFinishRevealProgress;
      this.lastBackdropRenderLevel = this.backdropEnvironmentLevel;
    }

    if (!this.failResolved && !this.finishResolved) {
      this.updateSharkEvent(time, deltaSeconds, loopSnapshot);
      this.updateGuidanceMoments(time, loopSnapshot);
    }

    this.updateFinishObjects(time, loopSnapshot);
    this.updateFailureObjects();

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
    const victoryBounce =
      this.finishResolved
        ? Math.sin(this.finishSequence * Math.PI) * (1 - this.finishSequence * 0.28) * 7
        : 0;
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
          loopSnapshot.surfaceProgress * 6 -
          victoryBounce
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

    this.updateHitReaction();

    if (this.showDebug) {
      this.renderDebugOverlay(loopSnapshot, time);
    }
  }

  private shouldRenderBackdrop() {
    if (!Number.isFinite(this.lastBackdropRenderDistance)) {
      return true;
    }

    return (
      Math.abs(this.backdropDistance - this.lastBackdropRenderDistance) >=
        journeyConfig.backdrop.redrawDistancePx ||
      Math.abs(this.backdropSurfaceProgress - this.lastBackdropRenderSurface) >=
        journeyConfig.backdrop.redrawProgressStep ||
      Math.abs(this.backdropFinishRevealProgress - this.lastBackdropRenderFinish) >=
        journeyConfig.backdrop.redrawProgressStep ||
      Math.abs(this.backdropEnvironmentLevel - this.lastBackdropRenderLevel) >=
        journeyConfig.backdrop.redrawEmotionStep
    );
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
    const interiorDarkness = Phaser.Math.Clamp(
      1 - surfaceProgress * 1.2 - finishRevealProgress * 0.85,
      0,
      1
    );
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

    if (interiorDarkness > 0.01) {
      this.backdrop.fillStyle(0x04070b, 0.18 * interiorDarkness);
      this.backdrop.fillRect(0, 0, width, height);
      this.backdrop.fillStyle(0x091017, 0.1 * interiorDarkness);
      this.backdrop.fillEllipse(width * 0.26, height * 0.28, 208, 168);
      this.backdrop.fillEllipse(width * 0.74, height * 0.34, 244, 196);
    }

    this.backdrop.fillStyle(mood.hazeColor, 0.08 + surfaceProgress * 0.03);
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

        const state = sessionState.snapshot();
        const runFailed = this.runnerLoop.snapshot().runFailed;

        if (!runFailed && !this.failResolved && !this.finishResolved) {
          if (state.currentPulse <= runnerConfig.obstacle.pulseLoss + 0.03) {
            this.showHitReaction(SECOND_HIT_REACTION, 1);
          } else {
            this.showHitReaction(FIRST_HIT_REACTION, 0);
          }
        }
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
    this.emitVictoryState(false);
    this.emitFocusMode(false);
    this.offAudioCue?.();
    this.runnerLoop.destroy();
  }

  private createIngredient(x: number, y: number) {
    const trebleGlyph = '\uD834\uDD1E';
    const halo = this.add
      .ellipse(0, 0, 82, 82, 0xe2f6b5, 0.11)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shellGlow = this.add
      .ellipse(0, 4, 60, 72, 0xd7f1d6, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x6a7d72, 0.26);
    frame.strokeEllipse(0, 2, 46, 62);
    frame.lineStyle(2, 0xf2f8e5, 0.18);
    frame.strokeEllipse(0, 2, 30, 44);
    const clefAura = this.add
      .text(2, -1, trebleGlyph, {
        fontFamily: '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", Georgia, serif',
        fontSize: '88px',
        color: '#9fffba'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0.16);
    const clefShadow = this.add
      .text(4, 2, trebleGlyph, {
        fontFamily: '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", Georgia, serif',
        fontSize: '84px',
        color: '#0f1517'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0.28);
    const clef = this.add
      .text(0, -2, trebleGlyph, {
        fontFamily: '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", Georgia, serif',
        fontSize: '84px',
        color: '#f4f8e4',
        stroke: '#50655a',
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 2, '#0a1015', 4, false, true);

    const orbitTop = this.add.ellipse(6, -44, 8, 8, 0xf8ffec, 0.92).setStrokeStyle(2, 0x66796c, 0.2);
    const heartCore = this.add.ellipse(-1, 2, 16, 16, 0x97ffae, 0.94).setStrokeStyle(2, 0x466145, 0.26);
    const heartSpark = this.add.ellipse(-1, 2, 7, 7, 0xfffcf0, 0.96);
    const lowerSeed = this.add.ellipse(-2, 21, 8, 8, 0xc8e7ab, 0.86).setStrokeStyle(2, 0x4d6242, 0.18);
    const sideLeafLeft = this.add
      .triangle(-15, -10, -7, 7, 0, -10, 8, 8, 0xe4f2cf, 0.8)
      .setRotation(-0.58)
      .setStrokeStyle(2, 0x586b5e, 0.14);
    const sideLeafRight = this.add
      .triangle(16, 12, -8, 7, 0, -10, 7, 8, 0xe4f2cf, 0.74)
      .setRotation(0.48)
      .setStrokeStyle(2, 0x586b5e, 0.14);
    const sparkleA = this.add.ellipse(24, -16, 4, 4, 0xfff9e8, 0.5);
    const sparkleB = this.add.ellipse(-22, -24, 3, 3, 0xfff9e8, 0.36);
    const sparkleC = this.add.ellipse(-20, 30, 3, 3, 0xf4ffcc, 0.32);

    return this.add
      .container(x, y, [
        halo,
        shellGlow,
        frame,
        clefAura,
        clefShadow,
        clef,
        orbitTop,
        heartCore,
        heartSpark,
        lowerSeed,
        sideLeafLeft,
        sideLeafRight,
        sparkleA,
        sparkleB,
        sparkleC
      ])
      .setDepth(6.35)
      .setAlpha(0);
  }

  private createHitReaction() {
    const bubble = this.add.graphics();
    bubble.fillStyle(0x121920, 0.96);
    bubble.lineStyle(2, 0xf1eadb, 0.18);
    bubble.fillRoundedRect(-34, -20, 68, 30, 14);
    bubble.strokeRoundedRect(-34, -20, 68, 30, 14);
    bubble.fillStyle(0x121920, 0.96);
    bubble.fillTriangle(-2, 10, 8, 10, 4, 21);
    bubble.lineStyle(2, 0xf1eadb, 0.12);
    bubble.strokePoints(
      [
        new Phaser.Geom.Point(-2, 10),
        new Phaser.Geom.Point(4, 21),
        new Phaser.Geom.Point(8, 10)
      ],
      true,
      true
    );
    bubble.fillStyle(0xf4ffd8, 0.035);
    bubble.fillRoundedRect(-22, -13, 30, 7, 6);

    const text = this.add
      .text(0, -5, FIRST_HIT_REACTION, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '16px',
        color: '#fff8ee',
        stroke: '#091018',
        strokeThickness: 2,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#05080b', 2, false, true);

    return {
      container: this.add.container(0, 0, [bubble, text]).setDepth(6.2).setAlpha(0).setVisible(false),
      text
    };
  }

  private createShark() {
    const shadow = this.add.ellipse(2, 24, 72, 18, 0x081018, 0.16);
    const glow = this.add
      .ellipse(0, 2, 92, 66, 0xd9f1dc, 0.032)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shark = this.add
      .image(0, 0, SHARK_TEXTURE_KEY)
      .setScale(-0.084, 0.084)
      .setAlpha(0.94)
      .setTint(0xe5ece7);

    return this.add.container(-120, 210, [shadow, glow, shark]).setDepth(4.9).setVisible(false);
  }

  private createPanelButton(label: string, width: number, onPress: () => void, fontSize = '12px') {
    const panel = this.add.graphics();
    panel.fillStyle(0x121a21, 0.94);
    panel.lineStyle(2, 0xdde8cf, 0.16);
    panel.fillRoundedRect(-width * 0.5, -17, width, 34, 14);
    panel.strokeRoundedRect(-width * 0.5, -17, width, 34, 14);
    panel.fillStyle(0xf4ffd8, 0.03);
    panel.fillRoundedRect(-width * 0.5 + 8, -10, width - 16, 8, 10);

    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize,
        color: '#f7f6ec',
        stroke: '#0a1015',
        strokeThickness: 1,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);

    const hit = this.add
      .rectangle(0, 0, width, 38, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    const button = this.add.container(0, 0, [panel, text, hit]).setSize(width, 38);

    hit.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        onPress();
      }
    );
    hit.on('pointerover', () => {
      button.setScale(1.02).setAlpha(1);
    });
    hit.on('pointerout', () => {
      button.setScale(1).setAlpha(0.98);
    });

    return button.setAlpha(0.98);
  }

  private createFinishMessage(x: number, y: number) {
    const panel = this.add.graphics();
    panel.fillStyle(0x0b1117, 0.95);
    panel.lineStyle(2, 0xdce9d6, 0.1);
    panel.fillRoundedRect(-118, -78, 236, 184, 22);
    panel.strokeRoundedRect(-118, -78, 236, 184, 22);
    panel.lineStyle(1, 0xf7fff0, 0.02);
    panel.strokeRoundedRect(-110, -70, 220, 168, 18);
    panel.fillStyle(0xf1ffbe, 0.03);
    panel.fillEllipse(0, -48, 90, 28);
    panel.fillStyle(0xd8f4df, 0.03);
    panel.fillCircle(-82, -46, 2);
    panel.fillCircle(82, -46, 2);
    panel.lineStyle(2, 0x9ee9b6, 0.06);
    panel.lineBetween(-68, -6, 68, -6);

    const title = this.add
      .text(0, -48, FINISH_TITLE, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '14px',
        color: '#fff8ef',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 192, useAdvancedWrap: true },
        lineSpacing: 2
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const label = this.add
      .text(0, -20, FINISH_LABEL, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '20px',
        color: '#e9ffaf',
        stroke: '#081018',
        strokeThickness: 2,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#03060a', 3, false, true);
    const body = this.add
      .text(0, 16, FINISH_BODY, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '13px',
        color: '#fff7ec',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 186, useAdvancedWrap: true },
        lineSpacing: 3
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const closing = this.add
      .text(0, 44, FINISH_CLOSING, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '12px',
        color: '#cfe8d9',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 188, useAdvancedWrap: true },
        lineSpacing: 3
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const continueButton = this.createPanelButton(
      CONTINUE_BUTTON_LABEL,
      88,
      () => this.openContinuation(),
      '11px'
    );
    const homeButton = this.createPanelButton(
      HOME_BUTTON_LABEL,
      118,
      () => this.returnToStart(),
      '11px'
    );

    continueButton.setPosition(-56, 86);
    homeButton.setPosition(54, 86);

    return this.add.container(x, y, [
      panel,
      title,
      label,
      body,
      closing,
      continueButton,
      homeButton
    ]);
  }

  private createContinueStage(x: number, y: number) {
    const panel = this.add.graphics();
    panel.fillStyle(0x0b1117, 0.95);
    panel.lineStyle(2, 0xdce9d6, 0.1);
    panel.fillRoundedRect(-116, -68, 232, 162, 22);
    panel.strokeRoundedRect(-116, -68, 232, 162, 22);
    panel.lineStyle(1, 0xf7fff0, 0.02);
    panel.strokeRoundedRect(-108, -60, 216, 146, 18);
    panel.fillStyle(0xf1ffbe, 0.026);
    panel.fillEllipse(0, -30, 76, 22);
    panel.fillStyle(0xd8f4df, 0.028);
    panel.fillCircle(-76, -30, 2);
    panel.fillCircle(76, -30, 2);

    const title = this.add
      .text(0, -30, CONTINUE_TITLE, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '20px',
        color: '#f2ffbe',
        stroke: '#081018',
        strokeThickness: 2,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#03060a', 3, false, true);
    const body = this.add
      .text(0, 6, CONTINUE_BODY, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '13px',
        color: '#fff7ec',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 186, useAdvancedWrap: true },
        lineSpacing: 3
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const closing = this.add
      .text(0, 46, CONTINUE_CLOSING, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '12px',
        color: '#cfe8d9',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 184, useAdvancedWrap: true },
        lineSpacing: 3
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const button = this.createPanelButton(HOME_BUTTON_LABEL, 136, () => this.returnToStart());

    button.setPosition(0, 86);

    return this.add
      .container(x, y, [panel, title, body, closing, button])
      .setDepth(6.66)
      .setAlpha(0)
      .setScale(0.9);
  }

  private createFailStage(x: number, y: number) {
    const panel = this.add.graphics();
    panel.fillStyle(0x10151d, 0.96);
    panel.lineStyle(2, 0xdce9d6, 0.1);
    panel.fillRoundedRect(-118, -74, 236, 160, 20);
    panel.strokeRoundedRect(-118, -74, 236, 160, 20);
    panel.lineStyle(1, 0xf7fff0, 0.018);
    panel.strokeRoundedRect(-110, -66, 220, 144, 16);
    panel.fillStyle(0xf1ffbe, 0.024);
    panel.fillEllipse(0, -28, 72, 20);
    panel.fillStyle(0xd8f4df, 0.03);
    panel.fillCircle(-80, -30, 2);
    panel.fillCircle(80, -30, 2);

    const title = this.add
      .text(0, -34, FAIL_TITLE, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '17px',
        color: '#fff8ef',
        stroke: '#091018',
        strokeThickness: 2,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 3, false, true);
    const body = this.add
      .text(0, 2, FAIL_BODY, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '14px',
        color: '#f3f0e8',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 182, useAdvancedWrap: true },
        lineSpacing: 3
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const closing = this.add
      .text(0, 34, FAIL_CLOSING, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '12px',
        color: '#cfe8d9',
        stroke: '#091018',
        strokeThickness: 1,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);
    const button = this.createPanelButton(HOME_BUTTON_LABEL, 136, () => this.returnToStart());

    button.setPosition(0, 74);

    return this.add
      .container(x, y, [panel, title, body, closing, button])
      .setDepth(6.62)
      .setAlpha(0)
      .setScale(0.92)
      .setSize(236, 160);
  }

  private updateFinishObjects(time: number, loopSnapshot: RunnerLoopSnapshot) {
    if (this.failResolved && !this.finishResolved) {
      this.ingredient.setAlpha(0);
      this.finishStage.setAlpha(0);
      this.continueStage.setAlpha(0);
      return;
    }

    const exitX = journeyConfig.logicalSize.width - 44 + loopSnapshot.finishRevealProgress * 6;
    const exitY = 190 - loopSnapshot.surfaceProgress * 28;
    const hover = Math.sin(time * 0.0042) * 3.6;
    const sequenceEase = Phaser.Math.Easing.Cubic.Out(this.finishSequence);
    const sequenceBack = Phaser.Math.Easing.Back.Out(this.finishSequence);
    const previewAlpha = this.finishResolved
      ? Phaser.Math.Linear(this.ingredient.alpha, 0, 0.18)
      : Math.max(loopSnapshot.finishRevealProgress, 0);
    const stageAlphaTarget = this.finishResolved && !this.continueResolved ? 0.98 : 0;
    const nextStageAlpha = Phaser.Math.Linear(this.finishStage.alpha, stageAlphaTarget, 0.12);
    const nextStageScale = Phaser.Math.Linear(
      this.finishStage.scaleX,
      this.finishResolved && !this.continueResolved ? 0.98 : 0.88,
      0.12
    );
    const continueAlphaTarget = this.finishResolved && this.continueResolved ? 0.98 : 0;
    const nextContinueAlpha = Phaser.Math.Linear(this.continueStage.alpha, continueAlphaTarget, 0.12);
    const nextContinueScale = Phaser.Math.Linear(
      this.continueStage.scaleX,
      this.finishResolved && this.continueResolved ? 0.98 : 0.9,
      0.12
    );
    const scrimTarget = this.finishResolved ? 0.08 : 0;

    this.finishGlow
      .setPosition(
        Phaser.Math.Linear(journeyConfig.logicalSize.width - 16, journeyConfig.logicalSize.width * 0.76, sequenceEase),
        Phaser.Math.Linear(188 - loopSnapshot.surfaceProgress * 10, 176, sequenceEase)
      )
      .setScale(
        1 + loopSnapshot.finishRevealProgress * 0.16 + sequenceEase * 0.12,
        1 + loopSnapshot.surfaceProgress * 0.12 + sequenceEase * 0.08
      )
      .setFillStyle(
        0xf2ffce,
        0.008 +
          loopSnapshot.surfaceProgress * 0.05 +
          loopSnapshot.finishRevealProgress * 0.07 +
          this.finishPulse * 0.03 +
          sequenceEase * 0.02
      );

    this.finishScrim.setAlpha(Phaser.Math.Linear(this.finishScrim.alpha, scrimTarget, 0.08));

    this.ingredient
      .setPosition(exitX, exitY + hover)
      .setAlpha(previewAlpha)
      .setScale(0.84 + loopSnapshot.finishRevealProgress * 0.14 + this.finishPulse * 0.08 + sequenceBack * 0.12)
      .setRotation(Math.sin(time * 0.0032) * 0.08 - loopSnapshot.finishRevealProgress * 0.04 + sequenceEase * 0.03);

    this.finishReward
      .setScale(0.94 + this.finishPulse * 0.06 + sequenceBack * 0.08)
      .setRotation(Math.sin(time * 0.0031) * 0.04 - sequenceEase * 0.02);

    this.finishStage
      .setAlpha(nextStageAlpha)
      .setScale(nextStageScale)
      .setPosition(journeyConfig.logicalSize.width * 0.63 + sequenceEase * 4, 308 - sequenceEase * 5);
    this.continueStage
      .setAlpha(nextContinueAlpha)
      .setScale(nextContinueScale)
      .setPosition(journeyConfig.logicalSize.width * 0.63 + sequenceEase * 3, 312 - sequenceEase * 4);

    if (loopSnapshot.levelComplete && !this.finishResolved) {
      this.beginVictoryBeat();
    }
  }

  private updateFailureObjects() {
    const targetAlpha = this.failResolved ? 1 : 0;
    const targetScale = this.failResolved ? 1 : 0.92;
    const targetY = this.failResolved ? 308 : 316;

    this.failStage
      .setAlpha(Phaser.Math.Linear(this.failStage.alpha, targetAlpha, 0.16))
      .setScale(Phaser.Math.Linear(this.failStage.scaleX, targetScale, 0.16))
      .setPosition(this.failStage.x, Phaser.Math.Linear(this.failStage.y, targetY, 0.16));
  }

  private beginVictoryBeat() {
    if (this.finishResolved) {
      return;
    }

    this.finishResolved = true;
    this.continueResolved = false;
    this.finishPulse = 1;
    this.hitReactionTimer = 0;
    this.haltSharkEvent();
    this.emitFocusMode(true);
    this.emitVictoryState(true);

    if (!this.victoryFrozen) {
      this.runnerLoop.setFrozen(true);
      this.victoryFrozen = true;
    }

    this.children.bringToTop(this.finishStage);

    audioCueBus.emit({
      type: 'victory_win',
      intensity: 1.1
    });
    this.cameras.main.flash(100, 220, 255, 186, false);
  }

  private beginFailureBeat() {
    if (this.failResolved || this.finishResolved) {
      return;
    }

    this.failResolved = true;
    this.restartQueued = false;
    this.hitReactionTimer = 0;
    this.finishStage.setAlpha(0);
    this.continueStage.setAlpha(0);
    this.ingredient.setAlpha(0);
    this.input.enabled = true;
    this.children.bringToTop(this.retryOverlay);
    this.children.bringToTop(this.failStage);
    this.retryOverlay
      .setVisible(true)
      .setAlpha(0.001)
      .setInteractive()
      .off('pointerdown', this.restartFromFailure, this)
      .on('pointerdown', this.restartFromFailure, this);
    this.haltSharkEvent();
    this.emitFocusMode(true);
  }

  private restartFromFailure(pointer: Phaser.Input.Pointer) {
    this.logRetryDebug('retry target hit', {
      button: pointer.button,
      failResolved: this.failResolved,
      inputEnabled: this.input.enabled,
      restartQueued: this.restartQueued,
      x: Math.round(pointer.x),
      y: Math.round(pointer.y)
    });

    if (!pointer.wasTouch && pointer.button !== 0) {
      this.logRetryDebug('restart ignored', {
        button: pointer.button,
        reason: 'non-primary pointer'
      });
      return;
    }

    if (!this.failResolved) {
      this.logRetryDebug('restart ignored', {
        reason: 'fail-state not active'
      });
      return;
    }

    if (!this.input.enabled) {
      this.logRetryDebug('restart ignored', {
        reason: 'scene input disabled'
      });
      return;
    }

    if (this.restartQueued) {
      this.logRetryDebug('retry guard active', {
        reason: 'restart already queued'
      });
      return;
    }

    this.restartQueued = true;
    this.time.delayedCall(0, this.triggerRestartFromFailure, undefined, this);
  }

  private triggerRestartFromFailure() {
    if (!this.failResolved) {
      this.restartQueued = false;
      this.logRetryDebug('restart ignored', {
        reason: 'fail-state cleared before restart'
      });
      return;
    }

    this.logRetryDebug('restart actually triggered');
    this.emitFocusMode(false);
    sessionState.restartRun();
    this.scene.restart();
  }

  private showHitReaction(text: string, strength: number) {
    this.hitReactionText.setText(text).setFontSize(strength > 0 ? 17 : 16);
    this.hitReactionTimer = this.hitReactionDuration;
    this.hitReactionStrength = strength;
    this.hitReaction.setVisible(true).setAlpha(1).setScale(0.94 + strength * 0.05);
  }

  private updateHitReaction() {
    if (this.hitReactionTimer <= 0 || this.failResolved || this.finishResolved) {
      this.hitReaction.setAlpha(0).setVisible(false);
      return;
    }

    const progress = 1 - this.hitReactionTimer / this.hitReactionDuration;
    const appear = Phaser.Math.Clamp(progress / 0.16, 0, 1);
    const fade = Phaser.Math.Clamp((progress - 0.6) / 0.4, 0, 1);
    const alpha = appear * (1 - fade);
    const rise = Phaser.Math.Easing.Cubic.Out(progress) * (18 + this.hitReactionStrength * 4);
    const scale = 0.92 + appear * 0.12 + this.hitReactionStrength * 0.04 - fade * 0.05;

    this.hitReaction
      .setVisible(alpha > 0.02)
      .setAlpha(alpha)
      .setScale(scale)
      .setPosition(
        Math.round(this.hero.x + 52 + this.hitReactionStrength * 4),
        Math.round(this.hero.y - 92 - rise)
      );
  }

  private returnToStart() {
    if (this.returnHomeQueued) {
      return;
    }

    this.returnHomeQueued = true;
    this.emitFocusMode(false);
    this.emitVictoryState(false);

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private openContinuation() {
    if (!this.finishResolved || this.continueResolved) {
      return;
    }

    this.continueResolved = true;
    this.children.bringToTop(this.continueStage);
  }

  private haltSharkEvent() {
    this.sharkActive = false;
    this.sharkTagged = false;
    this.shark.setVisible(false);
    this.sharkShadow.setVisible(false);
    this.sharkBurst = Math.min(this.sharkBurst, 0.16);
  }

  private emitVictoryState(active: boolean) {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('mateo:victory-state', {
        detail: {
          active
        }
      })
    );
  }

  private emitFocusMode(active: boolean) {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('mateo:focus-mode', {
        detail: {
          active
        }
      })
    );
  }

  private emitGuidanceLine(text: string, durationMs = 1800, time = 0) {
    if (typeof window === 'undefined') {
      return;
    }

    this.lastGuidanceAt = time;
    window.dispatchEvent(
      new CustomEvent('mateo:guidance-line', {
        detail: {
          text,
          durationMs
        }
      })
    );
  }

  private updateGuidanceMoments(time: number, loopSnapshot: RunnerLoopSnapshot) {
    if (
      loopSnapshot.currentPhraseId !== this.lastSeenPhraseId &&
      loopSnapshot.currentPhraseFamily === 'recovery' &&
      time - this.lastGuidanceAt > 6200
    ) {
      const line = SUPPORTIVE_LINES[this.guidanceIndex % SUPPORTIVE_LINES.length]!;
      this.guidanceIndex += 1;
      this.emitGuidanceLine(line, 1800, time);
    }

    if (!this.surfaceGuidanceShown && loopSnapshot.surfaceProgress >= 0.56 && time - this.lastGuidanceAt > 4200) {
      this.surfaceGuidanceShown = true;
      this.emitGuidanceLine('La luz vuelve poco a poco.', 1800, time);
    }

    this.lastSeenPhraseId = loopSnapshot.currentPhraseId;
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
    const y =
      this.sharkBaseY +
      Math.sin(this.sharkProgress * Math.PI * 2) * 12 +
      Math.sin(time * 0.007 + this.sharkProgress * 8) * 4;

    this.shark
      .setPosition(x, y)
      .setScale(0.93 + arc * 0.055, 0.985 - arc * 0.032)
      .setRotation(Math.sin(time * 0.011 + this.sharkProgress * 3.2) * 0.085 - 0.1);
    this.sharkShadow
      .setPosition(x + 6, runnerConfig.visual.groundLineY - 44 + arc * 4)
      .setAlpha(0.05 + arc * 0.05);

    if (!this.sharkTagged && Math.abs(x - this.hero.x) < 42 && Math.abs(y - this.hero.y) < 68) {
      this.sharkTagged = true;
      this.sharkBurst = 1;
      const pulseBefore = sessionState.snapshot().currentPulse;
      const pulseRestore = Math.min(SHARK_PULSE_RESTORE, Math.max(0, 1 - pulseBefore));

      if (pulseRestore > 0.01) {
        sessionState.pulse(pulseRestore);
        const line = SHARK_LINES[this.sharkGuidanceIndex % SHARK_LINES.length]!;
        this.sharkGuidanceIndex += 1;
        this.emitGuidanceLine(line, 1200, time);
      }
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

    const debugGraphics = this.debugGraphics;
    const debugEntities = this.runnerLoop.debugSnapshot();
    const heroBoundsX = loopSnapshot.heroX - runnerConfig.hero.hitbox.width / 2;
    const heroBoundsY = loopSnapshot.heroY - runnerConfig.hero.hitbox.topOffset;
    const heroCenterY = loopSnapshot.heroY - 26;
    const pulse = 0.2 + Math.sin(time * 0.0045) * 0.04;

    debugGraphics.clear();
    debugGraphics.fillStyle(0xa8ff6f, 0.07);
    debugGraphics.fillRect(loopSnapshot.heroX + 92, 64, 74, 500);
    debugGraphics.lineStyle(1, 0xffffff, 0.34);
    debugGraphics.strokeRect(
      heroBoundsX,
      heroBoundsY,
      runnerConfig.hero.hitbox.width,
      runnerConfig.hero.hitbox.topOffset + runnerConfig.hero.hitbox.bottomOffset
    );
    debugGraphics.strokeCircle(loopSnapshot.heroX + 4, heroCenterY, runnerConfig.rewards.collectRadius);

    debugEntities.forEach((entity) => {
      const color =
        entity.role === 'hazard'
          ? 0xff7a63
          : entity.role === 'collectible'
            ? 0x7cf4df
            : 0xb8c2d4;
      const fillAlpha =
        entity.role === 'hazard'
          ? entity.active
            ? 0.14
            : 0.06
          : entity.role === 'collectible'
            ? 0.08
            : 0.04;
      const strokeAlpha = entity.active ? 0.84 : 0.38;

      debugGraphics.fillStyle(color, fillAlpha);
      debugGraphics.fillRect(
        entity.hitbox.x,
        entity.hitbox.y,
        entity.hitbox.width,
        entity.hitbox.height
      );
      debugGraphics.lineStyle(entity.role === 'hazard' ? 2 : 1, color, strokeAlpha);
      debugGraphics.strokeRect(
        entity.hitbox.x,
        entity.hitbox.y,
        entity.hitbox.width,
        entity.hitbox.height
      );
    });

    if (this.shark.visible) {
      debugGraphics.lineStyle(1, 0xb8c2d4, 0.6);
      debugGraphics.strokeEllipse(this.shark.x, this.shark.y, 74, 34);
    }

    if (loopSnapshot.projectedLandingX) {
      debugGraphics.lineStyle(2, 0xe6ff81, 0.5 + pulse);
      debugGraphics.beginPath();
      debugGraphics.moveTo(loopSnapshot.projectedLandingX, runnerConfig.visual.groundLineY - 18);
      debugGraphics.lineTo(loopSnapshot.projectedLandingX, runnerConfig.visual.groundLineY + 22);
      debugGraphics.strokePath();
      debugGraphics.fillStyle(0xe6ff81, 0.22);
      debugGraphics.fillCircle(loopSnapshot.projectedLandingX, runnerConfig.visual.groundLineY + 10, 6);
    }

    if (time - this.lastDebugEmit > 90) {
      const activeHazards =
        debugEntities
          .filter((entity) => entity.role === 'hazard' && entity.active)
          .map((entity) => `${entity.label}@${Math.round(entity.screenX)}`)
          .join(', ') || 'none';

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
            grounded: loopSnapshot.grounded,
            hazards: activeHazards,
            decor: this.getDecorativeDebugLabels().join(', '),
            retry: this.getRetryDebugState()
          }
        })
      );
      this.lastDebugEmit = time;
    }
  }

  private getRetryDebugState() {
    if (!this.failResolved) {
      return 'idle';
    }

    return this.restartQueued ? 'queued' : 'ready';
  }

  private getDecorativeDebugLabels() {
    return DEBUG_DECORATIVE_FAMILIES.filter((label) => label !== 'shark-friend' || this.shark.visible);
  }

  private logRetryDebug(message: string, details?: Record<string, unknown>) {
    if (!this.showDebug) {
      return;
    }

    console.info('[retry-flow]', message, details ?? {});
  }
}
