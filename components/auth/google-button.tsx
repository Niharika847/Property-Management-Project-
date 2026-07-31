"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

/** "Continue with Google" only renders once we know the provider is actually
 *  enabled on the Supabase project. Otherwise clicking it dead-ends with
 *  "provider is not enabled", which looks like the app is broken. */
export function GoogleButton() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setEnabled(false);
      return;
    }
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setEnabled(Boolean(d?.external?.google));
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) {
      setBusy(false);
      setError(
        error.message.toLowerCase().includes("not enabled")
          ? "Google sign-in isn't switched on for this app yet — use your email below."
          : error.message
      );
    }
    // On success the browser is redirected to Google, so nothing to do here.
  }

  // Unknown or unavailable: render nothing rather than a button that fails.
  if (enabled !== true) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={signIn} loading={busy} className="w-full">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            fill="currentColor"
            d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a5.9 5.9 0 1 1 0-11.8c1.5 0 2.85.55 3.9 1.45l2.15-2.15A8.9 8.9 0 1 0 12 20.9c5.15 0 8.9-3.6 8.9-8.9 0-.3-.02-.6-.05-.9Z"
          />
        </svg>
        Continue with Google
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
