import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { catalog, type ProductFilters } from "../platform/api";
import { countries, mainCategories, subCategories } from "../platform/data/catalog";
import { ProductCard } from "../components/ProductCard";
import { Button, Card, Checkbox, EmptyState, Input, Select, cx } from "../ui";
import type { Availability } from "../platform/types";

const sortKeys = ["relevance", "price_asc", "price_desc", "rating", "popular", "newest", "lead_time"] as const;
const availabilities: Availability[] = ["in_stock", "low_stock", "made_to_order", "out_of_stock"];

export default function SearchPage() {
  const { d, t, n, money } = useI18n();
  const { query, setQuery } = useRouter();
  useDatabase();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const q = query.get("q") ?? "";
  const categoryId = query.get("category") ?? "";
  const sort = (query.get("sort") ?? "relevance") as ProductFilters["sort"];
  const minPrice = query.get("min");
  const maxPrice = query.get("max");
  const maxMoq = query.get("moq");
  const minRating = query.get("rating");
  const selectedCountries = (query.get("countries") ?? "").split(",").filter(Boolean);
  const selectedAvailability = (query.get("avail") ?? "").split(",").filter(Boolean);

  const results = useMemo(
    () =>
      catalog.search({
        query: q || undefined,
        categoryId: categoryId || undefined,
        sort,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        maxMoq: maxMoq ? Number(maxMoq) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
        countries: selectedCountries.length ? selectedCountries : undefined,
        availability: selectedAvailability.length ? selectedAvailability : undefined,
      }),
    [q, categoryId, sort, minPrice, maxPrice, maxMoq, minRating, query],
  );

  const toggleInList = (key: string, current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setQuery({ [key]: next.join(",") || null });
  };

  const activeCount =
    (categoryId ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (maxMoq ? 1 : 0) +
    (minRating ? 1 : 0) + selectedCountries.length + selectedAvailability.length;

  const parentCategory = categoryId
    ? catalog.categories().find((c) => c.id === categoryId)
    : null;
  const activeParent = parentCategory?.parentId
    ? catalog.categories().find((c) => c.id === parentCategory.parentId)
    : parentCategory;

  const Filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2.5 text-xs font-extrabold text-foreground">{t(d.nav.categories)}</h3>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setQuery({ category: null })}
            className={cx(
              "w-full cursor-pointer rounded-lg px-3 py-2 text-start text-xs font-bold transition-colors",
              !categoryId ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(d.common.all)}
          </button>
          {mainCategories.map((cat) => {
            const subs = subCategories(cat.id);
            const isActive = categoryId === cat.id;
            const expanded = isActive || activeParent?.id === cat.id;
            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => setQuery({ category: isActive ? null : cat.id })}
                  className={cx(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold transition-colors",
                    isActive ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span>{cat.icon}</span>
                  <span className="flex-1">{t(cat.name)}</span>
                </button>
                {expanded && subs.length > 0 && (
                  <div className="ms-4 mt-0.5 space-y-0.5 border-s border-border ps-2">
                    {subs.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setQuery({ category: categoryId === sub.id ? cat.id : sub.id })}
                        className={cx(
                          "w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-start text-[11px] font-semibold transition-colors",
                          categoryId === sub.id ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {t(sub.name)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-extrabold text-foreground">{t(d.search.priceRange)}</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={t(d.common.from)}
            defaultValue={minPrice ?? ""}
            onBlur={(e) => setQuery({ min: e.target.value || null })}
            className="h-10 text-xs"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={t(d.common.to)}
            defaultValue={maxPrice ?? ""}
            onBlur={(e) => setQuery({ max: e.target.value || null })}
            className="h-10 text-xs"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-extrabold text-foreground">{t(d.search.maxMoq)}</h3>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="—"
          defaultValue={maxMoq ?? ""}
          onBlur={(e) => setQuery({ moq: e.target.value || null })}
          className="h-10 text-xs"
        />
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-extrabold text-foreground">{t(d.search.rating)}</h3>
        <div className="flex gap-1.5">
          {[4.5, 4, 3.5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setQuery({ rating: minRating === String(r) ? null : String(r) })}
              className={cx(
                "num cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                minRating === String(r) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground hover:border-border-strong",
              )}
            >
              ★ {r}+
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-extrabold text-foreground">{t(d.search.availability)}</h3>
        {availabilities.map((a) => (
          <Checkbox
            key={a}
            checked={selectedAvailability.includes(a)}
            onChange={() => toggleInList("avail", selectedAvailability, a)}
            label={<span className="text-xs">{t(d.product.availability[a])}</span>}
          />
        ))}
      </div>

      <div>
        <h3 className="mb-2.5 text-xs font-extrabold text-foreground">{t(d.search.country)}</h3>
        <div className="max-h-48 overflow-y-auto pe-1">
          {countries.map((c) => (
            <Checkbox
              key={c.code}
              checked={selectedCountries.includes(c.code)}
              onChange={() => toggleInList("countries", selectedCountries, c.code)}
              label={<span className="text-xs">{t(c.name)}</span>}
            />
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <Button
          variant="outline"
          fullWidth
          size="sm"
          onClick={() => setQuery({ category: null, min: null, max: null, moq: null, rating: null, countries: null, avail: null })}
        >
          {t(d.action.reset)}
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {q ? `"${q}"` : parentCategory ? t(parentCategory.name) : t(d.nav.marketplace)}
          </h1>
          <p className="num mt-1 text-sm text-muted-foreground">
            {n(results.length)} {t(d.search.results)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            {t(d.search.filters)}
            {activeCount > 0 && <span className="num ms-1 rounded-full bg-accent px-1.5 text-[10px] text-white">{activeCount}</span>}
          </Button>
          <Select
            value={sort}
            onChange={(e) => setQuery({ sort: e.target.value === "relevance" ? null : e.target.value })}
            className="h-9 w-auto text-xs"
            aria-label={t(d.search.sortBy)}
          >
            {sortKeys.map((k) => (
              <option key={k} value={k}>
                {t(d.search.sort[k])}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <Card className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto p-5">{Filters}</Card>
        </aside>

        <div>
          {results.length === 0 ? (
            <EmptyState
              icon={<X className="h-6 w-6" />}
              title={t(d.search.noResults)}
              hint={t(d.search.noResultsHint)}
              action={
                <Button variant="outline" onClick={() => setQuery({ q: null, category: null, min: null, max: null, moq: null, rating: null, countries: null, avail: null })}>
                  {t(d.action.reset)}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-100 lg:hidden">
          <button type="button" aria-label="close" className="absolute inset-0 cursor-default bg-ink-950/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[min(88vw,20rem)] overflow-y-auto bg-card p-5 shadow-[var(--shadow-overlay)]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-extrabold">{t(d.search.filters)}</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} className="cursor-pointer rounded-lg p-1.5 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            {Filters}
            <Button fullWidth className="mt-6" onClick={() => setDrawerOpen(false)}>
              {t(d.action.apply)} ({n(results.length)})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
