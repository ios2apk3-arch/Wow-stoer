import { useState } from "react";
import { Building2, Clock, Globe, MapPin, MessageSquare, Star } from "lucide-react";
import { useRouter } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { ProductCard } from "../components/ProductCard";
import { VerificationBadge } from "../components/SupplierCard";
import { Badge, Button, Card, Progress, Rating, Stat, Tab, TabList, TabPanel, Tabs } from "../ui";
import NotFound from "./NotFound";

export default function SupplierPage({ id }: { id: string }) {
  const { d, t, n, money, date } = useI18n();
  const { navigate } = useRouter();
  const [tab, setTab] = useState("products");
  const [opening, setOpening] = useState(false);

  const { data: supplier, loading, error } = useApiQuery((signal) => api.catalog.supplier(id, signal), [id]);
  const productsQuery = useApiQuery((signal) => api.catalog.products({ supplier: id, perPage: 48 }, signal), [id]);

  if (loading && !supplier) {
    return (
      <div className="container-x py-8">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-muted/50" />
      </div>
    );
  }
  if (error?.isNotFound || !supplier) return <NotFound />;

  const company = supplier;
  const products = productsQuery.data?.items ?? [];
  const reviews = supplier.reviews ?? [];

  const contact = async () => {
    if (!auth.currentCompany()) {
      navigate("/login");
      return;
    }
    setOpening(true);
    try {
      const thread = await api.messaging.open(id, `Conversation with ${supplier.name.en}`);
      navigate(`/messages?thread=${thread.id}`);
    } catch {
      navigate("/messages");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="container-x py-8">
          <div className="flex flex-wrap items-start gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted text-4xl">{company.logo}</span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-foreground">{t(company.name)}</h1>
                <VerificationBadge status={company.verification} />
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{supplier.city}, {supplier.countryCode}</span>
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{t(d.profile.memberSince)} {date(supplier.memberSince, { month: "long", year: "numeric" })}</span>
                <span className="num inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{n(Math.round(supplier.responseHours))} {t(d.supplier.hours)}</span>
              </p>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(company.description)}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {supplier.badges.map((b) => (
                  <Badge key={b} tone="accent">
                    {b in d.supplier.badge ? t(d.supplier.badge[b as keyof typeof d.supplier.badge]) : b}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 gap-2.5">
              <Button onClick={() => void contact()} disabled={opening}>
                <MessageSquare className="h-4 w-4" />
                {t(d.action.message)}
              </Button>
              <Button variant="outline" onClick={() => navigate(`/rfq/new?supplier=${id}`)}>
                {t(d.action.requestQuote)}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-x py-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t(d.supplier.rating)} value={<Rating value={supplier.rating} count={supplier.reviewCount} />} icon={<Star className="h-5 w-5" />} tone="warning" />
          <Stat label={t(d.supplier.onTime)} value={<span className="num">{Math.round(supplier.onTimeRate * 100)}%</span>} tone="success" />
          <Stat label={t(d.supplier.fulfilled)} value={<span className="num">{n(supplier.fulfilledOrders)}</span>} tone="accent" />
          <Stat label={t(d.supplier.yearsActive)} value={<span className="num">{n(supplier.yearsActive)}</span>} tone="info" />
        </div>

        <Tabs value={tab} onChange={setTab}>
          <TabList>
            <Tab id="products">{t(d.supplier.products)} ({n(productsQuery.data?.total ?? 0)})</Tab>
            <Tab id="performance">{t(d.supplier.performance)}</Tab>
            <Tab id="reviews">{t(d.supplier.reviews)} ({n(reviews.length)})</Tab>
            <Tab id="about">{t(d.supplier.about)}</Tab>
          </TabList>

          <div className="pt-6">
            <TabPanel id="products">
              {productsQuery.loading && !products.length ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-muted/50" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </TabPanel>

            <TabPanel id="performance">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="text-sm font-extrabold text-foreground">{t(d.supplier.performance)}</h3>
                  <dl className="mt-4 space-y-4">
                    {[
                      { label: d.supplier.onTime, value: supplier.onTimeRate * 100, display: `${Math.round(supplier.onTimeRate * 100)}%`, tone: "success" as const },
                      { label: d.supplier.rating, value: (supplier.rating / 5) * 100, display: supplier.rating.toFixed(1), tone: "accent" as const },
                    ].map((row, i) => (
                      <div key={i}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <dt className="font-semibold text-muted-foreground">{t(row.label)}</dt>
                          <dd className="num font-extrabold text-foreground">{row.display}</dd>
                        </div>
                        <Progress value={row.value} tone={row.tone} />
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card className="p-5">
                  <h3 className="text-sm font-extrabold text-foreground">{t(d.supplier.products)}</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-4">
                    {[
                      { label: d.supplier.fulfilled, value: n(supplier.fulfilledOrders) },
                      { label: d.supplier.yearsActive, value: n(supplier.yearsActive) },
                      { label: d.supplier.reviews, value: n(supplier.reviewCount) },
                      { label: d.supplier.products, value: n(productsQuery.data?.total ?? 0) },
                    ].map((row, i) => (
                      <div key={i}>
                        <dt className="text-[11px] font-semibold text-muted-foreground">{t(row.label)}</dt>
                        <dd className="num mt-1 text-lg font-extrabold text-foreground">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </div>
            </TabPanel>

            <TabPanel id="reviews">
              <div className="space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <Rating value={r.rating} />
                      <span className="text-[11px] text-muted-foreground">{date(r.at)}</span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{t(r.body)}</p>
                  </Card>
                ))}
              </div>
            </TabPanel>

            <TabPanel id="about">
              <Card className="p-5">
                <dl className="grid gap-5 sm:grid-cols-2">
                  {[
                    { icon: Globe, label: d.profile.website, value: supplier.website ?? "—" },
                    { icon: MapPin, label: d.auth.city, value: `${supplier.city}, ${supplier.countryCode}` },
                    { icon: Building2, label: d.profile.memberSince, value: date(supplier.memberSince, { month: "long", year: "numeric" }) },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold text-muted-foreground">{t(label)}</dt>
                        <dd className="num truncate text-sm font-bold text-foreground">{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </Card>
            </TabPanel>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
