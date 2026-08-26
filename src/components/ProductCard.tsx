import { Heart, Package, Timer } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { catalog } from "../platform/api";
import { unitLabel } from "../platform/pricing";
import { useFavorites } from "../platform/remote/useFavorites";
import { Badge, Rating, cx } from "../ui";
import type { Availability, I18nText, Product, Unit } from "../platform/types";
import type { RemoteProduct } from "../platform/remote/endpoints";

/**
 * The card renders either a locally seeded product or one from the API.
 * Pages are migrating one at a time, so it accepts both and normalises here
 * rather than forcing a big-bang switch.
 */
export type ProductLike = Product | RemoteProduct;

interface CardModel {
  id: string;
  name: I18nText;
  imageAlt: I18nText;
  image: string;
  supplierId: string;
  supplierName: I18nText | null;
  availability: Availability;
  rating: number;
  reviewCount: number;
  moq: number;
  leadTimeDays: number;
  unit: Unit;
  entryPrice: number;
}

const isRemote = (p: ProductLike): p is RemoteProduct => "supplier" in p;

export function toCardModel(product: ProductLike): CardModel {
  const tiers = [...product.tiers].sort((a, b) => a.minQty - b.minQty);
  return {
    id: product.id,
    name: product.name,
    imageAlt: isRemote(product) ? product.name : product.imageAlt,
    image: product.image,
    supplierId: product.supplierId,
    supplierName: isRemote(product)
      ? product.supplier.name
      : catalog.supplierCompany(product.supplierId)?.name ?? null,
    availability: product.availability,
    rating: product.rating,
    reviewCount: product.reviewCount,
    moq: product.moq,
    leadTimeDays: product.leadTimeDays,
    unit: product.unit,
    entryPrice: isRemote(product) ? product.entryPrice : tiers[0]?.price ?? 0,
  };
}

/** Deterministic tile art — the same product always gets the same gradient. */
export function ProductThumb({ product, className }: { product: ProductLike; className?: string }) {
  const model = toCardModel(product);
  // Multiply before wrapping: consecutive ids otherwise land on adjacent hues
  // and the whole grid comes out one colour.
  const hue = ([...model.id].reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;
  return (
    <div
      className={cx("flex items-center justify-center overflow-hidden rounded-xl", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 94%), hsl(${(hue + 40) % 360} 70% 88%))` }}
      role="img"
      aria-label={model.imageAlt.en}
    >
      <span className="select-none text-[2.75em] leading-none">{model.image}</span>
    </div>
  );
}

export function AvailabilityBadge({ product }: { product: ProductLike }) {
  const { d, t } = useI18n();
  const tone = { in_stock: "success", low_stock: "warning", made_to_order: "info", out_of_stock: "danger" } as const;
  return <Badge tone={tone[product.availability]}>{t(d.product.availability[product.availability])}</Badge>;
}

export function ProductCard({ product, compact }: { product: ProductLike; compact?: boolean }) {
  const { d, t, money, n } = useI18n();
  const model = toCardModel(product);
  const { isFavorite, toggle } = useFavorites();

  return (
    <div className={cx("group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-border-strong hover:shadow-[var(--shadow-raised)]", compact ? "w-56 shrink-0" : "")}>
      <button
        type="button"
        onClick={() => void toggle(model.id)}
        aria-label="favourite"
        className="absolute end-3 top-3 z-10 cursor-pointer rounded-lg bg-card/90 p-1.5 backdrop-blur transition-colors hover:bg-card"
      >
        <Heart className={cx("h-4 w-4", isFavorite(model.id) ? "fill-danger text-danger" : "text-muted-foreground")} />
      </button>

      <Link to={`/product/${model.id}`} className="block p-3">
        <ProductThumb product={product} className="aspect-4/3 w-full text-4xl" />
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <Link to={`/product/${model.id}`} className="line-clamp-2 text-sm font-bold leading-snug text-foreground hover:text-accent">
          {t(model.name)}
        </Link>

        <Link to={`/supplier/${model.supplierId}`} className="mt-1.5 line-clamp-1 text-[11px] font-semibold text-muted-foreground hover:text-accent">
          {model.supplierName ? t(model.supplierName) : model.supplierId}
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <Rating value={model.rating} count={model.reviewCount} />
          <AvailabilityBadge product={product} />
        </div>

        <div className="mt-auto pt-3">
          <div className="num text-lg font-extrabold text-foreground">{money(model.entryPrice)}</div>
          <div className="text-[11px] text-muted-foreground">{t(d.common.perUnit)}</div>

          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {t(d.product.moq)} <span className="num">{n(model.moq)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              <span className="num">{n(model.leadTimeDays)}</span> {t(d.product.days)}
            </span>
            <span className="text-[10px]">{unitLabel(model.unit, "en")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
