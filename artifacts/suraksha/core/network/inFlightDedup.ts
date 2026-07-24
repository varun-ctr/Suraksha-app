/**
 * Generic in-flight-promise de-duplication: while a promise for a given key
 * is outstanding, a second caller for the same key awaits that same promise
 * instead of invoking `factory()` again. Once the promise settles (resolves
 * OR rejects), the key is released, so the next call for that key always
 * starts a fresh `factory()` call — this is purely a concurrency guard, not
 * a time-based cache; it never serves a result from a call that has
 * already finished.
 *
 * Framework-agnostic (no fetch/Firebase/Supabase dependency) so it's usable
 * — and unit-testable — independently of any specific network client. Used
 * by core/network/apiClient.ts (GET request de-dup) and
 * repositories/supabase/supabaseClient.ts (profiles.getById de-dup).
 */
export function dedupeInFlight<T>(
  registry: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = registry.get(key);
  if (existing) return existing;

  const promise = factory();
  registry.set(key, promise);
  const release = () => {
    if (registry.get(key) === promise) registry.delete(key);
  };
  // Always released once settled — a rejection must not permanently poison
  // the key for every future call, and a resolution must not turn this
  // into a stale-forever cache. Uses .then(onFulfilled, onRejected) rather
  // than .finally() so this internal bookkeeping chain itself never ends in
  // a rejected promise — .finally() re-throws on a rejection, which would
  // otherwise surface as an unhandled rejection here even though the
  // original `promise` returned to the caller is (correctly) still
  // rejected and handleable by them.
  void promise.then(release, release);
  return promise;
}
