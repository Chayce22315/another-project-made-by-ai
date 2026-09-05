import { ContextMeter } from './src/components/ContextMeter.js';
import { BossStateMachine, BOSS_STATES } from './src/systems/BossStateMachine.js';
import { summarizeLyric } from './src/utils/textSummarizer.js';

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
  status.textContent = 'CONTEXT LIMIT REACHED. BOSS COMPRESSED.';
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
