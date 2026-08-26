import { useState } from "react";
import { ArrowRight, Check, Handshake, X } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { NegotiationStatusBadge } from "../components/StatusBadge";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea, cx, useToast } from "../ui";
import RequireAuth from "./RequireAuth";
import type { NegotiationTerms, RemoteNegotiation } from "../platform/remote/endpoints";

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

function NegotiationThread({ item, onChanged }: { item: RemoteNegotiation; onChanged: () => void }) {
  const { d, t, n, money, date } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();

  const user = auth.currentUser();
  const productQuery = useApiQuery((signal) => api.catalog.product(item.productId, signal), [item.productId]);
  const product = productQuery.data?.product ?? null;

  const side: "buyer" | "supplier" = user?.role === "supplier" ? "supplier" : "buyer";
  const last = item.rounds[item.rounds.length - 1];
  // Saving is measured against the seller's listed entry price.
  const listed = product?.entryPrice ?? 0;
  const savings = listed && last ? Math.round(((listed - last.terms.unitPrice) / listed) * 1000) / 10 : 0;

  const [counterOpen, setCounterOpen] = useState(false);
  const [terms, setTerms] = useState<NegotiationTerms>(last.terms);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const myTurn = item.status === "active" && last.by !== side;

  const run = async (action: () => Promise<unknown>, label: string) => {
    setBusy(true);
    try {
      await action();
      onChanged();
      toast.push(label);
      return true;
    } catch (err) {
      toast.push(err instanceof Error ? err.message : label, "danger");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitCounter = async () => {
    const ok = await run(() => api.negotiations.counter(item.id, { ...terms, message }), t(d.action.counter));
    if (ok) {
      setCounterOpen(false);
      setMessage("");
    }
  };

  const resolve = (accept: boolean) =>
    run(() => api.negotiations.decide(item.id, accept ? "accept" : "reject"), t(accept ? d.action.accept : d.action.reject));

  const convert = async () => {
    setBusy(true);
    try {
      const result = await api.negotiations.convert(item.id);
      toast.push(t(d.action.convertToOrder));
      navigate(`/order/${result.orderId}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t(d.action.convertToOrder), "danger");
    } finally {
      setBusy(false);
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
              {product ? t(product.supplier.name) : t(d.nav.suppliers)}
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
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setTerms(last.terms); setCounterOpen(true); }}>
              <Handshake className="h-4 w-4" />
              {t(d.action.counter)}
            </Button>
            <Button size="sm" variant="success" disabled={!myTurn || busy} onClick={() => void resolve(true)}>
              <Check className="h-4 w-4" />
              {t(d.action.accept)}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void resolve(false)}>
              <X className="h-4 w-4" />
              {t(d.action.reject)}
            </Button>
          </>
        )}
        {item.status === "accepted" && (
          <Button size="sm" disabled={busy} onClick={() => void convert()}>
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
            <Button fullWidth disabled={busy} onClick={() => void submitCounter()}>{t(d.action.submit)}</Button>
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
  const { data, loading, refetch } = useApiQuery((signal) => api.negotiations.list({ perPage: 50 }, signal), []);
  const list = data?.items ?? [];

  return (
    <div className="container-x py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.negotiation.title)}</h1>
        <p className="num mt-1 text-sm text-muted-foreground">
          {loading ? t(d.common.loading) : n(data?.total ?? 0)}
        </p>
      </header>

      {loading && !list.length ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : list.length === 0 ? (
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
            <NegotiationThread key={item.id} item={item} onChanged={refetch} />
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
