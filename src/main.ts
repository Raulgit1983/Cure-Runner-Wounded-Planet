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
    <section class="game-frame" aria-label="Mateo spark journey play area">
      <header class="hud" id="hud"></header>
      <div class="game-root" id="game-root"></div>
      <div class="entry-shell" id="entry-shell" data-state="idle">
        <button class="entry-shell__button" id="entry-button" type="button">
          <span class="entry-shell__planet-stage" aria-hidden="true">
            <span class="entry-shell__planet-orbit"></span>
            <img class="entry-shell__planet" src="${planetHomeUrl}" alt="" />
          </span>
          <span class="entry-shell__callout">
            <span class="entry-shell__eyebrow">Level 1: Wounded Earth</span>
            <strong class="entry-shell__title" data-role="entry-title">Enter the planet</strong>
            <span class="entry-shell__mission">Find the first ingredient for the cure.</span>
            <span class="entry-shell__copy" data-role="entry-copy">Tap to begin</span>
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

const hud = createHud(hudRoot);
const audioLayer = createReactiveAudioLayer();
const entryShell = document.querySelector<HTMLElement>('#entry-shell');
const entryButton = document.querySelector<HTMLButtonElement>('#entry-button');
const entryTitle = document.querySelector<HTMLElement>('[data-role="entry-title"]');
const entryCopy = document.querySelector<HTMLElement>('[data-role="entry-copy"]');
let bootInFlight = false;

const bootGame = async () => {
  if (bootInFlight) {
    return;
  }

  bootInFlight = true;
  audioCueBus.unlockFromGesture();
  entryShell?.setAttribute('data-state', 'loading');

  if (entryTitle) {
    entryTitle.textContent = 'Opening the planet...';
  }

  if (entryCopy) {
    entryCopy.textContent = 'Loading Level 1.';
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
};

const startFromEntry = () => {
  void bootGame().catch(() => {
    bootInFlight = false;
    entryShell?.setAttribute('data-state', 'idle');

    if (entryTitle) {
      entryTitle.textContent = 'Enter the planet';
    }

    if (entryCopy) {
      entryCopy.textContent = 'The path did not open. Tap again.';
    }
  });
};

entryButton?.addEventListener('pointerdown', startFromEntry, { passive: true });

(window as Window & { __MATEO_RUN_TELEMETRY__?: typeof runTelemetryStore }).__MATEO_RUN_TELEMETRY__ =
  runTelemetryStore;

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
