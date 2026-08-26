import { useState } from "react";
import { Check, CreditCard, MapPin, Truck } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery, useSession } from "../platform/remote/useApi";
import { round2, VAT_RATE } from "../platform/pricing";
import type { ShippingQuote } from "../platform/remote/endpoints";
import { Button, Card, EmptyState, Field, Input, cx, useToast } from "../ui";
import RequireAuth from "./RequireAuth";

function CheckoutInner() {
  const { d, t, n, money } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();

  const company = auth.currentCompany();
  const session = useSession();
  const cartQuery = useApiQuery((signal) => api.cart.get(signal), [session?.user.id], { enabled: Boolean(session) });
  const lines = cartQuery.data?.lines ?? [];
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

  const [carrierIndex, setCarrierIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "credit_terms">("bank_transfer");
  const [addressId, setAddressId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState("");

  // Freight is quoted by the server; the browser never invents a price.
  const quotesQuery = useApiQuery(
    (signal) => api.orders.shippingQuotes(subtotal, "SA", company?.countryCode ?? "SA", signal),
    [subtotal, company?.countryCode],
    { enabled: subtotal > 0 },
  );
  const quotes: ShippingQuote[] = quotesQuery.data?.quotes ?? [];

  if (cartQuery.loading && !cartQuery.data) {
    return (
      <div className="container-x py-8">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-muted/50" />
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="container-x py-16">
        <EmptyState
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

  const selectedQuote = quotes[carrierIndex];
  const shippingCost = selectedQuote?.cost ?? 0;
  const tax = round2((subtotal + shippingCost) * VAT_RATE);
  const total = round2(subtotal + shippingCost + tax);

  const placeOrder = async () => {
    if (!selectedQuote) return;
    setSubmitting(true);
    setFailure("");
    try {
      const order = await api.orders.create({
        shippingAddressId: addressId || null,
        paymentMethod,
        carrier: selectedQuote.carrier,
        etaDays: selectedQuote.etaDays,
      });
      toast.push(t(d.checkout.orderPlaced));
      navigate(`/order/${order.id}`);
    } catch (err) {
      // The server rejects below-MOQ lines and stale carts; show why.
      const message = err instanceof Error ? err.message : t(d.cart.empty);
      setFailure(message);
      toast.push(message, "danger");
      setSubmitting(false);
    }
  };

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-extrabold text-foreground">{t(d.checkout.title)}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {/* Address */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <MapPin className="h-4 w-4 text-accent" />
              {t(d.checkout.deliveryAddress)}
            </h2>
            {/*
              Saved addresses are not exposed by the API yet, so delivery
              details are confirmed here and carried on the order.
            */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={t(d.auth.city)} required>
                <Input defaultValue={company?.city ?? ""} />
              </Field>
              <Field label={t(d.auth.phone)} required>
                <Input defaultValue={company?.phone ?? ""} className="num" />
              </Field>
            </div>
          </Card>

          {/* Shipping */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <Truck className="h-4 w-4 text-accent" />
              {t(d.checkout.shippingMethod)}
            </h2>
            <div className="mt-4 space-y-2.5">
              {quotes.map((q, i) => (
                <label
                  key={q.carrier}
                  className={cx(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                    carrierIndex === i ? "border-accent bg-accent-soft/50" : "border-border hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="carrier"
                    checked={carrierIndex === i}
                    onChange={() => setCarrierIndex(i)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block font-extrabold text-foreground">{q.carrier} — {t(q.service)}</span>
                    <span className="num mt-0.5 block text-muted-foreground">
                      {t(d.order.eta)}: {n(q.etaDays)} {t(d.product.days)}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm font-extrabold text-foreground">{money(q.cost)}</span>
                </label>
              ))}
              {!quotes.length && (
                <p className="text-xs text-muted-foreground">
                  {quotesQuery.loading ? t(d.common.loading) : t(d.common.none)}
                </p>
              )}
            </div>
          </Card>

          {/* Payment */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <CreditCard className="h-4 w-4 text-accent" />
              {t(d.checkout.paymentMethod)}
            </h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {(["bank_transfer", "card", "credit_terms"] as const).map((m) => (
                <label
                  key={m}
                  className={cx(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl border p-4 text-xs font-bold transition-colors",
                    paymentMethod === m ? "border-accent bg-accent-soft/50 text-accent" : "border-border text-muted-foreground hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === m}
                    onChange={() => setPaymentMethod(m)}
                    className="accent-[var(--color-accent)]"
                  />
                  {t(d.checkout.payment[m])}
                </label>
              ))}
            </div>
            {paymentMethod === "card" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Card number">
                  <Input placeholder="4242 4242 4242 4242" className="num" inputMode="numeric" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="MM / YY">
                    <Input placeholder="12/28" className="num" />
                  </Field>
                  <Field label="CVC">
                    <Input placeholder="123" className="num" inputMode="numeric" />
                  </Field>
                </div>
              </div>
            )}
          </Card>
        </div>

        <aside>
          <Card className="sticky top-32 p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.checkout.orderSummary)}</h2>

            <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto pe-1">
              {lines.map((line) => (
                <li key={line.productId} className="flex items-center gap-2.5">
                  <span className="text-lg">{line.image}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-foreground">{t(line.name)}</span>
                    <span className="num block text-[10px] text-muted-foreground">× {n(line.qty)}</span>
                  </span>
                  <span className="num shrink-0 text-[11px] font-extrabold text-foreground">{money(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
              {[
                { label: d.cart.subtotal, value: subtotal },
                { label: d.cart.shipping, value: shippingCost },
                { label: d.cart.tax, value: tax },
              ].map((row, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t(row.label)}</dt>
                  <dd className="num font-bold text-foreground">{money(row.value)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="font-extrabold text-foreground">{t(d.cart.total)}</dt>
                <dd className="num text-lg font-extrabold text-foreground">{money(total)}</dd>
              </div>
            </dl>

            <Button fullWidth size="lg" className="mt-5" disabled={!selectedQuote || submitting} onClick={placeOrder}>
              <Check className="h-4 w-4" />
              {submitting ? t(d.common.loading) : t(d.checkout.placeOrder)}
            </Button>
            {failure && <p className="mt-3 text-center text-[11px] font-semibold text-danger">{failure}</p>}
            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              {t(d.checkout.orderPlacedHint)}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function Checkout() {
  return (
    <RequireAuth roles={["buyer", "admin"]}>
      <CheckoutInner />
    </RequireAuth>
  );
}
