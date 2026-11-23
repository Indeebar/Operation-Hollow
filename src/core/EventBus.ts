type Listener<T = unknown> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Listener[]> = new Map();

  on<T>(event: string, fn: Listener<T>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn as Listener);
  }

  off<T>(event: string, fn: Listener<T>): void {
    const arr = this.listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(fn as Listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  emit<T>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

export const bus = new EventBus();
