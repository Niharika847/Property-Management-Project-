"use client";

import { useEffect, useState } from "react";
import { GoogleButton } from "./google-button";

/** Renders the social sign-in block plus its "or" divider only when at least
 *  one provider is actually enabled, so the auth screens never show a dangling
 *  separator above an empty space. */
export function OAuthSection() {
  const [anyEnabled, setAnyEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setAnyEnabled(Boolean(d?.external?.google));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!anyEnabled) return null;

  return (
    <>
      <GoogleButton />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
