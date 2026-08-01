/** Paging maths for list pages. Kept separate from the queries so the
 *  off-by-one risks (page clamping, range bounds, "showing X–Y of Z") are
 *  covered by tests rather than discovered in production. */

export interface PageInfo {
  /** 1-based, clamped into range. */
  page: number;
  pageCount: number;
  /** Inclusive row indexes for a Supabase `.range()` call. */
  from: number;
  to: number;
}

/** Parses an untrusted `?page=` value. Anything nonsensical falls back to 1. */
export function parsePage(raw: string | undefined | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function pageInfo(page: number, pageSize: number, totalCount: number): PageInfo {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const from = (clamped - 1) * pageSize;
  return { page: clamped, pageCount, from, to: from + pageSize - 1 };
}

/** Human range for "Showing 51–100 of 237". `rowsOnPage` is what actually came
 *  back, so a short final page reads correctly. */
export function pageRangeLabel(page: number, pageSize: number, rowsOnPage: number) {
  if (rowsOnPage === 0) return { first: 0, last: 0 };
  const first = (page - 1) * pageSize + 1;
  return { first, last: first + rowsOnPage - 1 };
}
