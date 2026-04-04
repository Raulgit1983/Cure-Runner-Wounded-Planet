import { runTelemetryStore } from '@/game/services/telemetry/runTelemetryStore';
import { sessionState, type SessionSnapshot } from '@/game/state/sessionState';

const renderProgress = (state: SessionSnapshot) => `${Math.round(state.displayLevel * 100)}%`;

export const createHud = (root: HTMLElement) => {
  const showTelemetry =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';
  let runtimeDebug = {
    phrase: 'Waiting',
    coyoteMs: 0,
    bufferMs: 0,
    landingX: null as number | null,
    grounded: true
  };

  root.innerHTML = `
    <div class="hud__row hud__row--compact">
      <div class="hud__pulse">
        <div class="hud__pulse-copy">
          <span class="hud__eyebrow">Pulse</span>
          <strong class="hud__value" data-role="progress">0%</strong>
        </div>
        <div class="spark-meter" aria-hidden="true">
          <div class="spark-meter__fill" data-role="meter"></div>
        </div>
      </div>
      <div class="hud__chain" data-role="count">x0</div>
    </div>
    <p class="hud__hint" data-role="hint">Tap to jump. Bright objects wake the hero up.</p>
    ${showTelemetry ? '<p class="hud__telemetry" data-role="telemetry"></p>' : ''}
    ${showTelemetry ? '<p class="hud__telemetry hud__telemetry--runtime" data-role="runtime"></p>' : ''}
  `;

  const progress = root.querySelector<HTMLElement>('[data-role="progress"]');
  const meter = root.querySelector<HTMLElement>('[data-role="meter"]');
  const hint = root.querySelector<HTMLElement>('[data-role="hint"]');
  const count = root.querySelector<HTMLElement>('[data-role="count"]');
  const telemetry = root.querySelector<HTMLElement>('[data-role="telemetry"]');
  const runtime = root.querySelector<HTMLElement>('[data-role="runtime"]');
  let telemetryInterval = 0;

  const handleRuntimeDebug = (event: Event) => {
    const detail = (event as CustomEvent<typeof runtimeDebug>).detail;

    runtimeDebug = detail;

    if (!runtime) {
      return;
    }

    runtime.textContent =
      `phrase ${detail.phrase} | ` +
      `coyote ${detail.coyoteMs}ms | ` +
      `buffer ${detail.bufferMs}ms | ` +
      `land ${detail.landingX ?? '-'} | ` +
      `${detail.grounded ? 'grounded' : 'air'}`;
  };

  window.addEventListener('mateo:runner-debug', handleRuntimeDebug as EventListener);

  const update = (state: SessionSnapshot) => {
    if (!progress || !meter || !hint || !count) {
      return;
    }

    progress.textContent = renderProgress(state);
    meter.style.width = `${Math.round(state.displayLevel * 100)}%`;
    count.textContent = `x${state.currentChain}`;
    hint.textContent =
      state.currentChain >= 3
        ? 'Clean runs lighten the hero.'
        : state.tier === 'awake'
          ? 'The world is starting to open.'
        : state.collectedSparks > 0
          ? 'Tap again in the air to double jump.'
          : 'Tap to jump. Tap again in the air to double jump.';
    hint.style.opacity = state.collectedSparks > 2 ? '0.42' : state.currentChain >= 3 ? '0.72' : '0.9';
    document.documentElement.style.setProperty('--emotion-progress', state.displayLevel.toFixed(3));
    document.body.dataset.emotion = state.tier;
  };

  if (telemetry) {
    const renderTelemetry = () => {
      const snapshot = runTelemetryStore.snapshot();

      telemetry.textContent =
        `run ${snapshot.runDurationSeconds.toFixed(1)}s | ` +
        `sparks ${snapshot.sparksCollected} | ` +
        `hits ${snapshot.obstacleHits} | ` +
        `max x${snapshot.maxChain} | ` +
        `pulse ${Math.round(snapshot.averagePulse * 100)}%`;
    };

    renderTelemetry();
    telemetryInterval = window.setInterval(renderTelemetry, 500);
  }

  const unsubscribe = sessionState.subscribe(update);

  return {
    destroy() {
      unsubscribe();
      if (telemetryInterval) {
        window.clearInterval(telemetryInterval);
      }
      window.removeEventListener('mateo:runner-debug', handleRuntimeDebug as EventListener);
    }
  };
};
