import Phaser from 'phaser';

import { journeyConfig } from '@/game/content/journeyConfig';
import { journeyStages, type JourneyStageKey } from '@/game/content/journeyStages';

/**
 * Per-level entry interstitial.
 * Dark screen with level eyebrow, title, framing line, and a CTA.
 * Provides emotional breathing room between levels.
 */
export class LevelEntryScene extends Phaser.Scene {
  private stageKey: JourneyStageKey = 'wounded-planet';
  private transitioning = false;

  constructor() {
    super('level-entry');
  }

  init(data?: { stage?: JourneyStageKey }) {
    this.stageKey = data?.stage ?? 'wounded-planet';
    this.transitioning = false;
  }

  preload() {
    const stage = journeyStages[this.stageKey] ?? journeyStages['wounded-planet'];
    const entry = stage.entry;
    const artIsReady = this.textures.exists(entry.art.textureKey);

    this.emitUiScreen(artIsReady ? 'chapter' : 'loading');

    if (artIsReady) {
      return;
    }

    const width = journeyConfig.logicalSize.width;
    const height = journeyConfig.logicalSize.height;
    const centerX = width * 0.5;
    const barWidth = 150;
    const barY = height * 0.5 + 76;
    const track = this.add.graphics();
    const fill = this.add.graphics();

    this.cameras.main.setBackgroundColor('#091018');

    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0x071018, 0x071018, 0x121822, 0x151d28, 1, 1, 1, 1);
    backdrop.fillRect(0, 0, width, height);

    this.add
      .ellipse(centerX, height * 0.36, 220, 250, entry.primaryColor, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .ellipse(centerX, height * 0.42, 168, 182, entry.accentColor, 0.05)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add
      .text(centerX, height * 0.5 - 64, entry.loading.eyebrow, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '11px',
        color: '#b8c4cc',
        letterSpacing: 1.6
      })
      .setOrigin(0.5)
      .setAlpha(0.82);

