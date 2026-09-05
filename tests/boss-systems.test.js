import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextMeter } from '../src/components/ContextMeter.js';
import { BossStateMachine, BOSS_STATES } from '../src/systems/BossStateMachine.js';
import { summarizeLyric } from '../src/utils/textSummarizer.js';

test('ContextMeter emits overflow exactly once when crossing max', () => {
  const meter = new ContextMeter(100);
  let overflowCount = 0;
  meter.on('ON_CONTEXT_OVERFLOW', () => overflowCount += 1);

  meter.add(60);
  meter.add(40);
  meter.add(20);

  assert.equal(meter.value, 100);
  assert.equal(meter.normalized, 1);
  assert.equal(overflowCount, 1);
});

test('BossStateMachine queues compression and holds it for 10 seconds', () => {
  const machine = new BossStateMachine({ compressedDurationMs: 10_000 });
  const changes = [];
  machine.onChange(({ state }) => changes.push(state));

  machine.requestState(BOSS_STATES.COMPRESSING);
  machine.update(1_000);

  assert.equal(machine.state, BOSS_STATES.COMPRESSED);
  assert.equal(machine.speedMultiplier, 1.5);
  assert.equal(machine.compressedUntil, 11_000);
  assert.deepEqual(changes, [BOSS_STATES.COMPRESSING, BOSS_STATES.COMPRESSED]);

  machine.update(10_999);
  assert.equal(machine.state, BOSS_STATES.COMPRESSED);

  machine.update(11_000);
  assert.equal(machine.state, BOSS_STATES.NORMAL);
  assert.equal(machine.speedMultiplier, 1);
  assert.deepEqual(changes, [
    BOSS_STATES.COMPRESSING,
    BOSS_STATES.COMPRESSED,
    BOSS_STATES.COOLDOWN,
    BOSS_STATES.NORMAL,
  ]);
});

test('text summarizer falls back to original text', () => {
  const unknown = 'a lyric that is not in the dictionary';
  assert.equal(summarizeLyric(unknown), unknown);
  assert.equal(
    summarizeLyric('gemini asked what the lyrics were for'),
    '[summarized] gemini asked about lyrics',
  );
});
