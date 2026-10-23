export function parseLimit(raw: unknown, fallback = 10, max = 50): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

export function parsePage(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), 10_000);
}

export interface PageMeta {
  page: number;
  limit: number;
  hasMore: boolean;
}

export function buildPageMeta(page: number, limit: number, returned: number, total?: number): PageMeta & { total?: number } {
  return {
    page,
    limit,
    hasMore: total !== undefined ? page * limit < total : returned === limit,
    ...(total !== undefined ? { total } : {}),
  };
}
