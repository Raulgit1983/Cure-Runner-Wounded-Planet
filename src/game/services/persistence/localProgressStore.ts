import type { PersistentProgress, SessionSnapshot } from '@/game/state/sessionState';

const STORAGE_KEY = 'mateo.spark-journey.progress.v1';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const localProgressStore = {
  load(): Partial<PersistentProgress> {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Partial<PersistentProgress>;

      return {
        awakeningLevel: clamp01(parsed.awakeningLevel ?? 0),
        collectedSparks: Math.max(0, Math.floor(parsed.collectedSparks ?? 0))
      };
    } catch {
      return {};
    }
  },

  save(snapshot: Pick<SessionSnapshot, 'awakeningLevel' | 'collectedSparks'>) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        awakeningLevel: clamp01(snapshot.awakeningLevel),
        collectedSparks: Math.max(0, Math.floor(snapshot.collectedSparks))
      })
    );
  }
};
