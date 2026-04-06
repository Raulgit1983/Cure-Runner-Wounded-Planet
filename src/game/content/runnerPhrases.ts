export type CollectibleVariant = 'note' | 'brush' | 'spark';
export type HazardVariant = 'sludge' | 'warden' | 'hound' | 'shard' | 'mirror' | 'crown';
export type PhraseFamily = 'onboarding' | 'tension' | 'recovery';
export type RunnerPhraseId = string;

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

export type RunnerPhraseMap = Record<string, RunnerPhrase>;

export const runnerPhrases: RunnerPhraseMap = {
  onboarding_intro: {
    id: 'onboarding_intro',
    label: 'Onboarding Intro',
    family: 'onboarding',
    spacingAfter: 352,
    items: [
      { kind: 'collectible', variant: 'spark', x: 92, y: 44 },
      { kind: 'collectible', variant: 'note', x: 156, y: 74 },
      { kind: 'collectible', variant: 'brush', x: 228, y: 54 },
      { kind: 'collectible', variant: 'spark', x: 292, y: 82 },
      { kind: 'collectible', variant: 'note', x: 352, y: 60 }
    ]
  },
  onboarding_jump: {
    id: 'onboarding_jump',
    label: 'Onboarding Jump',
    family: 'onboarding',
    spacingAfter: 424,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 48 },
      { kind: 'collectible', variant: 'note', x: 142, y: 70 },
      { kind: 'hazard', variant: 'sludge', x: 194, y: 18 },
      { kind: 'collectible', variant: 'note', x: 258, y: 90 },
      { kind: 'collectible', variant: 'brush', x: 314, y: 122 },
      { kind: 'collectible', variant: 'spark', x: 366, y: 146 },
      { kind: 'collectible', variant: 'note', x: 422, y: 92 }
    ]
  },
  onboarding_notes: {
    id: 'onboarding_notes',
    label: 'Onboarding Notes',
    family: 'onboarding',
    spacingAfter: 468,
    items: [
      { kind: 'collectible', variant: 'spark', x: 84, y: 54 },
      { kind: 'collectible', variant: 'note', x: 138, y: 82 },
      { kind: 'collectible', variant: 'brush', x: 192, y: 112 },
      { kind: 'collectible', variant: 'spark', x: 246, y: 136 },
      { kind: 'collectible', variant: 'note', x: 302, y: 118 },
      { kind: 'collectible', variant: 'brush', x: 356, y: 146 },
      { kind: 'collectible', variant: 'spark', x: 410, y: 104 },
      { kind: 'collectible', variant: 'note', x: 462, y: 72 }
    ]
  },
  onboarding_double: {
    id: 'onboarding_double',
    label: 'Onboarding Double',
    family: 'onboarding',
    spacingAfter: 492,
    items: [
      { kind: 'collectible', variant: 'note', x: 92, y: 74 },
      { kind: 'hazard', variant: 'hound', x: 170, y: 16 },
      { kind: 'collectible', variant: 'spark', x: 236, y: 112 },
      { kind: 'collectible', variant: 'brush', x: 292, y: 150 },
      { kind: 'collectible', variant: 'note', x: 346, y: 186 },
      { kind: 'collectible', variant: 'spark', x: 404, y: 152 },
      { kind: 'collectible', variant: 'note', x: 460, y: 102 }
    ]
  },
  onboarding_reserve: {
    id: 'onboarding_reserve',
    label: 'Onboarding Reserve',
    family: 'onboarding',
    spacingAfter: 556,
    items: [
      { kind: 'collectible', variant: 'spark', x: 82, y: 56 },
      { kind: 'collectible', variant: 'note', x: 134, y: 82 },
      { kind: 'collectible', variant: 'brush', x: 186, y: 110 },
      { kind: 'collectible', variant: 'spark', x: 238, y: 138 },
      { kind: 'collectible', variant: 'note', x: 290, y: 164 },
      { kind: 'collectible', variant: 'brush', x: 342, y: 142 },
      { kind: 'collectible', variant: 'note', x: 394, y: 118 },
      { kind: 'collectible', variant: 'spark', x: 446, y: 150 },
      { kind: 'collectible', variant: 'brush', x: 500, y: 122 },
      { kind: 'collectible', variant: 'note', x: 548, y: 92 }
    ]
  },
  onboarding_shark: {
    id: 'onboarding_shark',
    label: 'Onboarding Shark',
    family: 'onboarding',
    spacingAfter: 584,
    items: [
      { kind: 'collectible', variant: 'note', x: 98, y: 82 },
      { kind: 'collectible', variant: 'spark', x: 152, y: 116 },
      { kind: 'collectible', variant: 'brush', x: 208, y: 148 },
      { kind: 'collectible', variant: 'note', x: 266, y: 182 },
      { kind: 'collectible', variant: 'spark', x: 326, y: 156 },
      { kind: 'collectible', variant: 'brush', x: 386, y: 126 },
      { kind: 'collectible', variant: 'note', x: 446, y: 96 }
    ]
  },
  onboarding_arc: {
    id: 'onboarding_arc',
    label: 'Onboarding Arc',
    family: 'onboarding',
    spacingAfter: 484,
    items: [
      { kind: 'collectible', variant: 'spark', x: 98, y: 52 },
      { kind: 'collectible', variant: 'note', x: 158, y: 98 },
      { kind: 'hazard', variant: 'sludge', x: 224, y: 18 },
      { kind: 'collectible', variant: 'brush', x: 290, y: 106 },
      { kind: 'collectible', variant: 'spark', x: 350, y: 138 },
      { kind: 'collectible', variant: 'note', x: 414, y: 92 }
    ]
  },
  tension_step: {
    id: 'tension_step',
    label: 'Tension Step',
    family: 'tension',
    spacingAfter: 548,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 56 },
      { kind: 'hazard', variant: 'sludge', x: 136, y: 18 },
      { kind: 'collectible', variant: 'note', x: 206, y: 80 },
      { kind: 'hazard', variant: 'hound', x: 274, y: 136 },
      { kind: 'collectible', variant: 'spark', x: 310, y: 96 },
      { kind: 'collectible', variant: 'brush', x: 338, y: 114 },
      { kind: 'hazard', variant: 'hound', x: 408, y: 16 },
      { kind: 'collectible', variant: 'note', x: 448, y: 132 },
      { kind: 'collectible', variant: 'spark', x: 506, y: 90 }
    ]
  },
  tension_arch: {
    id: 'tension_arch',
    label: 'Tension Arch',
    family: 'tension',
    spacingAfter: 572,
    items: [
      { kind: 'collectible', variant: 'spark', x: 86, y: 54 },
      { kind: 'hazard', variant: 'sludge', x: 132, y: 18 },
      { kind: 'collectible', variant: 'note', x: 198, y: 76 },
      { kind: 'collectible', variant: 'brush', x: 226, y: 112 },
      { kind: 'hazard', variant: 'warden', x: 258, y: 150 },
      { kind: 'collectible', variant: 'brush', x: 318, y: 114 },
      { kind: 'collectible', variant: 'note', x: 352, y: 152 },
      { kind: 'hazard', variant: 'hound', x: 384, y: 184 },
      { kind: 'collectible', variant: 'spark', x: 442, y: 122 },
      { kind: 'collectible', variant: 'note', x: 502, y: 88 }
    ]
  },
  tension_weave: {
    id: 'tension_weave',
    label: 'Tension Weave',
    family: 'tension',
    spacingAfter: 588,
    items: [
      { kind: 'collectible', variant: 'note', x: 98, y: 72 },
      { kind: 'collectible', variant: 'spark', x: 142, y: 104 },
      { kind: 'hazard', variant: 'warden', x: 168, y: 144 },
      { kind: 'collectible', variant: 'spark', x: 236, y: 134 },
      { kind: 'collectible', variant: 'brush', x: 278, y: 90 },
      { kind: 'hazard', variant: 'sludge', x: 314, y: 18 },
      { kind: 'collectible', variant: 'brush', x: 380, y: 112 },
      { kind: 'hazard', variant: 'hound', x: 442, y: 170 },
      { kind: 'collectible', variant: 'note', x: 500, y: 86 },
      { kind: 'collectible', variant: 'spark', x: 548, y: 124 }
    ]
  },
  tension_ceiling: {
    id: 'tension_ceiling',
    label: 'Tension Ceiling',
    family: 'tension',
    spacingAfter: 604,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 58 },
      { kind: 'hazard', variant: 'hound', x: 132, y: 154 },
      { kind: 'collectible', variant: 'note', x: 188, y: 74 },
      { kind: 'hazard', variant: 'sludge', x: 252, y: 18 },
      { kind: 'collectible', variant: 'brush', x: 314, y: 112 },
      { kind: 'collectible', variant: 'spark', x: 350, y: 148 },
      { kind: 'hazard', variant: 'warden', x: 388, y: 182 },
      { kind: 'collectible', variant: 'spark', x: 450, y: 126 },
      { kind: 'collectible', variant: 'note', x: 514, y: 92 },
      { kind: 'collectible', variant: 'brush', x: 566, y: 128 }
    ]
  },
  tension_drill: {
    id: 'tension_drill',
    label: 'Tension Drill',
    family: 'tension',
    spacingAfter: 596,
    items: [
      { kind: 'collectible', variant: 'spark', x: 96, y: 76 },
      { kind: 'hazard', variant: 'warden', x: 154, y: 24 },
      { kind: 'collectible', variant: 'note', x: 214, y: 128 },
      { kind: 'hazard', variant: 'hound', x: 292, y: 148 },
      { kind: 'collectible', variant: 'brush', x: 356, y: 164 },
      { kind: 'collectible', variant: 'spark', x: 392, y: 126 },
      { kind: 'hazard', variant: 'sludge', x: 434, y: 18 },
      { kind: 'collectible', variant: 'note', x: 504, y: 104 },
      { kind: 'collectible', variant: 'brush', x: 556, y: 78 }
    ]
  },
  tension_ladder: {
    id: 'tension_ladder',
    label: 'Tension Ladder',
    family: 'tension',
    spacingAfter: 620,
    items: [
      { kind: 'hazard', variant: 'hound', x: 134, y: 16 },
      { kind: 'collectible', variant: 'spark', x: 170, y: 60 },
      { kind: 'collectible', variant: 'note', x: 202, y: 86 },
      { kind: 'collectible', variant: 'brush', x: 262, y: 126 },
      { kind: 'hazard', variant: 'warden', x: 324, y: 162 },
      { kind: 'collectible', variant: 'spark', x: 382, y: 174 },
      { kind: 'hazard', variant: 'sludge', x: 446, y: 18 },
      { kind: 'collectible', variant: 'note', x: 510, y: 118 },
      { kind: 'collectible', variant: 'brush', x: 566, y: 86 }
    ]
  },
  tension_triplet: {
    id: 'tension_triplet',
    label: 'Tension Triplet',
    family: 'tension',
    spacingAfter: 632,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 60 },
      { kind: 'hazard', variant: 'hound', x: 126, y: 16 },
      { kind: 'collectible', variant: 'note', x: 192, y: 94 },
      { kind: 'hazard', variant: 'warden', x: 262, y: 152 },
      { kind: 'collectible', variant: 'brush', x: 324, y: 132 },
      { kind: 'hazard', variant: 'sludge', x: 394, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 458, y: 156 },
      { kind: 'hazard', variant: 'hound', x: 526, y: 176 },
      { kind: 'collectible', variant: 'note', x: 582, y: 106 },
      { kind: 'collectible', variant: 'brush', x: 626, y: 78 }
    ]
  },
  recovery_breath: {
    id: 'recovery_breath',
    label: 'Recovery Breath',
    family: 'recovery',
    spacingAfter: 432,
    items: [
      { kind: 'collectible', variant: 'spark', x: 84, y: 60 },
      { kind: 'collectible', variant: 'note', x: 154, y: 88 },
      { kind: 'collectible', variant: 'brush', x: 230, y: 70 },
      { kind: 'collectible', variant: 'spark', x: 304, y: 104 },
      { kind: 'collectible', variant: 'note', x: 372, y: 128 },
      { kind: 'collectible', variant: 'spark', x: 432, y: 86 }
    ]
  },
  recovery_lift: {
    id: 'recovery_lift',
    label: 'Recovery Lift',
    family: 'recovery',
    spacingAfter: 452,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 52 },
      { kind: 'collectible', variant: 'note', x: 162, y: 86 },
      { kind: 'collectible', variant: 'brush', x: 246, y: 116 },
      { kind: 'collectible', variant: 'note', x: 322, y: 138 },
      { kind: 'collectible', variant: 'spark', x: 388, y: 118 },
      { kind: 'collectible', variant: 'brush', x: 448, y: 84 }
    ]
  }
};

export const runnerPhraseRotation: RunnerPhraseId[] = [
  'onboarding_arc',
  'tension_step',
  'tension_arch',
  'tension_weave',
  'tension_ceiling',
  'tension_drill',
  'tension_ladder',
  'tension_triplet'
];
