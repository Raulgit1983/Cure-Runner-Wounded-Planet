import welcomeCoverUrl from '@/assets/cover/portada-del-juego-v01.jpg';

export const globalWelcomeContent = {
  eyebrow: 'Un viaje que escucha',
  title: 'CURE RUNNER',
  subtitle: 'WOUNDED PLANET',
  lead: 'No vienes solo a correr.',
  body: 'Sigues notas, observas cambios y el mundo responde.',
  supportFirstRun: 'Cada capítulo abre otra mirada.',
  supportReturn: 'La ruta sigue abierta.',
  ctaFirstRun: 'Abrir viaje',
  ctaReturn: 'Seguir viaje',
  art: {
    imageUrl: welcomeCoverUrl,
    alt: 'Portada de Cure Runner: Wounded Planet'
  },
  loading: {
    eyebrow: 'Preparando entrada',
    title: 'Ajustando el primer paso...',
    copy: 'La primera ruta ya espera.'
  }
} as const;
