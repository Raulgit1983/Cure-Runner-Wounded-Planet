import Phaser from 'phaser';

import { heroProfile } from '@/game/content/heroProfile';
import { journeyStages, type JourneyStageDefinition, type JourneyStageKey } from '@/game/content/journeyStages';
import { journeyConfig } from '@/game/content/journeyConfig';
import { runnerConfig } from '@/game/content/runnerConfig';
import { audioCueBus } from '@/game/services/audio/audioCueBus';
import { localProgressStore } from '@/game/services/persistence/localProgressStore';
import { runTelemetryStore } from '@/game/services/telemetry/runTelemetryStore';
import { sessionState } from '@/game/state/sessionState';
import { EmotionController } from '@/game/systems/emotion/EmotionController';
import { RunnerLoopSystem, type RunnerLoopSnapshot } from '@/game/systems/runner/RunnerLoopSystem';

const SHARK_TEXTURE_KEY = 'shark-friend';
const DEBUG_DECORATIVE_FAMILIES = ['backdrop', 'ground-markers', 'shark-friend'] as const;
const FINISH_TITLE = 'Nota despertada';
const FINISH_LABEL = 'Algo cambió.';
const FINISH_BODY = 'Algo ha despertado.';
const FINISH_CLOSING = 'La luz abre camino.';
const MOONLIGHT_FINISH_TITLE = 'Reflejo despierto';
const MOONLIGHT_FINISH_LABEL = 'Hasta aquí, por ahora.';
const MOONLIGHT_FINISH_BODY = 'No hay más niveles todavía.';
const MOONLIGHT_FINISH_CLOSING = 'Puedes repetir o volver.';
const FINISH_REWARD_ZONE_X = 236;
const FINISH_REWARD_ZONE_Y = 332;
const FINISH_HERO_REACH_X = FINISH_REWARD_ZONE_X - 70;
const FINISH_HERO_REACH_Y = FINISH_REWARD_ZONE_Y + 128;
const FINISH_CONTACT_BEAT_AT = 0.6;
const FINISH_PANEL_REVEAL_AT = 0.94;
const FINISH_SEQUENCE_SPEED = 1.85;
const FAIL_TITLE = 'Aún hay luz.';
const FAIL_BODY = 'El camino no se cierra.';
const FAIL_CLOSING = 'Toca para volver.';
const MOONLIGHT_FAIL_TITLE = 'Aún hay reflejo.';
const MOONLIGHT_FAIL_BODY = 'La luna sigue ahí.';
const MOONLIGHT_FAIL_CLOSING = 'Toca para volver.';
const HOME_BUTTON_LABEL = 'Inicio';
const CONTINUE_BUTTON_LABEL = 'Continuar';
const FINISH_CONTINUE_BUTTON_LABEL = 'Seguir';
const REPLAY_BUTTON_LABEL = 'Repetir';
const CONTINUE_TITLE = 'Respira.';
const CONTINUE_BODY = 'Cada paso despierta algo.';
const CONTINUE_CLOSING = 'Sigamos.';
const FIRST_HIT_REACTION = 'Ay!!';
const SECOND_HIT_REACTION = 'Ñó!!!';
const SHARK_PULSE_RESTORE = 0.32;
const SUPPORTIVE_LINES = [
  'Sigue subiendo.',
  'Lo va despertando.',
  'Hay camino.'
] as const;
const SHARK_LINES = ['Respira.', 'Arriba.', 'Toma aire.'] as const;
const HERO_HIT_TEXTURE_KEY = 'hero-hit-stagger';
const HERO_JUMP_RISE_TEXTURE_KEY = 'hero-jump-rise';
const HERO_JUMP_FALL_TEXTURE_KEY = 'hero-jump-fall';
const HERO_FINISH_TEXTURE_KEY = 'hero-finish-awakened';
const HERO_HIT_POSE_LOCK_SECONDS = 0.15;
const HERO_AIR_RISE_THRESHOLD = -32;
const HERO_AIR_FALL_THRESHOLD = 32;
const HERO_AIR_APEX_DEADZONE = 12;
type DiscoveryBeatId =
  | 'jump_intro'
  | 'double_jump_intro'
  | 'notes_intro'
  | 'hazard_intro'
  | 'reserve_hint'
  | 'reserve_gain'
  | 'reserve_spent'
  | 'shark_sighting'
  | 'shark_catch';
type DiscoveryBeatDefinition =
  | {
      mode: 'guidance';
      text: string;
      durationMs?: number;
    }
  | {
      mode: 'panel';
      title: string;
      body: string;
      closing: string;
    };
const DISCOVERY_SESSION_STORAGE_KEY = 'cure-runner.discovery-beats.v1';
let discoverySessionCache: Set<DiscoveryBeatId> | null = null;

const getDiscoverySessionCache = () => {
  if (discoverySessionCache) {
    return discoverySessionCache;
  }

  const fallback = new Set<DiscoveryBeatId>();

  if (typeof window === 'undefined') {
    discoverySessionCache = fallback;
    return discoverySessionCache;
  }

  try {
    const raw = window.sessionStorage.getItem(DISCOVERY_SESSION_STORAGE_KEY);

    if (!raw) {
      discoverySessionCache = fallback;
      return discoverySessionCache;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      discoverySessionCache = fallback;
      return discoverySessionCache;
    }

    discoverySessionCache = new Set(parsed as DiscoveryBeatId[]);
    return discoverySessionCache;
  } catch {
    discoverySessionCache = fallback;
    return discoverySessionCache;
  }
};

const hasSeenDiscoveryBeat = (beatId: DiscoveryBeatId) => getDiscoverySessionCache().has(beatId);

const rememberDiscoveryBeat = (beatId: DiscoveryBeatId) => {
  const cache = getDiscoverySessionCache();

  if (cache.has(beatId)) {
    return;
  }

  cache.add(beatId);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(DISCOVERY_SESSION_STORAGE_KEY, JSON.stringify([...cache]));
  } catch {
    // Ignore storage failures and keep the in-memory session cache.
  }
};

const forgetDiscoveryBeat = (beatId: DiscoveryBeatId) => {
  const cache = getDiscoverySessionCache();

  if (!cache.delete(beatId) || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(DISCOVERY_SESSION_STORAGE_KEY, JSON.stringify([...cache]));
  } catch {
    // Ignore storage failures and keep the in-memory session cache.
  }
};

