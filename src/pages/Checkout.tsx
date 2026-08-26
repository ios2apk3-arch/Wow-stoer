import { useEffect, useState } from "react";
import { Check, CreditCard, MapPin, Truck } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, cart, orders } from "../platform/api";
import { round2, VAT_RATE } from "../platform/pricing";
import type { ShippingQuote } from "../platform/adapters";
import { Button, Card, EmptyState, Field, Input, cx, useToast } from "../ui";
import RequireAuth from "./RequireAuth";

function CheckoutInner() {
  const { d, t, n, money } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();
  useDatabase();

  const company = auth.currentCompany();
  const lines = cart.detailed();
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));

  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [carrierIndex, setCarrierIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "credit_terms">("bank_transfer");
  const [addressId, setAddressId] = useState(company?.addresses[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!company || !lines.length) return;
    let cancelled = false;
    orders.quoteShipping(subtotal, "SA", company.countryCode).then((q) => {
      if (!cancelled) setQuotes(q);
    });
    return () => {
      cancelled = true;
    };
  }, [subtotal, company?.countryCode, lines.length]);

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
    if (!company || !selectedQuote) return;
    setSubmitting(true);
    try {
      const order = await orders.createFromCart({
        buyerCompanyId: company.id,
        shippingAddressId: addressId,
        paymentMethod,
        carrier: selectedQuote.carrier,
        etaDays: selectedQuote.etaDays,
        shippingCost: selectedQuote.cost,
      });
      toast.push(t(d.checkout.orderPlaced));
      navigate(`/order/${order.id}`);
    } catch {
      toast.push(t(d.cart.empty), "danger");
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
            {company?.addresses.length ? (
              <div className="mt-4 space-y-2.5">
                {company.addresses.map((a) => (
                  <label
                    key={a.id}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      addressId === a.id ? "border-accent bg-accent-soft/50" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      className="mt-1 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 text-xs">
                      <span className="block font-extrabold text-foreground">{t(a.label)}</span>
                      <span className="mt-1 block text-muted-foreground">{a.line}</span>
                      <span className="num mt-0.5 block text-muted-foreground">{a.city}, {a.countryCode} · {a.phone}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={t(d.auth.city)} required>
                  <Input defaultValue={company?.city} />
                </Field>
                <Field label={t(d.auth.phone)} required>
                  <Input defaultValue={company?.phone} className="num" />
                </Field>
              </div>
            )}
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
              {!quotes.length && <p className="text-xs text-muted-foreground">{t(d.common.loading)}</p>}
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
              {lines.map(({ product, line, total: lineTotal }) => (
                <li key={product.id} className="flex items-center gap-2.5">
                  <span className="text-lg">{product.image}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-foreground">{t(product.name)}</span>
                    <span className="num block text-[10px] text-muted-foreground">× {n(line.qty)}</span>
                  </span>
                  <span className="num shrink-0 text-[11px] font-extrabold text-foreground">{money(lineTotal)}</span>
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
              {t(d.checkout.placeOrder)}
            </Button>
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
