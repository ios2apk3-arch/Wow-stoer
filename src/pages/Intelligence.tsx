import { useState } from "react";
import { Activity, Globe2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { BarList, LineChart } from "../components/LineChart";
import { Badge, Card, CardHeader, Progress, Rating, Select, Stat, cx } from "../ui";

export default function IntelligencePage() {
  const { d, t, n, money } = useI18n();

  const indicesQuery = useApiQuery((signal) => api.intelligence.categories(signal), []);
  const alertsQuery = useApiQuery((signal) => api.intelligence.alerts(signal), []);
  const trendingQuery = useApiQuery((signal) => api.intelligence.trending(signal), []);
  const rankingsQuery = useApiQuery((signal) => api.intelligence.suppliers(signal), []);
  const regionsQuery = useApiQuery((signal) => api.intelligence.regions(signal), []);
  const productsQuery = useApiQuery((signal) => api.catalog.products({ sort: "popular", perPage: 40 }, signal), []);

  const indices = indicesQuery.data?.categories ?? [];
  const alerts = alertsQuery.data?.alerts ?? [];
  const trending = trendingQuery.data?.trending ?? [];
  const rankings = (rankingsQuery.data?.suppliers ?? []).slice(0, 8);
  const regions = regionsQuery.data?.regions ?? [];
  const products = productsQuery.data?.items ?? [];

  const [selected, setSelected] = useState("");
  const focusId = selected || products[0]?.id || "";
  const focus = products.find((p) => p.id === focusId) ?? null;

  const focusQuery = useApiQuery(
    (signal) => api.intelligence.forecast(focusId, signal),
    [focusId],
    { enabled: Boolean(focusId) },
  );
  const focusSeries = focusQuery.data?.priceSummary ?? null;
  const focusHistory = focusQuery.data?.forecast.history ?? [];

  const avgChange = indices.length
    ? Math.round((indices.reduce((s, i) => s + i.changeMonthPct, 0) / indices.length) * 10) / 10
    : 0;

  return (
    <div className="container-x py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.intelligence.title)}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t(d.intelligence.subtitle)}</p>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t(d.intelligence.changeMonth)}
          value={<span className="num">{avgChange >= 0 ? "+" : ""}{n(avgChange)}%</span>}
          delta={{ value: avgChange }}
          icon={<Activity className="h-5 w-5" />}
          tone={avgChange >= 0 ? "danger" : "success"}
        />
        <Stat label={t(d.nav.categories)} value={<span className="num">{n(indices.length)}</span>} icon={<Globe2 className="h-5 w-5" />} tone="accent" />
        <Stat label={t(d.intelligence.priceAlerts)} value={<span className="num">{n(alerts.length)}</span>} icon={<TrendingUp className="h-5 w-5" />} tone="warning" />
        <Stat label={t(d.nav.suppliers)} value={<span className="num">{n(rankings.length)}</span>} icon={<Trophy className="h-5 w-5" />} tone="success" />
      </div>

      {/* Focus chart */}
      <Card className="mb-6">
        <CardHeader
          title={t(d.intelligence.demandIndex)}
          subtitle={focus ? t(focus.name) : ""}
          action={
            <Select value={focusId} onChange={(e) => setSelected(e.target.value)} className="h-9 w-48 text-xs">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{t(p.name)}</option>
              ))}
            </Select>
          }
        />
        <div className="p-5">
          {focusSeries && focusHistory.length ? (
            <>
              <LineChart
                series={[
                  {
                    label: t(d.product.priceHistory),
                    color: "var(--color-accent)",
                    points: focusHistory.map((h, i) => ({
                      x: h.date,
                      y: focusQuery.data!.forecast.history[i].volume,
                    })),
                  },
                ]}
                formatValue={(v) => n(Math.round(v))}
              />
              <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-4">
                {[
                  { label: d.product.unitPrice, value: money(focusSeries.current) },
                  { label: d.intelligence.changeMonth, value: `${focusSeries.changeMonthPct >= 0 ? "+" : ""}${n(focusSeries.changeMonthPct)}%`, tone: focusSeries.changeMonthPct >= 0 ? "text-danger" : "text-success" },
                  { label: d.intelligence.changeQuarter, value: `${focusSeries.changeQuarterPct >= 0 ? "+" : ""}${n(focusSeries.changeQuarterPct)}%`, tone: focusSeries.changeQuarterPct >= 0 ? "text-danger" : "text-success" },
                  { label: d.intelligence.volatility, value: `${n(focusSeries.volatility)}%` },
                ].map((row, i) => (
                  <div key={i}>
                    <dt className="text-[11px] font-semibold text-muted-foreground">{t(row.label)}</dt>
                    <dd className={cx("num mt-1 text-lg font-extrabold", row.tone ?? "text-foreground")}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {focusQuery.loading ? t(d.common.loading) : t(d.search.noResults)}
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category index */}
        <Card>
          <CardHeader title={t(d.intelligence.priceIndex)} />
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                  <th className="pb-2.5 text-start">{t(d.nav.categories)}</th>
                  <th className="pb-2.5 text-start">{t(d.product.unitPrice)}</th>
                  <th className="pb-2.5 text-start">{t(d.intelligence.changeMonth)}</th>
                  <th className="pb-2.5 text-start">{t(d.intelligence.demandIndex)}</th>
                </tr>
              </thead>
              <tbody>
                {indices.map((idx) => (
                  <tr key={idx.categoryId} className="border-b border-border/60 last:border-0">
                    <td className="py-3">
                      <Link to={`/search?category=${idx.categoryId}`} className="flex items-center gap-2 hover:text-accent">
                        <span>{idx.icon}</span>
                        <span className="text-xs font-extrabold text-foreground">{t(idx.name)}</span>
                      </Link>
                    </td>
                    <td className="num py-3 font-bold text-foreground">{money(idx.avgPrice)}</td>
                    <td className={cx("num py-3 font-extrabold", idx.changeMonthPct >= 0 ? "text-danger" : "text-success")}>
                      {idx.changeMonthPct >= 0 ? "+" : ""}{n(idx.changeMonthPct)}%
                    </td>
                    <td className="num py-3 text-muted-foreground">{n(idx.demandIndex)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Supplier rankings */}
        <Card>
          <CardHeader title={t(d.intelligence.topSuppliers)} />
          <ul className="divide-y divide-border p-5 pt-0">
            {rankings.map((r, i) => (
              <li key={r.supplierId} className="flex items-center gap-3 py-3.5 first:pt-5">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-extrabold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/supplier/${r.supplierId}`} className="block truncate text-xs font-extrabold text-foreground hover:text-accent">
                    {t(r.name)}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Rating value={r.rating} />
                    <span className="num text-[10px] text-muted-foreground">
                      {t(d.supplier.onTime)} {Math.round(r.onTimeRate * 100)}%
                    </span>
                    <span className={cx("num text-[10px] font-bold", r.competitivenessPct >= 0 ? "text-success" : "text-danger")}>
                      {t(d.intelligence.competitiveness)} {r.competitivenessPct >= 0 ? "+" : ""}{n(r.competitivenessPct)}%
                    </span>
                  </div>
                </div>
                <div className="w-16 shrink-0">
                  <Progress value={Math.min(100, r.score)} tone="success" />
                  <div className="num mt-1 text-end text-[10px] font-extrabold text-muted-foreground">{n(r.score)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Price alerts */}
        <Card>
          <CardHeader title={t(d.intelligence.priceAlerts)} />
          <ul className="divide-y divide-border p-5 pt-0">
            {alerts.map((a) => (
              <li key={a.productId} className="flex items-center gap-3 py-3 first:pt-5">
                <span className="text-xl">{a.image}</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${a.productId}`} className="block truncate text-xs font-bold text-foreground hover:text-accent">
                    {t(a.name)}
                  </Link>
                  <span className="num text-[10px] text-muted-foreground">
                    {money(a.previous)} → {money(a.current)}
                  </span>
                </div>
                <Badge tone={a.direction === "up" ? "danger" : "success"}>
                  {a.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span className="num">{a.changePct >= 0 ? "+" : ""}{n(a.changePct)}%</span>
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Trending + regions */}
        <div className="space-y-6">
          <Card>
            <CardHeader title={t(d.intelligence.trendingProducts)} />
            <ul className="divide-y divide-border p-5 pt-0">
              {trending.map((tp) => (
                <li key={tp.productId} className="flex items-center gap-3 py-3 first:pt-5">
                  <span className="text-xl">{tp.image}</span>
                  <Link to={`/product/${tp.productId}`} className="min-w-0 flex-1 truncate text-xs font-bold text-foreground hover:text-accent">
                    {t(tp.name)}
                  </Link>
                  <span className="num text-xs font-extrabold text-success">▲ {n(tp.demandGrowthPct)}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t(d.intelligence.regionDemand)} />
            <div className="p-5">
              <BarList
                items={regions.map((r) => ({
                  label: t(r.name),
                  value: r.value,
                  hint: `${n(r.orderCount)} ${t(d.nav.orders)} · ${t(d.intelligence.marketShare)} ${n(r.share)}%`,
                }))}
                formatValue={(v) => money(Math.round(v))}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
