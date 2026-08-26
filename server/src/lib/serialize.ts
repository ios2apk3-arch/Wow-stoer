/**
 * Postgres returns NUMERIC as a string to preserve precision. The API speaks
 * JSON numbers, so conversion happens once, here, on the way out.
 */
export const num = (v: string | number | null | undefined, fallback = 0): number =>
  v === null || v === undefined ? fallback : typeof v === "number" ? v : Number(v);

export const i18n = (ar: string, en: string) => ({ ar, en });

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export function paged<T>(items: T[], total: number, page: number, perPage: number): Page<T> {
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}
