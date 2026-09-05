export class ContextMeter {
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