const DISCOVERY_BEATS: Record<DiscoveryBeatId, DiscoveryBeatDefinition> = {
  jump_intro: {
    mode: 'guidance',
    text: 'Salta el barro.',
    durationMs: 2200
  },
  double_jump_intro: {
    mode: 'guidance',
    text: 'Toca otra vez.',
    durationMs: 2200
  },
  notes_intro: {
    mode: 'panel',
    title: 'Notas.',
    body: 'Cada nota despierta el planeta.',
    closing: 'Y llena la reserva.'
  },
  hazard_intro: {
    mode: 'panel',
    title: 'Golpe.',
    body: 'Te quita aire.',
    closing: 'Mide el salto.'
  },
  reserve_hint: {
    mode: 'guidance',
    text: 'Cien notas dan reserva.',
    durationMs: 2400
  },
  reserve_gain: {
    mode: 'panel',
    title: 'Reserva.',
    body: 'Ganaste una reserva.',
    closing: 'Te salva una vez.'
  },
  reserve_spent: {
    mode: 'panel',
    title: 'Reserva.',
    body: 'Se usó la reserva.',
    closing: 'Ya no queda.'
  },
  shark_sighting: {
    mode: 'guidance',
    text: 'Hay aire arriba.',
    durationMs: 2000
  },
  shark_catch: {
    mode: 'panel',
    title: 'Tiburón.',
    body: 'Devuelve aire si falta.',
    closing: 'Alcánzalo arriba.'
  }
};
type HeroTextureKey =
  | typeof heroProfile.textureKey
  | typeof HERO_HIT_TEXTURE_KEY
  | typeof HERO_JUMP_RISE_TEXTURE_KEY
  | typeof HERO_JUMP_FALL_TEXTURE_KEY
  | typeof HERO_FINISH_TEXTURE_KEY;

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
  private stageKey: JourneyStageKey = 'wounded-planet';
  private stage: JourneyStageDefinition = journeyStages['wounded-planet'];

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
  private discoveryOverlay!: Phaser.GameObjects.Rectangle;
  private discoveryStage!: Phaser.GameObjects.Container;
  private discoveryTitleText!: Phaser.GameObjects.Text;
  private discoveryBodyText!: Phaser.GameObjects.Text;
  private discoveryClosingText!: Phaser.GameObjects.Text;
  private retryOverlay!: Phaser.GameObjects.Rectangle;
  private runnerLoop!: RunnerLoopSystem;
  private shark!: Phaser.GameObjects.Container;
  private sharkShadow!: Phaser.GameObjects.Ellipse;
  private debugGraphics?: Phaser.GameObjects.Graphics;

  private baseHeroScale = 1;
  private heroRenderScaleX = 1;
  private heroRenderScaleY = 1;
  private activeHeroTextureKey: HeroTextureKey = heroProfile.textureKey;
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
  private finishAwakeningBeatShown = false;
  private failResolved = false;
  private victoryFrozen = false;
  private restartQueued = false;
  private returnHomeQueued = false;
  private hitReactionTimer = 0;
  private hitReactionDuration = 0.56;
  private hitReactionStrength = 0;
  private hitPoseLockTimer = 0;
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
  private moonlightIntroGuidanceShown = false;
  private moonlightBeatGuidanceShown = false;
  private firstJumpGuidanceShown = false;
  private doubleJumpHintShown = false;
  private firstCollectGuidanceShown = false;
  private firstHitGuidanceShown = false;
  private reserveGuidanceShown = false;
  private reserveFillBeatShown = false;
  private reserveSpentGuidanceShown = false;
  private sharkHelpGuidanceShown = false;
  private sharkBenefitGuidanceShown = false;
  private activeDiscoveryBeatId: DiscoveryBeatId | null = null;
  private queuedDiscoveryBeatId: DiscoveryBeatId | null = null;
  private offAudioCue?: () => void;

  constructor() {
    super('journey');
  }

  init(data?: { stage?: JourneyStageKey }) {
    this.stageKey = data?.stage ?? 'wounded-planet';
    this.stage = journeyStages[this.stageKey] ?? journeyStages['wounded-planet'];
  }

  create() {
    // Ensure camera starts clean after scene.restart() —
    // previous fadeOut may leave residual alpha on the new camera.
    this.cameras.main.resetFX();

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
    this.finishAwakeningBeatShown = false;
    this.failResolved = false;
    this.victoryFrozen = false;
    this.restartQueued = false;
    this.returnHomeQueued = false;
    this.hitReactionTimer = 0;
    this.hitReactionStrength = 0;
    this.hitPoseLockTimer = 0;
    this.activeHeroTextureKey = heroProfile.textureKey;
    this.sharkBurst = 0;
    this.sharkCooldown = 3.8;
    this.sharkActive = false;
    this.sharkTagged = false;
    this.lastGuidanceAt = -9999;
    this.guidanceIndex = 0;
    this.sharkGuidanceIndex = 0;
    this.lastSeenPhraseId = '';
    this.surfaceGuidanceShown = false;
    this.moonlightIntroGuidanceShown = false;
    this.moonlightBeatGuidanceShown = false;
    this.firstJumpGuidanceShown = false;
    this.doubleJumpHintShown = false;
    this.firstCollectGuidanceShown = false;
    this.firstHitGuidanceShown = false;
    this.reserveGuidanceShown = false;
    this.reserveFillBeatShown = false;
    this.reserveSpentGuidanceShown = false;
    this.sharkHelpGuidanceShown = false;
    this.sharkBenefitGuidanceShown = false;
    this.activeDiscoveryBeatId = null;
    this.queuedDiscoveryBeatId = null;

    this.emitVictoryState(false);
    this.emitFocusMode(false);
    this.backdrop = this.add.graphics().setDepth(0);
    this.finishScrim = this.add
      .rectangle(width * 0.5, journeyConfig.logicalSize.height * 0.5, width, journeyConfig.logicalSize.height, 0x0a0d12, 0)
      .setDepth(5.8);
    const isMoonlight = this.stage.backdropKind === 'moonlight-mountain';
    this.finishGlow = this.add
      .ellipse(width - 20, 192, 128, 248, isMoonlight ? 0xcef2ff : 0xf2ffce, 0)
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
    this.activeHeroTextureKey = this.hero.texture.key as HeroTextureKey;
    const hitReaction = this.createHitReaction();
    this.hitReaction = hitReaction.container;
    this.hitReactionText = hitReaction.text;

    this.baseHeroScale = heroProfile.mobileScale.preferredPx / this.hero.height;
    this.heroRenderScaleX = this.baseHeroScale;
    this.heroRenderScaleY = this.baseHeroScale;
    this.hero.setScale(this.baseHeroScale);
    this.ingredient = this.createIngredient(width - 52, 188);
    this.finishReward = this.createIngredient(width * 0.5, 0).setAlpha(0).setScale(0.9).setDepth(5.5);
    this.finishMessage = this.createFinishMessage(0, 0);
    this.finishStage = this.add
      .container(width * 0.5, 148, [this.finishMessage])
      .setDepth(6.65)
      .setAlpha(0)
      .setScale(0.88);
    this.continueStage = this.createContinueStage(width * 0.5, 148);
    this.failStage = this.createFailStage(width * 0.5, 316);
    this.discoveryOverlay = this.add
      .rectangle(width * 0.5, journeyConfig.logicalSize.height * 0.5, width, journeyConfig.logicalSize.height, 0x071018, 0.001)
      .setDepth(6.58)
      .setAlpha(0)
      .setVisible(false)
      .setInteractive();
    this.discoveryOverlay.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
      }
    );
    this.discoveryOverlay.disableInteractive();
    const discoveryStage = this.createDiscoveryStage(width * 0.5, 312);
    this.discoveryStage = discoveryStage.container;
    this.discoveryTitleText = discoveryStage.title;
    this.discoveryBodyText = discoveryStage.body;
    this.discoveryClosingText = discoveryStage.closing;
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
    this.runnerLoop = new RunnerLoopSystem(this, this.showDebug, this.stage);
    this.bindAudioFeedback();
    this.renderBackdrop(this.emotionController.getMood(sessionState.snapshot().displayLevel), 0, 0, 0);

    if (this.stage.introGuidance && !this.moonlightIntroGuidanceShown) {
      this.moonlightIntroGuidanceShown = true;
      this.time.delayedCall(420, () => {
        if (!this.failResolved && !this.finishResolved) {
          this.emitGuidanceLine(this.stage.introGuidance!, 2100, this.time.now);
        }
      });
    }

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
      this.finishSequence = Math.min(1, this.finishSequence + deltaSeconds * FINISH_SEQUENCE_SPEED);

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
    this.hitPoseLockTimer = Math.max(0, this.hitPoseLockTimer - deltaSeconds);
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

    if (!this.failResolved && !this.finishResolved && !this.activeDiscoveryBeatId) {
      this.updateSharkEvent(time, deltaSeconds, loopSnapshot);
      this.updateGuidanceMoments(time, loopSnapshot);
      this.updateDoubleJumpHint(time, loopSnapshot);
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
    const landingSquash = loopSnapshot.landingBurst * 0.10;
    const finishReach = this.finishResolved
      ? Phaser.Math.Easing.Cubic.Out(
          Phaser.Math.Clamp((this.finishSequence - 0.16) / 0.4, 0, 1)
        )
      : 0;
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
    this.updateHeroTexture(loopSnapshot);

    const heroBaseX = loopSnapshot.heroX - this.feedback.impact * 6 - this.sharkBurst * 3;
    const heroBaseY =
      loopSnapshot.heroY +
      runBob +
      impactDrop -
      rise +
      landingSquash * 6 +
      driftLift -
      loopSnapshot.surfaceProgress * 6 -
      victoryBounce;
    const heroDisplayX = this.finishResolved
      ? Phaser.Math.Linear(heroBaseX, FINISH_HERO_REACH_X, finishReach)
      : heroBaseX;
    const heroDisplayY = this.finishResolved
      ? Phaser.Math.Linear(heroBaseY, FINISH_HERO_REACH_Y - victoryBounce * 0.35, finishReach)
      : heroBaseY;

    this.hero.setPosition(heroDisplayX, heroDisplayY).setScale(this.heroRenderScaleX, this.heroRenderScaleY);

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

  private mixStageColor(from: number, to: number, value: number) {
    const start = Phaser.Display.Color.ValueToColor(from);
    const end = Phaser.Display.Color.ValueToColor(to);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(
      start,
      end,
      100,
      Math.round(Phaser.Math.Clamp(value, 0, 1) * 100)
    );

    return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
  }

  private renderMoonlightBackdrop(
    mood: ReturnType<EmotionController['getMood']>,
    distanceTravelled: number,
    surfaceProgress: number,
    finishRevealProgress: number
  ) {
    const width = journeyConfig.logicalSize.width;
    const height = journeyConfig.logicalSize.height;
    const floorY = runnerConfig.visual.groundLineY;
    const time = this.time.now;
    const climb = Phaser.Math.Clamp(surfaceProgress * 0.84 + finishRevealProgress * 0.18, 0, 1);
    const beatGlow = Phaser.Math.Clamp(
      this.feedback.collect * 0.48 + this.feedback.chain * 0.68 + this.feedback.awakening * 0.24,
      0,
      1
    );
    const farOffset = -((distanceTravelled * 0.12) % 136);
    const midOffset = -((distanceTravelled * 0.22) % 118);
    const nearOffset = -((distanceTravelled * 0.36) % 94);

    // --- Sky ---
    const skyTop = this.mixStageColor(0x08111d, 0x12253c, climb * 0.72 + beatGlow * 0.06);
    const skyBottom = this.mixStageColor(0x162134, 0x234666, climb * 0.7 + beatGlow * 0.08);
    this.backdrop.clear();
    this.backdrop.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1, 1, 1, 1);
    this.backdrop.fillRect(0, 0, width, height);

    // --- Atmospheric haze ---
    const haze = this.mixStageColor(0x7ca0ba, 0xbdefff, climb * 0.46 + beatGlow * 0.28);
    this.backdrop.fillStyle(haze, 0.12 + climb * 0.06);
    this.backdrop.fillEllipse(width * 0.22, height * 0.2, 178, 132);
    this.backdrop.fillEllipse(width * 0.82, height * 0.22, 198, 152);
    this.backdrop.fillEllipse(width * 0.5, height * 0.32, 246, 178);

    // --- Moon (load-bearing: massive, centered behind peak) ---
    const moonX = width * 0.54;
    const moonY = 182;
    const moonSize = 280;
    const moonGlow = this.mixStageColor(0xfff3d4, 0xf8fff0, climb * 0.18 + beatGlow * 0.24);

    // Outer atmospheric halo
    this.backdrop.fillStyle(moonGlow, 0.06 + beatGlow * 0.03);
    this.backdrop.fillEllipse(moonX, moonY, moonSize + 108, moonSize + 108);
    // Inner halo
    this.backdrop.fillStyle(0xffffff, 0.08 + beatGlow * 0.04);
    this.backdrop.fillEllipse(moonX, moonY, moonSize + 52, moonSize + 52);
    // Moon body
    this.backdrop.fillStyle(moonGlow, 0.94);
    this.backdrop.fillEllipse(moonX, moonY, moonSize, moonSize);
    // Craters
    this.backdrop.fillStyle(0xd6c7a2, 0.14);
    this.backdrop.fillEllipse(moonX - 34, moonY - 38, 38, 30);
    this.backdrop.fillEllipse(moonX + 28, moonY + 22, 30, 24);
    this.backdrop.fillEllipse(moonX - 8, moonY + 48, 20, 14);
    this.backdrop.fillEllipse(moonX + 48, moonY - 16, 16, 12);

    // --- Background crystal hints (behind mountain) ---
    const crystalFill = this.mixStageColor(0xa8e1d8, 0xe7fbff, climb * 0.54 + beatGlow * 0.34);
    const crystalFillSoft = this.mixStageColor(0x8dcfbf, 0xcff8ef, climb * 0.48 + beatGlow * 0.3);
    const crystalEdge = this.mixStageColor(0x4e7e74, 0x93efdf, climb * 0.3 + beatGlow * 0.34);

    this.backdrop.fillStyle(crystalFillSoft, 0.18 + climb * 0.06);
    for (let i = 0; i < 5; i += 1) {
      const bx = 42 + i * 72 + farOffset * 0.06;
      const bh = 62 + (i % 3) * 18;
      this.backdrop.fillTriangle(bx, floorY + 6, bx + 14, floorY - bh, bx + 30, floorY + 6);
    }

    // --- Mountain silhouette (load-bearing: one central peak + flanking ridges) ---
    const mountainShadow = this.mixStageColor(0x111925, 0x223240, climb * 0.6);
    const mountainBase = this.mixStageColor(0x1a2430, 0x2e4455, climb * 0.76);
    const mountainEdge = this.mixStageColor(0x334b5f, 0x6b9ab0, climb * 0.34 + beatGlow * 0.18);

    // Shadow layer (slightly wider, behind)
    this.backdrop.fillStyle(mountainShadow, 0.96);
    this.backdrop.fillTriangle(
      56 + farOffset * 0.06, floorY + 16,
      width * 0.52, 82,
      width - 32 + farOffset * 0.06, floorY + 16
    );

    // Main central peak
    this.backdrop.fillStyle(mountainBase, 0.98);
    this.backdrop.fillTriangle(
      86 + farOffset * 0.08, floorY + 14,
      width * 0.54, 98,
      width - 56 + farOffset * 0.08, floorY + 14
    );

    // Left flank ridge
    this.backdrop.fillStyle(mountainShadow, 0.92);
    this.backdrop.fillTriangle(
      14 + farOffset * 0.04, floorY + 12,
      92, 194,
      178 + farOffset * 0.04, floorY + 12
    );

    // Right flank ridge
    this.backdrop.fillTriangle(
      width - 148 + farOffset * 0.05, floorY + 12,
      width - 72, 208,
      width + 14 + farOffset * 0.05, floorY + 12
    );

    // Mountain edge highlights (ridgeline light)
    this.backdrop.lineStyle(3, mountainEdge, 0.26 + climb * 0.08);
    this.backdrop.beginPath();
    this.backdrop.moveTo(118 + farOffset * 0.08, floorY + 6);
    this.backdrop.lineTo(width * 0.54, 98);
    this.backdrop.lineTo(width - 88 + farOffset * 0.08, floorY + 8);
    this.backdrop.strokePath();

    // --- Mid-layer distant crystal cliffs ---
    this.backdrop.fillStyle(this.mixStageColor(0x273648, 0x36546b, climb * 0.5), 0.52);
    for (let i = 0; i < 7; i += 1) {
      const x = midOffset + i * 62;
      const h = 84 + (i % 3) * 22;
      this.backdrop.fillTriangle(x, floorY + 12, x + 24, floorY - h, x + 52, floorY + 12);
    }

    // --- Foreground crystal field (load-bearing: dense, 2-tier, staggered glint) ---
    const mirrorLine = this.mixStageColor(0xe9ffff, 0xffffff, beatGlow * 0.58 + finishRevealProgress * 0.2);

    // Tier A: Large crystals
    for (let i = 0; i < 7; i += 1) {
      const x = nearOffset + i * 54;
      const h = 128 + (i % 3) * 32;
      const w = 38 + (i % 3) * 6;
      const fill = i % 2 === 0 ? crystalFill : crystalFillSoft;
      const glintPhase = Math.sin(time * 0.003 + i * 1.4) * 0.5 + 0.5;
      const crystalAlpha = 0.74 + climb * 0.16 + beatGlow * glintPhase * 0.12;

      this.backdrop.fillStyle(fill, crystalAlpha);
      this.backdrop.fillTriangle(x, floorY + 14, x + w * 0.5, floorY - h, x + w, floorY + 14);

      // Internal edge line
      this.backdrop.lineStyle(2, crystalEdge, 0.38 + beatGlow * glintPhase * 0.22);
      this.backdrop.beginPath();
      this.backdrop.moveTo(x + w * 0.5, floorY - h);
      this.backdrop.lineTo(x + w * 0.22, floorY + 6);
      this.backdrop.strokePath();

      // Mirror highlight (staggered glint)
      this.backdrop.lineStyle(2, mirrorLine, 0.1 + beatGlow * glintPhase * 0.28);
      this.backdrop.beginPath();
      this.backdrop.moveTo(x + w * 0.56, floorY - h + 16);
      this.backdrop.lineTo(x + w * 0.78, floorY - h * 0.4);
      this.backdrop.strokePath();
    }

    // Tier B: Smaller fill crystals (between the large ones)
    for (let i = 0; i < 8; i += 1) {
      const x = nearOffset + i * 54 + 22;
      const h = 72 + (i % 4) * 18;
      const w = 24 + (i % 2) * 6;
      const glintPhase = Math.sin(time * 0.003 + i * 1.8 + 0.7) * 0.5 + 0.5;
      const fillAlpha = 0.52 + climb * 0.12 + beatGlow * glintPhase * 0.08;

      this.backdrop.fillStyle(crystalFillSoft, fillAlpha);
      this.backdrop.fillTriangle(x, floorY + 14, x + w * 0.5, floorY - h, x + w, floorY + 14);

      this.backdrop.lineStyle(1, crystalEdge, 0.24 + beatGlow * glintPhase * 0.16);
      this.backdrop.beginPath();
      this.backdrop.moveTo(x + w * 0.48, floorY - h);
      this.backdrop.lineTo(x + w * 0.26, floorY - h * 0.3);
      this.backdrop.strokePath();
    }

    // --- Ground plane ---
    this.backdrop.fillStyle(this.mixStageColor(0x172536, 0x1e3144, climb * 0.42), 0.94);
    this.backdrop.fillRect(-20, floorY, width + 40, height - floorY + 24);

    // Ground edge line
    this.backdrop.lineStyle(4, crystalEdge, 0.34 + beatGlow * 0.18);
    this.backdrop.beginPath();
    this.backdrop.moveTo(0, floorY + 8);
    this.backdrop.lineTo(width * 0.1, floorY + 2);
    this.backdrop.lineTo(width * 0.22, floorY + 10);
    this.backdrop.lineTo(width * 0.38, floorY + 4);
    this.backdrop.lineTo(width * 0.54, floorY + 14);
    this.backdrop.lineTo(width * 0.72, floorY + 6);
    this.backdrop.lineTo(width * 0.88, floorY + 12);
    this.backdrop.lineTo(width, floorY + 4);
    this.backdrop.strokePath();

    // Ground haze particles
    this.backdrop.fillStyle(haze, 0.07 + beatGlow * 0.05);
    for (let i = 0; i < 6; i += 1) {
      this.backdrop.fillEllipse(32 + i * 58, floorY - 12 - (i % 2) * 10, 42, 12);
    }

    // Small crystal tips above haze
    this.backdrop.lineStyle(2, mirrorLine, 0.1 + beatGlow * 0.18);
    for (let i = 0; i < 7; i += 1) {
      const x = nearOffset + i * 56 + 10;
      const peakY = floorY - 88 - (i % 3) * 26;
      this.backdrop.beginPath();
      this.backdrop.moveTo(x, peakY + 12);
      this.backdrop.lineTo(x + 8, peakY - 10);
      this.backdrop.lineTo(x + 18, peakY + 4);
      this.backdrop.strokePath();
    }

    // Moonlight bloom near horizon
    this.backdrop.fillStyle(0xf5fff4, 0.07 + beatGlow * 0.1 + finishRevealProgress * 0.05);
    this.backdrop.fillEllipse(width * 0.54, floorY - 178, 178 + beatGlow * 26, 68 + beatGlow * 12);
    this.backdrop.fillStyle(mood.auraColor, 0.04 + beatGlow * 0.06);
    this.backdrop.fillEllipse(width * 0.72, floorY - 124, 134, 54);
  }

  private renderBackdrop(
    mood: ReturnType<EmotionController['getMood']>,
    distanceTravelled: number,
    surfaceProgress: number,
    finishRevealProgress: number
  ) {
    if (this.stage.backdropKind === 'moonlight-mountain') {
      this.renderMoonlightBackdrop(mood, distanceTravelled, surfaceProgress, finishRevealProgress);
      return;
    }

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

        if (!this.firstCollectGuidanceShown) {
          this.firstCollectGuidanceShown = true;
          this.triggerDiscoveryBeat('notes_intro', this.time.now);
        }
      }

      if (event.type === 'chain_success') {
        this.feedback.chain = Math.max(this.feedback.chain, Math.min(1, event.intensity * 0.22));

        if (
          this.stage.beatGuidance &&
          !this.moonlightBeatGuidanceShown &&
          !this.failResolved &&
          !this.finishResolved
        ) {
          this.moonlightBeatGuidanceShown = true;
          this.emitGuidanceLine(this.stage.beatGuidance, 1800, this.time.now);
        }
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

        if (!this.firstHitGuidanceShown && !runFailed) {
          this.firstHitGuidanceShown = true;
          this.triggerDiscoveryBeat('hazard_intro', this.time.now);
        }
      }

      if (event.type === 'awakening_gain') {
        this.feedback.awakening = Math.max(
          this.feedback.awakening,
          Math.min(1, event.intensity * 0.18)
        );
      }

      if (event.type === 'reserve_fill') {
        this.feedback.collect = Math.max(this.feedback.collect, 0.34);
        this.feedback.awakening = Math.max(this.feedback.awakening, 0.24);

        if (!this.failResolved && !this.finishResolved) {
          if (!this.reserveFillBeatShown) {
            this.reserveFillBeatShown = true;
            this.triggerDiscoveryBeat('reserve_gain', this.time.now);
          } else {
            this.emitGuidanceLine('Reserva lista.', 2000, this.time.now);
          }
        }
      }

      if (event.type === 'reserve_spent') {
        this.feedback.collect = Math.max(this.feedback.collect, 0.26);
        this.feedback.awakening = Math.max(this.feedback.awakening, 0.14);

        if (!this.reserveSpentGuidanceShown && !this.failResolved && !this.finishResolved) {
          this.reserveSpentGuidanceShown = true;
          this.triggerDiscoveryBeat('reserve_spent', this.time.now);
        }
      }
    });
  }

  private handleShutdown() {
    this.hideDiscoveryStage();
    this.emitVictoryState(false);
    this.emitFocusMode(false);
    this.offAudioCue?.();
    this.runnerLoop?.destroy();
  }

  private createIngredient(x: number, y: number) {
    const trebleGlyph = '\uD834\uDD1E';
    const halo = this.add
      .ellipse(0, 0, 104, 104, 0xeaffc9, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    const haloCore = this.add
      .ellipse(0, 2, 72, 72, 0xfaffef, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shellGlow = this.add
      .ellipse(0, 4, 76, 88, 0xdff7d8, 0.14)
      .setBlendMode(Phaser.BlendModes.ADD);
    const paperCore = this.add
      .ellipse(0, 4, 58, 74, 0xf8fff1, 0.98)
      .setStrokeStyle(3, 0x6b8273, 0.18);
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x6a7d72, 0.18);
    frame.strokeEllipse(0, 2, 64, 82);
    frame.lineStyle(2, 0xf6fff3, 0.14);
    frame.strokeEllipse(0, 2, 40, 56);
    const clefAura = this.add
      .text(2, -2, trebleGlyph, {
        fontFamily: '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", Georgia, serif',
        fontSize: '96px',
        color: '#c8ffc9'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0.22);
    const clefShadow = this.add
      .text(4, 3, trebleGlyph, {
        fontFamily: '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", Georgia, serif',
        fontSize: '88px',
        color: '#0f1517'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0.34);
    const clef = this.add
      .text(0, -2, trebleGlyph, {
        fontFamily: '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", Georgia, serif',
        fontSize: '90px',
        color: '#ffffff',
        stroke: '#5d7464',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 2, '#0a1015', 5, false, true);

    const orbitTop = this.add.ellipse(6, -50, 9, 9, 0xf8ffec, 0.94).setStrokeStyle(2, 0x66796c, 0.18);
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
        haloCore,
        shellGlow,
        paperCore,
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

  private emitLightMotes(
    x: number,
    y: number,
    options: {
      count: number;
      spread: number;
      color: number;
      accentColor: number;
      durationMs: number;
      depth: number;
    }
  ) {
    const flash = this.add
      .ellipse(x, y, 22, 22, 0xfaffef, 0.22)
      .setDepth(options.depth)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: flash,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: Math.max(180, Math.round(options.durationMs * 0.72)),
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy();
      }
    });

    for (let index = 0; index < options.count; index += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.95, Math.PI * 0.95);
      const distance = Phaser.Math.FloatBetween(10, options.spread);
      const width = Phaser.Math.FloatBetween(4, 8);
      const height = width * Phaser.Math.FloatBetween(0.74, 1.24);
      const color = index % 3 === 0 ? options.accentColor : options.color;
      const mote = this.add
        .ellipse(x, y, width, height, color, Phaser.Math.FloatBetween(0.72, 0.96))
        .setDepth(options.depth + 0.01)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setRotation(Phaser.Math.FloatBetween(-0.8, 0.8));

      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - Phaser.Math.FloatBetween(8, 18),
        scaleX: Phaser.Math.FloatBetween(0.8, 1.3),
        scaleY: Phaser.Math.FloatBetween(0.8, 1.35),
        alpha: 0,
        duration: options.durationMs + Phaser.Math.Between(-80, 90),
        ease: 'Cubic.easeOut',
        onComplete: () => {
          mote.destroy();
        }
      });
    }
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

    const isMl = this.stage.backdropKind === 'moonlight-mountain';
    const title = this.add
      .text(0, -48, isMl ? MOONLIGHT_FINISH_TITLE : FINISH_TITLE, {
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
      .text(0, -20, isMl ? MOONLIGHT_FINISH_LABEL : FINISH_LABEL, {
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
      .text(0, 16, isMl ? MOONLIGHT_FINISH_BODY : FINISH_BODY, {
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
      .text(0, 44, isMl ? MOONLIGHT_FINISH_CLOSING : FINISH_CLOSING, {
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
      FINISH_CONTINUE_BUTTON_LABEL,
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
    const replayButton = this.createPanelButton(
      REPLAY_BUTTON_LABEL,
      94,
      () => this.replayCurrentStage(),
      '11px'
    );

    // Final level: replay + home instead of a misleading continuation CTA.
    if (!this.stage.nextStage) {
      replayButton.setPosition(-54, 86);
      homeButton.setPosition(54, 86);
      return this.add.container(x, y, [
        panel,
        title,
        label,
        body,
        closing,
        replayButton,
        homeButton
      ]);
    }

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

  private createDiscoveryStage(x: number, y: number) {
    const panel = this.add.graphics();
    panel.fillStyle(0x0b1117, 0.96);
    panel.lineStyle(2, 0xdce9d6, 0.11);
    panel.fillRoundedRect(-118, -80, 236, 176, 22);
    panel.strokeRoundedRect(-118, -80, 236, 176, 22);
    panel.lineStyle(1, 0xf7fff0, 0.025);
    panel.strokeRoundedRect(-110, -72, 220, 160, 18);
    panel.fillStyle(0xf1ffbe, 0.028);
    panel.fillEllipse(0, -40, 84, 24);
    panel.fillStyle(0xd8f4df, 0.026);
    panel.fillCircle(-78, -42, 2);
    panel.fillCircle(78, -42, 2);

    const title = this.add
      .text(0, -42, 'Notas.', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#f2ffbe',
        stroke: '#081018',
        strokeThickness: 2,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#03060a', 3, false, true);
    const body = this.add
      .text(0, -2, 'Cada nota despierta el planeta.', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '14px',
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
      .text(0, 32, 'Y llena la reserva.', {
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
    const continueButton = this.createPanelButton(
      CONTINUE_BUTTON_LABEL,
      98,
      () => this.dismissDiscoveryBeat(),
      '11px'
    );
    const homeButton = this.createPanelButton(
      HOME_BUTTON_LABEL,
      112,
      () => this.returnToStart(),
      '11px'
    );

    continueButton.setPosition(-54, 78);
    homeButton.setPosition(58, 78);

    return {
      container: this.add
        .container(x, y, [panel, title, body, closing, continueButton, homeButton])
        .setDepth(6.64)
        .setAlpha(0)
        .setScale(0.92)
        .setVisible(false),
      title,
      body,
      closing
    };
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
      .text(0, -34, this.stage.backdropKind === 'moonlight-mountain' ? MOONLIGHT_FAIL_TITLE : FAIL_TITLE, {
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
      .text(0, 2, this.stage.backdropKind === 'moonlight-mountain' ? MOONLIGHT_FAIL_BODY : FAIL_BODY, {
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
      .text(0, 34, this.stage.backdropKind === 'moonlight-mountain' ? MOONLIGHT_FAIL_CLOSING : FAIL_CLOSING, {
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
      this.finishReward.setAlpha(0);
      this.finishStage.setAlpha(0);
      this.continueStage.setAlpha(0);
      return;
    }

    const exitX = journeyConfig.logicalSize.width - 44 + loopSnapshot.finishRevealProgress * 6;
    const exitY = 190 - loopSnapshot.surfaceProgress * 28;
    const hover = Math.sin(time * 0.0042) * 3.6;
    const sequenceEase = Phaser.Math.Easing.Cubic.Out(this.finishSequence);
    const sequenceBack = Phaser.Math.Easing.Back.Out(this.finishSequence);
    const rewardReveal = this.finishResolved
      ? Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp(this.finishSequence / 0.28, 0, 1))
      : 0;
    const previewAlpha = this.finishResolved
      ? Phaser.Math.Linear(this.ingredient.alpha, 0, 0.18)
      : Math.max(loopSnapshot.finishRevealProgress, 0);
    const stageAlphaTarget =
      this.finishResolved && !this.continueResolved && this.finishSequence >= FINISH_PANEL_REVEAL_AT
        ? 0.98
        : 0;
    const nextStageAlpha = Phaser.Math.Linear(this.finishStage.alpha, stageAlphaTarget, 0.12);
    const nextStageScale = Phaser.Math.Linear(
      this.finishStage.scaleX,
      this.finishResolved && !this.continueResolved && this.finishSequence >= FINISH_PANEL_REVEAL_AT
        ? 0.98
        : 0.88,
      0.12
    );
    const continueAlphaTarget = this.finishResolved && this.continueResolved ? 0.98 : 0;
    const nextContinueAlpha = Phaser.Math.Linear(this.continueStage.alpha, continueAlphaTarget, 0.12);
    const nextContinueScale = Phaser.Math.Linear(
      this.continueStage.scaleX,
      this.finishResolved && this.continueResolved ? 0.98 : 0.9,
      0.12
    );
    const rewardAlphaTarget = this.finishResolved ? 0.98 * rewardReveal : 0;
    const nextRewardAlpha = Phaser.Math.Linear(this.finishReward.alpha, rewardAlphaTarget, 0.14);
    const scrimTarget = this.finishResolved ? 0.08 : 0;

    this.finishGlow
      .setPosition(
        FINISH_REWARD_ZONE_X + 12,
        Phaser.Math.Linear(FINISH_REWARD_ZONE_Y + 8, FINISH_REWARD_ZONE_Y - 8, rewardReveal)
      )
      .setScale(
        1 + loopSnapshot.finishRevealProgress * 0.14 + rewardReveal * 0.32,
        1 + loopSnapshot.surfaceProgress * 0.1 + rewardReveal * 0.28
      )
      .setFillStyle(
        0xf2ffce,
        0.008 +
          loopSnapshot.surfaceProgress * 0.05 +
          loopSnapshot.finishRevealProgress * 0.07 +
          this.finishPulse * 0.03 +
          rewardReveal * 0.09
      );

    this.finishScrim.setAlpha(Phaser.Math.Linear(this.finishScrim.alpha, scrimTarget, 0.08));

    this.ingredient
      .setPosition(exitX, exitY + hover)
      .setAlpha(previewAlpha)
      .setScale(0.84 + loopSnapshot.finishRevealProgress * 0.14 + this.finishPulse * 0.08 + sequenceBack * 0.12)
      .setRotation(Math.sin(time * 0.0032) * 0.08 - loopSnapshot.finishRevealProgress * 0.04 + sequenceEase * 0.03);

    this.finishReward
      .setPosition(
        FINISH_REWARD_ZONE_X,
        Phaser.Math.Linear(FINISH_REWARD_ZONE_Y + 26, FINISH_REWARD_ZONE_Y, rewardReveal) +
          Math.sin(time * 0.0036) * (0.9 + rewardReveal * 1.1)
      )
      .setAlpha(nextRewardAlpha)
      .setScale(0.72 + rewardReveal * 0.16 + this.finishPulse * 0.06 + sequenceBack * 0.08)
      .setRotation(Math.sin(time * 0.0031) * 0.02 - rewardReveal * 0.018);

    if (
      this.finishResolved &&
      !this.finishAwakeningBeatShown &&
      this.finishSequence >= FINISH_CONTACT_BEAT_AT
    ) {
      const contactX = Phaser.Math.Linear(this.hero.x + 24, this.finishReward.x - 10, 0.5);
      const contactY = Phaser.Math.Linear(this.hero.y - 66, this.finishReward.y + 10, 0.5);
      this.finishAwakeningBeatShown = true;
      this.finishPulse = Math.max(this.finishPulse, 1.28);
      audioCueBus.emit({
        type: 'awakening_touch',
        intensity: 1.14
      });
      this.emitLightMotes(this.finishReward.x, this.finishReward.y, {
        count: 10,
        spread: 48,
        color: 0xf7ffec,
        accentColor: 0x9fffba,
        durationMs: 700,
        depth: 5.58
      });
      this.emitLightMotes(contactX, contactY, {
        count: 6,
        spread: 24,
        color: 0xfffdf1,
        accentColor: 0xcaffb8,
        durationMs: 520,
        depth: 5.54
      });
    }

    this.finishStage
      .setAlpha(nextStageAlpha)
      .setScale(nextStageScale)
      .setPosition(journeyConfig.logicalSize.width * 0.5, 146 - sequenceEase * 4);
    this.continueStage
      .setAlpha(nextContinueAlpha)
      .setScale(nextContinueScale)
      .setPosition(journeyConfig.logicalSize.width * 0.5, 148 - sequenceEase * 4);

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
    this.hitPoseLockTimer = 0;
    this.hideDiscoveryStage();
    this.haltSharkEvent();
    this.emitFocusMode(true);
    this.emitVictoryState(true);

    if (!this.victoryFrozen) {
      this.runnerLoop.setFrozen(true);
      this.victoryFrozen = true;
    }

    this.children.bringToTop(this.finishReward);
    this.children.bringToTop(this.finishStage);

    audioCueBus.emit({
      type: 'victory_win',
      intensity: 1.1
    });
    this.cameras.main.flash(100, 220, 255, 186, false);
    this.cameras.main.zoomTo(1.06, 600, 'Cubic.easeOut');
  }

  private beginFailureBeat() {
    if (this.failResolved || this.finishResolved) {
      return;
    }

    this.failResolved = true;
    this.restartQueued = false;
    this.hitReactionTimer = 0;
    this.hitPoseLockTimer = 0;
    this.hideDiscoveryStage();
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
    this.scene.restart({ stage: this.stageKey });
  }

  private showHitReaction(text: string, strength: number) {
    this.hitReactionText.setText(text).setFontSize(strength > 0 ? 17 : 16);
    this.hitReactionTimer = this.hitReactionDuration;
    this.hitReactionStrength = strength;
    this.hitPoseLockTimer = Math.max(this.hitPoseLockTimer, HERO_HIT_POSE_LOCK_SECONDS);
    this.hitReaction.setVisible(true).setAlpha(1).setScale(0.94 + strength * 0.05);
  }

  private updateHeroTexture(loopSnapshot: RunnerLoopSnapshot) {
    const nextTextureKey = this.resolveHeroTextureKey(loopSnapshot);
    const currentTextureKey = this.hero.texture.key as HeroTextureKey;

    if (currentTextureKey === nextTextureKey) {
      this.activeHeroTextureKey = currentTextureKey;
      return;
    }

    this.hero.setTexture(nextTextureKey);
    this.activeHeroTextureKey = nextTextureKey;
  }

  private resolveHeroTextureKey(loopSnapshot: RunnerLoopSnapshot): HeroTextureKey {
    if (this.finishResolved && this.textures.exists(HERO_FINISH_TEXTURE_KEY)) {
      return HERO_FINISH_TEXTURE_KEY;
    }

    if (this.hitPoseLockTimer > 0 && this.textures.exists(HERO_HIT_TEXTURE_KEY)) {
      return HERO_HIT_TEXTURE_KEY;
    }

    if (loopSnapshot.grounded) {
      return heroProfile.textureKey;
    }

    const velocityY = loopSnapshot.velocityY;

    if (velocityY <= HERO_AIR_RISE_THRESHOLD && this.textures.exists(HERO_JUMP_RISE_TEXTURE_KEY)) {
      return HERO_JUMP_RISE_TEXTURE_KEY;
    }

    if (velocityY >= HERO_AIR_FALL_THRESHOLD && this.textures.exists(HERO_JUMP_FALL_TEXTURE_KEY)) {
      return HERO_JUMP_FALL_TEXTURE_KEY;
    }

    // Keep the previous air pose through the apex to avoid rise/fall flicker.
    if (Math.abs(velocityY) <= HERO_AIR_APEX_DEADZONE) {
      if (
        this.activeHeroTextureKey === HERO_JUMP_RISE_TEXTURE_KEY ||
        this.activeHeroTextureKey === HERO_JUMP_FALL_TEXTURE_KEY
      ) {
        return this.activeHeroTextureKey;
      }
    }

    if (
      this.activeHeroTextureKey === HERO_JUMP_RISE_TEXTURE_KEY &&
      velocityY < HERO_AIR_FALL_THRESHOLD &&
      this.textures.exists(HERO_JUMP_RISE_TEXTURE_KEY)
    ) {
      return HERO_JUMP_RISE_TEXTURE_KEY;
    }

    if (
      this.activeHeroTextureKey === HERO_JUMP_FALL_TEXTURE_KEY &&
      velocityY > HERO_AIR_RISE_THRESHOLD &&
      this.textures.exists(HERO_JUMP_FALL_TEXTURE_KEY)
    ) {
      return HERO_JUMP_FALL_TEXTURE_KEY;
    }

    if (velocityY < 0 && this.textures.exists(HERO_JUMP_RISE_TEXTURE_KEY)) {
      return HERO_JUMP_RISE_TEXTURE_KEY;
    }

    if (this.textures.exists(HERO_JUMP_FALL_TEXTURE_KEY)) {
      return HERO_JUMP_FALL_TEXTURE_KEY;
    }

    return heroProfile.textureKey;
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
    sessionState.hydrate({
      awakeningLevel: 0,
      collectedSparks: 0
    });
    localProgressStore.clear();
    discoverySessionCache = null;

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(DISCOVERY_SESSION_STORAGE_KEY);
      } catch {
        // Ignore storage failures and keep the hard reload path.
      }

      window.location.reload();
    }
  }

  private openContinuation() {
    if (!this.finishResolved || this.continueResolved) {
      return;
    }

    if (this.stage.nextStage) {
      this.continueResolved = true;
      this.emitFocusMode(false);
      this.emitVictoryState(false);
      this.cameras.main.fadeOut(220, 9, 16, 26);
      this.time.delayedCall(220, () => {
        sessionState.restartRun();
        this.scene.restart({ stage: this.stage.nextStage ?? this.stageKey });
      });
      return;
    }

    this.continueResolved = true;
    this.children.bringToTop(this.continueStage);
  }

  private replayCurrentStage() {
    if (this.continueResolved || this.returnHomeQueued) {
      return;
    }

    this.continueResolved = true;
    this.emitFocusMode(false);
    this.emitVictoryState(false);
    this.cameras.main.fadeOut(220, 9, 16, 26);
    this.time.delayedCall(220, () => {
      sessionState.restartRun();
      this.scene.restart({ stage: this.stageKey });
    });
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

  private triggerDiscoveryBeat(beatId: DiscoveryBeatId, time: number) {
    if (hasSeenDiscoveryBeat(beatId)) {
      return;
    }

    const beat = DISCOVERY_BEATS[beatId];

    if (beat.mode === 'guidance') {
      if (this.failResolved || this.finishResolved || this.activeDiscoveryBeatId) {
        return;
      }

      rememberDiscoveryBeat(beatId);
      this.emitGuidanceLine(beat.text, beat.durationMs ?? 1800, time);
      return;
    }

    this.presentDiscoveryBeat(beatId, beat);
  }

  private presentDiscoveryBeat(
    beatId: DiscoveryBeatId,
    beat: Extract<DiscoveryBeatDefinition, { mode: 'panel' }>
  ) {
    if (this.failResolved || this.finishResolved) {
      return;
    }

    if (this.activeDiscoveryBeatId) {
      if (this.activeDiscoveryBeatId !== beatId) {
        this.queuedDiscoveryBeatId = beatId;
      }
      return;
    }

    rememberDiscoveryBeat(beatId);
    this.activeDiscoveryBeatId = beatId;
    this.queuedDiscoveryBeatId = null;
    this.lastGuidanceAt = this.time.now;
    this.discoveryTitleText.setText(beat.title);
    this.discoveryBodyText.setText(beat.body);
    this.discoveryClosingText.setText(beat.closing);
    this.runnerLoop.setFrozen(true);
    this.emitFocusMode(true);
    this.discoveryOverlay.setVisible(true).setAlpha(0.001).setInteractive();
    this.discoveryStage.setVisible(true).setAlpha(0).setScale(0.92);
    this.children.bringToTop(this.discoveryOverlay);
    this.children.bringToTop(this.discoveryStage);
    this.tweens.killTweensOf(this.discoveryOverlay);
    this.tweens.killTweensOf(this.discoveryStage);
    this.tweens.add({
      targets: this.discoveryOverlay,
      alpha: 0.24,
      duration: 160,
      ease: 'Quad.easeOut'
    });
    this.tweens.add({
      targets: this.discoveryStage,
      alpha: 0.98,
      scaleX: 0.98,
      scaleY: 0.98,
      duration: 190,
      ease: 'Back.easeOut'
    });
    this.cameras.main.zoomTo(1.02, 170, 'Cubic.easeOut');
  }

  private dismissDiscoveryBeat() {
    if (!this.activeDiscoveryBeatId) {
      return;
    }

    const nextBeat = this.queuedDiscoveryBeatId;
    this.activeDiscoveryBeatId = null;
    this.queuedDiscoveryBeatId = null;
    this.lastGuidanceAt = this.time.now;
    this.tweens.killTweensOf(this.discoveryOverlay);
    this.tweens.killTweensOf(this.discoveryStage);
    this.tweens.add({
      targets: this.discoveryOverlay,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.discoveryOverlay.disableInteractive();
        this.discoveryOverlay.setVisible(false);
      }
    });
    this.tweens.add({
      targets: this.discoveryStage,
      alpha: 0,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.discoveryStage.setVisible(false);

        if (nextBeat && !this.failResolved && !this.finishResolved) {
          this.triggerDiscoveryBeat(nextBeat, this.time.now);
        }
      }
    });

    if (!nextBeat && !this.failResolved && !this.finishResolved && !this.victoryFrozen) {
      this.runnerLoop.setFrozen(false);
      this.emitFocusMode(false);
    }

    if (!nextBeat) {
      this.cameras.main.zoomTo(1, 170, 'Cubic.easeOut');
    }
  }

  private hideDiscoveryStage() {
    if (this.activeDiscoveryBeatId) {
      forgetDiscoveryBeat(this.activeDiscoveryBeatId);
    }

    this.activeDiscoveryBeatId = null;
    this.queuedDiscoveryBeatId = null;

    // During scene.restart(), Phaser tears down plugins and cameras
    // before firing SHUTDOWN. Guard every scene-owned access.
    if (this.tweens) {
      this.tweens.killTweensOf(this.discoveryOverlay);
      this.tweens.killTweensOf(this.discoveryStage);
    }

    if (this.discoveryOverlay?.scene) {
      this.discoveryOverlay.disableInteractive();
      this.discoveryOverlay.setAlpha(0).setVisible(false);
    }

    if (this.discoveryStage?.scene) {
      this.discoveryStage.setAlpha(0).setScale(0.92).setVisible(false);
    }

    if (this.cameras?.main) {
      this.cameras.main.zoomTo(1, 120, 'Cubic.easeOut');
    }
  }

  private updateGuidanceMoments(time: number, loopSnapshot: RunnerLoopSnapshot) {
    const phraseChanged = loopSnapshot.currentPhraseId !== this.lastSeenPhraseId;

    if (
      phraseChanged &&
      !this.firstJumpGuidanceShown &&
      loopSnapshot.currentPhraseId === 'onboarding_jump' &&
      time - this.lastGuidanceAt > 1400
    ) {
      this.firstJumpGuidanceShown = true;
      this.triggerDiscoveryBeat('jump_intro', time);
    }

    if (
      phraseChanged &&
      !this.reserveGuidanceShown &&
      loopSnapshot.currentPhraseId === 'onboarding_reserve' &&
      time - this.lastGuidanceAt > 1800
    ) {
      this.reserveGuidanceShown = true;
      this.triggerDiscoveryBeat('reserve_hint', time);
    }

    if (
      phraseChanged &&
      loopSnapshot.currentPhraseFamily === 'recovery' &&
      time - this.lastGuidanceAt > 6200
    ) {
      const line = SUPPORTIVE_LINES[this.guidanceIndex % SUPPORTIVE_LINES.length]!;
      this.guidanceIndex += 1;
      this.emitGuidanceLine(line, 1800, time);
    }

    if (
      !this.surfaceGuidanceShown &&
      this.stage.surfaceGuidance &&
      loopSnapshot.surfaceProgress >= 0.56 &&
      time - this.lastGuidanceAt > 4200
    ) {
      this.surfaceGuidanceShown = true;
      this.emitGuidanceLine(this.stage.surfaceGuidance, 1800, time);
    }

    this.lastSeenPhraseId = loopSnapshot.currentPhraseId;
  }

  private updateDoubleJumpHint(time: number, loopSnapshot: RunnerLoopSnapshot) {
    if (this.doubleJumpHintShown) {
      return;
    }

    if (
      loopSnapshot.currentPhraseId === 'onboarding_double' &&
      loopSnapshot.distanceTravelled > 240 &&
      time - this.lastGuidanceAt > 2200
    ) {
      this.doubleJumpHintShown = true;
      this.triggerDiscoveryBeat('double_jump_intro', time);
    }
  }

  private updateSharkEvent(time: number, deltaSeconds: number, loopSnapshot: RunnerLoopSnapshot) {
    if (!this.sharkActive) {
      const pulse = sessionState.snapshot().currentPulse;
      const firstSharkWindow =
        !this.sharkHelpGuidanceShown &&
        (
          loopSnapshot.currentPhraseId === 'onboarding_shark' ||
          (
            this.stage.backdropKind === 'moonlight-mountain' &&
            loopSnapshot.currentPhraseFamily === 'onboarding' &&
            loopSnapshot.levelProgress >= 0.18
          )
        );
      const sharkNeeded =
        (firstSharkWindow && (this.firstHitGuidanceShown || loopSnapshot.levelProgress > 0.26)) ||
        (this.sharkHelpGuidanceShown && (pulse < 0.88 || this.firstHitGuidanceShown));
      this.sharkCooldown -= deltaSeconds;

      if (
        this.sharkCooldown <= 0 &&
        sharkNeeded &&
        loopSnapshot.levelProgress > 0.12 &&
        loopSnapshot.levelProgress < 0.84 &&
        !loopSnapshot.levelComplete
      ) {
        this.sharkActive = true;
        this.sharkProgress = 0;
        this.sharkDuration = firstSharkWindow
          ? Phaser.Math.FloatBetween(3.05, 3.35)
          : Phaser.Math.FloatBetween(2.55, 2.95);
        this.sharkBaseY = firstSharkWindow
          ? Phaser.Math.Between(334, 352)
          : Phaser.Math.Between(340, 370);
        this.sharkTagged = false;
        this.shark.setVisible(true);
        this.sharkShadow.setVisible(true);

        if (!this.sharkHelpGuidanceShown && time - this.lastGuidanceAt > 1800) {
          this.sharkHelpGuidanceShown = true;
          this.triggerDiscoveryBeat('shark_sighting', time);
        }
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

    if (!this.sharkTagged && Math.abs(x - this.hero.x) < 48 && Math.abs(y - this.hero.y) < 76) {
      this.sharkTagged = true;
      this.sharkBurst = 1;
      this.feedback.collect = Math.max(this.feedback.collect, 0.42);
      this.feedback.awakening = Math.max(this.feedback.awakening, 0.2);
      audioCueBus.emit({
        type: 'shark_touch',
        intensity: 1.02
      });
      this.emitLightMotes(x, y, {
        count: 7,
        spread: 30,
        color: 0xf4fff0,
        accentColor: 0x9effcf,
        durationMs: 460,
        depth: 5.06
      });
      const pulseBefore = sessionState.snapshot().currentPulse;
      const pulseRestore = Math.min(SHARK_PULSE_RESTORE, Math.max(0, 1 - pulseBefore));

      if (pulseRestore > 0.01) {
        sessionState.pulse(pulseRestore);
      }

      if (!this.sharkBenefitGuidanceShown) {
        this.sharkBenefitGuidanceShown = true;
        this.triggerDiscoveryBeat('shark_catch', time);
      } else if (pulseRestore > 0.01) {
        const line = SHARK_LINES[this.sharkGuidanceIndex % SHARK_LINES.length]!;
        this.sharkGuidanceIndex += 1;
        this.emitGuidanceLine(line, 1200, time);
      }

      this.sharkActive = false;
      this.shark.setVisible(false);
      this.sharkShadow.setVisible(false);
      this.sharkCooldown = Phaser.Math.FloatBetween(6.4, 8.8);
      return;
    }

    if (this.sharkProgress >= 1) {
      this.sharkActive = false;
      this.shark.setVisible(false);
      this.sharkShadow.setVisible(false);
      this.sharkCooldown = Phaser.Math.FloatBetween(5.4, 8.2);
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
