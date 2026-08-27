/**
 * Single debug flag for the whole extension.
 * Routine events go through logDebug() and stay silent in production.
 * Only real failures go through logWarn().
 */
export const DEBUG = false;

const PREFIX = "[autoskip]";

export const logDebug = (...args: unknown[]) => {
  if (DEBUG) {
    console.log(PREFIX, ...args);
  }
};

export const logWarn = (...args: unknown[]) => {
  console.warn(PREFIX, ...args);
};
