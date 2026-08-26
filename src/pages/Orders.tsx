import { useState } from "react";
import { Package } from "lucide-react";
import { Link } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, orders } from "../platform/api";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/StatusBadge";
import { Button, Card, EmptyState, Select } from "../ui";
import RequireAuth from "./RequireAuth";
import type { OrderStatus } from "../platform/types";

const statuses: (OrderStatus | "all")[] = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

function OrdersInner() {
  const { d, t, n, money, date } = useI18n();
  useDatabase();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const user = auth.currentUser();
  const company = auth.currentCompany();

  const list = user?.role === "supplier" && company
    ? orders.forSupplier(company.id.replace("co-", ""))
    : user?.role === "admin"
      ? orders.all()
      : company
        ? orders.forBuyer(company.id)
        : [];

  const filtered = filter === "all" ? list : list.filter((o) => o.status === filter);

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.nav.orders)}</h1>
          <p className="num mt-1 text-sm text-muted-foreground">{n(filtered.length)}</p>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | "all")} className="h-9 w-auto text-xs">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t(d.common.all) : t(d.order.statuses[s])}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={t(d.order.noOrders)}
          action={
            <Link to="/search">
              <Button>{t(d.action.continueShopping)}</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <Link key={o.id} to={`/order/${o.id}`}>
              <Card className="p-5 transition-all hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-sm font-extrabold text-foreground">{o.reference}</span>
                      <OrderStatusBadge status={o.status} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {date(o.createdAt)} · <span className="num">{n(o.lines.length)}</span> {t(d.order.items)}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5">
                      {o.lines.slice(0, 5).map((l, i) => {
                        const emoji = l.productName.en.slice(0, 1);
                        return (
                          <span key={i} className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                            {emoji}
                          </span>
                        );
                      })}
                      {o.lines.length > 5 && <span className="num text-[11px] text-muted-foreground">+{o.lines.length - 5}</span>}
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="num text-lg font-extrabold text-foreground">{money(o.total, o.currency)}</div>
                    {o.trackingNumber && (
                      <div className="num mt-1 text-[11px] text-muted-foreground">{o.carrier} · {o.trackingNumber}</div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}
