import '@/styles/global.css';

import { importWithRecovery } from '@/app/importWithRecovery';
import { quickHelpContent } from '@/game/content/helpContent';
import { globalWelcomeContent } from '@/game/content/introFlow';
import { audioCueBus } from '@/game/services/audio/audioCueBus';
import { createReactiveAudioLayer } from '@/game/services/audio/reactiveAudioLayer';
import { localProgressStore } from '@/game/services/persistence/localProgressStore';
import { runTelemetryStore } from '@/game/services/telemetry/runTelemetryStore';
import { sessionState } from '@/game/state/sessionState';
import { createHud } from '@/ui/createHud';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

const savedProgress = localProgressStore.load();
const isFirstRun = !savedProgress.collectedSparks && !savedProgress.awakeningLevel;
const shouldSurfaceWelcomeHelp = true;
const prefersDesktopFullscreenControl =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const canOpenFullscreen =
  typeof document !== 'undefined' &&
  document.fullscreenEnabled &&
  typeof document.documentElement.requestFullscreen === 'function' &&
  prefersDesktopFullscreenControl;
const welcomeSupport = isFirstRun
  ? globalWelcomeContent.supportFirstRun
  : globalWelcomeContent.supportReturn;
const welcomeCta = isFirstRun
  ? globalWelcomeContent.ctaFirstRun
  : globalWelcomeContent.ctaReturn;

app.innerHTML = `
  <div class="app-shell">
    <section class="game-frame" aria-label="Cure Runner: Wounded Planet play area" data-flow-screen="welcome">
      <header class="hud" id="hud"></header>
      <div class="game-root" id="game-root"></div>
      <div class="entry-shell" id="entry-shell" data-state="idle" data-help="closed"${isFirstRun ? ' data-first-run="true"' : ''}>
        <button class="entry-shell__button" id="entry-button" type="button">
          <div class="entry-flow__title-stage">
            <div class="entry-flow__header">
              <span class="entry-flow__eyebrow">${globalWelcomeContent.eyebrow}</span>
              <h1 class="entry-flow__game-title">${globalWelcomeContent.title}<span class="entry-flow__game-sub">${globalWelcomeContent.subtitle}</span></h1>
            </div>

            <div class="entry-flow__hero">
              <span class="entry-flow__cover-glow" aria-hidden="true"></span>
              <span class="entry-flow__cover-frame">
                <img
                  class="entry-flow__cover"
                  src="${globalWelcomeContent.art.imageUrl}"
                  alt="${globalWelcomeContent.art.alt}"
                  decoding="async"
                />
              </span>
            </div>

            <div class="entry-flow__copy-stack">
              <div class="entry-flow__welcome-card" aria-label="Presentación">
                <p class="entry-flow__lead">${globalWelcomeContent.lead}</p>
                <p class="entry-flow__body">${globalWelcomeContent.body}</p>
                <p class="entry-flow__support">${welcomeSupport}</p>
              </div>
            </div>

            <div class="entry-flow__cta-stage" aria-hidden="true">
              <span class="entry-flow__cta">${welcomeCta}</span>
            </div>
          </div>

          <span class="entry-shell__callout" id="entry-loading">
            <span class="entry-shell__eyebrow" data-role="entry-eyebrow">${globalWelcomeContent.loading.eyebrow}</span>
            <strong class="entry-shell__title" data-role="entry-title">${globalWelcomeContent.loading.title}</strong>
            <span class="entry-shell__copy" data-role="entry-copy">${globalWelcomeContent.loading.copy}</span>
            <span class="entry-shell__loader" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </span>
        </button>

        ${
          shouldSurfaceWelcomeHelp || canOpenFullscreen
            ? `<div class="entry-shell__quick-actions" aria-label="Acciones rápidas">
                ${
                  shouldSurfaceWelcomeHelp
                    ? `<button class="entry-shell__quick-action" id="entry-help-toggle" type="button">${quickHelpContent.buttonLabel}</button>`
                    : ''
                }
                ${
                  canOpenFullscreen
                    ? '<button class="entry-shell__quick-action entry-shell__quick-action--ghost" id="entry-fullscreen-toggle" type="button">Pantalla completa</button>'
                    : ''
                }
              </div>`
            : ''
        }

        <div class="entry-help" id="entry-help" aria-hidden="true" hidden>
          <div class="entry-help__scrim" aria-hidden="true"></div>
          <div class="entry-help__panel" role="dialog" aria-modal="true" aria-labelledby="entry-help-title">
            <span class="entry-help__eyebrow">Recuerda</span>
            <h2 class="entry-help__title" id="entry-help-title">${quickHelpContent.title}</h2>
            <p class="entry-help__lead">${quickHelpContent.lead}</p>
            ${quickHelpContent.lines
              .map((line) => `<p class="entry-help__line">${line}</p>`)
              .join('')}
            <div class="entry-help__actions">
              <button class="entry-help__action entry-help__action--secondary" id="entry-help-dismiss" type="button">${quickHelpContent.dismiss}</button>
              <button class="entry-help__action" id="entry-help-start" type="button">${quickHelpContent.start}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
`;

