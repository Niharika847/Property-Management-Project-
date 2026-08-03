import { addressDetail, searchAddresses } from "@/lib/address";
import { lookupPropertyAttributes, propertyDataConfigured } from "@/lib/property-data";
import { log } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Address lookup proxy.
 *
 *  Server-side so the provider key never reaches the browser, and behind auth
 *  so the app's quota cannot be burned by anyone who finds the URL. */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const id = url.searchParams.get("id");

  try {
    // Detail mode: a suggestion was picked, so resolve it to form fields and,
    // if a property data provider is configured, its attributes too.
    if (id) {
      const detail = await addressDetail(id);
      if (!detail) return NextResponse.json({ error: "Address not found" }, { status: 404 });
      const attributes = await lookupPropertyAttributes(detail);
      return NextResponse.json({
        detail,
        attributes,
        attributesAvailable: propertyDataConfigured(),
      });
    }

    return NextResponse.json({ suggestions: await searchAddresses(query) });
  } catch (e) {
    log.error("address.lookup_failed", e, { route: "/api/address" });
    // Typing an address by hand still has to work when the provider is down.
    return NextResponse.json({ suggestions: [], error: "Address lookup unavailable" }, { status: 200 });
  }
}
