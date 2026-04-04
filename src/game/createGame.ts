import Phaser from 'phaser';

import { createGameConfig } from '@/game/config/gameConfig';

let gameInstance: Phaser.Game | null = null;

export const createGame = (parent = 'game-root') => {
  if (gameInstance) {
    return gameInstance;
  }

  gameInstance = new Phaser.Game(createGameConfig(parent));
  return gameInstance;
};
