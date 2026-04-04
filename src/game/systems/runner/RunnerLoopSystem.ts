import Phaser from 'phaser';

import { runnerConfig } from '@/game/content/runnerConfig';
import {
  runnerPhrases,
  runnerPhraseRotation,
  type CollectibleVariant,
  type HazardVariant,
  type RunnerPhrase,
  type RunnerPhraseItem
} from '@/game/content/runnerPhrases';
import { audioCueBus } from '@/game/services/audio/audioCueBus';
import { runTelemetryStore } from '@/game/services/telemetry/runTelemetryStore';
import { sessionState } from '@/game/state/sessionState';
import type { MoodSnapshot } from '@/game/systems/emotion/EmotionController';

type PaintableShape =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Ellipse
  | Phaser.GameObjects.Triangle;

interface RunnerEntity {
  kind: RunnerPhraseItem['kind'];
  variant: CollectibleVariant | HazardVariant;
  worldX: number;
  baseY: number;
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  container: Phaser.GameObjects.Container;
  halo?: Phaser.GameObjects.Ellipse;
  primary: PaintableShape[];
  secondary: PaintableShape[];
  inactive: boolean;
}

export interface RunnerLoopSnapshot {
  heroX: number;
  heroY: number;
  velocityY: number;
  grounded: boolean;
  distanceTravelled: number;
  levelProgress: number;
  surfaceProgress: number;
  finishRevealProgress: number;
  levelComplete: boolean;
  collectBurst: number;
  chainBurst: number;
  impactBurst: number;
  landingBurst: number;
  staggerAmount: number;
  jumpBufferSeconds: number;
  coyoteSeconds: number;
  currentPhraseId: string;
  currentPhraseLabel: string;
  projectedLandingX: number | null;
}

const collectibleMetrics = {
  spark: { width: 18, height: 18 },
  note: { width: 22, height: 30 },
  brush: { width: 28, height: 18 }
} as const;

const hazardMetrics = {
  sludge: { width: 24, height: 16 },
  warden: { width: 20, height: 32 },
  hound: { width: 28, height: 16 }
} as const;

export class RunnerLoopSystem {
  private readonly entities: RunnerEntity[] = [];

  private heroY = runnerConfig.hero.runY;
  private heroVelocityY = 0;
  private frozen = false;
  private grounded = true;
  private pointerHeld = false;
  private jumpBufferSeconds: number = 0;
  private coyoteSeconds: number = runnerConfig.jump.coyoteSeconds;
  private holdJumpSeconds: number = 0;
  private jumpsUsed = 0;
  private staggerSeconds: number = 0;
  private invulnerabilitySeconds: number = 0;
  private recoveryQueued = false;
  private distanceTravelled = 0;
  private nextPhraseWorldX = runnerConfig.spawn.startWorldX;
  private initialPhrasePending = true;
  private rotationIndex = 0;
  private collectBurst = 0;
  private chainBurst = 0;
  private impactBurst = 0;
  private landingBurst = 0;
  private recoveryPhraseIndex = 0;
  private currentSpeed: number = runnerConfig.movement.baseSpeed;
  private currentPhraseId: string = runnerPhrases.onboarding_arc.id;
  private currentPhraseLabel: string = runnerPhrases.onboarding_arc.label;

  constructor(private readonly scene: Phaser.Scene) {
    this.bindInput();
  }

