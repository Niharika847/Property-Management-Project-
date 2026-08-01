import { log } from "@/lib/logger";
import { NextResponse } from "next/server";

/** Receives render errors from the browser so client-side crashes land in the
 *  same place as server ones. Deliberately unauthenticated — an error boundary
 *  fires precisely when the session may be broken — so everything is treated as
 *  untrusted: fields are length-capped and nothing is echoed back. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : undefined;

    log.error("client.render_error", str(body?.message, 500) ?? "unknown client error", {
      digest: str(body?.digest, 100),
      route: str(body?.route, 200),
    });
  } catch {
    // A malformed report is not worth a 500 — the client cannot act on it.
  }
  return new NextResponse(null, { status: 204 });
}
