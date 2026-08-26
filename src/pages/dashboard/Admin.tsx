import { useState } from "react";
import { Check, FileText, Package, ShieldCheck, Users, Wallet, X } from "lucide-react";
import { Link } from "../../app/router";
import { useDatabase } from "../../app/usePlatform";
import { useI18n } from "../../i18n";
import { admin, catalog, orders } from "../../platform/api";
import { categoryIndices, regionDemand } from "../../platform/intelligence";
import { store } from "../../platform/store";
import { countries } from "../../platform/data/catalog";
import { BarList } from "../../components/LineChart";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { VerificationBadge } from "../../components/SupplierCard";
import { Badge, Button, Card, CardHeader, EmptyState, Stat, Tab, TabList, TabPanel, Tabs, useToast } from "../../ui";
import RequireAuth from "../RequireAuth";

function AdminInner() {
  const { d, t, n, money, date, relative } = useI18n();
  const toast = useToast();
  useDatabase();

  const stats = admin.stats();
  const companies = admin.companies();
  const users = admin.users();
  const audit = admin.audit();
  const regions = regionDemand();
  const indices = categoryIndices();
  const [tab, setTab] = useState("overview");

  const pending = companies.filter((c) => c.verification === "pending");
  const recentOrders = orders.all().slice(0, 10);

  return (
    <div className="container-x py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.dashboard.admin)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(d.dashboard.platformActivity)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            store.clear();
            toast.push(t(d.action.resetDemoData));
          }}
        >
          {t(d.action.resetDemoData)}
        </Button>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t(d.dashboard.gmv)} value={<span className="num">{money(stats.gmv)}</span>} icon={<Wallet className="h-5 w-5" />} tone="success" />
        <Stat label={t(d.dashboard.orderCount)} value={<span className="num">{n(stats.orders)}</span>} icon={<Package className="h-5 w-5" />} tone="accent" />
        <Stat label={t(d.auth.roles.buyer)} value={<span className="num">{n(users.length)}</span>} icon={<Users className="h-5 w-5" />} tone="info" />
        <Stat label={t(d.dashboard.pendingVerification)} value={<span className="num">{n(stats.pendingVerification)}</span>} icon={<ShieldCheck className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t(d.supplier.products)} value={<span className="num">{n(stats.products)}</span>} />
        <Stat label={t(d.nav.suppliers)} value={<span className="num">{n(stats.suppliers)}</span>} />
        <Stat label={t(d.nav.rfq)} value={<span className="num">{n(stats.openRfqs)}</span>} />
        <Stat label={t(d.nav.negotiations)} value={<span className="num">{n(stats.activeNegotiations)}</span>} />
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="overview">{t(d.dashboard.platformActivity)}</Tab>
          <Tab id="verification">{t(d.dashboard.verification)} ({n(pending.length)})</Tab>
          <Tab id="companies">{t(d.profile.companyInfo)} ({n(companies.length)})</Tab>
          <Tab id="audit">{t(d.dashboard.auditLog)}</Tab>
        </TabList>

        <div className="pt-6">
          <TabPanel id="overview">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title={t(d.dashboard.recentOrders)} />
                <ul className="divide-y divide-border p-5 pt-0">
                  {recentOrders.map((o) => {
                    const buyer = companies.find((c) => c.id === o.buyerCompanyId);
                    return (
                      <li key={o.id} className="py-3 first:pt-5">
                        <Link to={`/order/${o.id}`} className="flex items-center gap-3 hover:opacity-80">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="num text-xs font-extrabold text-foreground">{o.reference}</span>
                              <OrderStatusBadge status={o.status} />
                            </div>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {buyer ? t(buyer.name) : o.buyerCompanyId} · {date(o.createdAt)}
                            </span>
                          </div>
                          <span className="num shrink-0 text-sm font-extrabold text-foreground">{money(o.total, o.currency)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader title={t(d.intelligence.regionDemand)} />
                  <div className="p-5">
                    <BarList
                      items={regions.map((r) => ({
                        label: t(countries.find((c) => c.code === r.countryCode)?.name ?? { ar: r.countryCode, en: r.countryCode }),
                        value: r.value,
                        hint: `${n(r.orderCount)} ${t(d.nav.orders)}`,
                      }))}
                      formatValue={(v) => money(Math.round(v))}
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader title={t(d.intelligence.priceIndex)} />
                  <div className="p-5">
                    <BarList
                      items={indices.map((i) => ({
                        label: `${i.category.icon} ${t(i.category.name)}`,
                        value: i.demandIndex,
                        hint: `${n(i.productCount)} ${t(d.supplier.products)} · ${i.changeMonthPct >= 0 ? "+" : ""}${n(i.changeMonthPct)}%`,
                      }))}
                      formatValue={(v) => n(Math.round(v))}
                    />
                  </div>
                </Card>
              </div>
            </div>
          </TabPanel>

          <TabPanel id="verification">
            <Card>
              <CardHeader title={t(d.dashboard.verification)} />
              <div className="p-5">
                {pending.length === 0 ? (
                  <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={t(d.common.none)} />
                ) : (
                  <ul className="divide-y divide-border">
                    {pending.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-xl">{c.logo}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-extrabold text-foreground">{t(c.name)}</div>
                          <div className="num text-[11px] text-muted-foreground">
                            {c.city}, {c.countryCode} · {c.taxId || "—"} · {c.email}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => {
                              admin.setVerification(c.id, "verified");
                              toast.push(t(d.supplier.verified));
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {t(d.action.confirm)}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              admin.setVerification(c.id, "rejected");
                              toast.push(t(d.supplier.rejected), "warning");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            {t(d.action.reject)}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </TabPanel>

          <TabPanel id="companies">
            <Card>
              <CardHeader title={t(d.profile.companyInfo)} />
              <div className="overflow-x-auto p-5">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                      <th className="pb-2.5 text-start">{t(d.auth.companyName)}</th>
                      <th className="pb-2.5 text-start">{t(d.auth.country)}</th>
                      <th className="pb-2.5 text-start">{t(d.profile.verification)}</th>
                      <th className="pb-2.5 text-start">{t(d.profile.memberSince)}</th>
                      <th className="pb-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => {
                      const isSupplier = catalog.supplier(c.id.replace("co-", "")) !== null;
                      return (
                        <tr key={c.id} className="border-b border-border/60 last:border-0">
                          <td className="py-3">
                            <span className="flex items-center gap-2.5">
                              <span className="text-lg">{c.logo}</span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-extrabold text-foreground">{t(c.name)}</span>
                                <Badge tone={isSupplier ? "accent" : "neutral"}>
                                  {t(isSupplier ? d.auth.roles.supplier : d.auth.roles.buyer)}
                                </Badge>
                              </span>
                            </span>
                          </td>
                          <td className="num py-3 text-muted-foreground">{c.city}, {c.countryCode}</td>
                          <td className="py-3"><VerificationBadge status={c.verification} /></td>
                          <td className="num py-3 text-muted-foreground">{date(c.memberSince, { month: "short", year: "numeric" })}</td>
                          <td className="py-3">
                            {isSupplier && (
                              <Link to={`/supplier/${c.id.replace("co-", "")}`}>
                                <Button size="sm" variant="ghost">{t(d.action.view)}</Button>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabPanel>

          <TabPanel id="audit">
            <Card>
              <CardHeader title={t(d.dashboard.auditLog)} />
              <div className="p-5">
                {audit.length === 0 ? (
                  <EmptyState icon={<FileText className="h-6 w-6" />} title={t(d.common.none)} />
                ) : (
                  <ul className="divide-y divide-border">
                    {audit.slice(0, 40).map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="num rounded-lg bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
                          {entry.action}
                        </span>
                        <span className="num min-w-0 flex-1 truncate text-xs text-foreground">{entry.target}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{relative(entry.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <RequireAuth roles={["admin"]}>
      <AdminInner />
    </RequireAuth>
  );
}