  update(deltaSeconds: number, time: number, mood: MoodSnapshot, displayLevel: number) {
    if (this.frozen) {
      this.updateHeroPhysics(deltaSeconds);
      this.updateFeedback(deltaSeconds);
      return;
    }

    this.updateHeroPhysics(deltaSeconds);
    this.updateFeedback(deltaSeconds);

    const rawSpeed =
      runnerConfig.movement.baseSpeed *
      (1 + displayLevel * runnerConfig.movement.displaySpeedBonus) *
      (1 - this.getStaggerAmount() * runnerConfig.obstacle.speedPenalty);
    const remainingDistance = runnerConfig.level.endDistance - this.distanceTravelled;
    const speed =
      remainingDistance < runnerConfig.level.finishSlowdownDistance
        ? Phaser.Math.Linear(
            rawSpeed * 0.36,
            rawSpeed,
            Phaser.Math.Clamp(remainingDistance / runnerConfig.level.finishSlowdownDistance, 0, 1)
          )
        : rawSpeed;

    this.currentSpeed = speed;
    this.distanceTravelled = Math.min(
      runnerConfig.level.endDistance + runnerConfig.level.exitCoastDistance,
      this.distanceTravelled + speed * deltaSeconds
    );

    while (
      this.nextPhraseWorldX < runnerConfig.level.endDistance - 260 &&
      this.nextPhraseWorldX - this.distanceTravelled < runnerConfig.spawn.leadDistance
    ) {
      this.spawnPhrase(this.pickNextPhrase(sessionState.snapshot()), mood);
    }

    this.updateEntities(time, mood);
  }

  snapshot(): RunnerLoopSnapshot {
    return {
      heroX: runnerConfig.hero.screenX,
      heroY: this.heroY,
      velocityY: this.heroVelocityY,
      grounded: this.grounded,
      distanceTravelled: this.distanceTravelled,
      levelProgress: this.getLevelProgress(),
      surfaceProgress: this.getSurfaceProgress(),
      finishRevealProgress: this.getFinishRevealProgress(),
      levelComplete: this.isLevelComplete(),
      collectBurst: this.collectBurst,
      chainBurst: this.chainBurst,
      impactBurst: this.impactBurst,
      landingBurst: this.landingBurst,
      staggerAmount: this.getStaggerAmount(),
      jumpBufferSeconds: this.jumpBufferSeconds,
      coyoteSeconds: this.coyoteSeconds,
      currentPhraseId: this.currentPhraseId,
      currentPhraseLabel: this.currentPhraseLabel,
      projectedLandingX: this.projectLandingScreenX()
    };
  }

  destroy() {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.entities.forEach((entity) => {
      entity.container.destroy(true);
    });
    this.entities.length = 0;
  }

  setFrozen(nextFrozen: boolean) {
    this.frozen = nextFrozen;

    if (nextFrozen) {
      this.pointerHeld = false;
      this.jumpBufferSeconds = 0;
      this.holdJumpSeconds = 0;
    }
  }

