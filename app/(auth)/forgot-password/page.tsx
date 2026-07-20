"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(String(form.get("email")), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          If an account exists for that address, a reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted hover:text-ink">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
