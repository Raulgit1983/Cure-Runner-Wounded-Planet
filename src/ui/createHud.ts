import { runTelemetryStore } from '@/game/services/telemetry/runTelemetryStore';
import { sessionState, type SessionSnapshot } from '@/game/state/sessionState';

const renderPulse = (state: SessionSnapshot) => `${Math.round(state.currentPulse * 100)}%`;

export const createHud = (root: HTMLElement) => {
  const showTelemetry =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';
  let victoryQuiet = false;
  let hintBaseOpacity = '0.9';
  let latestState: SessionSnapshot | null = null;
  let hintOverrideText: string | null = null;
  let lastNoteProgress = 0;
  let runtimeDebug = {
    phrase: 'Waiting',
    coyoteMs: 0,
    bufferMs: 0,
    landingX: null as number | null,
    grounded: true,
    hazards: 'none',
    decor: 'backdrop, ground-markers',
    retry: 'idle'
  };

  root.innerHTML = `
    <div class="hud__row hud__row--compact">
      <div class="hud__pulse">
        <div class="hud__pulse-copy">
          <span class="hud__eyebrow">Aire</span>
          <strong class="hud__value" data-role="progress">0%</strong>
        </div>
        <div class="spark-meter" aria-hidden="true">
          <div class="spark-meter__fill" data-role="meter"></div>
        </div>
      </div>
      <div class="hud__meta-actions">
        <div class="hud__notes">
          <span class="hud__eyebrow" data-role="notes-label">Reserva</span>
          <strong class="hud__value" data-role="count">0/100</strong>
        </div>
        <button class="hud__action" data-role="pause" type="button">Pausa</button>
      </div>
    </div>
    <p class="hud__hint" data-role="hint">Toca para saltar.</p>
    ${showTelemetry ? '<p class="hud__telemetry" data-role="telemetry"></p>' : ''}
    ${showTelemetry ? '<p class="hud__telemetry hud__telemetry--runtime" data-role="runtime"></p>' : ''}
    ${showTelemetry ? '<p class="hud__telemetry hud__telemetry--runtime" data-role="audit"></p>' : ''}
  `;

  const progress = root.querySelector<HTMLElement>('[data-role="progress"]');
  const meter = root.querySelector<HTMLElement>('[data-role="meter"]');
  const hint = root.querySelector<HTMLElement>('[data-role="hint"]');
  const count = root.querySelector<HTMLElement>('[data-role="count"]');
  const notesLabel = root.querySelector<HTMLElement>('[data-role="notes-label"]');
  const telemetry = root.querySelector<HTMLElement>('[data-role="telemetry"]');
  const runtime = root.querySelector<HTMLElement>('[data-role="runtime"]');
  const audit = root.querySelector<HTMLElement>('[data-role="audit"]');
  const pulse = root.querySelector<HTMLElement>('.hud__pulse');
  const notes = root.querySelector<HTMLElement>('.hud__notes');
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-role="pause"]');
  let telemetryInterval = 0;
  let hintOverrideTimeout = 0;
  const handlePauseClick = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(new CustomEvent('mateo:pause-request'));
  };

  root.style.transition = 'opacity 180ms ease, transform 180ms ease';

  if (pulse) {
    pulse.style.transition = 'opacity 180ms ease, transform 180ms ease';
  }

  if (count) {
    count.style.transition = 'opacity 180ms ease';
  }

  if (notes) {
    notes.style.transition = 'opacity 180ms ease, transform 180ms ease';
  }

  if (hint) {
    hint.style.overflow = 'hidden';
    hint.style.transition =
      'opacity 180ms ease, max-height 180ms ease, padding 180ms ease, border-color 180ms ease';
  }

  const applyVictoryQuiet = () => {
    root.style.opacity = victoryQuiet ? '0.38' : '1';
    root.style.transform = victoryQuiet ? 'translateY(-4px)' : 'translateY(0)';

    if (pulse) {
      pulse.style.opacity = victoryQuiet ? '0.48' : '1';
      pulse.style.transform = victoryQuiet ? 'scale(0.985)' : 'scale(1)';
    }

    if (count) {
      count.style.opacity = victoryQuiet ? '0.22' : '1';
    }

    if (notes) {
      notes.style.opacity = victoryQuiet ? '0.32' : '1';
      notes.style.transform = victoryQuiet ? 'scale(0.985)' : 'scale(1)';
    }

    if (hint) {
      hint.style.opacity = victoryQuiet ? '0' : hintBaseOpacity;
      hint.style.maxHeight = victoryQuiet ? '0px' : '48px';
      hint.style.padding = victoryQuiet ? '0 9px' : '6px 9px';
      hint.style.borderColor = victoryQuiet ? 'rgba(255, 255, 255, 0)' : 'rgba(255, 255, 255, 0.06)';
    }

    if (telemetry) {
      telemetry.style.opacity = victoryQuiet ? '0.18' : '1';
    }

    if (runtime) {
      runtime.style.opacity = victoryQuiet ? '0.18' : '1';
    }

    if (audit) {
      audit.style.opacity = victoryQuiet ? '0.18' : '1';
    }
  };

  const renderBaseHint = (state: SessionSnapshot) => {
    if (!hint) {
      return;
    }

    hint.textContent =
      state.currentPulse <= 0.34
        ? 'Busca aire.'
        : state.recoveryChances > 0
          ? 'Reserva lista.'
          : state.noteProgress > 0
            ? 'La reserva crece.'
            : 'Toca para saltar.';
    hintBaseOpacity =
      state.currentPulse <= 0.34
        ? '0.84'
        : state.noteProgress > 0
          ? '0.72'
          : '0.9';
  };

  const renderHint = () => {
    if (!hint || !latestState) {
      return;
    }

    if (hintOverrideText) {
      hint.textContent = hintOverrideText;
      hintBaseOpacity = '0.92';
    } else {
      renderBaseHint(latestState);
    }

    applyVictoryQuiet();
  };

  const renderRuntimeDebug = () => {
    if (runtime) {
      runtime.textContent =
        `phrase ${runtimeDebug.phrase} | ` +
        `coyote ${runtimeDebug.coyoteMs}ms | ` +
        `buffer ${runtimeDebug.bufferMs}ms | ` +
        `land ${runtimeDebug.landingX ?? '-'} | ` +
        `${runtimeDebug.grounded ? 'grounded' : 'air'}`;
    }

    if (audit) {
      audit.textContent =
        `hazards ${runtimeDebug.hazards} | ` +
        `decor ${runtimeDebug.decor} | ` +
        `retry ${runtimeDebug.retry}`;
    }
  };

  const handleRuntimeDebug = (event: Event) => {
    const detail = (event as CustomEvent<typeof runtimeDebug>).detail;

    runtimeDebug = detail;

    renderRuntimeDebug();
  };

  renderRuntimeDebug();

  const handleVictoryState = (event: Event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;

    victoryQuiet = detail?.active === true;
    applyVictoryQuiet();
  };

  const handleFocusMode = (event: Event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;

    victoryQuiet = detail?.active === true;
    applyVictoryQuiet();
  };

  const handleGuidanceLine = (event: Event) => {
    const detail = (event as CustomEvent<{ text?: string; durationMs?: number }>).detail;
    const nextText = detail?.text?.trim();

    if (!nextText) {
      return;
    }

    hintOverrideText = nextText;
    renderHint();
    window.clearTimeout(hintOverrideTimeout);
    hintOverrideTimeout = window.setTimeout(() => {
      hintOverrideText = null;
      renderHint();
    }, detail?.durationMs ?? 1800);
  };

  if (showTelemetry) {
    window.addEventListener('mateo:runner-debug', handleRuntimeDebug as EventListener);
  }

  window.addEventListener('mateo:victory-state', handleVictoryState as EventListener);
  window.addEventListener('mateo:focus-mode', handleFocusMode as EventListener);
  window.addEventListener('mateo:guidance-line', handleGuidanceLine as EventListener);
  pauseButton?.addEventListener('pointerdown', handlePauseClick);

  let lastRecoveryChances = 0;
  let textOverrideUntil = 0;

  const update = (state: SessionSnapshot) => {
    if (!progress || !meter || !hint || !count) {
      return;
    }

    latestState = state;
    progress.textContent = renderPulse(state);
    meter.style.width = `${Math.round(state.currentPulse * 100)}%`;
    if (notesLabel) {
      notesLabel.textContent =
        state.recoveryChances > 0 ? `Reserva x${state.recoveryChances}` : 'Reserva';
    }
    
    const now = Date.now();
    if (now > textOverrideUntil) {
      count.textContent = `${state.noteProgress}/100`;
    }

    if (state.recoveryChances > lastRecoveryChances) {
      notes?.classList.remove('hud__notes--pulse', 'hud__notes--full-burst');
      if (notes) void notes.offsetWidth;
      notes?.classList.add('hud__notes--full-burst');
      count.textContent = 'LISTA';
      textOverrideUntil = now + 1100;
    } else if (state.recoveryChances < lastRecoveryChances) {
      notes?.classList.remove('hud__notes--pulse', 'hud__notes--full-burst');
      if (notes) void notes.offsetWidth;
      notes?.classList.add('hud__notes--full-burst');
      count.textContent = 'USADA';
      textOverrideUntil = now + 900;
    } else if (state.noteProgress > lastNoteProgress && (now > textOverrideUntil)) {
      notes?.classList.remove('hud__notes--pulse', 'hud__notes--full-burst');
      if (notes) void notes.offsetWidth;
      notes?.classList.add('hud__notes--pulse');
    }
    
    lastNoteProgress = state.noteProgress;
    lastRecoveryChances = state.recoveryChances;

    renderHint();
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
        `pulse ${Math.round(snapshot.averagePulse * 100)}% | ` +
        `reserve ${latestState?.recoveryChances ?? '-'}`;
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
      if (hintOverrideTimeout) {
        window.clearTimeout(hintOverrideTimeout);
      }
      if (showTelemetry) {
        window.removeEventListener('mateo:runner-debug', handleRuntimeDebug as EventListener);
      }
      window.removeEventListener('mateo:victory-state', handleVictoryState as EventListener);
      window.removeEventListener('mateo:focus-mode', handleFocusMode as EventListener);
      window.removeEventListener('mateo:guidance-line', handleGuidanceLine as EventListener);
      pauseButton?.removeEventListener('pointerdown', handlePauseClick);
    }
  };
};
