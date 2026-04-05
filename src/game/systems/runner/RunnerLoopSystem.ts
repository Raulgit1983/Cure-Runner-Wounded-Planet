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
  private currentPhraseId: string = runnerPhrases.onboarding_intro.id;
  private currentPhraseLabel: string = runnerPhrases.onboarding_intro.label;
  private currentPhraseFamily: PhraseFamily = runnerPhrases.onboarding_intro.family;
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
      return runnerPhrases.onboarding_intro;
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
        this.scene.add.ellipse(-8, 9, 12, 16, mood.sparkColor, 1).setRotation(-0.58),
        this.scene.add.ellipse(8, 13, 12, 16, mood.sparkColor, 1).setRotation(-0.58),
        this.scene.add.rectangle(-1, -4, 4, 30, mood.sparkColor, 1).setRotation(-0.08),
        this.scene.add.rectangle(14, 1, 4, 30, mood.sparkColor, 1).setRotation(-0.05),
        this.scene.add.rectangle(7, -18, 24, 5, mood.sparkColor, 1).setRotation(0.14),
        this.scene.add.triangle(-16, 18, -6, 3, 0, -10, 5, 4, mood.sparkColor, 1).setRotation(-0.42)
      );
      secondary.push(
        this.scene.add.ellipse(-8, 9, 6, 8, 0xffffff, 1).setRotation(-0.58),
        this.scene.add.ellipse(8, 13, 6, 8, 0xffffff, 1).setRotation(-0.58),
        this.scene.add.rectangle(8, -19, 10, 2, 0xffffff, 1).setRotation(0.14),
        this.scene.add.ellipse(13, -24, 4, 4, 0xffffff, 1)
      );
    }

    if (variant === 'note') {
      primary.push(
        this.scene.add.ellipse(-5, 10, 14, 18, mood.sparkColor, 1).setRotation(-0.54),
        this.scene.add.rectangle(9, -5, 4, 36, mood.sparkColor, 1).setRotation(-0.04),
        this.scene.add.rectangle(15, -24, 12, 5, mood.sparkColor, 1).setRotation(0.18),
        this.scene.add.triangle(17, -16, -8, 6, 0, -12, 7, 0, mood.sparkColor, 1).setRotation(0.22),
        this.scene.add.ellipse(1, 22, 11, 5, mood.sparkColor, 1).setRotation(0.12)
      );
      secondary.push(
        this.scene.add.ellipse(-5, 10, 7, 9, 0xffffff, 1).setRotation(-0.54),
        this.scene.add.rectangle(15, -24, 6, 2, 0xffffff, 1).setRotation(0.18),
        this.scene.add.ellipse(19, -30, 3, 3, 0xffffff, 1)
      );
    }

    if (variant === 'brush') {
      primary.push(
        this.scene.add.ellipse(-6, 12, 13, 17, mood.sparkColor, 1).setRotation(-0.52),
        this.scene.add.ellipse(8, 16, 13, 17, mood.sparkColor, 1).setRotation(-0.52),
        this.scene.add.rectangle(11, -3, 4, 34, mood.sparkColor, 1).setRotation(-0.04),
        this.scene.add.rectangle(16, -21, 16, 5, mood.sparkColor, 1).setRotation(0.22),
        this.scene.add.triangle(19, -13, -8, 6, 0, -11, 7, 0, mood.sparkColor, 1).setRotation(0.18),
        this.scene.add.triangle(-16, 20, -6, 2, 0, -9, 4, 4, mood.sparkColor, 1).setRotation(-0.34)
      );
      secondary.push(
        this.scene.add.ellipse(-6, 12, 6, 8, 0xffffff, 1).setRotation(-0.52),
        this.scene.add.ellipse(8, 16, 6, 8, 0xffffff, 1).setRotation(-0.52),
        this.scene.add.rectangle(16, -21, 8, 2, 0xffffff, 1).setRotation(0.22),
        this.scene.add.ellipse(22, -28, 3, 3, 0xffffff, 1)
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
        this.scene.add.ellipse(0, 16, 38, 10, 0x141820, 0.4),
        this.scene.add.ellipse(-2, 10, 34, 16, 0x29323b, 1),
        this.scene.add.triangle(-15, 6, -8, 10, 0, -12, 10, 10, 0x3c444d, 1).setRotation(-0.18),
        this.scene.add.triangle(1, 2, -8, 12, 0, -13, 8, 12, 0x48505a, 1),
        this.scene.add.triangle(17, 6, -10, 10, 0, -9, 8, 12, 0x343c45, 1).setRotation(0.2),
        this.scene.add.rectangle(-1, 8, 17, 7, 0x59616c, 1).setRotation(-0.08)
      );
      secondary.push(
        this.scene.add.ellipse(-11, 11, 8, 4, 0xb1c57d, 1).setRotation(-0.12),
        this.scene.add.ellipse(8, 6, 10, 4, 0xc7e39a, 1).setRotation(0.22),
        this.scene.add.rectangle(15, 10, 8, 2, 0xe8f6c3, 0.9).setRotation(-0.12),
        this.scene.add.rectangle(-4, 2, 8, 2, 0xcbd6c9, 0.6).setRotation(-0.52)
      );
    }

    if (variant === 'warden') {
      primary.push(
        this.scene.add.ellipse(0, 20, 40, 8, 0x0d0d12, 0.44),
        this.scene.add.triangle(-12, -2, -8, 18, 0, -12, 10, 16, 0x35272f, 1).setRotation(-0.16),
        this.scene.add.triangle(12, -2, -10, 16, 0, -12, 8, 18, 0x3d2b34, 1).setRotation(0.16),
        this.scene.add.rectangle(0, 7, 28, 16, 0x251f27, 1).setRotation(0.05),
        this.scene.add.rectangle(0, -9, 22, 18, 0x3d2d33, 1).setRotation(-0.04),
        this.scene.add.triangle(0, -25, -10, 6, 0, -10, 10, 6, 0x1a1820, 1),
        this.scene.add.rectangle(0, -1, 6, 34, 0x1d1a22, 1)
      );
      secondary.push(
        this.scene.add.ellipse(0, -11, 8, 8, 0xff7b72, 0.94),
        this.scene.add.rectangle(-8, 4, 7, 2, 0xb6b1bc, 0.72).setRotation(-0.32),
        this.scene.add.rectangle(7, 1, 8, 2, 0xc5c0c8, 0.72).setRotation(0.22),
        this.scene.add.rectangle(0, 16, 14, 2, 0xdad4cc, 0.52)
      );
    }

    if (variant === 'hound') {
      primary.push(
        this.scene.add.ellipse(-1, 18, 38, 8, 0x0b0d12, 0.44),
        this.scene.add.ellipse(-4, 8, 24, 14, 0x24303a, 1),
        this.scene.add.triangle(14, 3, -12, 8, 0, -12, 11, 12, 0x303c47, 1).setRotation(0.06),
        this.scene.add.triangle(-15, 3, -10, 10, 0, -10, 8, 12, 0x182127, 1).setRotation(-0.22),
        this.scene.add.rectangle(-9, 17, 5, 12, 0x1b242d, 1).setRotation(0.18),
        this.scene.add.rectangle(6, 17, 5, 12, 0x1b242d, 1).setRotation(-0.12),
        this.scene.add.triangle(-1, -4, -5, 7, 0, -10, 5, 7, 0x42505c, 1)
      );
      secondary.push(
        this.scene.add.rectangle(5, 4, 16, 2, 0x94a5aa, 0.82).setRotation(0.08),
        this.scene.add.ellipse(17, -1, 6, 6, 0xff7b72, 0.94),
        this.scene.add.triangle(-14, 2, -5, 8, 5, 8, -6, -3, 0xc9d0cf, 0.78),
        this.scene.add.rectangle(10, 11, 8, 2, 0xece0d6, 0.72).setRotation(-0.12)
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
    const awakeningGain =
      runnerConfig.rewards.baseAwakeningGain +
      comboTier * runnerConfig.rewards.comboAwakeningBonus;

    const transition = sessionState.registerSparkCollection({
      awakeningGain,
      chain: nextChain
    });

    runTelemetryStore.noteSpark(nextChain);
    this.collectBurst = 1;
    this.chainBurst = Math.max(this.chainBurst, Math.min(1, nextChain / 5));

    audioCueBus.emit({
      type: 'spark_collect',
      intensity: 1 + comboTier * 0.16,
      chain: nextChain,
      amount: 1
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

    if (transition.after.recoveryChances > transition.before.recoveryChances) {
      audioCueBus.emit({
        type: 'reserve_fill',
        intensity: 1,
        chain: nextChain,
        amount: 1
      });
    }
  }

  private hitHazard(entity: RunnerEntity) {
    if (this.failed) {
      return;
    }

    const previous = sessionState.snapshot();
    const transition = sessionState.registerPulseDrop({
      pulseLoss: runnerConfig.obstacle.pulseLoss,
      nextChain: 0
    });
    const shouldFail = transition.after.currentPulse <= 0.001;

    this.impactBurst = 1;
    this.collectBurst = Math.max(0, this.collectBurst - (shouldFail ? 0.24 : 0.18));
    this.chainBurst = Math.max(0, this.chainBurst - (shouldFail ? 0.28 : 0.18));
    this.staggerSeconds = runnerConfig.obstacle.staggerSeconds;
    this.invulnerabilitySeconds = runnerConfig.obstacle.invulnerabilitySeconds;
    this.recoveryQueued = !shouldFail;
    this.failed = shouldFail;
    runTelemetryStore.noteObstacleHit();

    audioCueBus.emit({
      type: 'pulse_drop',
      intensity: 1 + runnerConfig.obstacle.pulseLoss * 3,
      chain: previous.currentChain,
      amount: runnerConfig.obstacle.pulseLoss
    });

    if (shouldFail) {
      this.setFrozen(true);
    }

    entity.container.setRotation(Phaser.Math.DegToRad(shouldFail ? 10 : 6));
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
    const shellColor = 0xf0e7d7;
    const shellWarm = 0xe2d3b3;
    const shellStroke = 0x645d4f;
    const mossAccent = 0xc7d8ab;
    const highlightColor = 0xfff8ea;
    const applyPaint = (
      shape: PaintableShape | undefined,
      fillColor: number,
      fillAlpha: number,
      strokeColor: number,
      strokeAlpha: number
    ) => {
      shape?.setFillStyle(fillColor, fillAlpha).setStrokeStyle(2, strokeColor, strokeAlpha);
    };

    entity.container.setScale((hoverScale + this.chainBurst * 0.032) * 1.08);
    entity.halo?.setFillStyle(mood.sparkColor, mood.sparkHaloAlpha * 0.42 + this.chainBurst * 0.028);

    if (entity.variant === 'spark') {
      applyPaint(entity.primary[0], shellWarm, 0.98, shellStroke, 0.26);
      applyPaint(entity.primary[1], shellWarm, 0.98, shellStroke, 0.26);
      applyPaint(entity.primary[2], shellColor, 0.98, shellStroke, 0.24);
      applyPaint(entity.primary[3], shellColor, 0.98, shellStroke, 0.24);
      applyPaint(entity.primary[4], mossAccent, 0.94, shellStroke, 0.18);
      applyPaint(entity.primary[5], shellColor, 0.96, shellStroke, 0.2);
      applyPaint(entity.secondary[0], mood.sparkColor, 0.96, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[1], mood.sparkColor, 0.96, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[2], highlightColor, 0.92, shellStroke, 0.08);
      applyPaint(entity.secondary[3], highlightColor, 0.78, shellStroke, 0.04);
      return;
    }

    if (entity.variant === 'note') {
      applyPaint(entity.primary[0], shellWarm, 0.98, shellStroke, 0.26);
      applyPaint(entity.primary[1], shellColor, 0.98, shellStroke, 0.24);
      applyPaint(entity.primary[2], mossAccent, 0.94, shellStroke, 0.16);
      applyPaint(entity.primary[3], shellColor, 0.96, shellStroke, 0.18);
      applyPaint(entity.primary[4], shellWarm, 0.92, shellStroke, 0.12);
      applyPaint(entity.secondary[0], mood.sparkColor, 0.96, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[1], highlightColor, 0.92, shellStroke, 0.08);
      applyPaint(entity.secondary[2], highlightColor, 0.76, shellStroke, 0.04);
      return;
    }

    if (entity.variant === 'brush') {
      applyPaint(entity.primary[0], shellWarm, 0.98, shellStroke, 0.26);
      applyPaint(entity.primary[1], shellWarm, 0.98, shellStroke, 0.26);
      applyPaint(entity.primary[2], shellColor, 0.98, shellStroke, 0.24);
      applyPaint(entity.primary[3], mossAccent, 0.94, shellStroke, 0.16);
      applyPaint(entity.primary[4], shellColor, 0.96, shellStroke, 0.18);
      applyPaint(entity.primary[5], shellWarm, 0.92, shellStroke, 0.16);
      applyPaint(entity.secondary[0], mood.sparkColor, 0.96, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[1], mood.sparkColor, 0.96, mood.sparkEdgeColor, 0.22);
      applyPaint(entity.secondary[2], highlightColor, 0.92, shellStroke, 0.08);
      applyPaint(entity.secondary[3], highlightColor, 0.76, shellStroke, 0.04);
      return;
    }

    this.paintShapes(entity.primary, mood.sparkColor, 0.98, mood.sparkEdgeColor, 0.3);
    this.paintShapes(entity.secondary, highlightColor, 0.96, mood.sparkEdgeColor, 0.1);
  }

  private paintHazard(entity: RunnerEntity, mood: MoodSnapshot, time: number) {
    const sway = Math.sin(time * 0.0032 + entity.worldX * 0.01) * 0.035;
    const inactiveAlpha = entity.inactive ? 0.52 : 1;
    const applyPaint = (
      shape: PaintableShape | undefined,
      fillColor: number,
      fillAlpha: number,
      strokeColor: number,
      strokeAlpha: number,
      strokeWidth = 2
    ) => {
      shape
        ?.setAlpha(inactiveAlpha)
        .setFillStyle(fillColor, fillAlpha)
        .setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    };

    entity.container.setRotation(sway);

    if (entity.variant === 'sludge') {
      entity.container.setScale(1 + Math.abs(sway) * 0.7, 1 - Math.abs(sway) * 0.08);
      applyPaint(entity.primary[0], 0x0d1116, 0.4, 0x06080b, 0.2, 1);
      applyPaint(entity.primary[1], 0x252d35, 0.98, 0x0b1015, 0.64, 3);
      applyPaint(entity.primary[2], 0x3a4149, 0.98, 0x121920, 0.62, 3);
      applyPaint(entity.primary[3], 0x495058, 0.98, 0x151c22, 0.62, 3);
      applyPaint(entity.primary[4], 0x31383f, 0.98, 0x11171d, 0.62, 3);
      applyPaint(entity.primary[5], 0x59626a, 0.98, 0x1c242b, 0.52, 2);
      applyPaint(entity.secondary[0], 0xaebf73, 0.68, 0x30411d, 0.28, 2);
      applyPaint(entity.secondary[1], 0xc7dfa2, 0.72, 0x344a20, 0.3, 2);
      applyPaint(entity.secondary[2], 0xf4f8da, 0.74, 0x5c6749, 0.14, 1);
      applyPaint(entity.secondary[3], 0xd7ddd6, 0.38, 0x5b635c, 0.12, 1);
      return;
    }

    if (entity.variant === 'warden') {
      entity.container.setScale(1 + Math.abs(sway) * 0.16, 1);
      applyPaint(entity.primary[0], 0x090a0d, 0.4, 0x040507, 0.2, 1);
      applyPaint(entity.primary[1], 0x33242c, 0.98, 0x110d12, 0.62, 3);
      applyPaint(entity.primary[2], 0x3a2930, 0.98, 0x140d12, 0.62, 3);
      applyPaint(entity.primary[3], 0x231d25, 0.98, 0x0d0a0f, 0.64, 3);
      applyPaint(entity.primary[4], 0x3d2b31, 0.98, 0x140e12, 0.62, 3);
      applyPaint(entity.primary[5], 0x18151b, 0.98, 0x0a090d, 0.5, 2);
      applyPaint(entity.primary[6], 0x1b1820, 0.98, 0x08070a, 0.54, 2);
      applyPaint(entity.secondary[0], 0xff8478, 0.9, 0x6d201b, 0.24, 2);
      applyPaint(entity.secondary[1], 0xc7c1c8, 0.68, 0x524d53, 0.12, 1);
      applyPaint(entity.secondary[2], 0xd6d0d8, 0.68, 0x524d53, 0.12, 1);
      applyPaint(entity.secondary[3], 0xe8ded2, 0.42, 0x64594e, 0.1, 1);
      return;
    }

    entity.container.setScale(1 + Math.abs(sway) * 0.28, 1 - Math.abs(sway) * 0.04);
    applyPaint(entity.primary[0], 0x080a0d, 0.4, 0x040507, 0.2, 1);
    applyPaint(entity.primary[1], 0x23303a, 0.98, 0x10161b, 0.62, 3);
    applyPaint(entity.primary[2], 0x31404a, 0.98, 0x131a20, 0.62, 3);
    applyPaint(entity.primary[3], 0x171f25, 0.98, 0x0a0d10, 0.62, 3);
    applyPaint(entity.primary[4], 0x1a232b, 0.98, 0x0b0f13, 0.46, 2);
    applyPaint(entity.primary[5], 0x1a232b, 0.98, 0x0b0f13, 0.46, 2);
    applyPaint(entity.primary[6], 0x43515d, 0.98, 0x182028, 0.44, 2);
    applyPaint(entity.secondary[0], 0xa1b0b4, 0.78, 0x536066, 0.12, 1);
    applyPaint(entity.secondary[1], 0xff8478, 0.92, 0x70221e, 0.24, 2);
    applyPaint(entity.secondary[2], 0xd6d4ce, 0.72, 0x655f57, 0.12, 1);
    applyPaint(entity.secondary[3], 0xf0e7d8, 0.7, 0x655f57, 0.1, 1);
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
