/*
 * browser-game.js
 *
 * standalone browser entrypoint for direct `index.html` usage.
 *
 * proposal #002 moved the source systems to es modules, which browsers may
 * refuse to load from a file:// url. this entrypoint keeps the same behavior
 * without requiring a local web server, while the modular source files remain
 * available for testing and future bundling.
 */

const BOSS_STATES = Object.freeze({
  NORMAL: 'NORMAL',
  COMPRESSING: 'COMPRESSING',
  COMPRESSED: 'COMPRESSED',
  COOLDOWN: 'COOLDOWN',
});

class ContextMeter {
  constructor(max = 100) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new Error('ContextMeter max must be greater than zero.');
    }
    this.max = max;
    this.value = 0;
    this.listeners = new Map();
  }

  get normalized() {
    return this.value / this.max;
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(listener);
    return () => this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, detail = {}) {
    this.listeners.get(eventName)?.forEach((listener) => listener(detail));
  }

  add(amount) {
    if (!Number.isFinite(amount)) return this.value;
    const previous = this.value;
    this.value = Math.min(this.max, Math.max(0, this.value + amount));
    if (previous < this.max && this.value >= this.max) {
      this.emit('ON_CONTEXT_OVERFLOW', {
        value: this.value,
        max: this.max,
        normalized: this.normalized,
      });
    }
    return this.value;
  }

  recover(amount) {
    return this.add(-Math.abs(amount));
  }

  reset() {
    this.value = 0;
  }
}

