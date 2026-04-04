import '@/styles/global.css';

import { importWithRecovery } from '@/app/importWithRecovery';
import planetHomeUrl from '@/assets/planet/planet-home-cutout.webp';
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

app.innerHTML = `
  <div class="app-shell">
    <section class="game-frame" aria-label="Cure Runner: Wounded Earth play area">
      <header class="hud" id="hud"></header>
      <div class="game-root" id="game-root"></div>
      <div class="entry-shell" id="entry-shell" data-state="idle" data-stage="0">
        <button class="entry-shell__button" id="entry-button" type="button">
          
          <div class="entry-flow__stage entry-flow__stage--0">
            <h1 class="entry-flow__game-title">CURE RUNNER<span class="entry-flow__game-sub">WOUNDED EARTH</span></h1>
            <span class="entry-shell__planet-stage" aria-hidden="true">
              <span class="entry-shell__planet-orbit"></span>
              <img class="entry-shell__planet" src="${planetHomeUrl}" alt="" />
            </span>
            <span class="entry-flow__cta">Toca para empezar</span>
          </div>
          
          <div class="entry-flow__stage entry-flow__stage--1">
            <div class="entry-flow__story-card">
              <p class="entry-flow__story entry-flow__story--lead">El planeta aún respira.</p>
              <p class="entry-flow__story">Asciende desde su interior y ayúdalo a despertar.</p>
              <p class="entry-flow__story entry-flow__story--support">Cada paso puede devolverle luz.</p>
            </div>
            <span class="entry-flow__cta">Continuar</span>
          </div>

          <div class="entry-flow__stage entry-flow__stage--2">
            <div class="entry-flow__instruction-block">
              <p class="entry-flow__instruction">👆 Toca para saltar</p>
            </div>
            <div class="entry-flow__instruction-block">
              <p class="entry-flow__instruction">👆👆 Toca en el aire<br>para doble salto</p>
            </div>
            <span class="entry-flow__cta">Comenzar</span>
          </div>

          <span class="entry-shell__callout" id="entry-loading">
            <span class="entry-shell__eyebrow">Level 1: Wounded Earth</span>
            <strong class="entry-shell__title" data-role="entry-title">Abriendo el planeta</strong>
            <span class="entry-shell__copy" data-role="entry-copy">Cargando...</span>
            <span class="entry-shell__loader" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </span>

        </button>
      </div>
    </section>
  </div>
`;

sessionState.hydrate(localProgressStore.load());

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
const entryShell = document.querySelector<HTMLElement>('#entry-shell');
const entryButton = document.querySelector<HTMLButtonElement>('#entry-button');
const entryTitle = document.querySelector<HTMLElement>('[data-role="entry-title"]');
const entryCopy = document.querySelector<HTMLElement>('[data-role="entry-copy"]');
let bootInFlight = false;
let introStage = 0;

const setEntryEnabled = (enabled: boolean) => {
  if (!entryButton) {
    return;
  }

  entryButton.disabled = !enabled;
  entryButton.setAttribute('aria-busy', enabled ? 'false' : 'true');
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
  entryShell?.setAttribute('data-state', 'loading');

  if (entryTitle) {
    entryTitle.textContent = 'Abriendo el planeta...';
  }

  if (entryCopy) {
    entryCopy.textContent = 'Cargando el Nivel 1.';
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

  if (introStage < 2) {
    introStage += 1;
    entryShell?.setAttribute('data-stage', introStage.toString());
    return;
  }
  void bootGame(event.type).catch((error: unknown) => {
    bootInFlight = false;
    setEntryEnabled(true);
    entryShell?.setAttribute('data-state', 'idle');
    logStartDebug('failed: start reset', {
      type: event.type,
      error: error instanceof Error ? error.message : 'unknown',
    });

    if (entryTitle) {
      entryTitle.textContent = 'Entra en el planeta';
    }

    if (entryCopy) {
      entryCopy.textContent = 'El camino no se abrió. Toca otra vez.';
    }
  });
};

entryShell?.addEventListener('pointerdown', startFromEntry);
entryButton?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    startFromEntry(event);
  }
});

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
});
