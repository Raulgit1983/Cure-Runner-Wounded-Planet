export const heroProfile = {
  textureKey: 'hero-main',
  renderOrigin: {
    x: 0.5,
    y: 0.58
  },
  mobileScale: {
    minPx: 88,
    preferredPx: 128,
    maxPx: 160
  },
  collision: {
    catchRadiusPx: 48
  },
  silhouetteRules: [
    'Round pink body remains the main read.',
    'Single large green eye and X eye must stay visible together.',
    'Black horns with green interior must clear the background edge.',
    'Tiny limbs remain secondary accents, not anatomy anchors.'
  ],
  emotionStateNotes: [
    'Sadness starts with slower bob, heavier tilt, and softer aura.',
    'Awakening shows through posture lift, quicker response, and warmer surrounding light.',
    'Identity never changes through recolor or redesign.'
  ]
} as const;
