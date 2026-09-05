const CONFIG = Object.freeze({
  maxContext: 100,
  hitAmount: 8,
  normalSpeed: 1,
  compressedSpeed: 1.5,
  compressedDurationMs: 10_000,
  bossRecoveryPerSecond: 4,
  tickMs: 100,
});

const state = {
  context: 0,
  score: 0,
  speed: CONFIG.normalSpeed,
  compressed: false,
  compressedUntil: 0,
};

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

const compressedLyrics = [
  '[summarized] gemini asked about lyrics',
  '[summarized] copilot suggested an extension',
  '[summarized] meta optimized the punchline',
  '[summarized] context window panicking',
];

let lyricIndex = 0;
let lastFrame = performance.now();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function render() {
  const percent = clamp(state.context, 0, CONFIG.maxContext);
  contextFill.style.width = `${percent}%`;
  bossCore.textContent = `${Math.round(percent)}%`;
  score.textContent = state.score;

  if (state.compressed) {
    gameShell.classList.add('compressed');
    bossState.textContent = `compressed mode · ${state.speed}x`;
  } else {
    gameShell.classList.remove('compressed');
    bossState.textContent = 'normal phase';
  }
}

function compressBoss(now) {
  if (state.compressed) return;

  state.compressed = true;
  state.speed = CONFIG.compressedSpeed;
  state.compressedUntil = now + CONFIG.compressedDurationMs;
  lyrics.textContent = compressedLyrics[lyricIndex % compressedLyrics.length];
  status.textContent = 'CONTEXT LIMIT REACHED. BOSS COMPRESSED.';
  gameShell.classList.add('glitch');
  window.setTimeout(() => gameShell.classList.remove('glitch'), 360);
  render();
}

function endCompression() {
  state.compressed = false;
  state.speed = CONFIG.normalSpeed;
  state.context = 0;
  lyrics.textContent = normalLyrics[lyricIndex % normalLyrics.length];
  status.textContent = 'compression survived. overload it again.';
  render();
}

function hitBoss() {
  const amount = CONFIG.hitAmount * state.speed;
  state.context = clamp(state.context + amount, 0, CONFIG.maxContext);
  state.score += Math.round(amount);
  lyricIndex += 1;
  lyrics.textContent = (state.compressed ? compressedLyrics : normalLyrics)[lyricIndex % 4];

  if (state.context >= CONFIG.maxContext) {
    compressBoss(performance.now());
  }

  render();
}

function update(now) {
  const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;

  if (state.compressed && now >= state.compressedUntil) {
    endCompression();
  } else if (!state.compressed && state.context > 0) {
    state.context = clamp(state.context - CONFIG.bossRecoveryPerSecond * deltaSeconds, 0, CONFIG.maxContext);
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
  if (!state.compressed) return;
  status.textContent = `compressed mode active · ${Math.max(0, Math.ceil((state.compressedUntil - performance.now()) / 1000))}s left · ${state.speed}x speed`;
}, CONFIG.tickMs);
requestAnimationFrame(update);
