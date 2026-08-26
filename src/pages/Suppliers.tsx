import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { catalog } from "../platform/api";
import { supplierRankings } from "../platform/intelligence";
import { countries, mainCategories } from "../platform/data/catalog";
import { SupplierCard } from "../components/SupplierCard";
import { EmptyState, Input, Select } from "../ui";

export default function SuppliersPage() {
  const { d, t, n } = useI18n();
  useDatabase();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"score" | "rating" | "products">("score");

  const ranked = useMemo(() => new Map(supplierRankings().map((r) => [r.supplierId, r.score])), []);

  const results = useMemo(() => {
    let list = catalog.searchSuppliers(query);
    if (country) list = list.filter((s) => catalog.supplierCompany(s.id)?.countryCode === country);
    if (category) list = list.filter((s) => s.categories.includes(category));
    return [...list].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "products") {
        const count = (id: string) => catalog.products().filter((p) => p.supplierId === id).length;
        return count(b.id) - count(a.id);
      }
      return (ranked.get(b.id) ?? 0) - (ranked.get(a.id) ?? 0);
    });
  }, [query, country, category, sort, ranked]);

  return (
    <div className="container-x py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground">{t(d.supplier.directory)}</h1>
        <p className="num mt-1 text-sm text-muted-foreground">
          {n(results.length)} {t(d.nav.suppliers)}
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(d.action.search)} className="ps-10" />
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

      <div className="mb-5 flex justify-end">
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 w-auto text-xs" aria-label={t(d.search.sortBy)}>
          <option value="score">{t(d.intelligence.topSuppliers)}</option>
          <option value="rating">{t(d.search.sort.rating)}</option>
          <option value="products">{t(d.supplier.products)}</option>
        </Select>
      </div>

      {results.length === 0 ? (
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
