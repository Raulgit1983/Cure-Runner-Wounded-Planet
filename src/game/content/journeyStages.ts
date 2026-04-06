import moonlightMountainFinalUrl from '@/assets/entry/moonlight-mountain-ok.jpg';
import planetHomeCutoutUrl from '@/assets/planet/planet-home-cutout.webp';
import { runnerConfig } from '@/game/content/runnerConfig';
import {
  runnerPhrases,
  runnerPhraseRotation,
  type RunnerPhrase,
  type RunnerPhraseId,
  type RunnerPhraseMap
} from '@/game/content/runnerPhrases';

export type JourneyStageKey = 'wounded-planet' | 'moonlight-mountain';
export type JourneyBackdropKind = 'wounded-planet' | 'moonlight-mountain';

export interface JourneyLevelProfile {
  endDistance: number;
  surfaceStartDistance: number;
  finishRevealDistance: number;
  finishSlowdownDistance: number;
  exitCoastDistance: number;
}

export interface JourneyRunnerContent {
  phrases: RunnerPhraseMap;
  initialPhraseId: RunnerPhraseId;
  onboardingSequence: RunnerPhraseId[];
  rotation: RunnerPhraseId[];
  recoverySequence: RunnerPhraseId[];
  level: JourneyLevelProfile;
}

export interface JourneyEntryScreen {
  eyebrow: string;
  title: string;
  framing: string;
  detail: string;
  cta: string;
  primaryColor: number;
  accentColor: number;
  art: {
    textureKey: string;
    imageUrl: string;
    maxWidth: number;
    maxHeight: number;
    y: number;
    rotation?: number;
  };
  loading: {
    eyebrow: string;
    title: string;
    copy: string;
  };
}

export interface JourneyStageDefinition {
  key: JourneyStageKey;
  label: string;
  backdropKind: JourneyBackdropKind;
  nextStage: JourneyStageKey | null;
  entry: JourneyEntryScreen;
  introGuidance?: string;
  beatGuidance?: string;
  surfaceGuidance?: string;
  runner: JourneyRunnerContent;
}

