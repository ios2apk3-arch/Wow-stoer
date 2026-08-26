import { useState } from "react";
import { Award, Check, Handshake } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, catalog, negotiation, rfq } from "../platform/api";
import { RfqStatusBadge } from "../components/StatusBadge";
import { Badge, Button, Card, Field, Input, Modal, Rating, Select, Textarea, cx, useToast } from "../ui";
import NotFound from "./NotFound";
import RequireAuth from "./RequireAuth";

const paymentTermOptions = ["prepaid", "net_15", "net_30", "50_50"] as const;
const shippingTermOptions = ["DDP", "CIF", "FOB", "EXW"] as const;

function RfqDetailInner({ id }: { id: string }) {
  const { d, t, n, money, date } = useI18n();
  const { navigate } = useRouter();
  const toast = useToast();
  useDatabase();

  const request = rfq.get(id);
  const user = auth.currentUser();
  const company = auth.currentCompany();
  const [quoteOpen, setQuoteOpen] = useState(false);

  const supplierId = company?.id.replace("co-", "") ?? "";
  const [form, setForm] = useState({
    unitPrice: 0,
    moq: 0,
    leadTimeDays: 7,
    shippingCost: 0,
    shippingTerms: "DDP",
    paymentTerms: "net_30",
    validDays: 14,
    notes: "",
  });

  if (!request) return <NotFound />;

  const quotes = rfq.quotesFor(request.id);
  const isBuyer = company?.id === request.buyerCompanyId;
  const isInvitedSupplier = user?.role === "supplier" && request.invitedSupplierIds.includes(supplierId);
  const alreadyQuoted = quotes.some((q) => q.supplierId === supplierId);
  const bestPrice = quotes.length ? Math.min(...quotes.map((q) => q.unitPrice)) : null;

  const submitQuote = () => {
    rfq.submitQuote({
      rfqId: request.id,
      supplierId,
      unitPrice: form.unitPrice,
      currency: "SAR",
      moq: form.moq || request.qty,
      leadTimeDays: form.leadTimeDays,
      shippingCost: form.shippingCost,
      shippingTerms: form.shippingTerms,
      paymentTerms: form.paymentTerms,
      validUntil: new Date(Date.now() + form.validDays * 864e5).toISOString(),
      notes: form.notes,
    });
    setQuoteOpen(false);
    toast.push(t(d.rfq.submitQuote));
  };

  const startNegotiation = (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote || !company) return;
    const productId = request.productId ?? catalog.search({ categoryId: request.categoryId, supplierId: quote.supplierId })[0]?.id;
    if (!productId) {
      toast.push(t(d.search.noResults), "warning");
      return;
    }
    negotiation.start({
      productId,
      buyerCompanyId: company.id,
      supplierId: quote.supplierId,
      actorName: user?.name ?? "Buyer",
      rfqId: request.id,
      quoteId: quote.id,
      terms: {
        unitPrice: Math.round(quote.unitPrice * 0.92 * 100) / 100,
        qty: request.qty,
        moq: quote.moq,
        shippingCost: quote.shippingCost,
        shippingTerms: quote.shippingTerms,
        paymentTerms: quote.paymentTerms,
      },
      message: "",
    });
    toast.push(t(d.negotiation.title));
    navigate("/negotiations");
  };

  return (
    <div className="container-x py-8">
      <nav className="mb-5 text-xs font-semibold text-muted-foreground">
        <Link to="/rfq" className="hover:text-accent">{t(d.rfq.title)}</Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-xs font-extrabold text-muted-foreground">{request.reference}</span>
            <RfqStatusBadge status={request.status} />
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">{t(request.title)}</h1>
        </div>
        {isInvitedSupplier && !alreadyQuoted && request.status !== "awarded" && (
          <Button onClick={() => { setForm((f) => ({ ...f, moq: request.qty })); setQuoteOpen(true); }}>
            {t(d.rfq.submitQuote)}
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.rfq.quotesReceived)} ({n(quotes.length)})</h2>

            {quotes.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">{t(d.rfq.noQuotes)}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                      <th className="pb-2.5 text-start">{t(d.nav.suppliers)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.unitPrice)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.moq)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.leadTime)}</th>
                      <th className="pb-2.5 text-start">{t(d.cart.shipping)}</th>
                      <th className="pb-2.5 text-start">{t(d.rfq.paymentTerms)}</th>
                      <th className="pb-2.5 text-start">{t(d.product.total)}</th>
                      <th className="pb-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...quotes].sort((a, b) => a.unitPrice - b.unitPrice).map((q) => {
                      const co = catalog.supplierCompany(q.supplierId);
                      const sup = catalog.supplier(q.supplierId);
                      const isBest = q.unitPrice === bestPrice;
                      const lineTotal = q.unitPrice * request.qty + q.shippingCost;
                      return (
                        <tr key={q.id} className={cx("border-b border-border/60 last:border-0", q.status === "accepted" && "bg-success-soft/50")}>
                          <td className="py-3">
                            <Link to={`/supplier/${q.supplierId}`} className="flex items-center gap-2 hover:text-accent">
                              <span className="text-lg">{co?.logo}</span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-extrabold text-foreground">{co ? t(co.name) : q.supplierId}</span>
                                {sup && <Rating value={sup.rating} className="mt-0.5" />}
                              </span>
                            </Link>
                          </td>
                          <td className="num py-3 font-extrabold text-foreground">
                            {money(q.unitPrice)}
                            {isBest && <Badge tone="success" className="ms-1.5">{t(d.search.sort.price_asc)}</Badge>}
                          </td>
                          <td className="num py-3 text-muted-foreground">{n(q.moq)}</td>
                          <td className="num py-3 text-muted-foreground">{n(q.leadTimeDays)} {t(d.product.days)}</td>
                          <td className="num py-3 text-muted-foreground">{money(q.shippingCost)}</td>
                          <td className="py-3 text-[11px] text-muted-foreground">
                            {t(d.rfq.terms[q.paymentTerms as keyof typeof d.rfq.terms] ?? { ar: q.paymentTerms, en: q.paymentTerms })}
                          </td>
                          <td className="num py-3 font-extrabold text-foreground">{money(lineTotal)}</td>
                          <td className="py-3">
                            {isBuyer && request.status !== "awarded" && (
                              <div className="flex gap-1.5">
                                <Button size="sm" onClick={() => { rfq.acceptQuote(q.id); toast.push(t(d.rfq.acceptQuote)); }}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => startNegotiation(q.id)}>
                                  <Handshake className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                            {q.status === "accepted" && <Badge tone="success"><Award className="h-3 w-3" />{t(d.rfq.statuses.awarded)}</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {request.specs && (
            <Card className="p-5">
              <h2 className="text-sm font-extrabold text-foreground">{t(d.rfq.specs)}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{request.specs}</p>
            </Card>
          )}

          {request.notes && (
            <Card className="p-5">
              <h2 className="text-sm font-extrabold text-foreground">{t(d.rfq.notes)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{request.notes}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.rfq.title)}</h2>
            <dl className="mt-4 space-y-3 text-xs">
              {[
                { label: d.rfq.quantity, value: `${n(request.qty)} ${request.unit}` },
                { label: d.rfq.targetPrice, value: request.targetPrice ? money(request.targetPrice) : "—" },
                { label: d.rfq.neededBy, value: date(request.neededBy) },
                { label: d.rfq.deliveryLocation, value: `${request.deliveryCity}, ${request.deliveryCountry}` },
                {
                  label: d.rfq.paymentTerms,
                  value: t(d.rfq.terms[request.paymentTerms as keyof typeof d.rfq.terms] ?? { ar: request.paymentTerms, en: request.paymentTerms }),
                },
                {
                  label: d.rfq.shippingTerms,
                  value: t(d.rfq.terms[request.shippingTerms as keyof typeof d.rfq.terms] ?? { ar: request.shippingTerms, en: request.shippingTerms }),
                },
                { label: d.rfq.validUntil, value: date(request.expiresAt) },
              ].map((row, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{t(row.label)}</dt>
                  <dd className="num text-end font-bold text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.rfq.inviteSuppliers)}</h2>
            <ul className="mt-4 space-y-2.5">
              {request.invitedSupplierIds.map((sid) => {
                const co = catalog.supplierCompany(sid);
                const responded = quotes.some((q) => q.supplierId === sid);
                return (
                  <li key={sid}>
                    <Link to={`/supplier/${sid}`} className="flex items-center gap-2.5 hover:opacity-80">
                      <span className="text-lg">{co?.logo}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{co ? t(co.name) : sid}</span>
                      <Badge tone={responded ? "success" : "neutral"}>
                        {responded ? t(d.rfq.statuses.quoted) : t(d.rfq.statuses.open)}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>

      <Modal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        title={t(d.rfq.submitQuote)}
        footer={
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>{t(d.action.cancel)}</Button>
            <Button fullWidth onClick={submitQuote} disabled={form.unitPrice <= 0}>{t(d.action.submit)}</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(d.product.unitPrice)} required>
            <Input type="number" min={0} step="0.01" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.product.moq)}>
            <Input type="number" min={0} value={form.moq} onChange={(e) => setForm((f) => ({ ...f, moq: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.product.leadTime)}>
            <Input type="number" min={1} value={form.leadTimeDays} onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.cart.shipping)}>
            <Input type="number" min={0} value={form.shippingCost} onChange={(e) => setForm((f) => ({ ...f, shippingCost: Number(e.target.value) }))} className="num" />
          </Field>
          <Field label={t(d.rfq.shippingTerms)}>
            <Select value={form.shippingTerms} onChange={(e) => setForm((f) => ({ ...f, shippingTerms: e.target.value }))}>
              {shippingTermOptions.map((o) => (
                <option key={o} value={o}>{t(d.rfq.terms[o])}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(d.rfq.paymentTerms)}>
            <Select value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}>
              {paymentTermOptions.map((o) => (
                <option key={o} value={o}>{t(d.rfq.terms[o])}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(d.rfq.validUntil)}>
            <Input type="number" min={1} value={form.validDays} onChange={(e) => setForm((f) => ({ ...f, validDays: Number(e.target.value) }))} className="num" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(d.rfq.notes)}>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function RfqDetailPage({ id }: { id: string }) {
  return (
    <RequireAuth>
      <RfqDetailInner id={id} />
    </RequireAuth>
  );
}
