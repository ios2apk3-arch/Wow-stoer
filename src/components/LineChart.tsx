import { useI18n } from "../i18n";
import { cx } from "../ui";

export interface Series {
  label: string;
  points: { x: string; y: number }[];
  color: string;
  dashed?: boolean;
  band?: { low: number; high: number }[];
}

/**
 * Inline SVG line chart. No charting library: the shapes here are simple
 * enough that hand-drawn paths stay smaller and fully themeable.
 */
export function LineChart({
  series,
  height = 240,
  formatValue,
  className,
}: {
  series: Series[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const { date, n } = useI18n();
  const all = series.flatMap((s) => [
    ...s.points.map((p) => p.y),
    ...(s.band?.flatMap((b) => [b.low, b.high]) ?? []),
  ]);
  if (!all.length) return null;

  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.1 || 1;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const count = Math.max(...series.map((s) => s.points.length));
  const W = 100;
  const H = 100;
  const scaleX = (i: number, total: number) => (total <= 1 ? 0 : (i / (total - 1)) * W);
  const scaleY = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  const fmt = formatValue ?? ((v: number) => n(Math.round(v)));
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);

  // X labels: first, middle and last point of the longest series.
  const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]);
  const labelIdx = [0, Math.floor(longest.points.length / 2), longest.points.length - 1];

  return (
    <div className={cx("w-full", className)}>
      <div className="flex gap-3">
        <div className="flex shrink-0 flex-col-reverse justify-between py-1 text-[10px] font-semibold text-muted-foreground" style={{ height }}>
          {gridValues.map((v, i) => (
            <span key={i} className="num leading-none">{fmt(v)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img">
            {gridValues.map((v, i) => (
              <line
                key={i}
                x1="0"
                x2={W}
                y1={scaleY(v)}
                y2={scaleY(v)}
                stroke="var(--color-border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {series.map((s, si) => {
              const total = s.points.length;
              const line = s.points.map((p, i) => `${scaleX(i, total)},${scaleY(p.y)}`).join(" ");
              const bandPath = s.band
                ? [
                    ...s.band.map((b, i) => `${i === 0 ? "M" : "L"}${scaleX(i, total)},${scaleY(b.high)}`),
                    ...[...s.band].reverse().map((b, i) => `L${scaleX(total - 1 - i, total)},${scaleY(b.low)}`),
                    "Z",
                  ].join(" ")
                : null;
              return (
                <g key={si}>
                  {bandPath && <path d={bandPath} fill={s.color} opacity="0.12" />}
                  <polyline
                    points={line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/*
          Forced LTR: an SVG always plots index 0 on the left, whatever the
          document direction, so an RTL-flipped label row would put the newest
          date under the oldest point.
        */}
        <div dir="ltr" className="mt-2 flex justify-between text-[10px] font-semibold text-muted-foreground">
          {labelIdx.map((i) => {
            const point = longest.points[i];
            return (
              <span key={i} className="num">
                {point ? date(point.x, { day: "numeric", month: "short" }) : ""}
              </span>
            );
          })}
        </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <span
              className="h-0.5 w-5 rounded-full"
              style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Simple horizontal bar list for share-style breakdowns. */
export function BarList({
  items,
  formatValue,
}: {
  items: { label: string; value: number; hint?: string }[];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-bold text-foreground">{item.label}</span>
            <span className="num shrink-0 font-extrabold text-foreground">{formatValue(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.hint && <div className="num mt-1 text-[10px] text-muted-foreground">{item.hint}</div>}
        </li>
      ))}
    </ul>
  );
}