sessionState.hydrate(savedProgress);

const hudRoot = document.querySelector<HTMLElement>('#hud');

if (!hudRoot) {
  throw new Error('HUD root not found.');
}

const showDebug =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === '1';

const logStartDebug = (message: string, details?: Record<string, unknown>) => {
  if (!showDebug) {
    return;
  }

  console.info('[entry-start]', message, details ?? {});
};

const hud = createHud(hudRoot);
const audioLayer = createReactiveAudioLayer();
const gameFrame = document.querySelector<HTMLElement>('.game-frame');
const entryShell = document.querySelector<HTMLElement>('#entry-shell');
const entryButton = document.querySelector<HTMLButtonElement>('#entry-button');
const entryEyebrow = document.querySelector<HTMLElement>('[data-role="entry-eyebrow"]');
const entryTitle = document.querySelector<HTMLElement>('[data-role="entry-title"]');
const entryCopy = document.querySelector<HTMLElement>('[data-role="entry-copy"]');
const entryHelp = document.querySelector<HTMLElement>('#entry-help');
const entryHelpToggle = document.querySelector<HTMLButtonElement>('#entry-help-toggle');
const entryHelpDismiss = document.querySelector<HTMLButtonElement>('#entry-help-dismiss');
const entryHelpStart = document.querySelector<HTMLButtonElement>('#entry-help-start');
const entryFullscreenToggle = document.querySelector<HTMLButtonElement>('#entry-fullscreen-toggle');
let bootInFlight = false;

type FlowScreenState = 'welcome' | 'loading' | 'chapter' | 'playing';

const setFlowScreen = (screen: FlowScreenState) => {
  gameFrame?.setAttribute('data-flow-screen', screen);
};

const handleUiScreen = (event: Event) => {
  const screen = (event as CustomEvent<{ screen?: FlowScreenState }>).detail?.screen;

  if (!screen) {
    return;
  }

  setFlowScreen(screen);

  if (screen !== 'welcome') {
    setEntryHelpOpen(false);
    entryShell?.setAttribute('data-state', 'ready');

    if (entryShell?.isConnected) {
      window.setTimeout(() => {
        entryShell.remove();
      }, 60);
    }
  }
};

window.addEventListener('mateo:ui-screen', handleUiScreen as EventListener);
setFlowScreen('welcome');

const setEntryEnabled = (enabled: boolean) => {
  if (!entryButton) {
    return;
  }

  entryButton.disabled = !enabled;
  entryButton.setAttribute('aria-busy', enabled ? 'false' : 'true');
};

const setEntryHelpOpen = (open: boolean) => {
  if (!entryShell || !entryHelp) {
    return;
  }

  entryShell.setAttribute('data-help', open ? 'open' : 'closed');
  entryHelp.hidden = !open;
  entryHelp.setAttribute('aria-hidden', open ? 'false' : 'true');
};

const updateFullscreenButton = () => {
  if (!entryFullscreenToggle || typeof document === 'undefined') {
    return;
  }

  const isActive = Boolean(document.fullscreenElement);
  entryFullscreenToggle.textContent = isActive
    ? 'Salir de pantalla completa'
    : 'Pantalla completa';
};

