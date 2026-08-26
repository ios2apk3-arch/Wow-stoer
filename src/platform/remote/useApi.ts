import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, getSession, subscribeSession, type Session } from "./http";

export interface QueryState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** Re-run the fetch, e.g. after a mutation elsewhere. */
  refetch: () => void;
}

/**
 * Minimal async data hook: fetch on mount and whenever `deps` change, abort
 * the previous request, and never apply a stale response.
 *
 * Deliberately not a cache. A cache is worth adding when a screen actually
 * suffers without one; until then it would be state to keep correct for
 * no gain.
 */
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): QueryState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);

  // Keep the latest fetcher without making it a dependency; callers usually
  // pass an inline arrow, which would otherwise refetch on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "unknown", String(err)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, refetch };
}

/** Run a write and expose its pending/error state. */
export function useApiMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    setPending(true);
    setError(null);
    try {
      return await actionRef.current(...args);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "unknown", String(err)));
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, reset: () => setError(null) };
}

/** The signed-in session, re-rendering on sign-in and sign-out. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export function useCurrentUser() {
  const session = useSession();
  return useMemo(() => session?.user ?? null, [session]);
}
