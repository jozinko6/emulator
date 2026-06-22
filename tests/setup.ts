import "@testing-library/jest-dom/vitest";

// Mock browser APIs that jsdom doesn't implement
if (typeof globalThis.navigator !== "undefined") {
  const nav = navigator as Navigator & {
    storage?: StorageManager & {
      estimate?: () => Promise<{ quota: number; usage: number }>;
      persisted?: () => Promise<boolean>;
    };
  };
  if (!nav.storage) {
    nav.storage = {} as typeof nav.storage;
  }
  if (nav.storage && !nav.storage.estimate) {
    nav.storage.estimate = () =>
      Promise.resolve({ quota: 1024 * 1024 * 1024, usage: 0 });
  }
  if (nav.storage && !nav.storage.persisted) {
    nav.storage.persisted = () => Promise.resolve(false);
  }
}

// IndexedDB mock for tests — uses fakeDB in-memory
import "fake-indexeddb/auto";

// Suppress React 19 act warnings in test output
const origError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && first.includes("not wrapped in act")) return;
  origError(...args);
};

// crypto.randomUUID polyfill — Node 18+ has it built-in, but be defensive
if (typeof globalThis.crypto?.randomUUID !== "function") {
  // Fallback: simple UUID v4 generator
  const fallback = (): string =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: fallback,
    configurable: true,
  });
}
