import { useState } from "react";
import { AlertTriangle, FileText, Handshake, Package, TrendingUp, Users, Wallet } from "lucide-react";
import { Link } from "../../app/router";
import { useDatabase } from "../../app/usePlatform";
import { useI18n } from "../../i18n";
import { auth, catalog, negotiation, orders, rfq } from "../../platform/api";
import { supplierPerformance, supplierRankings } from "../../platform/intelligence";
import { BarList } from "../../components/LineChart";
import { AvailabilityBadge } from "../../components/ProductCard";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Progress, Select, Stat, Tab, TabList, TabPanel, Tabs, useToast } from "../../ui";
import RequireAuth from "../RequireAuth";
import type { Availability } from "../../platform/types";

function SupplierInner() {
  const { d, t, n, money, date } = useI18n();
  const toast = useToast();
  useDatabase();

  const company = auth.currentCompany()!;
  const supplierId = company.id.replace("co-", "");
  const supplier = catalog.supplier(supplierId);
  const perf = supplierPerformance(supplierId);
  const ranking = supplierRankings().find((r) => r.supplierId === supplierId);

  const products = catalog.search({ supplierId });
  const supplierOrders = orders.forSupplier(supplierId).slice(0, 8);
  const invitedRfqs = rfq.forSupplier(supplierId).filter((r) => ["open", "quoted"].includes(r.status));
  const activeNegotiations = negotiation.forSupplier(supplierId).filter((x) => x.status === "active");

  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState(0);
  const [priceDraft, setPriceDraft] = useState(0);
  const [availabilityDraft, setAvailabilityDraft] = useState<Availability>("in_stock");

  const openEdit = (productId: string) => {
    const p = catalog.product(productId);
    if (!p) return;
    setStockDraft(p.stock);
    setPriceDraft(p.tiers[0].price);
    setAvailabilityDraft(p.availability);
    setEditing(productId);
  };

  const saveEdit = () => {
    if (!editing) return;
    const p = catalog.product(editing);
    if (!p) return;
    // Shift the whole ladder by the same ratio so tier discounts stay intact.
    const ratio = p.tiers[0].price ? priceDraft / p.tiers[0].price : 1;
    catalog.updateProduct(editing, {
      stock: stockDraft,
      availability: availabilityDraft,
      tiers: p.tiers.map((tier) => ({ ...tier, price: Math.round(tier.price * ratio * 100) / 100 })),
    });
    setEditing(null);
    toast.push(t(d.action.save));
  };

  return (
    <div className="container-x py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.dashboard.supplier)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(company.name)}</p>
        </div>
        <Link to={`/supplier/${supplierId}`}>
          <Button variant="outline" size="sm">{t(d.action.view)}</Button>
        </Link>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t(d.dashboard.revenue)} value={<span className="num">{money(perf.revenue)}</span>} icon={<Wallet className="h-5 w-5" />} tone="success" />
        <Stat label={t(d.dashboard.orderCount)} value={<span className="num">{n(perf.orderCount)}</span>} icon={<Package className="h-5 w-5" />} tone="accent" />
        <Stat label={t(d.dashboard.avgOrderValue)} value={<span className="num">{money(perf.avgOrderValue)}</span>} icon={<TrendingUp className="h-5 w-5" />} tone="info" />
        <Stat label={t(d.dashboard.buyerCount)} value={<span className="num">{n(perf.buyerCount)}</span>} icon={<Users className="h-5 w-5" />} tone="warning" />
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="overview">{t(d.nav.dashboard)}</Tab>
          <Tab id="products">{t(d.dashboard.myProducts)} ({n(products.length)})</Tab>
          <Tab id="orders">{t(d.nav.orders)} ({n(supplierOrders.length)})</Tab>
          <Tab id="rfq">{t(d.nav.rfq)} ({n(invitedRfqs.length)})</Tab>
        </TabList>

        <div className="pt-6">
          <TabPanel id="overview">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader title={t(d.dashboard.monthlyRevenue)} />
                  <div className="p-5">
                    {perf.monthly.length ? (
                      <BarList items={perf.monthly.slice(-8).map((m) => ({ label: m.month, value: m.value }))} formatValue={(v) => money(Math.round(v))} />
                    ) : (
                      <p className="text-xs text-muted-foreground">{t(d.order.noOrders)}</p>
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title={t(d.dashboard.topProducts)} />
                  <div className="p-5">
                    {perf.topProducts.length ? (
                      <BarList
                        items={perf.topProducts.map((p) => ({
                          label: t(catalog.product(p.productId)?.name ?? { ar: p.productId, en: p.productId }),
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
                {supplier && ranking && (
                  <Card>
                    <CardHeader title={t(d.supplier.performance)} />
                    <div className="space-y-4 p-5">
                      {[
                        { label: d.supplier.onTime, pct: supplier.onTimeRate * 100, display: `${Math.round(supplier.onTimeRate * 100)}%`, tone: "success" as const },
                        { label: d.supplier.rating, pct: (supplier.rating / 5) * 100, display: supplier.rating.toFixed(1), tone: "accent" as const },
                        { label: d.intelligence.competitiveness, pct: Math.max(0, Math.min(100, 50 + ranking.competitivenessPct * 2)), display: `${ranking.competitivenessPct}%`, tone: "warning" as const },
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
                )}

                <Card>
                  <CardHeader title={t(d.dashboard.lowStock)} />
                  <ul className="divide-y divide-border p-5 pt-0">
                    {perf.lowStock.slice(0, 6).map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5 py-3 first:pt-5">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                        <Link to={`/product/${p.id}`} className="min-w-0 flex-1 truncate text-xs font-bold text-foreground hover:text-accent">
                          {t(p.name)}
                        </Link>
                        <span className="num shrink-0 text-[11px] font-extrabold text-muted-foreground">{n(p.stock)}</span>
                      </li>
                    ))}
                    {!perf.lowStock.length && <li className="py-5 text-xs text-muted-foreground">{t(d.common.none)}</li>}
                  </ul>
                </Card>

                <Card>
                  <CardHeader title={t(d.nav.negotiations)} action={<Link to="/negotiations" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>} />
                  <ul className="divide-y divide-border p-5 pt-0">
                    {activeNegotiations.slice(0, 5).map((x) => {
                      const product = catalog.product(x.productId);
                      const last = x.rounds[x.rounds.length - 1];
                      return (
                        <li key={x.id} className="py-3 first:pt-5">
                          <Link to="/negotiations" className="flex items-center gap-2.5 hover:opacity-80">
                            <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                              {product ? t(product.name) : x.reference}
                            </span>
                            <span className="num shrink-0 text-xs font-extrabold text-accent">{money(last.terms.unitPrice)}</span>
                          </Link>
                        </li>
                      );
                    })}
                    {!activeNegotiations.length && <li className="py-5 text-xs text-muted-foreground">{t(d.negotiation.noNegotiations)}</li>}
                  </ul>
                </Card>
              </aside>
            </div>
          </TabPanel>

          <TabPanel id="products">
            <Card>
              <CardHeader title={t(d.dashboard.inventory)} />
              <div className="overflow-x-auto p-5">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                      <th className="pb-2.5 text-start">{t(d.supplier.products)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.unitPrice)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.moq)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.stock)}</th>
                      <th className="pb-2.5 text-start">{t(d.search.availability)}</th>
                      <th className="pb-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3">
                          <Link to={`/product/${p.id}`} className="flex items-center gap-2.5 hover:text-accent">
                            <span className="text-lg">{p.image}</span>
                            <span className="min-w-0 truncate text-xs font-bold text-foreground">{t(p.name)}</span>
                          </Link>
                        </td>
                        <td className="num py-3 font-extrabold text-foreground">{money(p.tiers[0].price)}</td>
                        <td className="num py-3 text-muted-foreground">{n(p.moq)}</td>
                        <td className="num py-3 text-muted-foreground">{n(p.stock)}</td>
                        <td className="py-3"><AvailabilityBadge product={p} /></td>
                        <td className="py-3">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p.id)}>{t(d.action.edit)}</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!products.length && <EmptyState title={t(d.search.noResults)} />}
              </div>
            </Card>
          </TabPanel>

          <TabPanel id="orders">
            <Card>
              <CardHeader title={t(d.dashboard.recentOrders)} action={<Link to="/orders" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>} />
              <ul className="divide-y divide-border p-5 pt-0">
                {supplierOrders.map((o) => (
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
                {!supplierOrders.length && <li className="py-5"><EmptyState title={t(d.order.noOrders)} /></li>}
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
                      <Badge tone={rfq.quotesFor(r.id).some((q) => q.supplierId === supplierId) ? "success" : "warning"}>
                        {rfq.quotesFor(r.id).some((q) => q.supplierId === supplierId) ? t(d.rfq.statuses.quoted) : t(d.rfq.submitQuote)}
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

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t(d.action.edit)}
        size="sm"
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={() => setEditing(null)}>{t(d.action.cancel)}</Button>
            <Button fullWidth onClick={saveEdit}>{t(d.action.save)}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label={t(d.product.unitPrice)} hint={t({ ar: "يُعاد حساب سلّم الأسعار بالنسبة نفسها", en: "The tier ladder rescales by the same ratio" })}>
            <Input type="number" min={0} step="0.01" value={priceDraft} onChange={(e) => setPriceDraft(Number(e.target.value))} className="num" />
          </Field>
          <Field label={t(d.product.stock)}>
            <Input type="number" min={0} value={stockDraft} onChange={(e) => setStockDraft(Number(e.target.value))} className="num" />
          </Field>
          <Field label={t(d.search.availability)}>
            <Select value={availabilityDraft} onChange={(e) => setAvailabilityDraft(e.target.value as Availability)}>
              {(["in_stock", "low_stock", "made_to_order", "out_of_stock"] as Availability[]).map((a) => (
                <option key={a} value={a}>{t(d.product.availability[a])}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default function SupplierDashboard() {
  return (
    <RequireAuth roles={["supplier", "admin"]}>
      <SupplierInner />
    </RequireAuth>
  );
}
