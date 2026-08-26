import { BadgeCheck, Clock, MapPin, PackageCheck } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { catalog } from "../platform/api";
import { Badge, Rating, cx } from "../ui";
import type { I18nText, Supplier, VerificationStatus } from "../platform/types";
import type { RemoteSupplier } from "../platform/remote/endpoints";

export function VerificationBadge({ status }: { status: VerificationStatus | string }) {
  const { d, t } = useI18n();
  const key = (["verified", "pending", "unverified", "rejected"] as const).includes(status as VerificationStatus)
    ? (status as VerificationStatus)
    : "unverified";
  const tone = { verified: "success", pending: "warning", unverified: "neutral", rejected: "danger" } as const;
  return (
    <Badge tone={tone[key]}>
      {key === "verified" && <BadgeCheck className="h-3 w-3" />}
      {t(d.supplier[key])}
    </Badge>
  );
}

/** Accepts a locally seeded supplier or one from the API while pages migrate. */
export type SupplierLike = Supplier | RemoteSupplier;

interface CardModel {
  id: string;
  name: I18nText | null;
  description: I18nText | null;
  logo: string;
  city: string;
  countryCode: string;
  verification: string;
  rating: number;
  onTimeRate: number;
  responseHours: number;
  badges: string[];
}

const isRemote = (s: SupplierLike): s is RemoteSupplier => "name" in s;

function toCardModel(supplier: SupplierLike): CardModel | null {
  if (isRemote(supplier)) {
    return {
      id: supplier.id,
      name: supplier.name,
      description: supplier.description,
      logo: supplier.logo,
      city: supplier.city,
      countryCode: supplier.countryCode,
      verification: supplier.verification,
      rating: supplier.rating,
      onTimeRate: supplier.onTimeRate,
      responseHours: supplier.responseHours,
      badges: supplier.badges,
    };
  }
  const company = catalog.supplierCompany(supplier.id);
  if (!company) return null;
  return {
    id: supplier.id,
    name: company.name,
    description: company.description,
    logo: company.logo,
    city: company.city,
    countryCode: company.countryCode,
    verification: company.verification,
    rating: supplier.rating,
    onTimeRate: supplier.onTimeRate,
    responseHours: supplier.responseHours,
    badges: supplier.badges,
  };
}

const badgeLabels: Record<string, { ar: string; en: string }> = {
  gold: { ar: "مورد ذهبي", en: "Gold supplier" },
  verified: { ar: "موثّق", en: "Verified" },
  fast_response: { ar: "سريع الاستجابة", en: "Fast responder" },
  top_rated: { ar: "الأعلى تقييمًا", en: "Top rated" },
};

export function SupplierCard({ supplier, compact }: { supplier: SupplierLike; compact?: boolean }) {
  const { d, t, n } = useI18n();
  const model = toCardModel(supplier);
  if (!model) return null;

  return (
    <Link
      to={`/supplier/${model.id}`}
      className={cx(
        "flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-border-strong hover:shadow-[var(--shadow-raised)]",
        compact ? "w-72 shrink-0" : "",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{model.logo}</span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-extrabold text-foreground">{model.name ? t(model.name) : model.id}</h3>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {model.city} · {model.countryCode}
          </p>
        </div>
      </div>

      {model.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t(model.description)}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <VerificationBadge status={model.verification} />
        {model.badges.filter((b) => b !== "verified").slice(0, 2).map((b) => (
          <Badge key={b} tone="accent">{badgeLabels[b] ? t(badgeLabels[b]) : b}</Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
        <div>
          <Rating value={model.rating} />
          <div className="mt-0.5 text-[10px] text-muted-foreground">{t(d.supplier.rating)}</div>
        </div>
        <div>
          <div className="num inline-flex items-center gap-1 text-xs font-extrabold text-foreground">
            <PackageCheck className="h-3.5 w-3.5 text-success" />
            {Math.round(model.onTimeRate * 100)}%
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{t(d.supplier.onTime)}</div>
        </div>
        <div>
          <div className="num inline-flex items-center gap-1 text-xs font-extrabold text-foreground">
            <Clock className="h-3.5 w-3.5 text-accent" />
            {n(Math.round(model.responseHours))}h
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{t(d.supplier.responseTime)}</div>
        </div>
      </div>
    </Link>
  );
}