    this.add
      .text(centerX, height * 0.5 - 10, entry.loading.title, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '20px',
        color: '#fff5ea'
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, height * 0.5 + 22, entry.loading.copy, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '11px',
        color: '#d5d8df',
        align: 'center',
        wordWrap: { width: 220, useAdvancedWrap: true }
      })
      .setOrigin(0.5);

    const renderProgress = (progress: number) => {
      const clamped = Phaser.Math.Clamp(progress, 0, 1);

      track.clear();
      track.fillStyle(0xffffff, 0.08);
      track.fillRoundedRect(centerX - barWidth * 0.5, barY, barWidth, 8, 999);

      fill.clear();
      fill.fillStyle(entry.accentColor, 0.94);
      fill.fillRoundedRect(centerX - barWidth * 0.5, barY, barWidth * clamped, 8, 999);
    };

    renderProgress(0.08);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      renderProgress(0.08 + value * 0.84);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      renderProgress(1);
    });

    this.load.image(entry.art.textureKey, entry.art.imageUrl);
  }

  create() {
    const stage = journeyStages[this.stageKey] ?? journeyStages['wounded-planet'];
    const entry = stage.entry;
    const width = journeyConfig.logicalSize.width;
    const height = journeyConfig.logicalSize.height;
    const centerX = width * 0.5;
    const copyCardY = 444;
    const copyCardHeight = 106;
    const ctaY = 572;

    this.emitUiScreen('chapter');
    this.children.removeAll();
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor('#091018');
    this.cameras.main.fadeIn(260, 8, 12, 18);

    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0x071018, 0x071018, 0x121822, 0x151d28, 1, 1, 1, 1);
    backdrop.fillRect(0, 0, width, height);

    this.add
      .ellipse(centerX, height * 0.3, 240, 280, entry.primaryColor, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .ellipse(centerX, height * 0.36, 178, 200, entry.accentColor, 0.05)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .ellipse(centerX, height * 0.78, 290, 86, entry.primaryColor, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);

    const eyebrow = this.add
      .text(centerX, 68, entry.eyebrow, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '11px',
        color: '#b8c4cc',
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0);

    const title = this.add
      .text(centerX, 106, entry.title, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '24px',
        color: '#fff8ef',
        stroke: '#0a0e14',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: 240, useAdvancedWrap: true }
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 3, false, true)
      .setAlpha(0)
      .setScale(0.92);

    const artShadow = this.add
      .ellipse(
        centerX,
        entry.art.y + Math.min(entry.art.maxHeight * 0.42, 132),
        Math.max(132, entry.art.maxWidth * 0.66),
        34,
        0x030507,
        0.34
      )
      .setAlpha(0);

    const artHalo = this.add
      .ellipse(centerX, entry.art.y - 8, entry.art.maxWidth * 0.96, entry.art.maxHeight * 0.82, entry.accentColor, 0.11)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);

    let artImage: Phaser.GameObjects.Image | null = null;

    if (this.textures.exists(entry.art.textureKey)) {
      const textureImage = this.textures.get(entry.art.textureKey).getSourceImage() as {
        width: number;
        height: number;
      };
      const fitScale = Math.min(
        entry.art.maxWidth / textureImage.width,
        entry.art.maxHeight / textureImage.height
      );

      artImage = this.add
        .image(centerX, entry.art.y + 12, entry.art.textureKey)
        .setScale(fitScale)
        .setRotation(entry.art.rotation ?? 0)
        .setAlpha(0);
    }

    const copyCard = this.add.graphics().setAlpha(0);
    copyCard.fillStyle(0x101720, 0.92);
    copyCard.lineStyle(2, entry.accentColor, 0.18);
    copyCard.fillRoundedRect(centerX - 132, copyCardY, 264, copyCardHeight, 24);
    copyCard.strokeRoundedRect(centerX - 132, copyCardY, 264, copyCardHeight, 24);
    copyCard.fillStyle(entry.primaryColor, 0.07);
    copyCard.fillRoundedRect(centerX - 116, copyCardY + 12, 232, 14, 12);

    const framing = this.add
      .text(centerX, copyCardY + 34, entry.framing, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '17px',
        color: '#fff7ed',
        stroke: '#0a0e14',
        strokeThickness: 1,
        align: 'center',
        wordWrap: { width: 210, useAdvancedWrap: true }
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true)
      .setAlpha(0);

    const detail = this.add
      .text(centerX, copyCardY + 70, entry.detail, {
        fontFamily: 'Avenir Next, Trebuchet MS, Verdana, sans-serif',
        fontSize: '12px',
        color: '#d4dde4',
        align: 'center',
        wordWrap: { width: 220, useAdvancedWrap: true }
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0);

    const line = this.add.graphics().setAlpha(0);
    line.lineStyle(2, entry.primaryColor, 0.28);
    line.lineBetween(centerX - 34, 142, centerX + 34, 142);

    const ctaPanel = this.add.graphics();
    const ctaWidth = 118;
    const ctaHeight = 36;
    const ctaX = centerX;

    ctaPanel.fillStyle(0x121a21, 0.94);
    ctaPanel.lineStyle(2, entry.accentColor, 0.24);
    ctaPanel.fillRoundedRect(-ctaWidth * 0.5, -ctaHeight * 0.5, ctaWidth, ctaHeight, 14);
    ctaPanel.strokeRoundedRect(-ctaWidth * 0.5, -ctaHeight * 0.5, ctaWidth, ctaHeight, 14);
    ctaPanel.fillStyle(entry.accentColor, 0.05);
    ctaPanel.fillRoundedRect(-ctaWidth * 0.5 + 8, -ctaHeight * 0.5 + 6, ctaWidth - 16, 8, 10);

    const ctaText = this.add
      .text(0, 0, entry.cta, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '13px',
        color: '#f7f6ec',
        stroke: '#0a1015',
        strokeThickness: 1,
        align: 'center'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setShadow(0, 1, '#04070b', 2, false, true);

    const ctaHit = this.add
      .rectangle(0, 0, ctaWidth + 16, ctaHeight + 12, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    const ctaContainer = this.add
      .container(ctaX, ctaY, [ctaPanel, ctaText, ctaHit])
      .setSize(ctaWidth, ctaHeight)
      .setAlpha(0)
      .setScale(0.94);

    ctaHit.on('pointerover', () => {
      ctaContainer.setScale(1.02);
    });
    ctaHit.on('pointerout', () => {
      ctaContainer.setScale(1);
    });
    ctaHit.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => {
        event.stopPropagation();
        this.startJourney();
      }
    );

    this.tweens.add({
      targets: eyebrow,
      alpha: 0.72,
      duration: 340,
      delay: 120,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: title,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 420,
      delay: 220,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: line,
      alpha: 1,
      duration: 300,
      delay: 320,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: [artShadow, artHalo],
      alpha: 1,
      duration: 420,
      delay: 260,
      ease: 'Quad.easeOut'
    });

    if (artImage) {
      this.tweens.add({
        targets: artImage,
        alpha: 1,
        y: entry.art.y,
        duration: 520,
        delay: 300,
        ease: 'Cubic.easeOut'
      });

      this.tweens.add({
        targets: artImage,
        y: entry.art.y - 6,
        duration: 2400,
        delay: 860,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    this.tweens.add({
      targets: copyCard,
      alpha: 1,
      duration: 280,
      delay: 460,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: framing,
      alpha: 0.96,
      duration: 360,
      delay: 520,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: detail,
      alpha: 0.82,
      duration: 320,
      delay: 580,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: ctaContainer,
      alpha: 0.98,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      delay: 660,
      ease: 'Back.easeOut'
    });
  }

  private startJourney() {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.cameras.main.fadeOut(200, 9, 14, 20);
    this.time.delayedCall(200, () => {
      this.scene.start('journey', { stage: this.stageKey });
    });
  }

  private emitUiScreen(screen: 'loading' | 'chapter') {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('mateo:ui-screen', {
        detail: {
          screen
        }
      })
    );
  }
}
