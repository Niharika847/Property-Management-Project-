"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthSection } from "@/components/auth/oauth-section";
import { checkEmail } from "@/lib/email-validation";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuggestion(null);

    const form = new FormData(e.currentTarget);
    const cleanEmail = email.trim().toLowerCase();

    const verdict = checkEmail(cleanEmail);
    if (!verdict.ok) {
      setError(verdict.error ?? "Enter a valid email address.");
      setSuggestion(verdict.suggestion ?? null);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: String(form.get("password")),
      options: {
        data: { full_name: String(form.get("full_name") ?? "").trim() },
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("already registered")
          ? "That email already has an account — log in instead, or reset your password."
          : error.message
      );
      return;
    }

    // Confirmation is required, so there is no session until the link is clicked.
    if (!data.session) {
      setSentTo(cleanEmail);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function resend() {
    if (!sentTo) return;
    setResent(false);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
    setResent(true);
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink">Confirm your email</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <span className="font-medium text-ink">{sentTo}</span>.
          Click it to finish creating your account — you can&apos;t sign in until you do.
        </p>
        <p className="mt-3 text-xs text-muted">
          Nothing yet? Check your spam folder, then try again.
        </p>
        <button
          type="button"
          onClick={resend}
          className="mt-3 text-sm font-medium text-brand hover:underline"
        >
          {resent ? "Sent again — check your inbox" : "Resend confirmation email"}
        </button>
        <p className="mt-5 text-sm text-muted">
          <Link href="/login" className="hover:text-ink">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OAuthSection />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Full name" name="full_name" autoComplete="name" required />
        <div>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
              setSuggestion(null);
            }}
            required
          />
          <p className="mt-1 text-xs text-muted">
            We&apos;ll send a confirmation link, so use an address you can open.
          </p>
        </div>
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
        {error && (
          <div className="text-sm text-danger">
            {error}
            {suggestion && (
              <button
                type="button"
                onClick={() => {
                  setEmail(suggestion);
                  setError(null);
                  setSuggestion(null);
                }}
                className="ml-2 font-semibold underline"
              >
                Use it
              </button>
            )}
          </div>
        )}
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
