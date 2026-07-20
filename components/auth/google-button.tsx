"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function GoogleButton() {
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) setError("Google sign-in isn't enabled yet — use email below.");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={signIn} className="w-full">
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
