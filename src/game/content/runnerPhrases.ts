export type CollectibleVariant = 'note' | 'brush' | 'spark';
export type HazardVariant = 'sludge' | 'warden' | 'hound';
export type PhraseFamily = 'onboarding' | 'tension' | 'recovery';
export type RunnerPhraseId =
  | 'onboarding_arc'
  | 'tension_drill'
  | 'recovery_breath'
  | 'recovery_lift';

export interface CollectiblePhraseItem {
  kind: 'collectible';
  variant: CollectibleVariant;
  x: number;
  y: number;
}

export interface HazardPhraseItem {
  kind: 'hazard';
  variant: HazardVariant;
  x: number;
  y: number;
}

export type RunnerPhraseItem = CollectiblePhraseItem | HazardPhraseItem;

export interface RunnerPhrase {
  id: RunnerPhraseId;
  label: string;
  family: PhraseFamily;
  spacingAfter: number;
  items: RunnerPhraseItem[];
}

export const runnerPhrases: Record<RunnerPhraseId, RunnerPhrase> = {
  onboarding_arc: {
    id: 'onboarding_arc',
    label: 'Onboarding Arc',
    family: 'onboarding',
    spacingAfter: 412,
    items: [
      { kind: 'collectible', variant: 'spark', x: 98, y: 52 },
      { kind: 'collectible', variant: 'note', x: 158, y: 98 },
      { kind: 'hazard', variant: 'sludge', x: 224, y: 18 },
      { kind: 'collectible', variant: 'brush', x: 290, y: 106 }
    ]
  },
  tension_drill: {
    id: 'tension_drill',
    label: 'Tension Drill',
    family: 'tension',
    spacingAfter: 492,
    items: [
      { kind: 'hazard', variant: 'warden', x: 154, y: 24 },
      { kind: 'collectible', variant: 'note', x: 214, y: 128 },
      { kind: 'hazard', variant: 'hound', x: 366, y: 16 },
      { kind: 'collectible', variant: 'spark', x: 438, y: 104 }
    ]
  },
  recovery_breath: {
    id: 'recovery_breath',
    label: 'Recovery Breath',
    family: 'recovery',
    spacingAfter: 362,
    items: [
      { kind: 'collectible', variant: 'spark', x: 84, y: 60 },
      { kind: 'collectible', variant: 'note', x: 154, y: 88 },
      { kind: 'collectible', variant: 'brush', x: 230, y: 70 }
    ]
  },
  recovery_lift: {
    id: 'recovery_lift',
    label: 'Recovery Lift',
    family: 'recovery',
    spacingAfter: 388,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 52 },
      { kind: 'collectible', variant: 'note', x: 162, y: 86 },
      { kind: 'collectible', variant: 'brush', x: 246, y: 116 }
    ]
  }
};

export const runnerPhraseRotation: RunnerPhraseId[] = ['onboarding_arc', 'tension_drill'];
