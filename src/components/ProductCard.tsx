import { Heart, Package, Timer } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { catalog, favorites } from "../platform/api";
import { unitLabel } from "../platform/pricing";
import { Badge, Rating, cx } from "../ui";
import type { Product } from "../platform/types";

/** Deterministic tile art — the same product always gets the same gradient. */
export function ProductThumb({ product, className }: { product: Product; className?: string }) {
  // Multiply before wrapping: consecutive ids otherwise land on adjacent hues
  // and the whole grid comes out one colour.
  const hue = ([...product.id].reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;
  return (
    <div
      className={cx("flex items-center justify-center overflow-hidden rounded-xl", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 94%), hsl(${(hue + 40) % 360} 70% 88%))` }}
      role="img"
      aria-label={product.imageAlt.en}
    >
      <span className="select-none text-[2.75em] leading-none">{product.image}</span>
    </div>
  );
}

export function AvailabilityBadge({ product }: { product: Product }) {
  const { d, t } = useI18n();
  const tone = { in_stock: "success", low_stock: "warning", made_to_order: "info", out_of_stock: "danger" } as const;
  return <Badge tone={tone[product.availability]}>{t(d.product.availability[product.availability])}</Badge>;
}

export function ProductCard({ product, compact }: { product: Product; compact?: boolean }) {
  const { d, t, money, n } = useI18n();
  const supplierName = catalog.supplierCompany(product.supplierId)?.name;
  const isFavorite = favorites.has(product.id);

  return (
    <div className={cx("group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-border-strong hover:shadow-[var(--shadow-raised)]", compact ? "w-56 shrink-0" : "")}>
      <button
        type="button"
        onClick={() => favorites.toggle(product.id)}
        aria-label="favourite"
        className="absolute end-3 top-3 z-10 cursor-pointer rounded-lg bg-card/90 p-1.5 backdrop-blur transition-colors hover:bg-card"
      >
        <Heart className={cx("h-4 w-4", isFavorite ? "fill-danger text-danger" : "text-muted-foreground")} />
      </button>

      <Link to={`/product/${product.id}`} className="block p-3">
        <ProductThumb product={product} className="aspect-4/3 w-full text-4xl" />
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <Link to={`/product/${product.id}`} className="line-clamp-2 text-sm font-bold leading-snug text-foreground hover:text-accent">
          {t(product.name)}
        </Link>

        <Link to={`/supplier/${product.supplierId}`} className="mt-1.5 line-clamp-1 text-[11px] font-semibold text-muted-foreground hover:text-accent">
          {supplierName ? t(supplierName) : product.supplierId}
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <Rating value={product.rating} count={product.reviewCount} />
          <AvailabilityBadge product={product} />
        </div>

        <div className="mt-auto pt-3">
          <div className="num text-lg font-extrabold text-foreground">{money(product.tiers[0].price)}</div>
          <div className="text-[11px] text-muted-foreground">
            <span className="num">{unitLabel(product.unit, "en") && t(d.common.perUnit)}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {t(d.product.moq)} <span className="num">{n(product.moq)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              <span className="num">{n(product.leadTimeDays)}</span> {t(d.product.days)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
