import { useState } from "react";
import { AlertTriangle, FileText, Handshake, Package, TrendingUp, Users, Wallet } from "lucide-react";
import { Link } from "../../app/router";
import { useI18n } from "../../i18n";
import { auth } from "../../platform/api";
import { api } from "../../platform/remote/endpoints";
import { useApiQuery } from "../../platform/remote/useApi";
import { BarList } from "../../components/LineChart";
import { AvailabilityBadge } from "../../components/ProductCard";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { Badge, Button, Card, CardHeader, EmptyState, Progress, Stat, Tab, TabList, TabPanel, Tabs } from "../../ui";
import RequireAuth from "../RequireAuth";

function SupplierInner() {
  const { d, t, n, money, date } = useI18n();
  const company = auth.currentCompany();
  const supplierId = company?.id ?? "";
  const [tab, setTab] = useState("overview");

  const analytics = useApiQuery((signal) => api.analytics.supplier(signal), []);
  const products = useApiQuery(
    (signal) => api.catalog.products({ supplier: supplierId, perPage: 50 }, signal),
    [supplierId],
    { enabled: Boolean(supplierId) },
  );
  const orders = useApiQuery((signal) => api.orders.list({ perPage: 8 }, signal), []);
  const rfqs = useApiQuery((signal) => api.rfq.list({ perPage: 20 }, signal), []);
  const negotiations = useApiQuery((signal) => api.negotiations.list({ status: "active", perPage: 5 }, signal), []);

  const a = analytics.data;
  const invitedRfqs = (rfqs.data?.items ?? []).filter((r) => ["open", "quoted"].includes(r.status));

  return (
    <div className="container-x py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.dashboard.supplier)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{company ? t(company.name) : ""}</p>
        </div>
        {supplierId && (
          <Link to={`/supplier/${supplierId}`}>
            <Button variant="outline" size="sm">{t(d.action.view)}</Button>
          </Link>
        )}
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t(d.dashboard.revenue)} value={<span className="num">{money(a?.revenue ?? 0)}</span>} icon={<Wallet className="h-5 w-5" />} tone="success" />
        <Stat label={t(d.dashboard.orderCount)} value={<span className="num">{n(a?.orderCount ?? 0)}</span>} icon={<Package className="h-5 w-5" />} tone="accent" />
        <Stat label={t(d.dashboard.avgOrderValue)} value={<span className="num">{money(a?.avgOrderValue ?? 0)}</span>} icon={<TrendingUp className="h-5 w-5" />} tone="info" />
        <Stat label={t(d.dashboard.buyerCount)} value={<span className="num">{n(a?.buyerCount ?? 0)}</span>} icon={<Users className="h-5 w-5" />} tone="warning" />
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="overview">{t(d.nav.dashboard)}</Tab>
          <Tab id="products">{t(d.dashboard.myProducts)} ({n(a?.productCount ?? 0)})</Tab>
          <Tab id="orders">{t(d.nav.orders)} ({n(orders.data?.total ?? 0)})</Tab>
          <Tab id="rfq">{t(d.nav.rfq)} ({n(invitedRfqs.length)})</Tab>
        </TabList>

        <div className="pt-6">
          <TabPanel id="overview">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader title={t(d.dashboard.monthlyRevenue)} />
                  <div className="p-5">
                    {a?.monthly.length ? (
                      <BarList items={a.monthly.slice(-8).map((m) => ({ label: m.month, value: m.value }))} formatValue={(v) => money(Math.round(v))} />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {analytics.loading ? t(d.common.loading) : t(d.order.noOrders)}
                      </p>
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title={t(d.dashboard.topProducts)} />
                  <div className="p-5">
                    {a?.topProducts.length ? (
                      <BarList
                        items={a.topProducts.map((p) => ({
                          label: t(p.name),
                          value: p.value,
                          hint: `${n(p.qty)} ${t(d.product.quantity)}`,
                        }))}
                        formatValue={(v) => money(Math.round(v))}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">{t(d.order.noOrders)}</p>
                    )}
                  </div>
                </Card>
              </div>

              <aside className="space-y-6">
                <Card>
                  <CardHeader title={t(d.supplier.performance)} />
                  <div className="space-y-4 p-5">
                    {[
                      { label: d.supplier.onTime, pct: (a?.onTimeRate ?? 0) * 100, display: `${Math.round((a?.onTimeRate ?? 0) * 100)}%`, tone: "success" as const },
                      { label: d.supplier.rating, pct: ((a?.rating ?? 0) / 5) * 100, display: (a?.rating ?? 0).toFixed(1), tone: "accent" as const },
                    ].map((row, i) => (
                      <div key={i}>
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="font-semibold text-muted-foreground">{t(row.label)}</span>
                          <span className="num font-extrabold text-foreground">{row.display}</span>
                        </div>
                        <Progress value={row.pct} tone={row.tone} />
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader title={t(d.dashboard.lowStock)} />
                  <ul className="divide-y divide-border p-5 pt-0">
                    {(a?.lowStock ?? []).map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5 py-3 first:pt-5">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                        <Link to={`/product/${p.id}`} className="min-w-0 flex-1 truncate text-xs font-bold text-foreground hover:text-accent">
                          {t(p.name)}
                        </Link>
                        <span className="num shrink-0 text-[11px] font-extrabold text-muted-foreground">{n(p.stock)}</span>
                      </li>
                    ))}
                    {!a?.lowStock.length && <li className="py-5 text-xs text-muted-foreground">{t(d.common.none)}</li>}
                  </ul>
                </Card>

                <Card>
                  <CardHeader title={t(d.nav.negotiations)} action={<Link to="/negotiations" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>} />
                  <ul className="divide-y divide-border p-5 pt-0">
                    {(negotiations.data?.items ?? []).map((x) => {
                      const last = x.rounds[x.rounds.length - 1];
                      return (
                        <li key={x.id} className="py-3 first:pt-5">
                          <Link to="/negotiations" className="flex items-center gap-2.5 hover:opacity-80">
                            <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="num min-w-0 flex-1 truncate text-xs font-bold text-foreground">{x.reference}</span>
                            <span className="num shrink-0 text-xs font-extrabold text-accent">{money(last?.terms.unitPrice ?? 0)}</span>
                          </Link>
                        </li>
                      );
                    })}
                    {!negotiations.data?.items.length && (
                      <li className="py-5 text-xs text-muted-foreground">{t(d.negotiation.noNegotiations)}</li>
                    )}
                  </ul>
                </Card>
              </aside>
            </div>
          </TabPanel>

          <TabPanel id="products">
            <Card>
              <CardHeader title={t(d.dashboard.inventory)} />
              <div className="overflow-x-auto p-5">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                      <th className="pb-2.5 text-start">{t(d.supplier.products)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.unitPrice)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.moq)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.stock)}</th>
                      <th className="pb-2.5 text-start">{t(d.search.availability)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(products.data?.items ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3">
                          <Link to={`/product/${p.id}`} className="flex items-center gap-2.5 hover:text-accent">
                            <span className="text-lg">{p.image}</span>
                            <span className="min-w-0 truncate text-xs font-bold text-foreground">{t(p.name)}</span>
                          </Link>
                        </td>
                        <td className="num py-3 font-extrabold text-foreground">{money(p.entryPrice)}</td>
                        <td className="num py-3 text-muted-foreground">{n(p.moq)}</td>
                        <td className="num py-3 text-muted-foreground">{n(p.stock)}</td>
                        <td className="py-3"><AvailabilityBadge product={p} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!products.data?.items.length && <EmptyState title={t(d.search.noResults)} />}
              </div>
            </Card>
          </TabPanel>

          <TabPanel id="orders">
            <Card>
              <CardHeader title={t(d.dashboard.recentOrders)} action={<Link to="/orders" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>} />
              <ul className="divide-y divide-border p-5 pt-0">
                {(orders.data?.items ?? []).map((o) => (
                  <li key={o.id} className="py-3.5 first:pt-5">
                    <Link to={`/order/${o.id}`} className="flex flex-wrap items-center gap-3 hover:opacity-80">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-xs font-extrabold text-foreground">{o.reference}</span>
                          <OrderStatusBadge status={o.status} />
                        </div>
                        <span className="num mt-1 block text-[11px] text-muted-foreground">{date(o.createdAt)}</span>
                      </div>
                      <span className="num shrink-0 text-sm font-extrabold text-foreground">{money(o.total, o.currency)}</span>
                    </Link>
                  </li>
                ))}
                {!orders.data?.items.length && <li className="py-5"><EmptyState title={t(d.order.noOrders)} /></li>}
              </ul>
            </Card>
          </TabPanel>

          <TabPanel id="rfq">
            <Card>
              <CardHeader title={t(d.rfq.title)} />
              <ul className="divide-y divide-border p-5 pt-0">
                {invitedRfqs.map((r) => (
                  <li key={r.id} className="py-3.5 first:pt-5">
                    <Link to={`/rfq/${r.id}`} className="flex flex-wrap items-center gap-3 hover:opacity-80">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-extrabold text-foreground">{t(r.title)}</span>
                        <span className="num block text-[11px] text-muted-foreground">
                          {n(r.qty)} {r.unit} · {r.deliveryCity} · {t(d.rfq.neededBy)} {date(r.neededBy)}
                        </span>
                      </div>
                      <Badge tone={r.status === "quoted" ? "success" : "warning"}>
                        {t(d.rfq.statuses[r.status])}
                      </Badge>
                    </Link>
                  </li>
                ))}
                {!invitedRfqs.length && <li className="py-5"><EmptyState title={t(d.rfq.noRfqs)} /></li>}
              </ul>
            </Card>
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}

export default function SupplierDashboard() {
  return (
    <RequireAuth roles={["supplier"]}>
      <SupplierInner />
    </RequireAuth>
  );
}
