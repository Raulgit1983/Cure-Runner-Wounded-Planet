import Phaser from 'phaser';

import { importWithRecovery } from '@/app/importWithRecovery';
import sharkTextureUrl from '@/assets/creatures/shark-friend.webp';
import heroTextureUrl from '@/assets/hero/hero-main.webp';
import { heroProfile } from '@/game/content/heroProfile';

const loadJourneyScene = () => import('@/game/scenes/JourneyScene');

export class BootScene extends Phaser.Scene {
  private loadingTrack?: Phaser.GameObjects.Graphics;
  private loadingBar?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;

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
    this.load.image('shark-friend', sharkTextureUrl);
  }

  create() {
    this.statusText?.setText('Entrando al Nivel 1...');
    this.hintText?.setText('Busca el primer ingrediente.');
    this.renderProgress(0.82);
    this.time.delayedCall(16, () => {
      void this.startJourney();
    });
  }

  private renderLoadingShell() {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.cameras.main.setBackgroundColor('#10141d');

    this.add
      .ellipse(centerX, centerY - 54, 116, 86, 0xa3f0c8, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add.ellipse(centerX, centerY - 54, 44, 44, 0xdcebdd, 0.92);
    this.add.ellipse(centerX, centerY - 54, 12, 12, 0x8fe4b4, 0.96);

    const brace = this.add.graphics();
    brace.lineStyle(3, 0x819c90, 0.5);
    brace.strokeCircle(centerX, centerY - 54, 30);
    brace.lineBetween(centerX - 22, centerY - 54, centerX + 22, centerY - 54);
    brace.lineBetween(centerX, centerY - 76, centerX, centerY - 32);

    this.statusText = this.add
      .text(centerX, centerY + 24, 'Abriendo la tierra herida...', {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#fff5ea'
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(centerX, centerY + 52, 'Tu planeta se esta rompiendo. Busca la cura.', {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '11px',
        color: '#d5d8df'
      })
      .setOrigin(0.5);

    this.loadingTrack = this.add.graphics();
    this.loadingBar = this.add.graphics();
  }

  private renderProgress(progress: number) {
    const width = this.scale.width;
    const centerX = width * 0.5;
    const y = this.scale.height * 0.5 + 86;
    const barWidth = 150;
    const clamped = Phaser.Math.Clamp(progress, 0, 1);

    this.loadingTrack?.clear();
    this.loadingTrack?.fillStyle(0xffffff, 0.08);
    this.loadingTrack?.fillRoundedRect(centerX - barWidth * 0.5, y, barWidth, 8, 999);

    this.loadingBar?.clear();
    this.loadingBar?.fillStyle(0xe6ff81, 0.92);
    this.loadingBar?.fillRoundedRect(centerX - barWidth * 0.5, y, barWidth * clamped, 8, 999);
  }

  private async startJourney() {
    try {
      const { JourneyScene } = await importWithRecovery(loadJourneyScene);

      this.renderProgress(1);
      this.scene.add('journey', JourneyScene, false);
      this.scene.start('journey');
    } catch {
      this.statusText?.setText('Toca para recargar');
      this.hintText?.setText('La ruta cambio tras una actualizacion. Toca para volver.');
      this.renderProgress(0.18);
      this.input.once('pointerdown', () => {
        window.location.reload();
      });
    }
  }
}
