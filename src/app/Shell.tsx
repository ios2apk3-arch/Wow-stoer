import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, ChevronDown, LayoutDashboard, LogOut, Menu, MessageSquare, Search,
  ShoppingCart, Sparkles, User as UserIcon, X, Globe,
} from "lucide-react";
import { Link, useRouter } from "./router";
import { useSession } from "../platform/remote/useApi";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { Badge, Button, cx } from "../ui";

function WawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="var(--color-primary)" />
      <path
        d="M10 16l4.5 16h3.6L22 21.5 25.9 32h3.6L34 16h-3.9l-2.7 11.2L24.6 16h-3.2l-2.8 11.2L15.9 16z"
        fill="var(--color-brand-400)"
      />
      <circle cx="37" cy="14" r="3.5" fill="var(--color-brand-300)" />
    </svg>
  );
}

function Dropdown({ trigger, children, align = "end" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="cursor-pointer">
        {trigger}
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={cx(
            "absolute top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-overlay)]",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function SearchBar({ className }: { className?: string }) {
  const { d, t, locale } = useI18n();
  const { navigate, query } = useRouter();
  const [value, setValue] = useState(query.get("q") ?? "");

  useEffect(() => setValue(query.get("q") ?? ""), [query]);

  return (
    <form
      className={cx("relative flex-1", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;
        // A long, sentence-like query is a job for the assistant, not a keyword search.
        const isNaturalLanguage = q.split(/\s+/).length >= 6;
        navigate(`${isNaturalLanguage ? "/ai" : "/search"}?q=${encodeURIComponent(q)}`);
      }}
      role="search"
    >
      <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t(d.home.searchPlaceholder)}
        aria-label={t(d.action.search)}
        className="h-11 w-full rounded-xl border border-border bg-card ps-11 pe-24 text-sm text-foreground transition-colors placeholder:text-ink-400 hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
      <button
        type="submit"
        className="absolute top-1/2 end-1.5 h-8 -translate-y-1/2 cursor-pointer rounded-lg bg-accent px-3.5 text-xs font-bold text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        {t(d.action.search)}
      </button>
      <span className="sr-only">{locale}</span>
    </form>
  );
}

const buyerLinks = [
  { href: "/search", key: "marketplace" as const },
  { href: "/suppliers", key: "suppliers" as const },
  { href: "/rfq", key: "rfq" as const },
  { href: "/negotiations", key: "negotiations" as const },
  { href: "/orders", key: "orders" as const },
  { href: "/intelligence", key: "intelligence" as const },
];

const supplierLinks = [
  { href: "/supplier", key: "dashboard" as const },
  { href: "/search", key: "marketplace" as const },
  { href: "/rfq", key: "rfq" as const },
  { href: "/negotiations", key: "negotiations" as const },
  { href: "/orders", key: "orders" as const },
  { href: "/intelligence", key: "intelligence" as const },
];

export function Shell({ children }: { children: ReactNode }) {
  const { d, t, locale, toggleLocale } = useI18n();
  const { path, navigate } = useRouter();
  // Re-renders the chrome whenever the session changes.
  useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = auth.currentUser();

  // Badge counts come from the server, and only when someone is signed in.
  // Only buyers have a cart; asking for one as a supplier or admin is a 403.
  const isBuyer = user?.role === "buyer";
  const cartQuery = useApiQuery((signal) => api.cart.get(signal), [user?.id], { enabled: isBuyer });
  const notifQuery = useApiQuery(
    (signal) => api.notifications.list({ perPage: 1 }, signal),
    [user?.id],
    { enabled: Boolean(user) },
  );
  const threadsQuery = useApiQuery((signal) => api.messaging.threads(signal), [user?.id], { enabled: Boolean(user) });

  const cartCount = cartQuery.data?.lines.length ?? 0;
  const notifCount = notifQuery.data?.unreadCount ?? 0;
  const msgCount = threadsQuery.data?.threads.reduce((sum, t) => sum + t.unreadCount, 0) ?? 0;

  const links = user?.role === "supplier" ? supplierLinks : buyerLinks;
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  const dashboardHref = user?.role === "admin" ? "/admin" : user?.role === "supplier" ? "/supplier" : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Utility bar */}
      <div className="hidden border-b border-border bg-primary text-primary-foreground lg:block">
        <div className="container-x flex h-9 items-center justify-between text-[11px] font-semibold">
          <span>{t(d.tagline)}</span>
          <div className="flex items-center gap-5">
            <Link to="/company" className="hover:text-brand-300">{t(d.nav.company)}</Link>
            <Link to="/forecasting" className="hover:text-brand-300">{t(d.nav.forecasting)}</Link>
            <button type="button" onClick={toggleLocale} className="flex cursor-pointer items-center gap-1.5 hover:text-brand-300">
              <Globe className="h-3.5 w-3.5" />
              {d.common.language[locale]}
            </button>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container-x flex h-16 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <WawMark className="h-9 w-9" />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-base font-extrabold text-foreground">{t(d.brand)}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">{t(d.brandFull)}</span>
            </span>
          </Link>

          <SearchBar className="hidden md:block" />

          <div className="ms-auto flex items-center gap-1">
            <Link
              to="/ai"
              className="hidden items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
            >
              <Sparkles className="h-4 w-4" />
              {t(d.nav.aiAssistant)}
            </Link>

            {user && (
              <>
                <Link to="/messages" className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t(d.nav.messages)}>
                  <MessageSquare className="h-5 w-5" />
                  {msgCount > 0 && <span className="num absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{msgCount}</span>}
                </Link>
                <Link to="/notifications" className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t(d.nav.notifications)}>
                  <Bell className="h-5 w-5" />
                  {notifCount > 0 && <span className="num absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{notifCount}</span>}
                </Link>
              </>
            )}

            {(!user || isBuyer) && (
              <Link to="/cart" className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t(d.nav.cart)}>
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && <span className="num absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{cartCount}</span>}
              </Link>
            )}

            {user ? (
              <Dropdown
                trigger={
                  <span className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold text-white"
                      style={{ background: user.avatarColor }}
                    >
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
                  </span>
                }
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-extrabold text-foreground">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                  <Badge tone="accent" className="mt-2">{t(d.auth.roles[user.role])}</Badge>
                </div>
                <nav className="p-1.5">
                  <Link to={dashboardHref} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {t(d.nav.dashboard)}
                  </Link>
                  <Link to="/profile" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    {t(d.nav.profile)}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void auth.logout().then(() => navigate("/"));
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft"
                  >
                    <LogOut className="h-4 w-4" />
                    {t(d.action.signOut)}
                  </button>
                </nav>
              </Dropdown>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login">
                  <Button variant="ghost" size="sm">{t(d.action.signIn)}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">{t(d.action.register)}</Button>
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="cursor-pointer rounded-xl p-2.5 text-foreground lg:hidden"
              aria-label="menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="hidden border-t border-border lg:block">
          <div className="container-x flex h-11 items-center gap-1">
            <Link
              to="/"
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
                path === "/" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(d.nav.home)}
            </Link>
            {links.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
                  isActive(l.href) ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(d.nav[l.key])}
              </Link>
            ))}
          </div>
        </nav>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="border-t border-border bg-card lg:hidden">
            <div className="container-x space-y-1 py-4">
              <SearchBar className="mb-3 md:hidden" />
              <Link to="/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-bold text-foreground hover:bg-muted">
                {t(d.nav.home)}
              </Link>
              {links.map((l) => (
                <Link key={l.href} to={l.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-bold text-foreground hover:bg-muted">
                  {t(d.nav[l.key])}
                </Link>
              ))}
              <Link to="/forecasting" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-bold text-foreground hover:bg-muted">
                {t(d.nav.forecasting)}
              </Link>
              <button type="button" onClick={toggleLocale} className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-start text-sm font-bold text-foreground hover:bg-muted">
                {d.common.language[locale]}
              </button>
              {!user && (
                <div className="flex gap-2 pt-3">
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1">
                    <Button variant="outline" fullWidth>{t(d.action.signIn)}</Button>
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="flex-1">
                    <Button fullWidth>{t(d.action.register)}</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <Footer />

      <Link
        to="/ai"
        aria-label={t(d.nav.aiAssistant)}
        className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-[var(--shadow-overlay)] transition-transform hover:scale-105 sm:hidden"
      >
        <Sparkles className="h-6 w-6" />
      </Link>
    </div>
  );
}

function Footer() {
  const { d, t } = useI18n();
  const groups = [
    {
      title: d.home.forBuyers,
      links: [
        { href: "/search", label: d.nav.marketplace },
        { href: "/rfq/new", label: d.rfq.new },
        { href: "/orders", label: d.nav.orders },
        { href: "/dashboard", label: d.dashboard.buyer },
      ],
    },
    {
      title: d.home.forSuppliers,
      links: [
        { href: "/supplier", label: d.dashboard.supplier },
        { href: "/rfq", label: d.nav.rfq },
        { href: "/negotiations", label: d.nav.negotiations },
        { href: "/register", label: d.action.register },
      ],
    },
    {
      title: d.intelligence.title,
      links: [
        { href: "/intelligence", label: d.intelligence.priceIndex },
        { href: "/forecasting", label: d.nav.forecasting },
        { href: "/suppliers", label: d.supplier.directory },
        { href: "/ai", label: d.nav.aiAssistant },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-primary text-primary-foreground">
      <div className="container-x grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <WawMark className="h-9 w-9" />
            <span className="text-base font-extrabold">{t(d.brandFull)}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-300">{t(d.home.heroSub)}</p>
        </div>
        {groups.map((g, i) => (
          <div key={i}>
            <h4 className="text-sm font-extrabold">{t(g.title)}</h4>
            <ul className="mt-4 space-y-2.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link to={l.href} className="text-sm text-ink-300 transition-colors hover:text-brand-300">
                    {t(l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-5 text-[11px] text-ink-400 sm:flex-row">
          <span>© {new Date().getFullYear()} {t(d.brandFull)}</span>
          <span className="num">Multi-Language · Multi-Currency · Multi-Country</span>
        </div>
      </div>
    </footer>
  );
}
