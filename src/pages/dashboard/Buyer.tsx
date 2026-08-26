import { AlertTriangle, FileText, Handshake, Heart, Package, Wallet } from "lucide-react";
import { Link } from "../../app/router";
import { useDatabase } from "../../app/usePlatform";
import { useI18n } from "../../i18n";
import { auth, cart, catalog, favorites, negotiation, orders, rfq } from "../../platform/api";
import { buyerSpend, reorderSuggestions } from "../../platform/intelligence";
import { BarList } from "../../components/LineChart";
import { ProductCard } from "../../components/ProductCard";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { Badge, Button, Card, CardHeader, EmptyState, Stat, useToast } from "../../ui";
import RequireAuth from "../RequireAuth";

function BuyerInner() {
  const { d, t, n, money, date } = useI18n();
  const toast = useToast();
  useDatabase();

  const company = auth.currentCompany()!;
  const spend = buyerSpend(company.id);
  const recent = orders.forBuyer(company.id).slice(0, 6);
  const openRfqs = rfq.forBuyer(company.id).filter((r) => ["open", "quoted"].includes(r.status));
  const activeNegotiations = negotiation.forBuyer(company.id).filter((x) => x.status === "active");
  const reorders = reorderSuggestions(company.id, 5);
  const favourites = favorites.list().map((id) => catalog.product(id)).filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="container-x py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.dashboard.buyer)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(company.name)}</p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t(d.dashboard.totalSpend)} value={<span className="num">{money(spend.totalSpend)}</span>} icon={<Wallet className="h-5 w-5" />} tone="accent" />
        <Stat label={t(d.dashboard.orderCount)} value={<span className="num">{n(spend.orderCount)}</span>} icon={<Package className="h-5 w-5" />} tone="info" />
        <Stat label={t(d.dashboard.avgOrderValue)} value={<span className="num">{money(spend.avgOrderValue)}</span>} tone="success" />
        <Stat label={t(d.dashboard.supplierCount)} value={<span className="num">{n(spend.supplierCount)}</span>} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={t(d.dashboard.recentOrders)}
              action={<Link to="/orders" className="text-xs font-bold text-accent hover:underline">{t(d.action.viewAll)}</Link>}
            />
            {recent.length === 0 ? (
              <div className="p-5">
                <EmptyState title={t(d.order.noOrders)} action={<Link to="/search"><Button>{t(d.action.continueShopping)}</Button></Link>} />
              </div>
            ) : (
              <ul className="divide-y divide-border p-5 pt-0">
                {recent.map((o) => (
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
            )}
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader title={t(d.dashboard.monthlySpend)} />
              <div className="p-5">
                {spend.monthly.length ? (
                  <BarList
                    items={spend.monthly.slice(-6).map((m) => ({ label: m.month, value: m.value }))}
                    formatValue={(v) => money(Math.round(v))}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">{t(d.order.noOrders)}</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={t(d.dashboard.topCategories)} />
              <div className="p-5">
                {spend.topCategories.length ? (
                  <BarList
                    items={spend.topCategories.map((c) => ({
                      label: t(catalog.categories().find((x) => x.id === c.categoryId)?.name ?? { ar: c.categoryId, en: c.categoryId }),
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
              {reorders.length ? (
                <ul className="divide-y divide-border">
                  {reorders.map((s) => (
                    <li key={s.product.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="text-xl">{s.product.image}</span>
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${s.product.id}`} className="block truncate text-xs font-bold text-foreground hover:text-accent">
                          {t(s.product.name)}
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
                        onClick={() => {
                          cart.add(s.product.id, s.suggestedQty);
                          toast.push(t(d.action.addToCart));
                        }}
                      >
                        {t(d.action.reorder)}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t(d.order.noOrders)}</p>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={t(d.nav.rfq)} action={<Link to="/rfq/new"><Button size="sm">{t(d.rfq.new)}</Button></Link>} />
            <ul className="divide-y divide-border p-5 pt-0">
              {openRfqs.slice(0, 5).map((r) => (
                <li key={r.id} className="py-3 first:pt-5">
                  <Link to={`/rfq/${r.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-foreground">{t(r.title)}</span>
                      <span className="num block text-[10px] text-muted-foreground">
                        {rfq.quotesFor(r.id).length} {t(d.rfq.quotesReceived)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {!openRfqs.length && <li className="py-5 text-xs text-muted-foreground">{t(d.rfq.noRfqs)}</li>}
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

          <Card>
            <CardHeader title={t(d.dashboard.topSuppliers)} />
            <ul className="divide-y divide-border p-5 pt-0">
              {spend.topSuppliers.map((s) => {
                const co = catalog.supplierCompany(s.supplierId);
                return (
                  <li key={s.supplierId} className="py-3 first:pt-5">
                    <Link to={`/supplier/${s.supplierId}`} className="flex items-center gap-2.5 hover:opacity-80">
                      <span className="text-lg">{co?.logo ?? "🏢"}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                        {co ? t(co.name) : s.supplierId}
                      </span>
                      <span className="num shrink-0 text-[11px] font-extrabold text-foreground">{money(s.value)}</span>
                    </Link>
                  </li>
                );
              })}
              {!spend.topSuppliers.length && <li className="py-5 text-xs text-muted-foreground">{t(d.order.noOrders)}</li>}
            </ul>
          </Card>
        </aside>
      </div>

      {favourites.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-extrabold text-foreground">
            <Heart className="h-5 w-5 text-danger" />
            {t(d.dashboard.favorites)}
          </h2>
          <div className="rail">
            {favourites.map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BuyerDashboard() {
  return (
    <RequireAuth roles={["buyer", "admin"]}>
      <BuyerInner />
    </RequireAuth>
  );
}
