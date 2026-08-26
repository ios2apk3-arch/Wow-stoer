import type { Database } from "./types";
import { SEED_VERSION, buildSeed } from "./data/seed";

const STORAGE_KEY = "waw.smart-commerce.db.v1";

type Listener = () => void;

/**
 * Reactive persistent store.
 *
 * This is the local persistence adapter. `platform/api.ts` is the only caller,
 * so replacing it with HTTP requests against a real backend touches one file.
 */
class Store {
  private db: Database;
  private listeners = new Set<Listener>();
  private snapshotDirty = true;

  constructor() {
    this.db = this.load();
  }

  private load(): Database {
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Database;
          if (parsed.version === SEED_VERSION) return parsed;
        }
      } catch {
        // Corrupt or unreadable storage falls through to a fresh seed.
      }
    }
    const seeded = buildSeed();
    this.persist(seeded);
    return seeded;
  }

  private persist(db: Database) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Quota exceeded or private mode: keep running from memory.
    }
  }

  /**
   * Bound as a field, not a method: `useSyncExternalStore` calls this
   * detached from the instance, so a prototype method would lose `this`.
   */
  getState = (): Database => this.db;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Apply a mutation and notify subscribers. Mutations receive a draft copy. */
  update(mutator: (db: Database) => void) {
    const next: Database = structuredClone(this.db);
    mutator(next);
    this.db = next;
    this.snapshotDirty = true;
    this.persist(next);
    this.listeners.forEach((l) => l());
  }

  reset() {
    const seeded = buildSeed();
    this.db = seeded;
    this.persist(seeded);
    this.listeners.forEach((l) => l());
  }

  /** Wipe local state entirely, e.g. when a schema change lands. */
  clear() {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    this.reset();
  }

  get isDirty() {
    return this.snapshotDirty;
  }
}

export const store = new Store();

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const nowIso = () => new Date().toISOString();