const bootGame = async (trigger: string) => {
  if (bootInFlight) {
    logStartDebug('ignored: guard active', {
      trigger,
      disabled: entryButton?.disabled ?? null,
      state: entryShell?.getAttribute('data-state') ?? null,
    });
    return false;
  }

  bootInFlight = true;
  logStartDebug('accepted', {
    trigger,
    disabled: entryButton?.disabled ?? null,
    state: entryShell?.getAttribute('data-state') ?? null,
  });
  setEntryEnabled(false);
  audioCueBus.unlockFromGesture();
  setEntryHelpOpen(false);
  setFlowScreen('loading');
  entryShell?.setAttribute('data-state', 'loading');

  if (entryEyebrow) {
    entryEyebrow.textContent = globalWelcomeContent.loading.eyebrow;
  }

  if (entryTitle) {
    entryTitle.textContent = globalWelcomeContent.loading.title;
  }

  if (entryCopy) {
    entryCopy.textContent = globalWelcomeContent.loading.copy;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  const { createGame } = await importWithRecovery(() => import('@/game/createGame'));
  createGame('game-root');
  entryShell?.setAttribute('data-state', 'ready');
  window.setTimeout(() => {
    entryShell?.remove();
  }, 220);
  return true;
};

const startFromEntry = (event: PointerEvent | KeyboardEvent) => {
  if (entryShell?.getAttribute('data-help') === 'open') {
    return;
  }

  logStartDebug('event', {
    type: event.type,
    target: event.target instanceof HTMLElement ? event.target.id || event.target.className || event.target.tagName : null,
    disabled: entryButton?.disabled ?? null,
    guardActive: bootInFlight,
  });

  if (event instanceof PointerEvent) {
    if (event.button !== 0 || event.isPrimary === false) {
      logStartDebug('ignored: non-primary pointer', {
        type: event.type,
        button: event.button,
        isPrimary: event.isPrimary,
      });
      return;
    }
  }

  if (entryButton?.disabled) {
    logStartDebug('ignored: button disabled', {
      type: event.type,
      state: entryShell?.getAttribute('data-state') ?? null,
    });
    return;
  }

  event.preventDefault();

  void bootGame(event.type).catch((error: unknown) => {
    bootInFlight = false;
    setEntryEnabled(true);
    setFlowScreen('welcome');
    entryShell?.setAttribute('data-state', 'idle');
    logStartDebug('failed: start reset', {
      type: event.type,
      error: error instanceof Error ? error.message : 'unknown',
    });

    if (entryEyebrow) {
      entryEyebrow.textContent = 'Error';
    }

    if (entryTitle) {
      entryTitle.textContent = 'No se abrió.';
    }

    if (entryCopy) {
      entryCopy.textContent = 'Toca para recargar.';
    }
  });
};

entryButton?.addEventListener('pointerdown', startFromEntry);
entryButton?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    startFromEntry(event);
  }
});

entryHelpToggle?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  setEntryHelpOpen(true);
});

entryHelpDismiss?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  setEntryHelpOpen(false);
});

entryHelp?.addEventListener('pointerdown', (event) => {
  event.stopPropagation();
});

entryHelpStart?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  void bootGame('welcome-help');
});

entryFullscreenToggle?.addEventListener('pointerdown', async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (typeof document === 'undefined' || !document.fullscreenEnabled) {
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await (gameFrame ?? document.documentElement).requestFullscreen();
    }
    updateFullscreenButton();
  } catch {
    // Ignore fullscreen failures and leave the welcome flow intact.
  }
});

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
}

if (showDebug) {
  (window as Window & { __MATEO_RUN_TELEMETRY__?: typeof runTelemetryStore }).__MATEO_RUN_TELEMETRY__ =
    runTelemetryStore;
}

let persistTimeout = 0;

sessionState.subscribe((snapshot) => {
  window.clearTimeout(persistTimeout);
  persistTimeout = window.setTimeout(() => {
    localProgressStore.save(snapshot);
  }, 400);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    localProgressStore.save(sessionState.snapshot());
  }
});

window.addEventListener('beforeunload', () => {
  localProgressStore.save(sessionState.snapshot());
  hud.destroy();
  audioLayer.destroy();

  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', updateFullscreenButton);
  }
});
