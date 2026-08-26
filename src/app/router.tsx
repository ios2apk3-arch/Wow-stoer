import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";

/**
 * Minimal pushState router. The app is a handful of routes with at most one
 * dynamic segment, so a full routing library would be more surface than value.
 */

interface RouteState {
  path: string;
  query: URLSearchParams;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  setQuery: (next: Record<string, string | null>, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouteState | null>(null);

function currentLocation() {
  return { path: window.location.pathname, search: window.location.search };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(currentLocation);

  useEffect(() => {
    const onPop = () => setLoc(currentLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState({}, "", to);
    else window.history.pushState({}, "", to);
    setLoc(currentLocation());
    if (!to.includes("#")) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const value = useMemo<RouteState>(() => {
    const query = new URLSearchParams(loc.search);
    return {
      path: loc.path,
      query,
      navigate,
      setQuery: (next, options) => {
        const params = new URLSearchParams(loc.search);
        for (const [key, val] of Object.entries(next)) {
          if (val === null || val === "") params.delete(key);
          else params.set(key, val);
        }
        const qs = params.toString();
        navigate(`${loc.path}${qs ? `?${qs}` : ""}`, options);
      },
    };
  }, [loc, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouteState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}

/** Anchor that keeps middle-click and modifier-click behaving natively. */
export function Link({
  to,
  children,
  className,
  onClick,
  ...rest
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
} & Record<string, unknown>) {
  const { navigate } = useRouter();
  return (
    <a
      {...rest}
      href={to}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

/**
 * Match a path against a pattern with `:param` segments.
 * Returns the extracted params, or null when the pattern doesn't apply.
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i];
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    else if (p !== pathParts[i]) return null;
  }
  return params;
}
