import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { cart, catalog } from "../platform/api";
import { tierSavingPct, unitLabel } from "../platform/pricing";
import { ProductThumb } from "../components/ProductCard";
import { Badge, Button, Card, EmptyState, Input } from "../ui";

export default function CartPage() {
  const { d, t, n, money } = useI18n();
  const { navigate } = useRouter();
  useDatabase();

  const lines = cart.detailed();
  const totals = cart.totals();

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
        <div className="space-y-3">
          {lines.map(({ line, product, price, total }) => {
            const belowMoq = line.qty < product.moq;
            const supplier = catalog.supplierCompany(product.supplierId);
            const saving = tierSavingPct(product, line.qty);
            const step = Math.max(1, Math.round(product.moq / 4));

            return (
              <Card key={product.id} className="p-4">
                <div className="flex gap-4">
                  <Link to={`/product/${product.id}`} className="shrink-0">
                    <ProductThumb product={product} className="h-24 w-24 text-3xl" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/product/${product.id}`} className="line-clamp-2 text-sm font-bold text-foreground hover:text-accent">
                          {t(product.name)}
                        </Link>
                        {supplier && (
                          <Link to={`/supplier/${product.supplierId}`} className="mt-1 block truncate text-[11px] font-semibold text-muted-foreground hover:text-accent">
                            {t(supplier.name)}
                          </Link>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.remove(product.id)}
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
                          onClick={() => cart.setQty(product.id, Math.max(0, line.qty - step))}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border hover:bg-muted"
                          aria-label="decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <Input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) => cart.setQty(product.id, Math.max(1, Number(e.target.value) || 1))}
                          className="num h-9 w-20 text-center text-xs font-extrabold"
                        />
                        <button
                          type="button"
                          onClick={() => cart.setQty(product.id, line.qty + step)}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border hover:bg-muted"
                          aria-label="increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="ms-1 text-[11px] text-muted-foreground">{unitLabel(product.unit, "en")}</span>
                      </div>

                      <div className="text-end">
                        <div className="num text-base font-extrabold text-foreground">{money(total)}</div>
                        <div className="num text-[11px] text-muted-foreground">
                          {money(price)} {t(d.common.perUnit)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {belowMoq && (
                        <Badge tone="danger">
                          {t(d.cart.belowMoq)} <span className="num">{n(product.moq)}</span>
                        </Badge>
                      )}
                      {saving > 0 && (
                        <Badge tone="success">
                          {t(d.product.youSave)} <span className="num">{n(saving)}%</span>
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
            <Button variant="ghost" onClick={() => cart.clear()}>
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

            <Button fullWidth size="lg" className="mt-5" onClick={() => navigate("/checkout")}>
              {t(d.action.checkout)}
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
