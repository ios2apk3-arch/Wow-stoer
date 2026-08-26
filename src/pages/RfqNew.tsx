import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { parse } from "../platform/ai/nlu";
import { categories as allCategories, countries, mainCategories } from "../platform/data/catalog";
import { Badge, Button, Card, Checkbox, Field, Input, Select, Textarea, useToast } from "../ui";
import RequireAuth from "./RequireAuth";
import type { Unit } from "../platform/types";

const paymentTermOptions = ["prepaid", "net_15", "net_30", "50_50"] as const;
const shippingTermOptions = ["DDP", "CIF", "FOB", "EXW"] as const;
const unitOptions: Unit[] = ["carton", "pallet", "box", "kg", "liter", "piece"];

function RfqNewInner() {
  const { d, t, n, locale } = useI18n();
  const { query, navigate } = useRouter();
  const toast = useToast();

  const company = auth.currentCompany();
  const productId = query.get("product");
  const productQuery = useApiQuery(
    (signal) => api.catalog.product(productId!, signal),
    [productId],
    { enabled: Boolean(productId) },
  );
  const prefillProduct = productQuery.data?.product ?? null;
  const aiQuery = query.get("ai") ?? "";
  const parsed = useMemo(() => (aiQuery ? parse(aiQuery) : null), [aiQuery]);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState("");

  const [title, setTitle] = useState(parsed?.keywords.join(" ") ?? "");
  const [categoryId, setCategoryId] = useState(mainCategories[0].id);
  const [qty, setQty] = useState(Number(query.get("qty")) || parsed?.qty || 100);
  const [unit, setUnit] = useState<Unit>(parsed?.unit ?? "carton");
  const [targetPrice, setTargetPrice] = useState<number | "">(parsed?.budget ?? "");
  const [specs, setSpecs] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // The product arrives asynchronously; seed the form once it does, without
  // overwriting anything the user has already typed.
  useEffect(() => {
    if (!prefillProduct || prefilled) return;
    setTitle(`${locale === "ar" ? "توريد" : "Supply of"} ${prefillProduct.name[locale]}`);
    setCategoryId(prefillProduct.categoryId);
    setUnit(prefillProduct.unit);
    setQty((q) => (Number(query.get("qty")) || q) || prefillProduct.moq);
    setSpecs(prefillProduct.specs.map((sp) => `${sp.label[locale]}: ${sp.value[locale]}`).join("\n"));
    setInvited((prev) => (prev.length ? prev : [prefillProduct.supplierId]));
    setPrefilled(true);
  }, [prefillProduct, prefilled, locale, query]);
  const [neededBy, setNeededBy] = useState(
    new Date(Date.now() + (parsed?.withinDays ?? 14) * 864e5).toISOString().slice(0, 10),
  );
  const [city, setCity] = useState(parsed?.city ?? company?.city ?? "");
  const [country, setCountry] = useState(parsed?.countryCode ?? company?.countryCode ?? "SA");
  const [paymentTerms, setPaymentTerms] = useState<string>(parsed?.paymentTerms ?? "net_30");
  const [shippingTerms, setShippingTerms] = useState<string>("DDP");
  const [notes, setNotes] = useState("");

  // Suppliers that actually carry this category, straight from the server.
  const suggestedQuery = useApiQuery(
    (signal) => api.catalog.suppliers({ category: categoryId, perPage: 8 }, signal),
    [categoryId],
  );
  const suggested = suggestedQuery.data?.items ?? [];

  const [invited, setInvited] = useState<string[]>(() =>
    query.get("supplier") ? [query.get("supplier")!] : [],
  );

  const submit = async () => {
    const supplierIds = invited.length ? invited : suggested.slice(0, 3).map((s) => s.id);
    if (!supplierIds.length) {
      setFailure(t(d.rfq.inviteSuppliers));
      return;
    }
    setSubmitting(true);
    setFailure("");
    try {
      const created = await api.rfq.create({
        title,
        categoryId,
        productId: prefillProduct?.id ?? null,
        qty,
        unit,
        targetPrice: targetPrice === "" ? null : Number(targetPrice),
        specs,
        neededBy,
        deliveryCity: city,
        deliveryCountry: country,
        paymentTerms,
        shippingTerms,
        notes,
        supplierIds,
      });
      toast.push(t(d.rfq.new));
      navigate(`/rfq/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t(d.rfq.new);
      setFailure(message);
      toast.push(message, "danger");
      setSubmitting(false);
    }
  };

  const cities = countries.find((c) => c.code === country)?.cities ?? [];

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-extrabold text-foreground">{t(d.rfq.new)}</h1>

      {parsed && (
        <Card className="mt-5 border-accent/40 bg-accent-soft/40 p-4">
          <p className="flex items-center gap-2 text-xs font-extrabold text-accent">
            <Sparkles className="h-4 w-4" />
            {t(d.ai.understood)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {parsed.qty && <Badge tone="accent">{t(d.rfq.quantity)}: <span className="num">{n(parsed.qty)}</span></Badge>}
            {parsed.city && <Badge tone="accent">{t(d.rfq.deliveryLocation)}: {parsed.city}</Badge>}
            {parsed.withinDays != null && <Badge tone="accent">{t(d.rfq.neededBy)}: <span className="num">{n(parsed.withinDays)}</span> {t(d.product.days)}</Badge>}
            {parsed.budget && <Badge tone="accent">{t(d.rfq.targetPrice)}: <span className="num">{n(parsed.budget)}</span></Badge>}
          </div>
        </Card>
      )}

      <form
        className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Field label={t(d.rfq.productOrCategory)} required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t(d.rfq.productOrCategory)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t(d.nav.categories)} required>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parentId ? "— " : ""}{t(c.name)}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t(d.rfq.quantity)} required>
                  <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="num" required />
                </Field>
                <Field label={t(d.product.unit)}>
                  <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <Field label={t(d.rfq.targetPrice)} hint={t(d.common.optional)}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))}
                className="num"
                placeholder="—"
              />
            </Field>

            <Field label={t(d.rfq.specs)}>
              <Textarea value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder={t(d.rfq.specs)} />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t(d.rfq.neededBy)} required>
                <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="num" required />
              </Field>
              <Field label={t(d.auth.country)} required>
                <Select value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); }}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{t(c.name)}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={t(d.rfq.deliveryLocation)} required>
              <Select value={city} onChange={(e) => setCity(e.target.value)} required>
                <option value="">—</option>
                {cities.map((c) => (
                  <option key={c.en} value={c.ar}>{t(c)}</option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t(d.rfq.paymentTerms)}>
                <Select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                  {paymentTermOptions.map((o) => (
                    <option key={o} value={o}>{t(d.rfq.terms[o])}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t(d.rfq.shippingTerms)}>
                <Select value={shippingTerms} onChange={(e) => setShippingTerms(e.target.value)}>
                  {shippingTermOptions.map((o) => (
                    <option key={o} value={o}>{t(d.rfq.terms[o])}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={t(d.rfq.notes)}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Card>
        </div>

        <aside>
          <Card className="sticky top-32 p-5">
            <h2 className="text-sm font-extrabold text-foreground">{t(d.rfq.inviteSuppliers)}</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {invited.length ? `${n(invited.length)} ${t(d.nav.suppliers)}` : t(d.rfq.inviteSuppliers)}
            </p>

            <div className="mt-4 max-h-80 space-y-1 overflow-y-auto pe-1">
              {suggestedQuery.loading && <p className="py-3 text-xs text-muted-foreground">{t(d.common.loading)}</p>}
              {suggested.map((sup) => (
                <Checkbox
                  key={sup.id}
                  checked={invited.includes(sup.id)}
                  onChange={() =>
                    setInvited((prev) => (prev.includes(sup.id) ? prev.filter((s) => s !== sup.id) : [...prev, sup.id]))
                  }
                  label={
                    <span className="flex min-w-0 items-center gap-2">
                      <span>{sup.logo}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{t(sup.name)}</span>
                        <span className="num block text-[10px] text-muted-foreground">
                          ★ {sup.rating.toFixed(1)} · {sup.city}
                        </span>
                      </span>
                    </span>
                  }
                />
              ))}
              {!suggestedQuery.loading && !suggested.length && (
                <p className="py-3 text-xs text-muted-foreground">{t(d.search.noResults)}</p>
              )}
            </div>

            <Button type="submit" fullWidth size="lg" className="mt-5" disabled={submitting}>
              {submitting ? t(d.common.loading) : t(d.action.submit)}
            </Button>
            {failure && <p className="mt-2 text-center text-[11px] font-semibold text-danger">{failure}</p>}
          </Card>
        </aside>
      </form>
    </div>
  );
}

export default function RfqNewPage() {
  return (
    <RequireAuth roles={["buyer", "admin"]}>
      <RfqNewInner />
    </RequireAuth>
  );
}
