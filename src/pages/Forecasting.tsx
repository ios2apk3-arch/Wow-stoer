import { useState } from "react";
import { AlertTriangle, CalendarClock, LineChart as LineIcon, TrendingUp } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { api } from "../platform/remote/endpoints";
import { useApiQuery, useSession } from "../platform/remote/useApi";
import { LineChart } from "../components/LineChart";
import { Badge, Button, Card, CardHeader, EmptyState, Progress, Select, Stat, useToast } from "../ui";

export default function ForecastingPage() {
  const { d, t, n, money, date } = useI18n();
  const toast = useToast();
  const session = useSession();
  const isBuyer = session?.user.role === "buyer";

  const productsQuery = useApiQuery((signal) => api.catalog.products({ sort: "popular", perPage: 40 }, signal), []);
  const products = productsQuery.data?.items ?? [];

  const [selected, setSelected] = useState("");
  const productId = selected || products[0]?.id || "";
  const product = products.find((p) => p.id === productId) ?? null;

  const forecastQuery = useApiQuery(
    (signal) => api.intelligence.forecast(productId, signal),
    [productId],
    { enabled: Boolean(productId) },
  );
  const forecast = forecastQuery.data?.forecast ?? null;

  const reordersQuery = useApiQuery(
    (signal) => api.analytics.reorders(signal),
    [session?.user.id],
    { enabled: isBuyer },
  );
  const reorders = reordersQuery.data?.suggestions ?? [];

  return (
    <div className="container-x py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.forecasting.title)}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t(d.forecasting.subtitle)}</p>
      </header>

      {forecast && product ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t(d.forecasting.nextMonth)}
              value={<span className="num">{n(forecast.nextMonthUnits)}</span>}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="accent"
            />
            <Stat
              label={t(d.forecasting.trend)}
              value={t(d.forecasting.directions[forecast.direction])}
              delta={{ value: forecast.trendPerWeek, suffix: "/w" }}
              icon={<LineIcon className="h-5 w-5" />}
              tone={forecast.direction === "rising" ? "success" : forecast.direction === "declining" ? "danger" : "neutral"}
            />
            <Stat
              label={t(d.forecasting.seasonality)}
              value={<span className="num">{n(forecast.seasonalStrength)}%</span>}
              icon={<CalendarClock className="h-5 w-5" />}
              tone="warning"
            />
            <Stat
              label={t(d.forecasting.priceOutlook)}
              value={<span className="num">{forecast.priceOutlookPct >= 0 ? "+" : ""}{n(forecast.priceOutlookPct)}%</span>}
              tone={forecast.priceOutlookPct >= 0 ? "danger" : "success"}
            />
          </div>

          <Card className="mb-6">
            <CardHeader
              title={t(d.forecasting.projected)}
              subtitle={t(product.name)}
              action={
                <Select value={productId} onChange={(e) => setSelected(e.target.value)} className="h-9 w-48 text-xs">
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{t(p.name)}</option>
                  ))}
                </Select>
              }
            />
            <div className="p-5">
              <LineChart
                height={280}
                series={[
                  {
                    label: t(d.forecasting.history),
                    color: "var(--color-accent)",
                    points: forecast.history.map((h) => ({ x: h.date, y: h.volume })),
                  },
                  {
                    label: t(d.forecasting.forecast),
                    color: "var(--color-success)",
                    dashed: true,
                    points: [
                      // Join the projection to the last actual point so the line is continuous.
                      { x: forecast.history[forecast.history.length - 1].date, y: forecast.history[forecast.history.length - 1].volume },
                      ...forecast.projection.map((p) => ({ x: p.date, y: p.volume })),
                    ],
                    band: [
                      {
                        low: forecast.history[forecast.history.length - 1].volume,
                        high: forecast.history[forecast.history.length - 1].volume,
                      },
                      ...forecast.projection.map((p) => ({ low: p.low, high: p.high })),
                    ],
                  },
                ]}
              />

              <div className="mt-6 border-t border-border pt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">{t(d.forecasting.confidence)}</span>
                  <span className="num font-extrabold text-foreground">{forecast.confidence}%</span>
                </div>
                <Progress
                  value={forecast.confidence}
                  tone={forecast.confidence >= 70 ? "success" : forecast.confidence >= 45 ? "accent" : "warning"}
                />
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {t({
                    ar: "النموذج يجمع بين اتجاه خطي وموسمية سنوية مقدَّرة من 26 أسبوعًا من البيانات. النطاق الظليل يمثل مجال الخطأ المتوقع، ويتسع كلما ابتعد الأفق الزمني.",
                    en: "The model combines a linear trend with an annual seasonal term fitted over 26 weeks of history. The shaded band is the expected error range, widening with the forecast horizon.",
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="mb-6">
            <CardHeader title={t(d.forecasting.projected)} subtitle={t(d.forecasting.forecast)} />
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                    <th className="pb-2.5 text-start">{t(d.order.date)}</th>
                    <th className="pb-2.5 text-start">{t(d.forecasting.projected)}</th>
                    <th className="pb-2.5 text-start">{t(d.common.from)}</th>
                    <th className="pb-2.5 text-start">{t(d.common.to)}</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.projection.map((p) => (
                    <tr key={p.date} className="border-b border-border/60 last:border-0">
                      <td className="num py-2.5 text-muted-foreground">{date(p.date)}</td>
                      <td className="num py-2.5 font-extrabold text-foreground">{n(p.volume)}</td>
                      <td className="num py-2.5 text-muted-foreground">{n(p.low)}</td>
                      <td className="num py-2.5 text-muted-foreground">{n(p.high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState title={forecastQuery.loading ? t(d.common.loading) : t(d.forecasting.selectProduct)} />
      )}

      <Card>
        <CardHeader title={t(d.dashboard.reorderSuggestions)} />
        <div className="p-5">
          {reorders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {!isBuyer
                ? t(d.common.signInRequiredHint)
                : reordersQuery.loading
                  ? t(d.common.loading)
                  : t(d.order.noOrders)}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {reorders.map((s) => (
                <li key={s.productId} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{s.image}</span>

                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${s.productId}`} className="block truncate text-sm font-bold text-foreground hover:text-accent">
                      {t(s.name)}
                    </Link>
                    <p className="num mt-0.5 text-[11px] text-muted-foreground">
                      {t(d.forecasting.trend)}: {t(d.dashboard.reorderSuggestions)} ~{n(s.avgIntervalDays)} {t(d.product.days)} · {n(s.daysSinceLast)} {t(d.product.days)}
                    </p>
                  </div>

                  <Badge
                    tone={s.urgency === "overdue" ? "danger" : s.urgency === "soon" ? "warning" : "neutral"}
                  >
                    {s.urgency === "overdue" && <AlertTriangle className="h-3 w-3" />}
                    {t(d.forecasting.urgency[s.urgency])}
                    {s.daysUntilReorder > 0 && <span className="num"> · {n(s.daysUntilReorder)}</span>}
                  </Badge>

                  <div className="text-end">
                    <div className="num text-xs font-extrabold text-foreground">{n(s.suggestedQty)}</div>
                    <div className="num text-[10px] text-muted-foreground">{t(d.product.quantity)}</div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api.cart.add(s.productId, s.suggestedQty);
                        toast.push(t(d.action.addToCart));
                      } catch (err) {
                        toast.push(err instanceof Error ? err.message : t(d.action.addToCart), "danger");
                      }
                    }}
                  >
                    {t(d.action.reorder)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