const moonlightPhrases: RunnerPhraseMap = {
  moonlight_intro: {
    id: 'moonlight_intro',
    label: 'Moonlight Intro',
    family: 'onboarding',
    spacingAfter: 476,
    items: [
      { kind: 'collectible', variant: 'spark', x: 84, y: 58 },
      { kind: 'collectible', variant: 'note', x: 146, y: 92 },
      { kind: 'collectible', variant: 'brush', x: 210, y: 132 },
      { kind: 'hazard', variant: 'shard', x: 248, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 304, y: 116 },
      { kind: 'collectible', variant: 'note', x: 366, y: 152 },
      { kind: 'collectible', variant: 'brush', x: 428, y: 110 }
    ]
  },
  moonlight_gate: {
    id: 'moonlight_gate',
    label: 'Moonlight Gate',
    family: 'onboarding',
    spacingAfter: 528,
    items: [
      { kind: 'collectible', variant: 'note', x: 96, y: 86 },
      { kind: 'hazard', variant: 'shard', x: 164, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 222, y: 126 },
      { kind: 'hazard', variant: 'mirror', x: 268, y: 132 },
      { kind: 'collectible', variant: 'brush', x: 320, y: 170 },
      { kind: 'collectible', variant: 'note', x: 378, y: 136 },
      { kind: 'collectible', variant: 'spark', x: 438, y: 94 }
    ]
  },
  moonlight_reflect: {
    id: 'moonlight_reflect',
    label: 'Moonlight Reflect',
    family: 'onboarding',
    spacingAfter: 552,
    items: [
      { kind: 'collectible', variant: 'spark', x: 86, y: 58 },
      { kind: 'collectible', variant: 'note', x: 142, y: 98 },
      { kind: 'hazard', variant: 'mirror', x: 202, y: 124 },
      { kind: 'collectible', variant: 'brush', x: 248, y: 160 },
      { kind: 'collectible', variant: 'note', x: 306, y: 190 },
      { kind: 'hazard', variant: 'crown', x: 372, y: 196 },
      { kind: 'collectible', variant: 'spark', x: 428, y: 142 },
      { kind: 'collectible', variant: 'note', x: 486, y: 104 }
    ]
  },
  moonlight_launch: {
    id: 'moonlight_launch',
    label: 'Moonlight Launch',
    family: 'onboarding',
    spacingAfter: 596,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 54 },
      { kind: 'hazard', variant: 'shard', x: 136, y: 18 },
      { kind: 'collectible', variant: 'note', x: 204, y: 84 },
      { kind: 'collectible', variant: 'brush', x: 248, y: 128 },
      { kind: 'hazard', variant: 'mirror', x: 278, y: 146 },
      { kind: 'platform', variant: 'ledge', x: 382, y: 190, width: 188 },
      { kind: 'collectible', variant: 'spark', x: 334, y: 182 },
      { kind: 'collectible', variant: 'note', x: 386, y: 214 },
      { kind: 'collectible', variant: 'brush', x: 436, y: 196 },
      { kind: 'hazard', variant: 'crown', x: 526, y: 204 },
      { kind: 'collectible', variant: 'note', x: 566, y: 146 }
    ]
  },
  moonlight_shard_step: {
    id: 'moonlight_shard_step',
    label: 'Moonlight Shard Step',
    family: 'tension',
    spacingAfter: 588,
    items: [
      { kind: 'collectible', variant: 'spark', x: 82, y: 58 },
      { kind: 'hazard', variant: 'shard', x: 134, y: 18 },
      { kind: 'collectible', variant: 'note', x: 202, y: 86 },
      { kind: 'hazard', variant: 'shard', x: 270, y: 18 },
      { kind: 'collectible', variant: 'brush', x: 334, y: 124 },
      { kind: 'hazard', variant: 'mirror', x: 390, y: 154 },
      { kind: 'collectible', variant: 'note', x: 446, y: 112 },
      { kind: 'collectible', variant: 'spark', x: 504, y: 74 }
    ]
  },
  moonlight_mirror_arc: {
    id: 'moonlight_mirror_arc',
    label: 'Moonlight Mirror Arc',
    family: 'tension',
    spacingAfter: 604,
    items: [
      { kind: 'collectible', variant: 'note', x: 92, y: 82 },
      { kind: 'hazard', variant: 'mirror', x: 150, y: 126 },
      { kind: 'collectible', variant: 'spark', x: 202, y: 152 },
      { kind: 'collectible', variant: 'brush', x: 254, y: 184 },
      { kind: 'hazard', variant: 'crown', x: 316, y: 204 },
      { kind: 'collectible', variant: 'spark', x: 372, y: 164 },
      { kind: 'hazard', variant: 'mirror', x: 428, y: 128 },
      { kind: 'collectible', variant: 'note', x: 490, y: 92 }
    ]
  },
  moonlight_crown_cross: {
    id: 'moonlight_crown_cross',
    label: 'Moonlight Crown Cross',
    family: 'tension',
    spacingAfter: 612,
    items: [
      { kind: 'collectible', variant: 'spark', x: 84, y: 64 },
      { kind: 'hazard', variant: 'crown', x: 138, y: 198 },
      { kind: 'collectible', variant: 'note', x: 190, y: 112 },
      { kind: 'hazard', variant: 'shard', x: 252, y: 18 },
      { kind: 'collectible', variant: 'brush', x: 320, y: 146 },
      { kind: 'hazard', variant: 'mirror', x: 374, y: 170 },
      { kind: 'collectible', variant: 'note', x: 436, y: 126 },
      { kind: 'hazard', variant: 'crown', x: 506, y: 206 },
      { kind: 'collectible', variant: 'spark', x: 556, y: 88 }
    ]
  },
  moonlight_reflect_gate: {
    id: 'moonlight_reflect_gate',
    label: 'Moonlight Reflect Gate',
    family: 'tension',
    spacingAfter: 626,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 60 },
      { kind: 'hazard', variant: 'mirror', x: 154, y: 104 },
      { kind: 'collectible', variant: 'note', x: 210, y: 72 },
      { kind: 'collectible', variant: 'brush', x: 260, y: 122 },
      { kind: 'hazard', variant: 'shard', x: 326, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 384, y: 156 },
      { kind: 'hazard', variant: 'mirror', x: 438, y: 172 },
      { kind: 'collectible', variant: 'note', x: 500, y: 124 },
      { kind: 'collectible', variant: 'brush', x: 558, y: 86 }
    ]
  },
  moonlight_glass_ladder: {
    id: 'moonlight_glass_ladder',
    label: 'Moonlight Glass Ladder',
    family: 'tension',
    spacingAfter: 636,
    items: [
      { kind: 'hazard', variant: 'shard', x: 130, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 166, y: 62 },
      { kind: 'collectible', variant: 'note', x: 208, y: 96 },
      { kind: 'collectible', variant: 'brush', x: 258, y: 136 },
      { kind: 'hazard', variant: 'mirror', x: 268, y: 150 },
      { kind: 'platform', variant: 'ledge', x: 404, y: 190, width: 190 },
      { kind: 'collectible', variant: 'spark', x: 352, y: 178 },
      { kind: 'collectible', variant: 'note', x: 406, y: 214 },
      { kind: 'collectible', variant: 'brush', x: 452, y: 196 },
      { kind: 'collectible', variant: 'note', x: 500, y: 160 },
      { kind: 'hazard', variant: 'crown', x: 548, y: 204 },
      { kind: 'collectible', variant: 'brush', x: 560, y: 118 }
    ]
  },
  moonlight_fork: {
    id: 'moonlight_fork',
    label: 'Moonlight Fork',
    family: 'tension',
    spacingAfter: 644,
    items: [
      { kind: 'collectible', variant: 'note', x: 94, y: 88 },
      { kind: 'hazard', variant: 'shard', x: 152, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 214, y: 124 },
      { kind: 'hazard', variant: 'mirror', x: 264, y: 144 },
      { kind: 'collectible', variant: 'brush', x: 318, y: 100 },
      { kind: 'hazard', variant: 'crown', x: 382, y: 194 },
      { kind: 'collectible', variant: 'spark', x: 436, y: 158 },
      { kind: 'hazard', variant: 'mirror', x: 494, y: 118 },
      { kind: 'collectible', variant: 'note', x: 552, y: 82 }
    ]
  },
  moonlight_crescent: {
    id: 'moonlight_crescent',
    label: 'Moonlight Crescent',
    family: 'tension',
    spacingAfter: 656,
    items: [
      { kind: 'collectible', variant: 'spark', x: 86, y: 60 },
      { kind: 'hazard', variant: 'mirror', x: 148, y: 120 },
      { kind: 'collectible', variant: 'note', x: 202, y: 164 },
      { kind: 'collectible', variant: 'brush', x: 252, y: 194 },
      { kind: 'hazard', variant: 'crown', x: 316, y: 210 },
      { kind: 'collectible', variant: 'note', x: 374, y: 176 },
      { kind: 'hazard', variant: 'shard', x: 438, y: 18 },
      { kind: 'collectible', variant: 'spark', x: 494, y: 132 },
      { kind: 'collectible', variant: 'brush', x: 548, y: 92 }
    ]
  },
  moonlight_recovery_glint: {
    id: 'moonlight_recovery_glint',
    label: 'Moonlight Recovery Glint',
    family: 'recovery',
    spacingAfter: 448,
    items: [
      { kind: 'collectible', variant: 'spark', x: 86, y: 62 },
      { kind: 'collectible', variant: 'note', x: 156, y: 96 },
      { kind: 'collectible', variant: 'brush', x: 230, y: 122 },
      { kind: 'collectible', variant: 'spark', x: 300, y: 146 },
      { kind: 'collectible', variant: 'note', x: 370, y: 126 },
      { kind: 'collectible', variant: 'brush', x: 438, y: 92 }
    ]
  },
  moonlight_recovery_mirror: {
    id: 'moonlight_recovery_mirror',
    label: 'Moonlight Recovery Mirror',
    family: 'recovery',
    spacingAfter: 462,
    items: [
      { kind: 'collectible', variant: 'spark', x: 88, y: 58 },
      { kind: 'collectible', variant: 'note', x: 162, y: 104 },
      { kind: 'collectible', variant: 'brush', x: 236, y: 148 },
      { kind: 'collectible', variant: 'note', x: 312, y: 168 },
      { kind: 'collectible', variant: 'spark', x: 386, y: 132 },
      { kind: 'collectible', variant: 'brush', x: 456, y: 88 }
    ]
  }
};

