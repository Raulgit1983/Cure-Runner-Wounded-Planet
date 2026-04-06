import Phaser from 'phaser';

import { importWithRecovery } from '@/app/importWithRecovery';
import sharkTextureUrl from '@/assets/creatures/tiburoncin-ok.png';
import heroFinishAwakenedTextureUrl from '@/assets/hero/hero-finish-awakened.webp';
import heroHitStaggerTextureUrl from '@/assets/hero/hero-hit-stagger.webp';
import heroJumpFallTextureUrl from '@/assets/hero/hero-jump-fall.webp';
import heroJumpRiseTextureUrl from '@/assets/hero/hero-jump-rise.webp';
import heroTextureUrl from '@/assets/hero/hero-main.webp';
import { journeyStages, type JourneyStageKey } from '@/game/content/journeyStages';
import { heroProfile } from '@/game/content/heroProfile';

const loadJourneyScene = () => import('@/game/scenes/JourneyScene');
const loadLevelEntryScene = () => import('@/game/scenes/LevelEntryScene');
const INITIAL_STAGE_KEY: JourneyStageKey = 'wounded-planet';

export class BootScene extends Phaser.Scene {
  private loadingTrack?: Phaser.GameObjects.Graphics;
  private loadingBar?: Phaser.GameObjects.Graphics;
  private loadingEyebrow?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private loadingDots: Phaser.GameObjects.Ellipse[] = [];

  constructor() {
    super('boot');
  }

  preload() {
    this.renderLoadingShell();
    this.renderProgress(0.08);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.renderProgress(0.08 + value * 0.66);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.renderProgress(0.76);
    });

    this.load.image(heroProfile.textureKey, heroTextureUrl);
    this.load.image('hero-hit-stagger', heroHitStaggerTextureUrl);
    this.load.image('hero-jump-rise', heroJumpRiseTextureUrl);
    this.load.image('hero-jump-fall', heroJumpFallTextureUrl);
    this.load.image('hero-finish-awakened', heroFinishAwakenedTextureUrl);
    this.load.image('shark-friend', sharkTextureUrl);

    const initialEntry = journeyStages[INITIAL_STAGE_KEY].entry;
    this.load.image(initialEntry.art.textureKey, initialEntry.art.imageUrl);
  }

  create() {
    const entry = journeyStages[INITIAL_STAGE_KEY].entry;

    this.loadingEyebrow?.setText(entry.loading.eyebrow);
    this.statusText?.setText(entry.loading.title);
    this.hintText?.setText(entry.loading.copy);
    this.renderProgress(0.84);
    this.time.delayedCall(180, () => {
      void this.startJourney();
    });
  }

  private renderLoadingShell() {
    const entry = journeyStages[INITIAL_STAGE_KEY].entry;
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.cameras.main.setBackgroundColor('#0b1017');

    this.add
      .ellipse(centerX, centerY - 54, 116, 86, entry.primaryColor, 0.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add.ellipse(centerX, centerY - 54, 44, 44, 0xdcebdd, 0.88);
    this.add.ellipse(centerX, centerY - 54, 12, 12, entry.accentColor, 0.96);

    const brace = this.add.graphics();
    brace.lineStyle(3, entry.primaryColor, 0.42);
    brace.strokeCircle(centerX, centerY - 54, 30);
    brace.lineBetween(centerX - 22, centerY - 54, centerX + 22, centerY - 54);
    brace.lineBetween(centerX, centerY - 76, centerX, centerY - 32);

    this.loadingEyebrow = this.add
      .text(centerX, centerY - 120, entry.loading.eyebrow, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '11px',
        color: '#b9c6cf',
        letterSpacing: 1.6
      })
      .setOrigin(0.5)
      .setAlpha(0.82);

    this.statusText = this.add
      .text(centerX, centerY + 24, entry.loading.title, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '20px',
        color: '#fff5ea'
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(centerX, centerY + 54, entry.loading.copy, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '11px',
        color: '#d5d8df',
        wordWrap: { width: 220, useAdvancedWrap: true },
        align: 'center'
      })
      .setOrigin(0.5);

    this.loadingDots = [-18, 0, 18].map((offsetX, index) =>
      this.add
        .ellipse(centerX + offsetX, centerY + 84, 8, 8, index === 1 ? 0xffffff : entry.accentColor, 0.34)
        .setStrokeStyle(1, entry.primaryColor, 0.18)
    );
    this.tweens.add({
      targets: this.loadingDots,
      alpha: { from: 0.28, to: 1 },
      scaleX: { from: 0.84, to: 1.1 },
      scaleY: { from: 0.84, to: 1.1 },
      duration: 620,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      stagger: 120
    });

    this.loadingTrack = this.add.graphics();
    this.loadingBar = this.add.graphics();
  }

  private renderProgress(progress: number) {
    const entry = journeyStages[INITIAL_STAGE_KEY].entry;
    const width = this.scale.width;
    const centerX = width * 0.5;
    const y = this.scale.height * 0.5 + 104;
    const barWidth = 164;
    const clamped = Phaser.Math.Clamp(progress, 0, 1);

    this.loadingTrack?.clear();
    this.loadingTrack?.fillStyle(0xffffff, 0.1);
    this.loadingTrack?.fillRoundedRect(centerX - barWidth * 0.5, y, barWidth, 10, 999);

    this.loadingBar?.clear();
    this.loadingBar?.fillStyle(entry.accentColor, 0.94);
    this.loadingBar?.fillRoundedRect(centerX - barWidth * 0.5, y, barWidth * clamped, 10, 999);
  }

  private async startJourney() {
    try {
      const { JourneyScene } = await importWithRecovery(loadJourneyScene);
      let LevelEntryScene:
        | (typeof import('@/game/scenes/LevelEntryScene'))['LevelEntryScene']
        | null = null;

      try {
        ({ LevelEntryScene } = await importWithRecovery(loadLevelEntryScene));
      } catch {
        LevelEntryScene = null;
      }

      this.renderProgress(1);
      this.scene.add('journey', JourneyScene, false);

      if (LevelEntryScene) {
        this.scene.add('level-entry', LevelEntryScene, false);
      }

      this.time.delayedCall(160, () => {
        this.scene.start(LevelEntryScene ? 'level-entry' : 'journey', { stage: INITIAL_STAGE_KEY });
      });
    } catch {
      this.statusText?.setText('No se abrió.');
      this.hintText?.setText('Toca para recargar.');
      this.renderProgress(0.18);
      this.input.once('pointerdown', () => {
        window.location.reload();
      });
    }
  }
}
