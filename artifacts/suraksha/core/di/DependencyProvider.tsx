import React, { createContext, useContext, useMemo } from "react";

import { createAppContainer, type AppRegistry } from "./registry";
import type { Container } from "./container";

const DiContext = createContext<Container<AppRegistry> | null>(null);

/**
 * Wires the app's repositories into a single container once, at the root of
 * the tree, so any descendant can resolve them via `useDependency` (or the
 * convenience hooks in core/di/hooks.ts) instead of importing a concrete
 * repository module directly.
 */
export function DependencyProvider({
  children,
  overrides,
}: {
  children: React.ReactNode;
  overrides?: Partial<AppRegistry>;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- overrides is only meaningful for tests, which pass a stable object once
  const container = useMemo(() => createAppContainer(overrides), []);
  return <DiContext.Provider value={container}>{children}</DiContext.Provider>;
}

export function useDependency<K extends keyof AppRegistry>(key: K): AppRegistry[K] {
  const container = useContext(DiContext);
  if (!container) throw new Error("useDependency must be used within a DependencyProvider");
  return container.resolve(key);
}
