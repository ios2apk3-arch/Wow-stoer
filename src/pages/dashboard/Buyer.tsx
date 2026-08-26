import { AlertTriangle, FileText, Handshake, Package, Wallet } from "lucide-react";
import { Link } from "../../app/router";
import { useI18n } from "../../i18n";
import { auth } from "../../platform/api";
import { api } from "../../platform/remote/endpoints";
import { useApiQuery } from "../../platform/remote/useApi";
import { BarList } from "../../components/LineChart";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { Badge, Button, Card, CardHeader, EmptyState, Stat, useToast } from "../../ui";
import RequireAuth from "../RequireAuth";

function BuyerInner() {
  const { d, t, n, money, date } = useI18n();
  const toast = useToast();
  const company = auth.currentCompany();

  const analytics = useApiQuery((signal) => api.analytics.buyer(signal), []);
  const reorders = useApiQuery((signal) => api.analytics.reorders(signal), []);
  const orders = useApiQuery((signal) => api.orders.list({ perPage: 6 }, signal), []);
  const rfqs = useApiQuery((signal) => api.rfq.list({ perPage: 5 }, signal), []);
  const negotiations = useApiQuery((signal) => api.negotiations.list({ status: "active", perPage: 5 }, signal), []);

  const a = analytics.data;
  const loading = analytics.loading && !a;

  return (
    <div className="container-x py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.dashboard.buyer)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{company ? t(company.name) : ""}</p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t(d.dashboard.totalSpend)} value={<span className="num">{money(a?.totalSpend ?? 0)}</span>} icon={<Wallet className="h-5 w-5" />} tone="accent" />
          <Stat label={t(d.dashboard.orderCount)} value={<span className="num">{n(a?.orderCount ?? 0)}</span>} icon={<Package className="h-5 w-5" />} tone="info" />
          <Stat label={t(d.dashboard.avgOrderValue)} value={<span className="num">{money(a?.avgOrderValue ?? 0)}</span>} tone="success" />
          <Stat label={t(d.dashboard.supplierCount)} value={<span className="num">{n(a?.supplierCount ?? 0)}</span>} tone="warning" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={t(d.dashboard.recentOrders)}
              action={<Link to="/orders" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>}
            />
            {orders.data?.items.length ? (
              <ul className="divide-y divide-border p-5 pt-0">
                {orders.data.items.map((o) => (
                  <li key={o.id} className="py-3.5 first:pt-5">
                    <Link to={`/order/${o.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-xs font-extrabold text-foreground">{o.reference}</span>
                          <OrderStatusBadge status={o.status} />
                        </div>
                        <span className="num mt-1 block text-[11px] text-muted-foreground">
                          {date(o.createdAt)} · {n(o.lines.length)} {t(d.order.items)}
                        </span>
                      </div>
                      <span className="num shrink-0 text-sm font-extrabold text-foreground">{money(o.total, o.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState title={t(d.order.noOrders)} action={<Link to="/search"><Button>{t(d.action.continueShopping)}</Button></Link>} />
              </div>
            )}
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader title={t(d.dashboard.monthlySpend)} />
              <div className="p-5">
                {a?.monthly.length ? (
                  <BarList items={a.monthly.slice(-6).map((m) => ({ label: m.month, value: m.value }))} formatValue={(v) => money(Math.round(v))} />
                ) : (
                  <p className="text-xs text-muted-foreground">{t(d.order.noOrders)}</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={t(d.dashboard.topCategories)} />
              <div className="p-5">
                {a?.topCategories.length ? (
                  <BarList
                    items={a.topCategories.map((c) => ({
                      label: t(c.name),
                      value: c.value,
                      hint: `${t(d.intelligence.marketShare)} ${n(c.share)}%`,
                    }))}
                    formatValue={(v) => money(Math.round(v))}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">{t(d.order.noOrders)}</p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={t(d.dashboard.reorderSuggestions)}
              action={<Link to="/forecasting" className="text-xs font-bold text-accent hover:underline">{t(d.nav.forecasting)}</Link>}
            />
            <div className="p-5">
              {reorders.data?.suggestions.length ? (
                <ul className="divide-y divide-border">
                  {reorders.data.suggestions.map((s) => (
                    <li key={s.productId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="text-xl">{s.image}</span>
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${s.productId}`} className="block truncate text-xs font-bold text-foreground hover:text-accent">
                          {t(s.name)}
                        </Link>
                        <span className="num text-[10px] text-muted-foreground">
                          ~{n(s.avgIntervalDays)} {t(d.product.days)}
                        </span>
                      </div>
                      <Badge tone={s.urgency === "overdue" ? "danger" : s.urgency === "soon" ? "warning" : "neutral"}>
                        {s.urgency === "overdue" && <AlertTriangle className="h-3 w-3" />}
                        {t(d.forecasting.urgency[s.urgency])}
                      </Badge>
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
              ) : (
                <p className="text-xs text-muted-foreground">
                  {reorders.loading ? t(d.common.loading) : t(d.order.noOrders)}
                </p>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={t(d.nav.rfq)} action={<Link to="/rfq/new"><Button size="sm">{t(d.rfq.new)}</Button></Link>} />
            <ul className="divide-y divide-border p-5 pt-0">
              {(rfqs.data?.items ?? []).slice(0, 5).map((r) => (
                <li key={r.id} className="py-3 first:pt-5">
                  <Link to={`/rfq/${r.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-foreground">{t(r.title)}</span>
                      <span className="num block text-[10px] text-muted-foreground">
                        {n(r.quoteCount ?? 0)} {t(d.rfq.quotesReceived)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {!rfqs.data?.items.length && <li className="py-5 text-xs text-muted-foreground">{t(d.rfq.noRfqs)}</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t(d.nav.negotiations)} action={<Link to="/negotiations" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>} />
            <ul className="divide-y divide-border p-5 pt-0">
              {(negotiations.data?.items ?? []).slice(0, 5).map((x) => {
                const last = x.rounds[x.rounds.length - 1];
                return (
                  <li key={x.id} className="py-3 first:pt-5">
                    <Link to="/negotiations" className="flex items-center gap-2.5 hover:opacity-80">
                      <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="num min-w-0 flex-1 truncate text-xs font-bold text-foreground">{x.reference}</span>
                      <span className="num shrink-0 text-xs font-extrabold text-accent">
                        {money(last?.terms.unitPrice ?? 0)}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {!negotiations.data?.items.length && (
                <li className="py-5 text-xs text-muted-foreground">{t(d.negotiation.noNegotiations)}</li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t(d.dashboard.topSuppliers)} />
            <ul className="divide-y divide-border p-5 pt-0">
              {(a?.topSuppliers ?? []).map((s) => (
                <li key={s.supplierId} className="py-3 first:pt-5">
                  <Link to={`/supplier/${s.supplierId}`} className="flex items-center gap-2.5 hover:opacity-80">
                    <span className="text-lg">{s.logo || "🏢"}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{t(s.name)}</span>
                    <span className="num shrink-0 text-[11px] font-extrabold text-foreground">{money(s.value)}</span>
                  </Link>
                </li>
              ))}
              {!a?.topSuppliers.length && <li className="py-5 text-xs text-muted-foreground">{t(d.order.noOrders)}</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function BuyerDashboard() {
  return (
    <RequireAuth roles={["buyer"]}>
      <BuyerInner />
    </RequireAuth>
  );
}
