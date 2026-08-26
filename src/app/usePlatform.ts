import { useSyncExternalStore } from "react";
import { store } from "../platform/store";
import type { Database } from "../platform/types";

/** Subscribe to the platform store; any mutation re-renders the caller. */
export function useDatabase(): Database {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/**
 * Derive a value from the store. The selector runs on every store change, so
 * keep it cheap and let React bail out on identical renders downstream.
 */
export function usePlatform<T>(selector: (db: Database) => T): T {
  const db = useDatabase();
  return selector(db);
}
