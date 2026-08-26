import { useMemo, useState } from "react";
import { Heart, MessageSquare, Minus, Package, Plus, Timer, TrendingDown, TrendingUp, Truck } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { ApiError } from "../platform/remote/http";
import { useFavorites } from "../platform/remote/useFavorites";
import { tierFor, tierSavingPct, unitLabel, unitPrice } from "../platform/pricing";
import { categoryById } from "../platform/data/catalog";
import { AvailabilityBadge, ProductCard, ProductThumb } from "../components/ProductCard";
import { VerificationBadge } from "../components/SupplierCard";
import { Badge, Button, Card, Field, Input, Modal, Rating, Sparkline, Textarea, cx, useToast } from "../ui";
import NotFound from "./NotFound";

export default function ProductPage({ id }: { id: string }) {
  const { d, t, n, money, date, locale } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();

  const { data, loading, error } = useApiQuery((signal) => api.catalog.product(id, signal), [id]);
  const similarQuery = useApiQuery(
    (signal) =>
      api.catalog.products({ category: data?.product.categoryId, perPage: 6 }, signal),
    [data?.product.categoryId],
    { enabled: Boolean(data?.product.categoryId) },
  );

  const [qtyOverride, setQtyOverride] = useState<number | null>(null);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState(0);
  const [negotiateMessage, setNegotiateMessage] = useState("");
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const [addingToCart, setAddingToCart] = useState(false);

  const product = data?.product ?? null;
  // Default the quantity to the MOQ, but never fight the user once they type.
  const qty = qtyOverride ?? product?.moq ?? 1;
  const setQty = (next: number | ((prev: number) => number)) =>
    setQtyOverride((prev) => {
      const current = prev ?? product?.moq ?? 1;
      return Math.max(1, typeof next === "function" ? next(current) : next);
    });

  const series = useMemo(() => {
    const points = data?.priceHistory ?? [];
    if (points.length < 4) return null;
    const prices = points.map((p) => p.avgPrice);
    const at = (weeksBack: number) => prices[Math.max(0, prices.length - 1 - weeksBack)];
    const current = prices[prices.length - 1];
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + (b - avg) ** 2, 0) / prices.length;
    const pct = (from: number, to: number) => (from ? Math.round(((to - from) / from) * 1000) / 10 : 0);
    return {
      points,
      current,
      min: Math.min(...prices),
      max: Math.max(...prices),
      changeMonthPct: pct(at(4), current),
      changeQuarterPct: pct(at(13), current),
      volatility: Math.round((Math.sqrt(variance) / avg) * 1000) / 10,
    };
  }, [data?.priceHistory]);

  if (loading && !product) {
    return (
      <div className="container-x py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="h-[32rem] animate-pulse rounded-2xl border border-border bg-muted/50" />
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-muted/50" />
        </div>
      </div>
    );
  }
  if (error?.isNotFound || (!loading && !product)) return <NotFound />;
  if (!product) return <NotFound />;

  const company = product.supplier;
  const supplier = { rating: product.supplier.rating };
  const price = unitPrice(product, qty);
  const activeTier = tierFor(product, qty);
  const saving = tierSavingPct(product, qty);
  const belowMoq = qty < product.moq;
  const user = auth.currentUser();
  const [busy, setBusy] = useState(false);

  const similar = (similarQuery.data?.items ?? []).filter((p) => p.id !== product.id).slice(0, 5);

  const openNegotiation = async () => {
    if (!auth.currentCompany()) {
      navigate("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await api.negotiations.start({
        productId: product.id,
        unitPrice: targetPrice || Math.round(price * 0.9 * 100) / 100,
        qty,
        moq: product.moq,
        shippingCost: 0,
        shippingTerms: "DDP",
        paymentTerms: "net_30",
        message: negotiateMessage,
      });
      setNegotiateOpen(false);
      toast.push(t(d.negotiation.title));
      navigate("/negotiations");
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : t(d.common.error), "danger");
    } finally {
      setBusy(false);
    }
  };

  const messageSupplier = async () => {
    if (!auth.currentCompany()) {
      navigate("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const thread = await api.messaging.open(
        product.supplierId,
        locale === "ar" ? `استفسار عن ${product.name.ar}` : `Enquiry about ${product.name.en}`,
      );
      navigate(`/messages?thread=${thread.id}`);
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : t(d.common.error), "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x py-8">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link to="/search" className="hover:text-accent">{t(d.nav.marketplace)}</Link>
        <span>/</span>
        <Link to={`/search?category=${product.categoryId}`} className="hover:text-accent">
          {t(categoryById(product.categoryId)?.name ?? { ar: "", en: "" })}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-[18rem_1fr]">
            <ProductThumb product={product} className="aspect-square w-full text-7xl" />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <AvailabilityBadge product={product} />
                <Badge tone="neutral">{product.brand}</Badge>
                {product.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} tone="accent">{tag}</Badge>
                ))}
              </div>

              <h1 className="mt-3 text-2xl font-extrabold leading-snug text-foreground">{t(product.name)}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Rating value={product.rating} count={product.reviewCount} />
                <span className="num text-xs text-muted-foreground">
                  {n(product.soldUnits)} {t(d.supplier.fulfilled)}
                </span>
              </div>

              <Link
                to={`/supplier/${product.supplierId}`}
                className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-accent"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{company.logo}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold text-foreground">{t(company.name)}</span>
                  <span className="num block text-[11px] text-muted-foreground">★ {company.rating.toFixed(1)}</span>
                </span>
                <VerificationBadge status={company.verification} />
              </Link>

              <dl className="mt-5 grid grid-cols-2 gap-4">
                {[
                  { icon: Package, label: d.product.moq, value: `${n(product.moq)} ${unitLabel(product.unit, "en")}` },
                  { icon: Timer, label: d.product.leadTime, value: `${n(product.leadTimeDays)} ${t(d.product.days)}` },
                  { icon: Truck, label: d.product.origin, value: product.originCountry },
                  { icon: Package, label: d.product.stock, value: n(product.stock) },
                ].map(({ icon: Icon, label, value }, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-muted-foreground">{t(label)}</dt>
                      <dd className="num truncate text-sm font-extrabold text-foreground">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Price ladder */}
          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.product.priceLadder)}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-96 text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-[11px] font-bold text-muted-foreground">
                    <th className="pb-2 text-start">{t(d.product.quantity)}</th>
                    <th className="pb-2 text-start">{t(d.product.unitPrice)}</th>
                    <th className="pb-2 text-start">{t(d.product.youSave)}</th>
                  </tr>
                </thead>
                <tbody>
                  {product.tiers.map((tier, i) => {
                    const next = product.tiers[i + 1];
                    const active = tier.minQty === activeTier.minQty;
                    const savePct = Math.round(((product.tiers[0].price - tier.price) / product.tiers[0].price) * 1000) / 10;
                    return (
                      <tr key={tier.minQty} className={cx("border-b border-border/60 last:border-0", active && "bg-accent-soft/60")}>
                        <td className="num py-2.5 font-semibold text-foreground">
                          {n(tier.minQty)}{next ? ` – ${n(next.minQty - 1)}` : "+"}
                        </td>
                        <td className="num py-2.5 font-extrabold text-foreground">{money(tier.price)}</td>
                        <td className="num py-2.5 font-semibold text-success">{savePct > 0 ? `${savePct}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Price history */}
          {series && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-sm font-extrabold text-foreground">{t(d.product.priceHistory)}</h2>
                <span className={cx("num inline-flex items-center gap-1 text-xs font-extrabold", series.changeMonthPct >= 0 ? "text-danger" : "text-success")}>
                  {series.changeMonthPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {series.changeMonthPct >= 0 ? "+" : ""}{n(series.changeMonthPct)}% · {t(d.intelligence.changeMonth)}
                </span>
              </div>
              <Sparkline
                points={series.points.map((p) => p.avgPrice)}
                tone={series.changeMonthPct >= 0 ? "danger" : "success"}
                className="mt-4 h-20"
              />
              <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
                {[
                  { label: d.intelligence.range26w, value: `${money(series.min)} – ${money(series.max)}` },
                  { label: d.intelligence.volatility, value: `${n(series.volatility)}%` },
                  { label: d.intelligence.changeQuarter, value: `${series.changeQuarterPct >= 0 ? "+" : ""}${n(series.changeQuarterPct)}%` },
                ].map((s, i) => (
                  <div key={i}>
                    <dt className="text-[11px] font-semibold text-muted-foreground">{t(s.label)}</dt>
                    <dd className="num mt-1 text-xs font-extrabold text-foreground">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.product.description)}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(product.description)}</p>

            <h3 className="mt-6 text-sm font-extrabold text-foreground">{t(d.product.specs)}</h3>
            <dl className="mt-3 divide-y divide-border">
              {product.specs.map((spec, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-xs font-semibold text-muted-foreground">{t(spec.label)}</dt>
                  <dd className="text-xs font-extrabold text-foreground">{t(spec.value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        {/* Purchase panel */}
        <aside>
          <Card className="sticky top-32 p-5">
            <div className="num text-3xl font-extrabold text-foreground">{money(price)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(d.common.perUnit)} · {unitLabel(product.unit, "en")}
            </p>
            {saving > 0 && (
              <Badge tone="success" className="mt-2">
                {t(d.product.youSave)} <span className="num">{n(saving)}%</span>
              </Badge>
            )}

            <div className="mt-5">
              <Field label={t(d.product.quantity)} error={belowMoq ? `${t(d.cart.belowMoq)} (${n(product.moq)})` : undefined}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - Math.max(1, Math.round(product.moq / 4))))}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border hover:bg-muted"
                    aria-label="decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="num text-center font-extrabold"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + Math.max(1, Math.round(product.moq / 4)))}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border hover:bg-muted"
                    aria-label="increase"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs font-semibold text-muted-foreground">{t(d.product.total)}</span>
              <span className="num text-xl font-extrabold text-foreground">{money(price * qty)}</span>
            </div>

            <div className="mt-5 space-y-2.5">
              <Button
                fullWidth
                size="lg"
                disabled={belowMoq || product.availability === "out_of_stock" || addingToCart}
                onClick={async () => {
                  setAddingToCart(true);
                  try {
                    await api.cart.add(product.id, qty);
                    toast.push(t(d.action.addToCart));
                  } catch (err) {
                    toast.push(err instanceof Error ? err.message : t(d.common.signInRequired), "danger");
                  } finally {
                    setAddingToCart(false);
                  }
                }}
              >
                {t(d.action.addToCart)}
              </Button>
              <Button
                fullWidth
                variant="outline"
                onClick={() => navigate(`/rfq/new?product=${product.id}&qty=${qty}`)}
              >
                {t(d.action.requestQuote)}
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setTargetPrice(Math.round(price * 0.9 * 100) / 100);
                    setNegotiateOpen(true);
                  }}
                >
                  {t(d.action.negotiate)}
                </Button>
                <Button variant="ghost" onClick={() => void messageSupplier()}>
                  <MessageSquare className="h-4 w-4" />
                  {t(d.action.message)}
                </Button>
              </div>
              <Button variant="ghost" fullWidth onClick={() => void toggleFavorite(product.id)}>
                <Heart className={cx("h-4 w-4", isFavorite(product.id) && "fill-danger text-danger")} />
                {t(d.dashboard.favorites)}
              </Button>
            </div>

            <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(d.supplier.rating)}</dt>
                <dd className="num font-extrabold text-foreground">{supplier.rating.toFixed(1)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(d.product.leadTime)}</dt>
                <dd className="num font-extrabold text-foreground">{n(product.leadTimeDays)} {t(d.product.days)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(d.product.stock)}</dt>
                <dd className="num font-extrabold text-foreground">{n(product.stock)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-extrabold text-foreground">{t(d.product.similar)}</h2>
          <div className="rail">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      )}

      <Modal
        open={negotiateOpen}
        onClose={() => setNegotiateOpen(false)}
        title={t(d.action.negotiate)}
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={() => setNegotiateOpen(false)}>{t(d.action.cancel)}</Button>
            <Button fullWidth disabled={busy} onClick={() => void openNegotiation()}>{t(d.action.submit)}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(product.name)} · {t(d.product.unitPrice)} <span className="num font-extrabold text-foreground">{money(price)}</span>
          </p>
          <Field label={t(d.rfq.targetPrice)} hint={t(d.common.sar)}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="num"
            />
          </Field>
          <Field label={t(d.product.quantity)}>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="num" />
          </Field>
          <Field label={t(d.rfq.notes)}>
            <Textarea
              value={negotiateMessage}
              onChange={(e) => setNegotiateMessage(e.target.value)}
              placeholder={t(d.messages.placeholder)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
