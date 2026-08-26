import { Check, CreditCard, Download, Truck, X } from "lucide-react";
import { useState } from "react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/StatusBadge";
import { Button, Card, cx, useToast } from "../ui";
import NotFound from "./NotFound";
import RequireAuth from "./RequireAuth";
import type { OrderStatus } from "../platform/types";

const flow: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

function OrderInner({ id }: { id: string }) {
  const { d, t, n, money, date } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const { data: order, loading, error, refetch } = useApiQuery((signal) => api.orders.get(id, signal), [id]);
  const user = auth.currentUser();

  if (loading && !order) {
    return (
      <div className="container-x py-8">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-muted/50" />
      </div>
    );
  }
  if (error?.isNotFound || error?.isForbidden || !order) return <NotFound />;

  const canFulfil = user?.role === "supplier" || user?.role === "admin";
  const stageIndex = flow.indexOf(order.status as OrderStatus);
  const cancelled = order.status === "cancelled";

  /** Re-add every line to the cart; the server reprices each one. */
  const reorder = async () => {
    setBusy(true);
    try {
      for (const line of order.lines) {
        if (line.productId) await api.cart.add(line.productId, line.qty);
      }
      toast.push(t(d.action.reorder));
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t(d.common.signInRequired), "danger");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>, label: string) => {
    setBusy(true);
    try {
      await action();
      refetch();
      toast.push(label);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : label, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x py-8">
      <nav className="mb-5 text-xs font-semibold text-muted-foreground">
        <Link to="/orders" className="hover:text-accent">{t(d.nav.orders)}</Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="num text-2xl font-extrabold text-foreground">{order.reference}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {date(order.createdAt, { day: "numeric", month: "long", year: "numeric" })}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void reorder()}>
            {t(d.action.reorder)}
          </Button>
          {canFulfil && !cancelled && order.status !== "delivered" && (
            <Button size="sm" disabled={busy} onClick={() => void runAction(() => api.orders.advance(order.id), t(d.action.advance))}>
              {t(d.action.advance)}
            </Button>
          )}
          {!cancelled && ["pending", "confirmed"].includes(order.status) && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void runAction(() => api.orders.cancel(order.id), t(d.order.statuses.cancelled))}>
              {t(d.action.cancel)}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {/* Timeline */}
          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.order.timeline)}</h2>
            {cancelled ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-danger-soft p-4">
                <X className="h-5 w-5 text-danger" />
                <div>
                  <div className="text-sm font-extrabold text-danger">{t(d.order.statuses.cancelled)}</div>
                  <div className="text-[11px] text-muted-foreground">{date((order.timeline?.[order.timeline.length - 1]?.at ?? order.createdAt))}</div>
                </div>
              </div>
            ) : (
              <ol className="mt-6 flex items-start justify-between gap-1">
                {flow.map((stage, i) => {
                  const done = i <= stageIndex;
                  const event = order.timeline?.find((e) => e.status === stage);
                  return (
                    <li key={stage} className="relative flex flex-1 flex-col items-center text-center">
                      {i > 0 && (
                        <span
                          className={cx(
                            "absolute top-4 h-0.5 w-full -translate-x-1/2 rtl:translate-x-1/2",
                            i <= stageIndex ? "bg-accent" : "bg-border",
                          )}
                          style={{ insetInlineEnd: "50%" }}
                        />
                      )}
                      <span
                        className={cx(
                          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold",
                          done ? "border-accent bg-accent text-white" : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className={cx("mt-2 text-[10px] font-bold leading-tight", done ? "text-foreground" : "text-muted-foreground")}>
                        {t(d.order.statuses[stage])}
                      </span>
                      {event && <span className="mt-0.5 text-[9px] text-muted-foreground">{date(event.at, { day: "numeric", month: "short" })}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* Lines */}
          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.order.items)}</h2>
            <ul className="mt-4 divide-y divide-border">
              {order.lines.map((line, i) => (
                <li key={i} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <Link to={`/product/${line.productId}`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                    📦
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${line.productId}`} className="line-clamp-1 text-sm font-bold text-foreground hover:text-accent">
                      {t(line.name)}
                    </Link>
                    <p className="num mt-0.5 text-[11px] text-muted-foreground">
                      {n(line.qty)} {line.unit} × {money(line.unitPrice, order.currency)}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-extrabold text-foreground">
                    {money(line.qty * line.unitPrice, order.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {order.trackingNumber && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <Truck className="h-4 w-4 text-accent" />
                {t(d.action.track)}
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  { label: d.order.carrier, value: order.carrier ?? "—" },
                  { label: d.order.tracking, value: order.trackingNumber },
                  { label: d.order.eta, value: `${n(order.etaDays)} ${t(d.product.days)}` },
                ].map((row, i) => (
                  <div key={i}>
                    <dt className="text-[11px] font-semibold text-muted-foreground">{t(row.label)}</dt>
                    <dd className="num mt-1 text-sm font-extrabold text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.order.invoice)}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                { label: d.cart.subtotal, value: order.subtotal },
                { label: d.cart.shipping, value: order.shipping },
                { label: d.cart.tax, value: order.tax },
              ].map((row, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t(row.label)}</dt>
                  <dd className="num font-bold text-foreground">{money(row.value, order.currency)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="font-extrabold text-foreground">{t(d.cart.total)}</dt>
                <dd className="num text-lg font-extrabold text-foreground">{money(order.total, order.currency)}</dd>
              </div>
            </dl>
            <Button
              variant="outline"
              fullWidth
              size="sm"
              className="mt-4"
              onClick={() => window.print()}
            >
              <Download className="h-4 w-4" />
              {t(d.order.invoice)}
            </Button>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <CreditCard className="h-4 w-4 text-accent" />
              {t(d.checkout.paymentMethod)}
            </h2>
            <p className="mt-3 text-xs font-bold text-foreground">
              {order.paymentMethod in d.checkout.payment
                ? t(d.checkout.payment[order.paymentMethod as keyof typeof d.checkout.payment])
                : order.paymentMethod}
            </p>
            <div className="mt-2.5">
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </Card>

        </aside>
      </div>
    </div>
  );
}

export default function OrderPage({ id }: { id: string }) {
  return (
    <RequireAuth>
      <OrderInner id={id} />
    </RequireAuth>
  );
}