class BossStateMachine {
  constructor({ compressedDurationMs = 10_000, cooldownDurationMs = 0 } = {}) {
    this.state = BOSS_STATES.NORMAL;
    this.compressedDurationMs = compressedDurationMs;
    this.cooldownDurationMs = cooldownDurationMs;
    this.stateStartedAt = 0;
    this.compressedUntil = 0;
    this.pendingState = null;
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  requestState(nextState) {
    if (nextState === this.state) return;
    this.pendingState = nextState;
  }

  transitionTo(nextState, now) {
    if (nextState === this.state) return;
    const previousState = this.state;
    this.state = nextState;
    this.stateStartedAt = now;
    this.compressedUntil = nextState === BOSS_STATES.COMPRESSED
      ? now + this.compressedDurationMs
      : 0;
    this.listeners.forEach((listener) => listener({
      previousState,
      state: nextState,
      startedAt: now,
      compressedUntil: this.compressedUntil,
    }));
  }

  update(now) {
    const queuedState = this.pendingState;
    this.pendingState = null;

    if (queuedState) {
      this.transitionTo(queuedState, now);
      if (queuedState === BOSS_STATES.COMPRESSING) {
        this.transitionTo(BOSS_STATES.COMPRESSED, now);
      }
    }

    if (this.state === BOSS_STATES.COMPRESSED && now >= this.compressedUntil) {
      this.transitionTo(BOSS_STATES.COOLDOWN, now);
    }

    if (
      this.state === BOSS_STATES.COOLDOWN &&
      now - this.stateStartedAt >= this.cooldownDurationMs
    ) {
      this.transitionTo(BOSS_STATES.NORMAL, now);
    }

    return this.state;
  }

  get isCompressed() {
    return this.state === BOSS_STATES.COMPRESSED;
  }

  get speedMultiplier() {
    return this.isCompressed ? 1.5 : 1;
  }
}

const SUMMARY_DICTIONARY = Object.freeze({
  'gemini asked what the lyrics were for': '[summarized] gemini asked about lyrics',
  'copilot suggested installing another extension': '[summarized] copilot suggested an extension',
  'meta tried to optimize the punchline': '[summarized] meta optimized the punchline',
  'the context window is getting nervous': '[summarized] context window panicking',
});

function summarizeLyric(lyric) {
  if (typeof lyric !== 'string') return lyric;
  return SUMMARY_DICTIONARY[lyric] ?? lyric;
}

const CONFIG = Object.freeze({
  maxContext: 100,
  hitAmount: 8,
  compressedDurationMs: 10_000,
  bossRecoveryPerSecond: 4,
  tickMs: 100,
});

const contextMeter = new ContextMeter(CONFIG.maxContext);
const bossStateMachine = new BossStateMachine({ compressedDurationMs: CONFIG.compressedDurationMs });
const state = { score: 0 };

const gameShell = document.querySelector('#gameShell');
const contextFill = document.querySelector('#contextFill');
const bossCore = document.querySelector('#bossCore');
const bossState = document.querySelector('#bossState');
const lyrics = document.querySelector('#lyrics');
const score = document.querySelector('#score');
const status = document.querySelector('#status');
const hitButton = document.querySelector('#hitButton');

const normalLyrics = [
  'gemini asked what the lyrics were for',
  'copilot suggested installing another extension',
  'meta tried to optimize the punchline',
  'the context window is getting nervous',
];

let lyricIndex = 0;
let lastFrame = performance.now();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function render() {
  const percent = clamp(contextMeter.value, 0, contextMeter.max);
  const stateName = bossStateMachine.state;
  contextFill.style.width = `${percent}%`;
  bossCore.textContent = `${Math.round(percent)}%`;
  score.textContent = state.score;
  bossState.textContent = bossStateMachine.isCompressed
    ? `compressed mode · ${bossStateMachine.speedMultiplier}x`
    : stateName === BOSS_STATES.COMPRESSING
      ? 'compression queued'
      : stateName === BOSS_STATES.COOLDOWN
        ? 'cooldown'
        : 'normal phase';
  const lyric = normalLyrics[lyricIndex % normalLyrics.length];
  lyrics.textContent = bossStateMachine.isCompressed ? summarizeLyric(lyric) : lyric;
  gameShell.classList.toggle('compressed', bossStateMachine.isCompressed);
}

function triggerCompressionPresentation() {
  status.textContent = 'context limit reached. boss compressed.';
  gameShell.classList.add('glitch');
  window.setTimeout(() => gameShell.classList.remove('glitch'), 360);
}

contextMeter.on('ON_CONTEXT_OVERFLOW', () => {
  bossStateMachine.requestState(BOSS_STATES.COMPRESSING);
});

bossStateMachine.onChange(({ state: nextState }) => {
  if (nextState === BOSS_STATES.COMPRESSED) {
    triggerCompressionPresentation();
  } else if (nextState === BOSS_STATES.COOLDOWN) {
    status.textContent = 'compression survived. resetting context.';
  } else if (nextState === BOSS_STATES.NORMAL) {
    contextMeter.reset();
    status.textContent = 'compression survived. overload it again.';
  }
  render();
});

function hitBoss() {
  if (bossStateMachine.state !== BOSS_STATES.NORMAL) return;
  const amount = CONFIG.hitAmount * bossStateMachine.speedMultiplier;
  contextMeter.add(amount);
  state.score += Math.round(amount);
  lyricIndex += 1;
  render();
}

function update(now) {
  const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  bossStateMachine.update(now);

  if (bossStateMachine.state === BOSS_STATES.NORMAL && contextMeter.value > 0) {
    contextMeter.recover(CONFIG.bossRecoveryPerSecond * deltaSeconds);
    render();
  }
  requestAnimationFrame(update);
}

// keep both input paths active: mouse/touch click and keyboard spacebar.
hitButton.addEventListener('click', hitBoss);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    hitBoss();
  }
});

render();
window.setInterval(() => {
  if (!bossStateMachine.isCompressed) return;
  const secondsLeft = Math.max(0, Math.ceil((bossStateMachine.compressedUntil - performance.now()) / 1000));
  status.textContent = `compressed mode active · ${secondsLeft}s left · ${bossStateMachine.speedMultiplier}x speed`;
}, CONFIG.tickMs);
requestAnimationFrame(update);
