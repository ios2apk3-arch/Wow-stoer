import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- Button */

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm",
  secondary: "bg-primary text-primary-foreground hover:bg-ink-800 shadow-sm",
  outline: "border border-border-strong bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm",
  success: "bg-success text-white hover:brightness-95 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; fullWidth?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center rounded-xl font-bold transition-all",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <div {...rest} className={cx("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Inputs */

export function Field({ label, hint, error, children, required }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-bold text-foreground">
        {label}
        {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-semibold text-danger">{error}</span>}
    </label>
  );
}

const controlBase =
  "w-full rounded-xl border border-border bg-input px-3.5 text-sm text-foreground transition-colors placeholder:text-ink-400 hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:bg-muted disabled:text-muted-foreground";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(controlBase, "h-11", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(controlBase, "min-h-24 py-2.5 leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(controlBase, "h-11 cursor-pointer pe-8", className)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-foreground">
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 cursor-pointer rounded border-border-strong text-accent accent-[var(--color-accent)]"
      />
      <span className="select-none">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ Stat */

export function Stat({
  label,
  value,
  delta,
  icon,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: { value: number; suffix?: string };
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold text-foreground">{value}</div>
          {delta && (
            <div
              className={cx(
                "mt-1.5 num text-xs font-bold",
                delta.value > 0 ? "text-success" : delta.value < 0 ? "text-danger" : "text-muted-foreground",
              )}
            >
              {delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "—"} {Math.abs(delta.value)}
              {delta.suffix ?? "%"}
            </div>
          )}
        </div>
        {icon && (
          <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>{icon}</div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Tabs */

const TabsContext = createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <TabsContext.Provider value={{ value, setValue: onChange }}>{children}</TabsContext.Provider>;
}

export function TabList({ children }: { children: ReactNode }) {
  return (
    <div role="tablist" className="rail no-scrollbar border-b border-border">
      {children}
    </div>
  );
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab must be inside Tabs");
  const active = ctx.value === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(id)}
      className={cx(
        "-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors",
        active ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== id) return null;
  return <div role="tabpanel">{children}</div>;
}

/* ----------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center overflow-y-auto bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" aria-label="close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card shadow-[var(--shadow-overlay)] focus:outline-none sm:rounded-2xl",
          widths[size],
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-4">
          <h2 id={titleId} className="text-base font-extrabold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-border bg-card px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-card/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</div>}
      <p className="text-sm font-extrabold text-foreground">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Rating */

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs font-bold", className)}>
      <span aria-hidden className="text-amber-500">
        ★
      </span>
      <span className="num text-foreground">{value.toFixed(1)}</span>
      {count != null && <span className="num text-muted-foreground">({count})</span>}
    </span>
  );
}

/* ------------------------------------------------------------- Progress */

export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "warning" | "danger" }) {
  const colors = { accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cx("h-full rounded-full transition-all", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Toast */

interface ToastMessage {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<{ push: (text: string, tone?: Tone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([]);

  const push = (text: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3600);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 start-1/2 z-200 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2 rtl:translate-x-1/2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              "pointer-events-auto rounded-xl px-4 py-3 text-sm font-bold shadow-[var(--shadow-overlay)]",
              t.tone === "danger" ? "bg-danger text-white" : t.tone === "warning" ? "bg-warning text-white" : "bg-primary text-primary-foreground",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* --------------------------------------------------------------- Sparkline */

/** Inline trend line. Purely decorative — the numbers carry the meaning. */
export function Sparkline({
  points,
  className,
  tone = "accent",
}: {
  points: number[];
  className?: string;
  tone?: "accent" | "success" | "danger";
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${28 - ((p - min) / span) * 26}`)
    .join(" ");
  const stroke = tone === "success" ? "var(--color-success)" : tone === "danger" ? "var(--color-danger)" : "var(--color-accent)";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cx("h-8 w-full", className)} aria-hidden>
      <polyline points={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