  private bindInput() {
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);
  }

  private handlePointerDown() {
    if (this.frozen) {
      return;
    }

    audioCueBus.unlockFromGesture();
    this.pointerHeld = true;
    this.jumpBufferSeconds = runnerConfig.jump.bufferSeconds;
    this.tryStartJump();
  }

  private handlePointerUp() {
    this.pointerHeld = false;
    this.holdJumpSeconds = 0;
  }

  private updateHeroPhysics(deltaSeconds: number) {
    const wasGrounded = this.grounded;
    const previousVelocityY = this.heroVelocityY;

    this.staggerSeconds = Math.max(0, this.staggerSeconds - deltaSeconds);
    this.invulnerabilitySeconds = Math.max(0, this.invulnerabilitySeconds - deltaSeconds);
    this.jumpBufferSeconds = Math.max(0, this.jumpBufferSeconds - deltaSeconds);
    this.coyoteSeconds = this.grounded
      ? runnerConfig.jump.coyoteSeconds
      : Math.max(0, this.coyoteSeconds - deltaSeconds);

    this.tryStartJump();

    let gravity =
      this.heroVelocityY < 0 ? runnerConfig.jump.riseGravity : runnerConfig.jump.fallGravity;

    if (this.pointerHeld && this.holdJumpSeconds > 0 && this.heroVelocityY < 0) {
      gravity *= runnerConfig.jump.holdGravityMultiplier;
      this.holdJumpSeconds = Math.max(0, this.holdJumpSeconds - deltaSeconds);
    } else {
      if (!this.pointerHeld && this.heroVelocityY < 0) {
        gravity *= runnerConfig.jump.releaseGravityMultiplier;
      }

      this.holdJumpSeconds = 0;
    }

    this.heroVelocityY = Math.min(
      runnerConfig.jump.maxFallSpeed,
      this.heroVelocityY + gravity * deltaSeconds
    );
    this.heroY += this.heroVelocityY * deltaSeconds;

    if (this.heroY >= runnerConfig.hero.runY) {
      this.heroY = runnerConfig.hero.runY;

      if (!wasGrounded && previousVelocityY > runnerConfig.jump.landingBurstVelocity) {
        this.landingBurst = Math.max(
          this.landingBurst,
          Phaser.Math.Clamp(previousVelocityY / runnerConfig.jump.maxFallSpeed, 0, 1)
        );
      }

      this.heroVelocityY = 0;
      this.grounded = true;
      this.jumpsUsed = 0;
    } else {
      this.grounded = false;
    }
  }

  private tryStartJump() {
    if (this.jumpBufferSeconds <= 0) {
      return;
    }

    const canGroundJump = this.grounded || this.coyoteSeconds > 0;
    const canAirJump = !canGroundJump && this.jumpsUsed < runnerConfig.jump.maxJumps;

    if (!canGroundJump && !canAirJump) {
      return;
    }

    const isAirJump = !canGroundJump;

    this.jumpBufferSeconds = 0;
    this.coyoteSeconds = 0;
    this.grounded = false;
    this.heroVelocityY = isAirJump
      ? -runnerConfig.jump.doubleJumpVelocity
      : -runnerConfig.jump.velocity;
    this.heroY -= isAirJump ? 1 : 2;
    this.holdJumpSeconds = isAirJump
      ? runnerConfig.jump.airJumpHoldMaxSeconds
      : runnerConfig.jump.holdMaxSeconds;
    this.jumpsUsed = isAirJump ? this.jumpsUsed + 1 : 1;

    if (isAirJump) {
      this.collectBurst = Math.max(this.collectBurst, 0.18);
      this.chainBurst = Math.max(this.chainBurst, 0.06);
    }
  }

  private updateFeedback(deltaSeconds: number) {
    this.collectBurst = Math.max(0, this.collectBurst - deltaSeconds * 3.2);
    this.chainBurst = Math.max(0, this.chainBurst - deltaSeconds * 1.8);
    this.impactBurst = Math.max(0, this.impactBurst - deltaSeconds * 2.5);
    this.landingBurst = Math.max(0, this.landingBurst - deltaSeconds * 5.8);
  }

  private spawnPhrase(phrase: RunnerPhrase, mood: MoodSnapshot) {
    this.currentPhraseId = phrase.id;
    this.currentPhraseLabel = phrase.label;

    phrase.items.forEach((item) => {
      this.entities.push(this.createEntity(this.nextPhraseWorldX + item.x, item, mood));
    });

    this.nextPhraseWorldX += phrase.spacingAfter;
  }

  private pickNextPhrase(snapshot = sessionState.snapshot()) {
    if (this.initialPhrasePending) {
      this.initialPhrasePending = false;
      return runnerPhrases.onboarding_arc;
    }

    if (this.recoveryQueued || snapshot.currentPulse <= runnerConfig.director.recoveryPulseThreshold) {
      this.recoveryQueued = false;
      const recoveryId = this.recoveryPhraseIndex % 2 === 0 ? 'recovery_breath' : 'recovery_lift';
      this.recoveryPhraseIndex += 1;
      return runnerPhrases[recoveryId];
    }

    const nextId = runnerPhraseRotation[this.rotationIndex % runnerPhraseRotation.length]!;
    this.rotationIndex += 1;

    return runnerPhrases[nextId];
  }

  private createEntity(worldX: number, item: RunnerPhraseItem, mood: MoodSnapshot): RunnerEntity {
    return item.kind === 'collectible'
      ? this.createCollectible(worldX, item.variant, item.y, mood)
      : this.createHazard(worldX, item.variant, item.y, mood);
  }

  private createCollectible(
    worldX: number,
    variant: CollectibleVariant,
    centerHeight: number,
    mood: MoodSnapshot
  ): RunnerEntity {
    const container = this.scene.add.container(0, 0).setDepth(4);
    const halo = this.scene.add
      .ellipse(0, 0, 42, 42, mood.sparkColor, mood.sparkHaloAlpha)
      .setBlendMode(Phaser.BlendModes.ADD);

    const primary: PaintableShape[] = [];
    const secondary: PaintableShape[] = [];

    if (variant === 'spark') {
      primary.push(this.scene.add.ellipse(0, 0, 12, 12, mood.sparkColor, 1));
      secondary.push(
        this.scene.add.rectangle(0, -10, 4, 12, mood.markerColor, 1).setRotation(0.18),
        this.scene.add.rectangle(9, 0, 12, 4, mood.markerColor, 1).setRotation(-0.12),
        this.scene.add.rectangle(0, 10, 4, 12, mood.markerColor, 1).setRotation(0.16),
        this.scene.add.rectangle(-9, 0, 12, 4, mood.markerColor, 1).setRotation(-0.1)
      );
    }

    if (variant === 'note') {
      primary.push(
        this.scene.add.ellipse(-3, 4, 12, 10, mood.sparkColor, 1),
        this.scene.add.rectangle(5, -8, 4, 24, mood.sparkColor, 1),
        this.scene.add.triangle(12, -14, 0, 0, 10, 4, 0, 11, mood.sparkColor, 1)
      );
      secondary.push(this.scene.add.rectangle(-8, 12, 8, 3, mood.markerColor, 0.9));
    }

    if (variant === 'brush') {
      primary.push(
        this.scene.add.rectangle(-2, 0, 20, 5, mood.sparkColor, 1).setRotation(-0.32),
        this.scene.add.rectangle(10, -6, 8, 8, mood.sparkColor, 1).setRotation(-0.32),
        this.scene.add.triangle(15, -12, -4, 4, 8, 0, 0, -9, mood.sparkColor, 1).setRotation(-0.22)
      );
      secondary.push(this.scene.add.rectangle(-12, 7, 10, 3, mood.markerColor, 0.92).setRotation(-0.32));
    }

    container.add([halo, ...primary, ...secondary]);

    return {
      kind: 'collectible',
      variant,
      worldX,
      baseY: runnerConfig.visual.groundLineY - centerHeight,
      screenX: 0,
      screenY: 0,
      width: collectibleMetrics[variant].width,
      height: collectibleMetrics[variant].height,
      container,
      halo,
      primary,
      secondary,
      inactive: false
    };
  }

  private createHazard(
    worldX: number,
    variant: HazardVariant,
    centerHeight: number,
    mood: MoodSnapshot
  ): RunnerEntity {
    const container = this.scene.add.container(0, 0).setDepth(3.6);
    const primary: PaintableShape[] = [];
    const secondary: PaintableShape[] = [];

    if (variant === 'sludge') {
      primary.push(
        this.scene.add.ellipse(-4, 10, 34, 14, 0x5f3a1f, 0.96),
        this.scene.add.ellipse(-3, 0, 26, 14, 0x6d4324, 0.96),
        this.scene.add.ellipse(2, -10, 18, 12, 0x784929, 0.96),
        this.scene.add.triangle(8, -19, -6, 3, 0, -8, 7, 4, 0x7f502d, 0.96)
      );
      secondary.push(
        this.scene.add.ellipse(-7, -12, 7, 4, 0xa56e43, 0.9),
        this.scene.add.ellipse(3, -7, 6, 4, 0xa56e43, 0.86),
        this.scene.add.ellipse(12, -1, 5, 3, 0x3a2413, 0.34),
        this.scene.add.ellipse(-15, 12, 8, 4, 0xf8f1e5, 0.12)
      );
    }

    if (variant === 'warden') {
      primary.push(
        this.scene.add.rectangle(0, 6, 24, 30, mood.shadowColor, 0.94),
        this.scene.add.rectangle(0, -3, 28, 8, mood.shadowColor, 0.94),
        this.scene.add.ellipse(0, -18, 18, 17, mood.shadowColor, 0.94),
        this.scene.add.rectangle(-9, -2, 7, 18, mood.shadowColor, 0.94),
        this.scene.add.rectangle(9, -2, 7, 18, mood.shadowColor, 0.94)
      );
      secondary.push(
        this.scene.add.rectangle(0, -29, 28, 6, mood.floorLineColor, 0.88),
        this.scene.add.ellipse(0, -18, 6, 6, mood.markerColor, 0.88),
        this.scene.add.rectangle(0, -4, 16, 4, mood.markerColor, 0.24),
        this.scene.add.rectangle(-7, 22, 6, 10, mood.floorLineColor, 0.9),
        this.scene.add.rectangle(7, 22, 6, 10, mood.floorLineColor, 0.9),
        this.scene.add.rectangle(0, 9, 10, 4, mood.markerColor, 0.32)
      );
    }

    if (variant === 'hound') {
      primary.push(
        this.scene.add.ellipse(-4, 8, 30, 16, mood.shadowColor, 0.94),
        this.scene.add.ellipse(12, -1, 18, 14, mood.shadowColor, 0.94),
        this.scene.add.ellipse(21, 2, 10, 8, mood.shadowColor, 0.94),
        this.scene.add.ellipse(3, 1, 10, 8, mood.shadowColor, 0.94)
      );
      secondary.push(
        this.scene.add.triangle(7, -12, -3, 0, 3, -10, 8, 4, mood.floorLineColor, 0.92),
        this.scene.add.triangle(17, -12, -3, 0, 3, -10, 8, 4, mood.floorLineColor, 0.92),
        this.scene.add.triangle(-20, 2, -10, 0, -20, -8, -18, 9, mood.floorLineColor, 0.86),
        this.scene.add.rectangle(-14, 17, 6, 8, mood.floorLineColor, 0.9),
        this.scene.add.rectangle(0, 18, 6, 8, mood.floorLineColor, 0.9),
        this.scene.add.ellipse(20, 1, 4, 4, mood.markerColor, 0.78),
        this.scene.add.rectangle(14, 7, 7, 2, mood.markerColor, 0.42).setRotation(0.1)
      );
    }

    container.add([...primary, ...secondary]);

    return {
      kind: 'hazard',
      variant,
      worldX,
      baseY: runnerConfig.visual.groundLineY - centerHeight,
      screenX: 0,
      screenY: 0,
      width: hazardMetrics[variant].width,
      height: hazardMetrics[variant].height,
      container,
      primary,
      secondary,
      inactive: false
    };
  }

  private updateEntities(time: number, mood: MoodSnapshot) {
    const heroBounds = this.getHeroBounds();
    const heroCenterY = this.heroY - 26;
    const expired = new Set<RunnerEntity>();

    this.entities.forEach((entity) => {
      const screenX = runnerConfig.hero.screenX + (entity.worldX - this.distanceTravelled);
      const wobble =
        entity.kind === 'collectible'
          ? Math.sin(time * 0.0052 + entity.worldX * 0.02) * 4.4
          : Math.sin(time * 0.0037 + entity.worldX * 0.01) * 1.4;

      entity.screenX = screenX;
      entity.screenY = entity.baseY + wobble;
      entity.container.setPosition(entity.screenX, entity.screenY);

      if (entity.kind === 'collectible') {
        this.paintCollectible(entity, mood, time);

        if (!entity.inactive) {
          const distance = Phaser.Math.Distance.Between(
            runnerConfig.hero.screenX + 4,
            heroCenterY,
            entity.screenX,
            entity.screenY
          );

          if (distance <= runnerConfig.rewards.collectRadius) {
            this.collectEntity(entity);
            expired.add(entity);
            return;
          }

          if (entity.screenX < runnerConfig.hero.screenX - runnerConfig.rewards.missMargin) {
            if (sessionState.snapshot().currentChain > 0) {
              sessionState.breakChain();
              this.chainBurst = Math.max(0, this.chainBurst - 0.18);
            }

            entity.inactive = true;
            expired.add(entity);
            return;
          }
        }
      } else {
        this.paintHazard(entity, mood, time);

        if (!entity.inactive && this.invulnerabilitySeconds <= 0 && this.overlapsHero(entity, heroBounds)) {
          this.hitHazard(entity);
          entity.inactive = true;
          entity.container.setAlpha(0.68);
        }
      }

      if (entity.screenX < -runnerConfig.spawn.removalMargin) {
        expired.add(entity);
      }
    });

    if (expired.size > 0) {
      for (let index = this.entities.length - 1; index >= 0; index -= 1) {
        const entity = this.entities[index]!;

        if (!expired.has(entity)) {
          continue;
        }

        entity.container.destroy(true);
        this.entities.splice(index, 1);
      }
    }
  }

  private collectEntity(entity: RunnerEntity) {
    const previous = sessionState.snapshot();
    const nextChain = previous.currentChain + 1;
    const comboTier = Math.floor((nextChain - 1) / runnerConfig.rewards.comboEvery);
    const pulseGain =
      runnerConfig.rewards.basePulseGain + comboTier * runnerConfig.rewards.comboPulseBonus;
    const awakeningGain =
      runnerConfig.rewards.baseAwakeningGain +
      comboTier * runnerConfig.rewards.comboAwakeningBonus;

    const transition = sessionState.registerSparkCollection({
      awakeningGain,
      pulseGain,
      chain: nextChain
    });

    runTelemetryStore.noteSpark(nextChain);
    this.collectBurst = 1;
    this.chainBurst = Math.max(this.chainBurst, Math.min(1, nextChain / 5));

    audioCueBus.emit({
      type: 'spark_collect',
      intensity: 1 + comboTier * 0.16,
      chain: nextChain,
      amount: pulseGain
    });

    if (nextChain >= runnerConfig.rewards.comboEvery) {
      audioCueBus.emit({
        type: 'chain_success',
        intensity: 1 + nextChain * 0.06,
        chain: nextChain
      });
    }

    if (transition.after.awakeningLevel > transition.before.awakeningLevel) {
      audioCueBus.emit({
        type: 'awakening_gain',
        intensity: 1 + awakeningGain * 8,
        chain: nextChain,
        amount: awakeningGain
      });
    }
  }

  private hitHazard(entity: RunnerEntity) {
    const previous = sessionState.snapshot();

    sessionState.registerPulseDrop({
      pulseLoss: runnerConfig.obstacle.pulseLoss,
      nextChain: 0
    });

    this.impactBurst = 1;
    this.collectBurst = Math.max(0, this.collectBurst - 0.24);
    this.chainBurst = Math.max(0, this.chainBurst - 0.28);
    this.staggerSeconds = runnerConfig.obstacle.staggerSeconds;
    this.invulnerabilitySeconds = runnerConfig.obstacle.invulnerabilitySeconds;
    this.recoveryQueued = true;
    runTelemetryStore.noteObstacleHit();

    audioCueBus.emit({
      type: 'pulse_drop',
      intensity: 1 + runnerConfig.obstacle.pulseLoss * 3,
      chain: previous.currentChain,
      amount: runnerConfig.obstacle.pulseLoss
    });

    if (previous.currentChain > 0) {
      sessionState.breakChain();
    }

    entity.container.setRotation(Phaser.Math.DegToRad(6));
  }

  private getHeroBounds() {
    return new Phaser.Geom.Rectangle(
      runnerConfig.hero.screenX - runnerConfig.hero.hitbox.width / 2,
      this.heroY - runnerConfig.hero.hitbox.topOffset,
      runnerConfig.hero.hitbox.width,
      runnerConfig.hero.hitbox.topOffset + runnerConfig.hero.hitbox.bottomOffset
    );
  }

  private overlapsHero(entity: RunnerEntity, heroBounds: Phaser.Geom.Rectangle) {
    const entityBounds = new Phaser.Geom.Rectangle(
      entity.screenX - entity.width / 2,
      entity.screenY - entity.height / 2,
      entity.width,
      entity.height
    );

    return Phaser.Geom.Intersects.RectangleToRectangle(heroBounds, entityBounds);
  }

  private paintCollectible(entity: RunnerEntity, mood: MoodSnapshot, time: number) {
    const hoverScale = 1 + Math.sin(time * 0.005 + entity.worldX * 0.018) * 0.06;
    entity.container.setScale(hoverScale + this.chainBurst * 0.04);
    entity.halo?.setFillStyle(mood.sparkColor, mood.sparkHaloAlpha + this.chainBurst * 0.08);
    this.paintShapes(entity.primary, mood.sparkColor, 0.97, mood.sparkEdgeColor, 0.34);
    this.paintShapes(entity.secondary, mood.markerColor, 0.92, mood.sparkEdgeColor, 0.12);
  }

  private paintHazard(entity: RunnerEntity, mood: MoodSnapshot, time: number) {
    const sway = Math.sin(time * 0.0032 + entity.worldX * 0.01) * 0.035;
    const primaryFill =
      entity.variant === 'sludge'
        ? 0x6c4325
        : entity.variant === 'warden'
          ? 0x2d2b3a
          : 0x4a4031;
    const primaryStroke =
      entity.variant === 'sludge'
        ? 0x9d6a42
        : entity.variant === 'warden'
          ? 0x7a7f93
          : 0x887760;
    const secondaryFill =
      entity.variant === 'sludge'
        ? 0xa97347
        : entity.variant === 'warden'
          ? 0x8e9aa4
          : 0x9e8d74;
    const secondaryStroke = entity.variant === 'sludge' ? 0xf8f1e5 : mood.markerColor;

    entity.container.setRotation(sway);
    this.paintShapes(
      entity.primary,
      primaryFill,
      entity.inactive ? 0.46 : 0.92,
      primaryStroke,
      0.34
    );
    this.paintShapes(
      entity.secondary,
      secondaryFill,
      entity.inactive ? 0.34 : 0.86,
      secondaryStroke,
      entity.variant === 'sludge' ? 0.16 : 0.1
    );
  }

  private paintShapes(
    shapes: PaintableShape[],
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    strokeAlpha: number
  ) {
    shapes.forEach((shape) => {
      shape.setFillStyle(fillColor, fillAlpha).setStrokeStyle(2, strokeColor, strokeAlpha);
    });
  }

  private getStaggerAmount() {
    return Phaser.Math.Clamp(
      this.staggerSeconds / runnerConfig.obstacle.staggerSeconds,
      0,
      1
    );
  }

  private getLevelProgress() {
    return Phaser.Math.Clamp(
      this.distanceTravelled / runnerConfig.level.endDistance,
      0,
      1
    );
  }

  private getSurfaceProgress() {
    return Phaser.Math.Clamp(
      (this.distanceTravelled - runnerConfig.level.surfaceStartDistance) /
        (runnerConfig.level.endDistance - runnerConfig.level.surfaceStartDistance),
      0,
      1
    );
  }

  private getFinishRevealProgress() {
    return Phaser.Math.Clamp(
      (this.distanceTravelled - runnerConfig.level.finishRevealDistance) /
        (runnerConfig.level.endDistance - runnerConfig.level.finishRevealDistance),
      0,
      1
    );
  }

  private isLevelComplete() {
    return this.distanceTravelled >= runnerConfig.level.endDistance;
  }

  private projectLandingScreenX() {
    if (this.grounded) {
      return runnerConfig.hero.screenX;
    }

    let simulatedY = this.heroY;
    let simulatedVelocityY = this.heroVelocityY;
    let simulatedHold = this.pointerHeld ? this.holdJumpSeconds : 0;
    let elapsed = 0;
    const step = 1 / 120;

    while (elapsed < 1.8) {
      let gravity =
        simulatedVelocityY < 0 ? runnerConfig.jump.riseGravity : runnerConfig.jump.fallGravity;

      if (this.pointerHeld && simulatedHold > 0 && simulatedVelocityY < 0) {
        gravity *= runnerConfig.jump.holdGravityMultiplier;
        simulatedHold = Math.max(0, simulatedHold - step);
      } else if (!this.pointerHeld && simulatedVelocityY < 0) {
        gravity *= runnerConfig.jump.releaseGravityMultiplier;
      }

      simulatedVelocityY = Math.min(
        runnerConfig.jump.maxFallSpeed,
        simulatedVelocityY + gravity * step
      );
      simulatedY += simulatedVelocityY * step;
      elapsed += step;

      if (simulatedY >= runnerConfig.hero.runY) {
        return runnerConfig.hero.screenX + this.currentSpeed * elapsed;
      }
    }

    return null;
  }
}
