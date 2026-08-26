import { BadgeCheck, Clock, MapPin, PackageCheck } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { catalog } from "../platform/api";
import { Badge, Rating, cx } from "../ui";
import type { Supplier } from "../platform/types";

export function VerificationBadge({ status }: { status: "verified" | "pending" | "unverified" | "rejected" }) {
  const { d, t } = useI18n();
  const tone = { verified: "success", pending: "warning", unverified: "neutral", rejected: "danger" } as const;
  return (
    <Badge tone={tone[status]}>
      {status === "verified" && <BadgeCheck className="h-3 w-3" />}
      {t(d.supplier[status])}
    </Badge>
  );
}

export function SupplierCard({ supplier, compact }: { supplier: Supplier; compact?: boolean }) {
  const { d, t, n } = useI18n();
  const company = catalog.supplierCompany(supplier.id);
  if (!company) return null;
  const productCount = catalog.products().filter((p) => p.supplierId === supplier.id).length;

  return (
    <Link
      to={`/supplier/${supplier.id}`}
      className={cx(
        "flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-border-strong hover:shadow-[var(--shadow-raised)]",
        compact ? "w-72 shrink-0" : "",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{company.logo}</span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-extrabold text-foreground">{t(company.name)}</h3>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {company.city} · {company.countryCode}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t(company.description)}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <VerificationBadge status={company.verification} />
        {supplier.badges.filter((b) => b !== "verified").slice(0, 2).map((b) => (
          <Badge key={b} tone="accent">{t(d.supplier.badge[b])}</Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
        <div>
          <Rating value={supplier.rating} />
          <div className="mt-0.5 text-[10px] text-muted-foreground">{t(d.supplier.rating)}</div>
        </div>
        <div>
          <div className="num inline-flex items-center gap-1 text-xs font-extrabold text-foreground">
            <PackageCheck className="h-3.5 w-3.5 text-success" />
            {Math.round(supplier.onTimeRate * 100)}%
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{t(d.supplier.onTime)}</div>
        </div>
        <div>
          <div className="num inline-flex items-center gap-1 text-xs font-extrabold text-foreground">
            <Clock className="h-3.5 w-3.5 text-accent" />
            {n(supplier.responseHours)}h
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{t(d.supplier.responseTime)}</div>
        </div>
      </div>

      <div className="num mt-3 text-[11px] font-semibold text-accent">
        {n(productCount)} {t(d.supplier.products)}
      </div>
    </Link>
  );
}
