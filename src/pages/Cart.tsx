import { useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useI18n } from "../i18n";
import { api } from "../platform/remote/endpoints";
import { useApiQuery, useSession } from "../platform/remote/useApi";
import { unitLabel } from "../platform/pricing";
import { Badge, Button, Card, EmptyState, Input, cx } from "../ui";
import type { RemoteCart } from "../platform/remote/endpoints";

export default function CartPage() {
  const { d, t, n, money } = useI18n();
  const { navigate } = useRouter();

  const session = useSession();
  // No point asking the server for a cart we know is unauthenticated.
  const { data, loading, error, refetch } = useApiQuery(
    (signal) => api.cart.get(signal),
    [session?.user.id],
    { enabled: Boolean(session) },
  );
  // Hold the server's answer locally so quantity edits feel immediate.
  const [override, setOverride] = useState<RemoteCart | null>(null);
  const [busy, setBusy] = useState(false);

  const cartData = override ?? data;
  const lines = cartData?.lines ?? [];
  const totals = cartData?.totals ?? { subtotal: 0, shipping: 0, tax: 0, total: 0 };

  /** Every mutation returns the recomputed cart, so the server stays the source of truth. */
  const mutate = async (action: () => Promise<RemoteCart>) => {
    setBusy(true);
    try {
      setOverride(await action());
    } catch {
      refetch();
    } finally {
      setBusy(false);
    }
  };

  if (!session || error?.isAuthError) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title={t(d.common.signInRequired)}
          hint={t(d.common.signInRequiredHint)}
          action={<Link to="/login"><Button>{t(d.action.signIn)}</Button></Link>}
        />
      </div>
    );
  }

  if (loading && !cartData) {
    return (
      <div className="container-x py-8">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-muted/50" />
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title={t(d.cart.empty)}
          hint={t(d.cart.emptyHint)}
          action={
            <Link to="/search">
              <Button>{t(d.action.continueShopping)}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-extrabold text-foreground">{t(d.cart.title)}</h1>
      <p className="num mt-1 text-sm text-muted-foreground">
        {n(lines.length)} {t(d.cart.items)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className={cx("space-y-3", busy && "opacity-70")}>
          {lines.map((line) => {
            const step = Math.max(1, Math.round(line.moq / 4));

            return (
              <Card key={line.productId} className="p-4">
                <div className="flex gap-4">
                  <Link to={`/product/${line.productId}`} className="shrink-0">
                    <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted text-3xl">
                      {line.image}
                    </span>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/product/${line.productId}`} className="line-clamp-2 text-sm font-bold text-foreground hover:text-accent">
                          {t(line.name)}
                        </Link>
                        <Link to={`/supplier/${line.supplierId}`} className="mt-1 block truncate text-[11px] font-semibold text-muted-foreground hover:text-accent">
                          {t(d.nav.suppliers)}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => void mutate(() => api.cart.remove(line.productId))}
                        aria-label={t(d.action.remove)}
                        className="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void mutate(() => api.cart.setQty(line.productId, Math.max(0, line.qty - step)))}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border hover:bg-muted"
                          aria-label="decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <Input
                          type="number"
                          min={1}
                          defaultValue={line.qty}
                          key={`${line.productId}-${line.qty}`}
                          onBlur={(e) => {
                            const next = Math.max(1, Number(e.target.value) || 1);
                            if (next !== line.qty) void mutate(() => api.cart.setQty(line.productId, next));
                          }}
                          className="num h-9 w-20 text-center text-xs font-extrabold"
                        />
                        <button
                          type="button"
                          onClick={() => void mutate(() => api.cart.setQty(line.productId, line.qty + step))}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border hover:bg-muted"
                          aria-label="increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="ms-1 text-[11px] text-muted-foreground">{unitLabel(line.unit, "en")}</span>
                      </div>

                      <div className="text-end">
                        <div className="num text-base font-extrabold text-foreground">{money(line.lineTotal)}</div>
                        <div className="num text-[11px] text-muted-foreground">
                          {money(line.unitPrice)} {t(d.common.perUnit)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {line.belowMoq && (
                        <Badge tone="danger">
                          {t(d.cart.belowMoq)} <span className="num">{n(line.moq)}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <div className="flex justify-between pt-2">
            <Link to="/search">
              <Button variant="ghost">{t(d.action.continueShopping)}</Button>
            </Link>
            <Button variant="ghost" onClick={() => void mutate(() => api.cart.clear())}>
              {t(d.action.clear)}
            </Button>
          </div>
        </div>

        <aside>
          <Card className="sticky top-32 p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.checkout.orderSummary)}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                { label: d.cart.subtotal, value: totals.subtotal },
                { label: d.cart.shipping, value: totals.shipping },
                { label: d.cart.tax, value: totals.tax },
              ].map((row, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t(row.label)}</dt>
                  <dd className="num font-bold text-foreground">{money(row.value)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="font-extrabold text-foreground">{t(d.cart.total)}</dt>
                <dd className="num text-lg font-extrabold text-foreground">{money(totals.total)}</dd>
              </div>
            </dl>

            <Button
              fullWidth
              size="lg"
              className="mt-5"
              disabled={busy || lines.some((l) => l.belowMoq)}
              onClick={() => navigate("/checkout")}
            >
              {t(d.action.checkout)}
            </Button>
            {lines.some((l) => l.belowMoq) && (
              <p className="mt-2 text-center text-[11px] font-semibold text-danger">{t(d.cart.belowMoq)}</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
