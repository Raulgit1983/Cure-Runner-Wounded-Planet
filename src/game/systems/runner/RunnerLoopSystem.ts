import Phaser from 'phaser';

import { runnerConfig } from '@/game/content/runnerConfig';
import {
  runnerPhrases,
  runnerPhraseRotation,
  type CollectibleVariant,
  type HazardVariant,
  type PhraseFamily,
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

type LaneEntityRole = 'collectible' | 'hazard';

interface EntityDefinition {
  label: string;
  role: LaneEntityRole;
  depth: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface RunnerEntity {
  label: string;
  role: LaneEntityRole;
  variant: CollectibleVariant | HazardVariant;
  worldX: number;
  baseY: number;
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  hitboxOffsetX: number;
  hitboxOffsetY: number;
  container: Phaser.GameObjects.Container;
  halo?: Phaser.GameObjects.Ellipse;
  primary: PaintableShape[];
  secondary: PaintableShape[];
  inactive: boolean;
}

export interface RunnerDebugEntitySnapshot {
  label: string;
  role: LaneEntityRole;
  screenX: number;
  screenY: number;
  active: boolean;
  hitbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  currentPhraseFamily: PhraseFamily;
  projectedLandingX: number | null;
  runFailed: boolean;
}

const collectibleDefinitions: Record<CollectibleVariant, EntityDefinition> = {
  spark: { label: 'spark', role: 'collectible', depth: 4, width: 18, height: 18, offsetX: 0, offsetY: 0 },
  note: { label: 'note', role: 'collectible', depth: 4, width: 22, height: 30, offsetX: 0, offsetY: 0 },
  brush: { label: 'brush', role: 'collectible', depth: 4, width: 28, height: 18, offsetX: 0, offsetY: 0 }
} as const;

const hazardDefinitions: Record<HazardVariant, EntityDefinition> = {
  sludge: { label: 'sludge', role: 'hazard', depth: 3.6, width: 34, height: 20, offsetX: -4, offsetY: -10 },
  warden: { label: 'warden', role: 'hazard', depth: 3.6, width: 30, height: 38, offsetX: 0, offsetY: -11 },
  hound: { label: 'hound', role: 'hazard', depth: 3.6, width: 36, height: 20, offsetX: 3, offsetY: -12 }
} as const;

const collectRadiusSquared = runnerConfig.rewards.collectRadius * runnerConfig.rewards.collectRadius;

export class RunnerLoopSystem {
  private readonly entities: RunnerEntity[] = [];
  private readonly heroBoundsRect = new Phaser.Geom.Rectangle();
  private readonly entityBoundsRect = new Phaser.Geom.Rectangle();

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
  private currentPhraseFamily: PhraseFamily = runnerPhrases.onboarding_arc.family;
  private failed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly showDebug = false
  ) {
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
      currentPhraseFamily: this.currentPhraseFamily,
      projectedLandingX: this.showDebug ? this.projectLandingScreenX() : null,
      runFailed: this.failed
    };
  }

  debugSnapshot(): RunnerDebugEntitySnapshot[] {
    return this.entities.map((entity) => {
      const hitbox = this.getEntityBounds(entity);

      return {
        label: entity.label,
        role: entity.role,
        screenX: entity.screenX,
        screenY: entity.screenY,
        active: !entity.inactive,
        hitbox: {
          x: hitbox.x,
          y: hitbox.y,
          width: hitbox.width,
          height: hitbox.height
        }
      };
    });
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

    audioCueBus.emit({
      type: 'jump_player',
      intensity: isAirJump ? 1.4 : 1.0
    });

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
    this.currentPhraseFamily = phrase.family;

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
    const definition = collectibleDefinitions[variant];
    const container = this.scene.add.container(0, 0).setDepth(definition.depth);
    const halo = this.scene.add
      .ellipse(0, 0, 38, 38, mood.sparkColor, mood.sparkHaloAlpha * 0.88)
      .setBlendMode(Phaser.BlendModes.ADD);

    const primary: PaintableShape[] = [];
    const secondary: PaintableShape[] = [];

    if (variant === 'spark') {
      primary.push(
        this.scene.add.ellipse(0, 3, 18, 16, mood.sparkColor, 1),
        this.scene.add.triangle(-10, -6, -8, 2, 0, -10, 2, 4, mood.sparkColor, 1).setRotation(-0.26),
        this.scene.add.triangle(10, -6, -2, 4, 0, -10, 8, 2, mood.sparkColor, 1).setRotation(0.26),
        this.scene.add.ellipse(0, 10, 24, 10, mood.sparkColor, 1),
        this.scene.add.triangle(0, 17, -4, -2, 0, 4, 4, -2, mood.sparkColor, 1)
      );
      secondary.push(
        this.scene.add.ellipse(0, 3, 8, 8, 0xffffff, 1),
        this.scene.add.ellipse(0, -5, 4, 4, 0xffffff, 1),
        this.scene.add.ellipse(0, 11, 5, 3, 0xf8fff0, 0.9)
      );
    }

    if (variant === 'note') {
      primary.push(
        this.scene.add.ellipse(0, 2, 18, 24, mood.sparkColor, 1),
        this.scene.add.rectangle(0, 12, 14, 8, mood.sparkColor, 1),
        this.scene.add.triangle(0, -14, -7, 3, 0, -8, 7, 3, mood.sparkColor, 1),
        this.scene.add.triangle(-9, -2, -4, 5, 0, -6, 3, 6, mood.sparkColor, 1).setRotation(-0.22),
        this.scene.add.triangle(9, -2, -3, 6, 0, -6, 4, 5, mood.sparkColor, 1).setRotation(0.22)
      );
      secondary.push(
        this.scene.add.ellipse(0, 2, 8, 10, 0xffffff, 1),
        this.scene.add.ellipse(2, 1, 3, 3, 0xffffff, 1),
        this.scene.add.rectangle(0, 13, 6, 2, 0xf8fff0, 0.9)
      );
    }

    if (variant === 'brush') {
      primary.push(
        this.scene.add.ellipse(-6, 6, 16, 12, mood.sparkColor, 1),
        this.scene.add.rectangle(6, -2, 20, 6, mood.sparkColor, 1).setRotation(-0.56),
        this.scene.add.triangle(15, -13, -6, 4, 6, 0, 0, -9, mood.sparkColor, 1).setRotation(-0.18),
        this.scene.add.triangle(-14, 13, -5, -2, 5, -1, 0, 6, mood.sparkColor, 1).setRotation(0.2)
      );
      secondary.push(
        this.scene.add.ellipse(-6, 6, 6, 6, 0xffffff, 1),
        this.scene.add.rectangle(8, -4, 8, 2, 0xffffff, 1).setRotation(-0.56),
        this.scene.add.rectangle(-11, 11, 6, 2, 0xf8fff0, 0.9).setRotation(0.2)
      );
    }

    container.add([halo, ...primary, ...secondary]);

    return {
      label: definition.label,
      role: definition.role,
      variant,
      worldX,
      baseY: runnerConfig.visual.groundLineY - centerHeight,
      screenX: 0,
      screenY: 0,
      width: definition.width,
      height: definition.height,
      hitboxOffsetX: definition.offsetX,
      hitboxOffsetY: definition.offsetY,
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
    const definition = hazardDefinitions[variant];
    const container = this.scene.add.container(0, 0).setDepth(definition.depth);
    const primary: PaintableShape[] = [];
    const secondary: PaintableShape[] = [];

    if (variant === 'sludge') {
      primary.push(
        this.scene.add.rectangle(0, 12, 36, 14, 0x3e4c59, 1),
        this.scene.add.triangle(-6, -2, -12, 14, 12, 14, -6, -8, 0x52606d, 1),
        this.scene.add.rectangle(8, 2, 16, 12, 0x52606d, 1).setRotation(0.2),
        this.scene.add.rectangle(-12, 4, 14, 18, 0x616e7c, 1).setRotation(-0.15),
        this.scene.add.triangle(15, 4, -4, 9, 4, 0, 0, -8, 0x607284, 1).setRotation(0.14)
      );
      secondary.push(
        this.scene.add.rectangle(-6, 0, 4, 12, 0x9aa5b1, 1).setRotation(0.4),
        this.scene.add.rectangle(8, -4, 18, 4, 0x7b8794, 1).setRotation(-0.3),
        this.scene.add.ellipse(-16, 14, 6, 4, 0x323f4b, 1),
        this.scene.add.ellipse(14, 16, 12, 4, 0x1f2933, 1),
        this.scene.add.rectangle(10, 6, 7, 2, 0xd5dde2, 0.85).setRotation(-0.22)
      );
    }

    if (variant === 'warden') {
      primary.push(
        this.scene.add.ellipse(0, 20, 40, 8, 0x13111a, 0.4),
        this.scene.add.rectangle(0, 8, 34, 12, 0x3a2a2a, 1).setRotation(0.04),
        this.scene.add.rectangle(-2, -4, 30, 14, 0x2a303a, 1).setRotation(-0.06),
        this.scene.add.rectangle(3, -18, 28, 16, 0x4a2a2a, 1).setRotation(0.08),
        this.scene.add.triangle(0, -32, -12, 6, 12, 6, 0, -8, 0x1a1a2a, 1),
        this.scene.add.rectangle(-16, 4, 6, 14, 0x33262f, 1).setRotation(-0.1),
        this.scene.add.rectangle(16, 6, 6, 14, 0x33262f, 1).setRotation(0.1)
      );
      secondary.push(
        this.scene.add.rectangle(0, 8, 30, 4, 0xfff0e4, 0.9).setRotation(0.04),
        this.scene.add.rectangle(-2, -4, 26, 4, 0xe4f0ff, 0.9).setRotation(-0.06),
        this.scene.add.rectangle(3, -18, 24, 6, 0xffe4e4, 0.9).setRotation(0.08),
        this.scene.add.ellipse(0, -28, 6, 6, 0xff3333, 0.8),
        this.scene.add.rectangle(0, 18, 12, 2, 0xe7dfe4, 0.72)
      );
    }

    if (variant === 'hound') {
      primary.push(
        this.scene.add.ellipse(-2, 18, 38, 8, 0x13111a, 0.4),
        this.scene.add.rectangle(0, 6, 28, 16, 0x34495e, 1),
        this.scene.add.triangle(18, -4, -10, 10, 6, 10, 8, -6, 0x2c3e50, 1),
        this.scene.add.rectangle(-12, 14, 6, 14, 0x2c3e50, 1).setRotation(0.2),
        this.scene.add.rectangle(8, 14, 6, 14, 0x2c3e50, 1).setRotation(-0.1),
        this.scene.add.triangle(-2, -8, -5, 5, 0, -8, 5, 5, 0x25394e, 1)
      );
      secondary.push(
        this.scene.add.rectangle(4, 2, 24, 2, 0x7f8c8d, 1),
        this.scene.add.ellipse(20, -2, 6, 6, 0xff3366, 0.9),
        this.scene.add.triangle(-14, 0, -6, 8, 6, 8, -6, -4, 0x95a5a6, 1),
        this.scene.add.rectangle(-12, 20, 8, 4, 0x1a252f, 1),
        this.scene.add.rectangle(8, 20, 8, 4, 0x1a252f, 1),
        this.scene.add.rectangle(8, -5, 8, 2, 0xd7e0e8, 0.74).setRotation(0.1)
      );
    }

    container.add([...primary, ...secondary]);

    return {
      label: definition.label,
      role: definition.role,
      variant,
      worldX,
      baseY: runnerConfig.visual.groundLineY - centerHeight,
      screenX: 0,
      screenY: 0,
      width: definition.width,
      height: definition.height,
      hitboxOffsetX: definition.offsetX,
      hitboxOffsetY: definition.offsetY,
      container,
      primary,
      secondary,
      inactive: false
    };
  }

  private updateEntities(time: number, mood: MoodSnapshot) {
    const heroBounds = this.getHeroBounds();
    const heroCenterY = this.heroY - 26;
    const missThreshold = runnerConfig.hero.screenX - runnerConfig.rewards.missMargin;

    for (let index = this.entities.length - 1; index >= 0; index -= 1) {
      const entity = this.entities[index]!;
      const screenX = runnerConfig.hero.screenX + (entity.worldX - this.distanceTravelled);
      const wobble =
        entity.role === 'collectible'
          ? Math.sin(time * 0.0052 + entity.worldX * 0.02) * 4.4
          : Math.sin(time * 0.0037 + entity.worldX * 0.01) * 1.4;
      let shouldRemove = false;

      entity.screenX = screenX;
      entity.screenY = entity.baseY + wobble;
      entity.container.setPosition(entity.screenX, entity.screenY);

      if (entity.role === 'collectible') {
        this.paintCollectible(entity, mood, time);

        if (!entity.inactive) {
          const deltaX = runnerConfig.hero.screenX + 4 - entity.screenX;
          const deltaY = heroCenterY - entity.screenY;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY;

          if (distanceSquared <= collectRadiusSquared) {
            this.collectEntity(entity);
            shouldRemove = true;
          } else if (entity.screenX < missThreshold) {
            const snapshot = sessionState.snapshot();

            if (snapshot.currentChain > 0) {
              sessionState.breakChain();
              this.chainBurst = Math.max(0, this.chainBurst - 0.18);
            }

            entity.inactive = true;
            shouldRemove = true;
          }
        }
      } else if (entity.role === 'hazard') {
        this.paintHazard(entity, mood, time);

        if (!entity.inactive && this.invulnerabilitySeconds <= 0 && this.overlapsHero(entity, heroBounds)) {
          this.hitHazard(entity);
          entity.inactive = true;
          entity.container.setAlpha(0.68);
        }
      }

      if (entity.screenX < -runnerConfig.spawn.removalMargin) {
        shouldRemove = true;
      }

      if (shouldRemove) {
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
    if (this.failed) {
      return;
    }

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
    this.failed = true;
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

    this.setFrozen(true);
    entity.container.setRotation(Phaser.Math.DegToRad(6));
  }

  private getHeroBounds() {
    this.heroBoundsRect.x = runnerConfig.hero.screenX - runnerConfig.hero.hitbox.width / 2;
    this.heroBoundsRect.y = this.heroY - runnerConfig.hero.hitbox.topOffset;
    this.heroBoundsRect.width = runnerConfig.hero.hitbox.width;
    this.heroBoundsRect.height =
      runnerConfig.hero.hitbox.topOffset + runnerConfig.hero.hitbox.bottomOffset;

    return this.heroBoundsRect;
  }

  private getEntityBounds(entity: RunnerEntity) {
    this.entityBoundsRect.x = entity.screenX + entity.hitboxOffsetX - entity.width / 2;
    this.entityBoundsRect.y = entity.screenY + entity.hitboxOffsetY - entity.height / 2;
    this.entityBoundsRect.width = entity.width;
    this.entityBoundsRect.height = entity.height;

    return this.entityBoundsRect;
  }

  private overlapsHero(entity: RunnerEntity, heroBounds: Phaser.Geom.Rectangle) {
    const entityBounds = this.getEntityBounds(entity);

    return Phaser.Geom.Intersects.RectangleToRectangle(heroBounds, entityBounds);
  }

  private paintCollectible(entity: RunnerEntity, mood: MoodSnapshot, time: number) {
    const hoverScale = 1 + Math.sin(time * 0.005 + entity.worldX * 0.018) * 0.06;
    const shellColor = 0xe9ead9;
    const shellStroke = 0x657267;
    const accentColor = 0xd4e7d0;
    const highlightColor = 0xfaf7ed;
    const applyPaint = (
      shape: PaintableShape | undefined,
      fillColor: number,
      fillAlpha: number,
      strokeColor: number,
      strokeAlpha: number
    ) => {
      shape?.setFillStyle(fillColor, fillAlpha).setStrokeStyle(2, strokeColor, strokeAlpha);
    };

    entity.container.setScale((hoverScale + this.chainBurst * 0.032) * 1.14);
    entity.halo?.setFillStyle(mood.sparkColor, mood.sparkHaloAlpha * 0.5 + this.chainBurst * 0.035);

    if (entity.variant === 'spark') {
      entity.primary.forEach((shape, index) => {
        applyPaint(
          shape,
          index === 3 ? accentColor : shellColor,
          0.96,
          shellStroke,
          index === 4 ? 0.18 : 0.24
        );
      });
      applyPaint(entity.secondary[0], mood.sparkColor, 0.94, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[1], highlightColor, 0.9, shellStroke, 0.06);
      applyPaint(entity.secondary[2], accentColor, 0.82, shellStroke, 0.08);
      return;
    }

    if (entity.variant === 'note') {
      entity.primary.forEach((shape, index) => {
        applyPaint(
          shape,
          index === 1 ? accentColor : shellColor,
          0.96,
          shellStroke,
          index > 2 ? 0.18 : 0.24
        );
      });
      applyPaint(entity.secondary[0], mood.sparkColor, 0.9, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[1], highlightColor, 0.92, shellStroke, 0.05);
      applyPaint(entity.secondary[2], accentColor, 0.82, shellStroke, 0.08);
      return;
    }

    if (entity.variant === 'brush') {
      entity.primary.forEach((shape, index) => {
        applyPaint(
          shape,
          index === 1 ? accentColor : shellColor,
          0.96,
          shellStroke,
          index === 3 ? 0.16 : 0.24
        );
      });
      applyPaint(entity.secondary[0], mood.sparkColor, 0.92, mood.sparkEdgeColor, 0.2);
      applyPaint(entity.secondary[1], highlightColor, 0.9, shellStroke, 0.05);
      applyPaint(entity.secondary[2], accentColor, 0.82, shellStroke, 0.08);
      return;
    }

    this.paintShapes(entity.primary, mood.sparkColor, 0.98, mood.sparkEdgeColor, 0.3);
    this.paintShapes(entity.secondary, highlightColor, 0.96, mood.sparkEdgeColor, 0.1);
  }

  private paintHazard(entity: RunnerEntity, mood: MoodSnapshot, time: number) {
    const sway = Math.sin(time * 0.0032 + entity.worldX * 0.01) * 0.035;
    entity.container.setRotation(sway);

    const primaryStroke =
      entity.variant === 'sludge' ? 0x2c3e50 : entity.variant === 'warden' ? 0x2a1a1a : 0x1a252f;
    const secondaryStroke = entity.variant === 'sludge' ? 0x7b8794 : mood.markerColor;

    entity.primary.forEach((shape) => {
      shape.setAlpha(entity.inactive ? 0.46 : 0.92).setStrokeStyle(3, primaryStroke, 0.6);
    });
    
    entity.secondary.forEach((shape) => {
      shape.setAlpha(entity.inactive ? 0.34 : 0.86).setStrokeStyle(2, secondaryStroke, entity.variant === 'sludge' ? 0.3 : 0.2);
    });
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
