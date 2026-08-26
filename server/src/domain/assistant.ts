import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { companies, priceTiers, products, suppliers } from "../db/schema.ts";
import { i18n, num } from "../lib/serialize.ts";
import { unitPriceFor } from "./pricing.ts";
import type { ParsedQuery } from "./nlu.ts";
import type { Database } from "../db/client.ts";

/**
 * Supplier matching for the assistant.
 *
 * Every match carries the reasons it ranked where it did. An opaque score is
 * not actionable: a buyer needs to see that an option lost on lead time
 * rather than price before they can decide to override it.
 */

export interface MatchReason {
  ar: string;
  en: string;
}

export interface SupplierMatch {
  productId: string;
  supplierId: string;
  supplierName: { ar: string; en: string };
  supplierLogo: string;
  name: { ar: string; en: string };
  image: string;
  unitPrice: number;
  lineTotal: number;
  leadTimeDays: number;
  moq: number;
  availability: "in_stock" | "low_stock" | "made_to_order" | "out_of_stock";
  rating: number;
  verified: boolean;
  meetsBudget: boolean;
  meetsDeadline: boolean;
  meetsMoq: boolean;
  matchScore: number;
  reasons: MatchReason[];
}

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

/** Same Arabic folding the catalogue search uses, so both agree on a match. */
export const fold = (s: string) =>
  s.toLowerCase().replace(/[ً-ْٰ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();

/**
 * Arabic glues the article and common prepositions onto the noun, so a buyer
 * who types "الأرز" would never match a listing named "أرز". Search both the
 * word as typed and the word with its prefix removed.
 */
const prefixes = ["وبال", "فبال", "بال", "وال", "فال", "كال", "لل", "ال", "ل", "ب", "و", "ف", "ك"];

export function variantsOf(term: string): string[] {
  const stripped = prefixes.find((pre) => term.startsWith(pre) && term.length - pre.length >= 3);
  return stripped ? [term, term.slice(stripped.length)] : [term];
}

export async function matchSuppliers(
  db: Database,
  parsed: ParsedQuery,
  limit = 5,
): Promise<SupplierMatch[]> {
  const terms = parsed.keywords.map(fold).filter((t) => t.length > 1);

  const filters: SQL[] = [eq(products.isActive, true)];
  if (terms.length) {
    // Every term must appear somewhere, but any of its spellings will do.
    const like = terms.map((t) =>
      or(
        ...variantsOf(t).flatMap((v) => [
          sql`waw_fold(${products.nameAr}) LIKE ${"%" + v + "%"}`,
          sql`waw_fold(${products.nameEn}) LIKE ${"%" + v + "%"}`,
          sql`waw_fold(${products.brand}) LIKE ${"%" + v + "%"}`,
        ]),
      ),
    );
    filters.push(and(...like)!);
  }
  // Origin country is a ranking signal, not a filter: a foreign supplier
  // that beats every local one on price and lead time still belongs in the list.

  const rows = await db
    .select({
      product: products,
      supplierNameAr: companies.nameAr,
      supplierNameEn: companies.nameEn,
      supplierLogo: companies.logo,
      verification: companies.verification,
      rating: suppliers.rating,
      onTimeRate: suppliers.onTimeRate,
    })
    .from(products)
    .innerJoin(suppliers, eq(suppliers.id, products.supplierId))
    .innerJoin(companies, eq(companies.id, suppliers.id))
    .where(and(...filters))
    .limit(60);

  if (!rows.length) return [];

  const tiers = await db
    .select({ productId: priceTiers.productId, minQty: priceTiers.minQty, price: priceTiers.price })
    .from(priceTiers)
    .where(inArray(priceTiers.productId, rows.map((r) => r.product.id)));

  const matches = rows.map((row) => {
    const p = row.product;
    const productTiers = tiers
      .filter((t) => t.productId === p.id)
      .map((t) => ({ minQty: t.minQty, price: num(t.price) }));
    if (!productTiers.length) return null;

    const effectiveQty = Math.max(parsed.qty ?? p.moq, p.moq);
    const unitPrice = unitPriceFor(productTiers, effectiveQty);
    const supplierRating = num(row.rating);
    const verified = row.verification === "verified";

    const meetsMoq = parsed.qty == null || parsed.qty >= p.moq;
    const meetsDeadline = parsed.withinDays == null || p.leadTimeDays <= parsed.withinDays;
    const meetsBudget = parsed.budget == null || unitPrice <= parsed.budget;

    const reasons: MatchReason[] = [];
    // The absolute signals only take a match to about 90; the last stretch is
    // earned against the rest of the shortlist, in the relative pass below.
    // Without that, every credible supplier pins at 100 and the score stops
    // telling the buyer anything.
    let score = 30;

    if (parsed.budget != null) {
      if (meetsBudget) {
        score += 12;
        reasons.push({
          ar: `السعر ${fmt(unitPrice)} ريال ضمن ميزانيتك`,
          en: `Unit price ${fmt(unitPrice)} SAR fits your budget`,
        });
      } else {
        score -= 24;
        reasons.push({
          ar: `أعلى من ميزانيتك بـ ${fmt(unitPrice - parsed.budget)} ريال`,
          en: `${fmt(unitPrice - parsed.budget)} SAR above your budget`,
        });
      }
    }

    if (parsed.withinDays != null) {
      if (meetsDeadline) {
        score += 12;
        reasons.push({
          ar: `التجهيز ${p.leadTimeDays} أيام — ضمن الموعد المطلوب`,
          en: `${p.leadTimeDays}-day lead time meets your deadline`,
        });
      } else {
        score -= 22;
        reasons.push({
          ar: `يحتاج ${p.leadTimeDays} أيام — يتجاوز موعدك`,
          en: `Needs ${p.leadTimeDays} days — misses your deadline`,
        });
      }
    }

    if (!meetsMoq) {
      score -= 12;
      reasons.push({
        ar: `الحد الأدنى للطلب ${fmt(p.moq)} وحدة`,
        en: `Minimum order is ${fmt(p.moq)} units`,
      });
    }

    if (parsed.countryCode && p.originCountry === parsed.countryCode) {
      score += 6;
      reasons.push({ ar: "مورد محلي — شحن أسرع وأرخص", en: "Domestic supplier — faster, cheaper freight" });
    }

    if (verified) {
      score += 6;
      if (parsed.wantsVerified) score += 4;
      reasons.push({ ar: "شركة موثّقة على المنصة", en: "Verified company on the platform" });
    }

    if (p.availability === "in_stock") {
      score += 4;
      reasons.push({ ar: "متوفر في المخزون الآن", en: "In stock right now" });
    } else if (p.availability === "out_of_stock") {
      score -= 25;
    }

    // Ratings cluster in a narrow band, so score the distance above a floor
    // rather than the raw value — otherwise every supplier scores the same.
    score += Math.max(0, supplierRating - 3) * 5;
    score += Math.max(0, num(row.onTimeRate) - 0.8) * 50;

    return {
      productId: p.id,
      supplierId: p.supplierId,
      supplierName: i18n(row.supplierNameAr, row.supplierNameEn),
      supplierLogo: row.supplierLogo,
      name: i18n(p.nameAr, p.nameEn),
      image: p.image,
      unitPrice,
      lineTotal: Math.round(unitPrice * effectiveQty * 100) / 100,
      leadTimeDays: p.leadTimeDays,
      moq: p.moq,
      availability: p.availability,
      rating: supplierRating,
      verified,
      meetsBudget,
      meetsDeadline,
      meetsMoq,
      matchScore: Math.max(0, Math.min(100, Math.round(score))),
      reasons: reasons.slice(0, 3),
    } satisfies SupplierMatch;
  });

  const found = matches.filter((m): m is SupplierMatch => m !== null);

  // Price is always relative: "8.04 SAR" means nothing until you see what the
  // alternatives charge. Lead time only becomes a ranking signal when the
  // buyer asked for speed — otherwise meeting the stated deadline is enough.
  const prices = found.map((m) => m.unitPrice);
  const leads = found.map((m) => m.leadTimeDays);
  const cheapest = Math.min(...prices);
  const fastest = Math.min(...leads);
  const rank = (values: number[], v: number) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return hi === lo ? 1 : 1 - (v - lo) / (hi - lo);
  };

  for (const m of found) {
    m.matchScore += Math.round(rank(prices, m.unitPrice) * (parsed.wantsCheapest ? 24 : 12));
    if (m.unitPrice === cheapest && found.length > 1) {
      m.reasons.unshift({ ar: "أقل سعر بين العروض المطابقة", en: "Lowest price among the matches" });
    }
    if (parsed.wantsFastest) {
      m.matchScore += Math.round(rank(leads, m.leadTimeDays) * 12);
      if (m.leadTimeDays === fastest && found.length > 1) {
        m.reasons.unshift({ ar: "أسرع تجهيز بين العروض المطابقة", en: "Fastest lead time among the matches" });
      }
    }
    m.matchScore = Math.max(0, Math.min(100, m.matchScore));
    m.reasons = m.reasons.slice(0, 3);
  }

  // Keep the best offer per supplier so one vendor cannot fill the whole list.
  const bestPerSupplier = new Map<string, SupplierMatch>();
  for (const m of found) {
    const existing = bestPerSupplier.get(m.supplierId);
    if (!existing || m.matchScore > existing.matchScore) bestPerSupplier.set(m.supplierId, m);
  }

  return [...bestPerSupplier.values()].sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}
