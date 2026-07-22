/**
 * A minimal, type-safe service registry — not a framework. `TRegistry` maps
 * each service name to its interface type, so `register`/`resolve` are
 * checked at compile time without decorators, reflection, or a build-step
 * dependency. See docs/adr/0002-repository-pattern.md for why this exists.
 */
export class Container<TRegistry extends object> {
  private readonly services = new Map<keyof TRegistry, TRegistry[keyof TRegistry]>();

  register<K extends keyof TRegistry>(key: K, instance: TRegistry[K]): void {
    this.services.set(key, instance);
  }

  resolve<K extends keyof TRegistry>(key: K): TRegistry[K] {
    if (!this.services.has(key)) {
      throw new Error(`[DI] No registration found for "${String(key)}"`);
    }
    return this.services.get(key) as TRegistry[K];
  }
}
