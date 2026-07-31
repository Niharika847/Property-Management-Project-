/** Client-side email checks used at sign-up.
 *
 *  These catch typos and obvious throwaways early — the real proof that an
 *  address exists and belongs to the person is the confirmation email, which
 *  Supabase requires before the account can sign in. */

// Deliberately stricter than the browser default: requires a dot-separated TLD
// of at least two letters and disallows consecutive/leading/trailing dots.
const SHAPE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Common disposable/temporary inbox providers — these defeat the point of
 *  verifying an address, so we ask for a real one up front. */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc",
  "fakeinbox.com", "mailnesia.com", "spamgourmet.com", "moakt.com",
  "emailondeck.com", "tempr.email", "mohmal.com", "burnermail.io",
]);

/** Domains that are never real inboxes. */
const PLACEHOLDER = new Set(["example.com", "example.org", "example.net", "test.com", "email.com", "domain.com"]);

/** Near-misses of popular providers, mapped to what was almost certainly meant. */
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gnail.com": "gmail.com", "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.co": "outlook.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "icloud.co": "icloud.com", "iclould.com": "icloud.com",
  "bigpon.com.au": "bigpond.com.au", "bigpond.com": "bigpond.com.au",
};

export interface EmailCheck {
  ok: boolean;
  /** Blocking problem to show the user. */
  error?: string;
  /** A corrected address to offer, e.g. after a domain typo. */
  suggestion?: string;
}

export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();

  if (!email) return { ok: false, error: "Enter your email address." };
  if (/\s/.test(email)) return { ok: false, error: "Email addresses can't contain spaces." };
  if (!email.includes("@")) return { ok: false, error: "That doesn't look like an email address — it needs an @." };
  if ((email.match(/@/g) ?? []).length > 1) return { ok: false, error: "An email address can only contain one @." };
  if (!SHAPE.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email address. Check for typos." };
  }

  const domain = email.split("@")[1];

  if (TYPOS[domain]) {
    return {
      ok: false,
      error: `Did you mean ${email.split("@")[0]}@${TYPOS[domain]}?`,
      suggestion: `${email.split("@")[0]}@${TYPOS[domain]}`,
    };
  }
  if (PLACEHOLDER.has(domain)) {
    return { ok: false, error: "Please use a real email address — you'll need it to confirm your account." };
  }
  if (DISPOSABLE.has(domain)) {
    return { ok: false, error: "Temporary email addresses aren't supported. Please use a permanent address." };
  }

  return { ok: true };
}
