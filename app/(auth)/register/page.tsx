"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/auth/google-button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setError(
        error.message.includes("already registered")
          ? "That email already has an account — log in instead, or reset your password."
          : error.message
      );
      setLoading(false);
      return;
    }
    // If email confirmation is enabled there's no session yet.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to your inbox. Click it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GoogleButton />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Full name" name="full_name" autoComplete="name" placeholder="Niharika Singh" required />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
