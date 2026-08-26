import { useCallback, useEffect, useState } from "react";
import { api } from "./endpoints";
import { getSession, subscribeSession } from "./http";

/**
 * Favourites live on the server, but every product card needs to know the set
 * synchronously. One shared module-level cache, loaded once per session.
 */
let cache = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

async function load() {
  if (!getSession()) {
    cache = new Set();
    loaded = true;
    notify();
    return;
  }
  try {
    const { productIds } = await api.favorites.list();
    cache = new Set(productIds);
  } catch {
    cache = new Set();
  }
  loaded = true;
  notify();
}

subscribeSession(() => {
  loaded = false;
  void load();
});

export function useFavorites() {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    if (!loaded) void load();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const isFavorite = useCallback((productId: string) => cache.has(productId), []);

  const toggle = useCallback(async (productId: string) => {
    if (!getSession()) return;
    const next = new Set(cache);
    const wasFavorite = next.has(productId);
    // Optimistic: the heart must respond instantly, and roll back on failure.
    if (wasFavorite) next.delete(productId);
    else next.add(productId);
    cache = next;
    notify();
    try {
      if (wasFavorite) await api.favorites.remove(productId);
      else await api.favorites.add(productId);
    } catch {
      const reverted = new Set(cache);
      if (wasFavorite) reverted.add(productId);
      else reverted.delete(productId);
      cache = reverted;
      notify();
    }
  }, []);

  return { isFavorite, toggle, favorites: cache };
}