export const journeyStages: Record<JourneyStageKey, JourneyStageDefinition> = {
  'wounded-planet': {
    key: 'wounded-planet',
    label: 'Wounded Planet',
    backdropKind: 'wounded-planet',
    nextStage: 'moonlight-mountain',
    entry: {
      eyebrow: 'Nivel 1',
      title: 'Wounded Planet',
      framing: 'Entra en el planeta herido.',
      detail: 'Las notas abren camino.',
      cta: 'Entrar',
      primaryColor: 0x90e6b7,
      accentColor: 0xe9ffaf,
      art: {
        textureKey: 'entry-art-wounded-planet',
        imageUrl: planetHomeCutoutUrl,
        maxWidth: 252,
        maxHeight: 276,
        y: 274,
        rotation: -0.05
      },
      loading: {
        eyebrow: 'Wounded Planet',
        title: 'Abriendo el primer mundo...',
        copy: 'El primer mundo ya está listo.'
      }
    },
    surfaceGuidance: 'La luz vuelve poco a poco.',
    runner: {
      phrases: runnerPhrases,
      initialPhraseId: 'onboarding_intro',
      onboardingSequence: [
        'onboarding_jump',
        'onboarding_notes',
        'onboarding_double',
        'onboarding_upper',
        'tension_step',
        'onboarding_reserve',
        'onboarding_shark'
      ],
      rotation: runnerPhraseRotation,
      recoverySequence: ['recovery_breath', 'recovery_lift'],
      level: runnerConfig.level
    }
  },
  'moonlight-mountain': {
    key: 'moonlight-mountain',
    label: 'Moonlight Mountain',
    backdropKind: 'moonlight-mountain',
    nextStage: null,
    entry: {
      eyebrow: 'Nivel 2',
      title: 'Moonlight Mountain',
      framing: 'La montaña devuelve reflejos.',
      detail: 'La ruta cambia con la luz.',
      cta: 'Seguir',
      primaryColor: 0x95c5d8,
      accentColor: 0xcef2ff,
      art: {
        textureKey: 'entry-art-moonlight-mountain',
        imageUrl: moonlightMountainFinalUrl,
        maxWidth: 286,
        maxHeight: 236,
        y: 282
      },
      loading: {
        eyebrow: 'Moonlight Mountain',
        title: 'Preparando la segunda entrada...',
        copy: 'La luz ya marca la ruta.'
      }
    },
    introGuidance: 'Todo refleja aquí.',
    beatGuidance: 'Brillan con cada nota.',
    surfaceGuidance: 'La luna abre camino.',
    runner: {
      phrases: moonlightPhrases,
      initialPhraseId: 'moonlight_intro',
      onboardingSequence: [
        'moonlight_gate',
        'moonlight_reflect',
        'moonlight_launch'
      ],
      rotation: [
        'moonlight_shard_step',
        'moonlight_glass_ladder',
        'moonlight_mirror_arc',
        'moonlight_crown_cross',
        'moonlight_reflect_gate',
        'moonlight_fork',
        'moonlight_crescent'
      ],
      recoverySequence: ['moonlight_recovery_glint', 'moonlight_recovery_mirror'],
      level: {
        endDistance: 10160,
        surfaceStartDistance: 1560,
        finishRevealDistance: 8780,
        finishSlowdownDistance: 300,
        exitCoastDistance: 120
      }
    }
  }
};
