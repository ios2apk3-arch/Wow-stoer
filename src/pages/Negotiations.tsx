import { useState } from "react";
import { ArrowRight, Check, Handshake, X } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, catalog, negotiation } from "../platform/api";
import { NegotiationStatusBadge } from "../components/StatusBadge";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea, cx, useToast } from "../ui";
import RequireAuth from "./RequireAuth";
import type { Negotiation, NegotiationTerms } from "../platform/types";

const paymentTermOptions = ["prepaid", "net_15", "net_30", "50_50"] as const;

function TermsGrid({ terms, currency }: { terms: NegotiationTerms; currency: string }) {
  const { d, t, n, money } = useI18n();
  const rows = [
    { label: d.product.unitPrice, value: money(terms.unitPrice, currency) },
    { label: d.product.quantity, value: n(terms.qty) },
    { label: d.product.moq, value: n(terms.moq) },
    { label: d.cart.shipping, value: money(terms.shippingCost, currency) },
    { label: d.rfq.shippingTerms, value: t(d.rfq.terms[terms.shippingTerms as keyof typeof d.rfq.terms] ?? { ar: terms.shippingTerms, en: terms.shippingTerms }) },
    { label: d.rfq.paymentTerms, value: t(d.rfq.terms[terms.paymentTerms as keyof typeof d.rfq.terms] ?? { ar: terms.paymentTerms, en: terms.paymentTerms }) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
      {rows.map((r, i) => (
        <div key={i}>
          <dt className="text-[10px] font-semibold text-muted-foreground">{t(r.label)}</dt>
          <dd className="num mt-0.5 text-xs font-extrabold text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NegotiationThread({ item }: { item: Negotiation }) {
  const { d, t, n, money, date } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();

  const user = auth.currentUser();
  const company = auth.currentCompany();
  const product = catalog.product(item.productId);
  const supplierCompany = catalog.supplierCompany(item.supplierId);

  const side: "buyer" | "supplier" = user?.role === "supplier" ? "supplier" : "buyer";
  const last = item.rounds[item.rounds.length - 1];
  const first = item.rounds[0];
  const savings = first.terms.unitPrice && last.terms.unitPrice
    ? Math.round(((product?.tiers[0].price ?? last.terms.unitPrice) - last.terms.unitPrice) / (product?.tiers[0].price ?? 1) * 1000) / 10
    : 0;

  const [counterOpen, setCounterOpen] = useState(false);
  const [terms, setTerms] = useState<NegotiationTerms>(last.terms);
  const [message, setMessage] = useState("");

  const myTurn = item.status === "active" && last.by !== side;

  const submitCounter = () => {
    negotiation.counter(item.id, side, user?.name ?? side, terms, message);
    setCounterOpen(false);
    setMessage("");
    toast.push(t(d.action.counter));
  };

  const resolve = (accept: boolean) => {
    negotiation.resolve(item.id, side, user?.name ?? side, accept, "");
    toast.push(t(accept ? d.action.accept : d.action.reject));
  };

  const convert = async () => {
    const order = await negotiation.convertToOrder(item.id);
    if (order) {
      toast.push(t(d.action.convertToOrder));
      navigate(`/order/${order.id}`);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{product?.image ?? "🤝"}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[11px] font-extrabold text-muted-foreground">{item.reference}</span>
              <NegotiationStatusBadge status={item.status} />
            </div>
            {product && (
              <Link to={`/product/${product.id}`} className="mt-1 block truncate text-sm font-extrabold text-foreground hover:text-accent">
                {t(product.name)}
              </Link>
            )}
            <Link to={`/supplier/${item.supplierId}`} className="text-[11px] font-semibold text-muted-foreground hover:text-accent">
              {supplierCompany ? t(supplierCompany.name) : item.supplierId}
            </Link>
          </div>
        </div>

        <div className="text-end">
          <div className="num text-lg font-extrabold text-foreground">{money(last.terms.unitPrice, item.currency)}</div>
          {savings > 0 && (
            <Badge tone="success" className="mt-1">
              {t(d.negotiation.savingsAchieved)} <span className="num">{n(savings)}%</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Rounds */}
      <ol className="mt-5 space-y-3 border-t border-border pt-5">
        {item.rounds.map((round, i) => (
          <li
            key={round.id}
            className={cx(
              "rounded-xl border p-4",
              round.by === "buyer" ? "border-accent/30 bg-accent-soft/40" : "border-border bg-muted/50",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[11px] font-extrabold text-foreground">
                <Badge tone={round.by === "buyer" ? "accent" : "neutral"}>
                  {t(d.auth.roles[round.by])}
                </Badge>
                {round.actorName}
                <span className="num font-semibold text-muted-foreground">
                  {t(d.negotiation.round)} {i + 1}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground">{date(round.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>

            {round.message && <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{round.message}</p>}

            <div className="mt-3 border-t border-border/60 pt-3">
              <TermsGrid terms={round.terms} currency={item.currency} />
            </div>
          </li>
        ))}
      </ol>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2.5 border-t border-border pt-5">
        {item.status === "active" && (
          <>
            <Button size="sm" variant="outline" onClick={() => { setTerms(last.terms); setCounterOpen(true); }}>
              <Handshake className="h-4 w-4" />
              {t(d.action.counter)}
            </Button>
            <Button size="sm" variant="success" disabled={!myTurn} onClick={() => resolve(true)}>
              <Check className="h-4 w-4" />
              {t(d.action.accept)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => resolve(false)}>
              <X className="h-4 w-4" />
              {t(d.action.reject)}
            </Button>
          </>
        )}
        {item.status === "accepted" && (
          <Button size="sm" onClick={convert}>
            <ArrowRight className="h-4 w-4" />
            {t(d.action.convertToOrder)}
          </Button>
        )}
        {item.status === "converted" && item.orderId && (
          <Link to={`/order/${item.orderId}`}>
            <Button size="sm" variant="outline">{t(d.nav.orders)}</Button>
          </Link>
        )}
      </div>

      <Modal
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        title={t(d.negotiation.yourCounter)}
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={() => setCounterOpen(false)}>{t(d.action.cancel)}</Button>
            <Button fullWidth onClick={submitCounter}>{t(d.action.submit)}</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(d.product.unitPrice)}>
            <Input type="number" min={0} step="0.01" value={terms.unitPrice} onChange={(e) => setTerms((s) => ({ ...s, unitPrice: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.product.quantity)}>
            <Input type="number" min={1} value={terms.qty} onChange={(e) => setTerms((s) => ({ ...s, qty: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.product.moq)}>
            <Input type="number" min={1} value={terms.moq} onChange={(e) => setTerms((s) => ({ ...s, moq: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.cart.shipping)}>
            <Input type="number" min={0} value={terms.shippingCost} onChange={(e) => setTerms((s) => ({ ...s, shippingCost: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.rfq.paymentTerms)}>
            <Select value={terms.paymentTerms} onChange={(e) => setTerms((s) => ({ ...s, paymentTerms: e.target.value }))}>
              {paymentTermOptions.map((o) => (
                <option key={o} value={o}>{t(d.rfq.terms[o])}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(d.rfq.shippingTerms)}>
            <Select value={terms.shippingTerms} onChange={(e) => setTerms((s) => ({ ...s, shippingTerms: e.target.value }))}>
              {(["DDP", "CIF", "FOB", "EXW"] as const).map((o) => (
                <option key={o} value={o}>{t(d.rfq.terms[o])}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(d.rfq.notes)}>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t(d.messages.placeholder)} />
            </Field>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function NegotiationsInner() {
  const { d, t, n } = useI18n();
  useDatabase();

  const user = auth.currentUser();
  const company = auth.currentCompany();

  const list =
    user?.role === "supplier" && company
      ? negotiation.forSupplier(company.id.replace("co-", ""))
      : user?.role === "admin"
        ? negotiation.all()
        : company
          ? negotiation.forBuyer(company.id)
          : [];

  return (
    <div className="container-x py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.negotiation.title)}</h1>
        <p className="num mt-1 text-sm text-muted-foreground">{n(list.length)}</p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-6 w-6" />}
          title={t(d.negotiation.noNegotiations)}
          action={
            <Link to="/search">
              <Button>{t(d.nav.marketplace)}</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((item) => (
            <NegotiationThread key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NegotiationsPage() {
  return (
    <RequireAuth>
      <NegotiationsInner />
    </RequireAuth>
  );
}
