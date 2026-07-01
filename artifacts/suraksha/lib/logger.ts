const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;

export const logger = {
  info:  (...args: unknown[]) => { if (isDev) console.log("[INFO]",  ...args); },
  warn:  (...args: unknown[]) => { if (isDev) console.warn("[WARN]",  ...args); },
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  debug: (...args: unknown[]) => { if (isDev) console.debug("[DEBUG]", ...args); },
};
