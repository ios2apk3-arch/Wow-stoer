import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Truck, Wallet } from "lucide-react";
import { Link, useRouter } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, catalog } from "../platform/api";
import { categoryIndices, priceAlerts, trendingProducts } from "../platform/intelligence";
import { suggestedPrompts } from "../platform/ai/assistant";
import { ProductCard } from "../components/ProductCard";
import { SupplierCard } from "../components/SupplierCard";
import { Badge, Button, Card, Sparkline, cx } from "../ui";
import { mainCategories, subCategories } from "../platform/data/catalog";
import { priceSeries } from "../platform/intelligence";

function SectionHeader({ title, href, cta }: { title: string; href?: string; cta?: string }) {
  const { dir } = useI18n();
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">{title}</h2>
      {href && (
        <Link to={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-accent hover:underline">
          {cta}
          <Arrow className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Hero() {
  const { d, t, n } = useI18n();
  const { navigate } = useRouter();
  const { locale } = useI18n();
  const prompts = suggestedPrompts(locale).slice(0, 3);
  const db = useDatabase();

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -end-20 -top-20 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-32 -start-20 h-96 w-96 rounded-full bg-brand-400/15 blur-3xl" />
      </div>

      <div className="container-x relative py-14 lg:py-20">
        <div className="max-w-3xl">
          <Badge tone="accent" className="bg-white/10 text-brand-300">
            <Sparkles className="h-3 w-3" />
            {t(d.nav.aiAssistant)}
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.15] sm:text-5xl lg:text-6xl">
            {t(d.home.heroTitle)}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300 sm:text-lg">{t(d.home.heroSub)}</p>
        </div>

        <div className="mt-8 max-w-3xl">
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => navigate(`/ai?q=${encodeURIComponent(p)}`)}
                className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-4 py-2 text-start text-xs font-semibold text-ink-200 transition-colors hover:border-brand-400 hover:bg-white/10 hover:text-white"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/search">
            <Button size="lg">{t(d.nav.marketplace)}</Button>
          </Link>
          <Link to="/rfq/new">
            <Button size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10">
              {t(d.action.requestQuote)}
            </Button>
          </Link>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
          {[
            { label: d.supplier.directory, value: db.suppliers.length, icon: ShieldCheck },
            { label: d.supplier.products, value: db.products.length, icon: Wallet },
            { label: d.nav.orders, value: db.orders.length, icon: Truck },
            { label: d.nav.rfq, value: db.rfqs.length, icon: Sparkles },
          ].map(({ label, value, icon: Icon }, i) => (
            <div key={i}>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
                <Icon className="h-3.5 w-3.5" />
                {t(label)}
              </dt>
              <dd className="num mt-1.5 text-2xl font-extrabold">{n(value)}+</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function MarketPulse() {
  const { d, t, money, n } = useI18n();
  const indices = categoryIndices().slice(0, 4);
  const alerts = priceAlerts(4, 4);

  return (
    <section className="container-x py-12">
      <SectionHeader title={t(d.home.marketPulse)} href="/intelligence" cta={t(d.action.viewAll)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <h3 className="text-sm font-extrabold text-foreground">{t(d.intelligence.priceIndex)}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {indices.map((idx) => (
              <Link
                key={idx.category.id}
                to={`/search?category=${idx.category.id}`}
                className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-accent hover:bg-accent-soft/40"
              >
                <span className="text-2xl">{idx.category.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-extrabold text-foreground">{t(idx.category.name)}</div>
                  <div className="num text-[11px] text-muted-foreground">{money(idx.avgPrice)}</div>
                </div>
                <span className={cx("num inline-flex items-center gap-0.5 text-xs font-extrabold", idx.changeMonthPct >= 0 ? "text-danger" : "text-success")}>
                  {idx.changeMonthPct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(idx.changeMonthPct)}%
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-extrabold text-foreground">{t(d.intelligence.priceAlerts)}</h3>
          <ul className="mt-4 space-y-3">
            {alerts.map((a) => (
              <li key={a.product.id}>
                <Link to={`/product/${a.product.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <span className="text-xl">{a.product.image}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-foreground">{t(a.product.name)}</span>
                    <span className="num block text-[11px] text-muted-foreground">{money(a.current)}</span>
                  </span>
                  <span className={cx("num text-xs font-extrabold", a.direction === "up" ? "text-danger" : "text-success")}>
                    {a.direction === "up" ? "+" : ""}{n(a.changePct)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

function Categories() {
  const { d, t } = useI18n();
  return (
    <section className="container-x py-12">
      <SectionHeader title={t(d.home.shopByCategory)} href="/search" cta={t(d.action.viewAll)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {mainCategories.map((cat) => (
          <Link
            key={cat.id}
            to={`/search?category=${cat.id}`}
            className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-5 text-center transition-all hover:border-accent hover:shadow-[var(--shadow-raised)]"
          >
            <span className="text-3xl transition-transform group-hover:scale-110">{cat.icon}</span>
            <span className="text-xs font-extrabold leading-snug text-foreground">{t(cat.name)}</span>
            <span className="text-[10px] text-muted-foreground">{subCategories(cat.id).length || "—"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductRail({ title, products, href }: { title: string; products: ReturnType<typeof catalog.products>; href: string }) {
  const { d, t } = useI18n();
  if (!products.length) return null;
  return (
    <section className="container-x py-12">
      <SectionHeader title={title} href={href} cta={t(d.action.viewAll)} />
      <div className="rail">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} compact />
        ))}
      </div>
    </section>
  );
}

function Trending() {
  const { d, t, n } = useI18n();
  const items = trendingProducts(6);
  if (!items.length) return null;

  return (
    <section className="container-x py-12">
      <SectionHeader title={t(d.home.trending)} href="/intelligence" cta={t(d.action.viewAll)} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ product, demandGrowthPct, priceChangePct }) => {
          const series = priceSeries(product.id);
          return (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-accent hover:shadow-[var(--shadow-raised)]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{product.image}</span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-bold text-foreground">{t(product.name)}</div>
                <div className="num mt-1 text-[11px] font-semibold text-success">
                  ▲ {n(demandGrowthPct)}% {t(d.intelligence.demandIndex)}
                </div>
                {series && <Sparkline points={series.points.map((p) => p.volume)} tone="success" className="mt-1.5" />}
              </div>
              <span className={cx("num shrink-0 text-xs font-extrabold", priceChangePct >= 0 ? "text-danger" : "text-success")}>
                {priceChangePct >= 0 ? "+" : ""}{n(priceChangePct)}%
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RolePanels() {
  const { d, t } = useI18n();
  const panels = [
    { title: d.home.forBuyers, pitch: d.home.buyerPitch, href: "/search", cta: d.nav.marketplace, tone: "bg-accent-soft text-accent" },
    { title: d.home.forSuppliers, pitch: d.home.supplierPitch, href: "/register", cta: d.action.register, tone: "bg-success-soft text-success" },
  ];
  return (
    <section className="container-x py-12">
      <div className="grid gap-4 md:grid-cols-2">
        {panels.map((p, i) => (
          <Card key={i} className="flex flex-col p-7">
            <Badge className={p.tone}>{t(p.title)}</Badge>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{t(p.pitch)}</p>
            <Link to={p.href} className="mt-6">
              <Button variant="outline">{t(p.cta)}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { d, t } = useI18n();
  useDatabase();
  const user = auth.currentUser();

  return (
    <>
      <Hero />
      <Categories />
      <MarketPulse />
      <ProductRail title={t(d.home.featuredProducts)} products={catalog.featuredProducts(10)} href="/search?sort=rating" />
      <Trending />

      <section className="container-x py-12">
        <SectionHeader title={t(d.home.featuredSuppliers)} href="/suppliers" cta={t(d.action.viewAll)} />
        <div className="rail">
          {catalog.featuredSuppliers(6).map((s) => (
            <SupplierCard key={s.id} supplier={s} compact />
          ))}
        </div>
      </section>

      <ProductRail
        title={t(user ? d.home.recommended : d.home.bestSellers)}
        products={catalog.bestSellers(10)}
        href="/search?sort=popular"
      />
      <RolePanels />
    </>
  );
}
