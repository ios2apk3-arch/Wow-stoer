import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "../i18n";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { countries, mainCategories } from "../platform/data/catalog";
import { SupplierCard } from "../components/SupplierCard";
import { EmptyState, Input, Select } from "../ui";

export default function SuppliersPage() {
  const { d, t, n } = useI18n();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");

  // Debounce typing so each keystroke does not become a request.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, loading, error } = useApiQuery(
    (signal) =>
      api.catalog.suppliers(
        { q: query || undefined, country: country || undefined, category: category || undefined, perPage: 50 },
        signal,
      ),
    [query, country, category],
  );

  const results = data?.items ?? [];

  return (
    <div className="container-x py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.supplier.directory)}</h1>
        <p className="num mt-1 text-sm text-muted-foreground">
          {loading ? t(d.common.loading) : `${n(data?.total ?? 0)} ${t(d.nav.suppliers)}`}
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t(d.action.search)} className="ps-10" />
        </div>
        <Select value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t(d.search.country)}>
          <option value="">{t(d.search.country)} — {t(d.common.all)}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{t(c.name)}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t(d.nav.categories)}>
          <option value="">{t(d.nav.categories)} — {t(d.common.all)}</option>
          {mainCategories.map((c) => (
            <option key={c.id} value={c.id}>{t(c.name)}</option>
          ))}
        </Select>
      </div>

      {error ? (
        <EmptyState title={error.message} hint={t({ ar: "تعذّر الوصول إلى الخادم.", en: "Could not reach the server." })} />
      ) : loading && !results.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState title={t(d.search.noResults)} hint={t(d.search.noResultsHint)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((s) => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
        </div>
      )}
    </div>
  );
}
