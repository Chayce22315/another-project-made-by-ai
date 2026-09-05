export const BOSS_STATES = Object.freeze({
  NORMAL: 'NORMAL',
  COMPRESSING: 'COMPRESSING',
  COMPRESSED: 'COMPRESSED',
  COOLDOWN: 'COOLDOWN',
});

export class BossStateMachine {
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
