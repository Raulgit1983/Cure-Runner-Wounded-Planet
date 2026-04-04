import type { PersistentProgress } from '@/game/state/sessionState';

export interface CloudProgressGateway {
  pull(): Promise<PersistentProgress | null>;
  push(progress: PersistentProgress): Promise<void>;
}

export const firebaseProgressGateway: CloudProgressGateway = {
  async pull() {
    return null;
  },

  async push(_progress) {
    return;
  }
};
