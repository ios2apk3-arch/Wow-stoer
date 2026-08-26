import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, catalog, rfq } from "../platform/api";
import { parse } from "../platform/ai/nlu";
import { matchSuppliers } from "../platform/ai/assistant";
import { countries, mainCategories } from "../platform/data/catalog";
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
  useDatabase();

  const company = auth.currentCompany();
  const prefillProduct = query.get("product") ? catalog.product(query.get("product")!) : null;
  const aiQuery = query.get("ai") ?? "";
  const parsed = useMemo(() => (aiQuery ? parse(aiQuery) : null), [aiQuery]);

  const [title, setTitle] = useState(
    prefillProduct ? `${locale === "ar" ? "توريد" : "Supply of"} ${prefillProduct.name[locale]}` : parsed?.keywords.join(" ") ?? "",
  );
  const [categoryId, setCategoryId] = useState(prefillProduct?.categoryId ?? mainCategories[0].id);
  const [qty, setQty] = useState(Number(query.get("qty")) || parsed?.qty || prefillProduct?.moq || 100);
  const [unit, setUnit] = useState<Unit>(prefillProduct?.unit ?? parsed?.unit ?? "carton");
  const [targetPrice, setTargetPrice] = useState<number | "">(parsed?.budget ?? "");
  const [specs, setSpecs] = useState(prefillProduct?.specs.map((s) => `${s.label[locale]}: ${s.value[locale]}`).join("\n") ?? "");
  const [neededBy, setNeededBy] = useState(
    new Date(Date.now() + (parsed?.withinDays ?? 14) * 864e5).toISOString().slice(0, 10),
  );
  const [city, setCity] = useState(parsed?.city ?? company?.city ?? "");
  const [country, setCountry] = useState(parsed?.countryCode ?? company?.countryCode ?? "SA");
  const [paymentTerms, setPaymentTerms] = useState<string>(parsed?.paymentTerms ?? "net_30");
  const [shippingTerms, setShippingTerms] = useState<string>("DDP");
  const [notes, setNotes] = useState("");

  // Suggest suppliers from the category, ranked by the same engine the assistant uses.
  const suggested = useMemo(() => {
    const fromAi = parsed ? matchSuppliers(parsed, 6).map((m) => m.supplierId) : [];
    const fromCategory = catalog.suppliers().filter((s) => s.categories.includes(categoryId)).map((s) => s.id);
    return [...new Set([...fromAi, ...fromCategory])].slice(0, 8);
  }, [parsed, categoryId]);

  const [invited, setInvited] = useState<string[]>(() =>
    prefillProduct ? [prefillProduct.supplierId] : query.get("supplier") ? [query.get("supplier")!] : [],
  );

  const submit = () => {
    if (!company) return;
    const created = rfq.create({
      buyerCompanyId: company.id,
      title: { ar: title, en: title },
      categoryId,
      productId: prefillProduct?.id,
      qty,
      unit,
      targetPrice: targetPrice === "" ? undefined : Number(targetPrice),
      currency: "SAR",
      specs,
      neededBy: new Date(neededBy).toISOString(),
      deliveryCity: city,
      deliveryCountry: country,
      paymentTerms,
      shippingTerms,
      notes,
      invitedSupplierIds: invited.length ? invited : suggested.slice(0, 3),
    });
    toast.push(t(d.rfq.new));
    navigate(`/rfq/${created.id}`);
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
          submit();
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
                  {catalog.categories().map((c) => (
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
              {suggested.map((sid) => {
                const co = catalog.supplierCompany(sid);
                const sup = catalog.supplier(sid);
                if (!co || !sup) return null;
                return (
                  <Checkbox
                    key={sid}
                    checked={invited.includes(sid)}
                    onChange={() =>
                      setInvited((prev) => (prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid]))
                    }
                    label={
                      <span className="flex min-w-0 items-center gap-2">
                        <span>{co.logo}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold">{t(co.name)}</span>
                          <span className="num block text-[10px] text-muted-foreground">★ {sup.rating.toFixed(1)} · {co.city}</span>
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </div>

            <Button type="submit" fullWidth size="lg" className="mt-5">
              {t(d.action.submit)}
            </Button>
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
