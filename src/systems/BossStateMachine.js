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

  applyPendingState(now) {
    if (!this.pendingState) return;

    const nextState = this.pendingState;
    this.pendingState = null;
    this.transitionTo(nextState, now);
  }

  transitionTo(nextState, now) {
    if (nextState === this.state) return;

    const previousState = this.state;
    this.state = nextState;
    this.stateStartedAt = now;

    if (nextState === BOSS_STATES.COMPRESSED) {
      this.compressedUntil = now + this.compressedDurationMs;
    } else {
      this.compressedUntil = 0;
    }

    this.listeners.forEach((listener) => listener({
      previousState,
      state: nextState,
      startedAt: now,
      compressedUntil: this.compressedUntil,
    }));
  }

  update(now) {
    this.applyPendingState(now);

    if (this.state === BOSS_STATES.COMPRESSED && now >= this.compressedUntil) {
      this.requestState(BOSS_STATES.COOLDOWN);
      this.applyPendingState(now);
    }

    if (
      this.state === BOSS_STATES.COOLDOWN &&
      now - this.stateStartedAt >= this.cooldownDurationMs
    ) {
      this.requestState(BOSS_STATES.NORMAL);
      this.applyPendingState(now);
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
