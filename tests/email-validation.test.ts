import { describe, expect, it } from "vitest";
import { checkEmail } from "@/lib/email-validation";

describe("checkEmail — accepts real addresses", () => {
  const valid = [
    "niharika.singh04@outlook.com",
    "a@b.co",
    "first.last+tag@sub.domain.com.au",
    "user_name-123@bigpond.com.au",
    "  Mixed.Case@Gmail.COM  ", // trimmed and lower-cased before checking
  ];

  for (const email of valid) {
    it(`accepts ${email.trim()}`, () => {
      expect(checkEmail(email).ok).toBe(true);
    });
  }
});

describe("checkEmail — rejects malformed addresses", () => {
  const invalid: [string, string][] = [
    ["", "empty"],
    ["   ", "whitespace only"],
    ["niharika", "no @"],
    ["a@b@c.com", "two @"],
    ["no space@gmail.com", "contains a space"],
    ["@gmail.com", "no local part"],
    ["user@", "no domain"],
    ["user@gmail", "no TLD"],
    ["user@gmail.c", "one-letter TLD"],
    ["user@.gmail.com", "leading dot in domain"],
    ["user@gmail..com", "consecutive dots"],
    [".user@gmail.com", "leading dot in local part"],
    ["user.@gmail.com", "trailing dot in local part"],
  ];

  for (const [email, why] of invalid) {
    it(`rejects "${email}" (${why})`, () => {
      const result = checkEmail(email);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  }
});

describe("checkEmail — typo correction", () => {
  it("suggests the intended domain and preserves the local part", () => {
    const result = checkEmail("niharika@gmial.com");
    expect(result.ok).toBe(false);
    expect(result.suggestion).toBe("niharika@gmail.com");
  });

  it("catches a .con slip", () => {
    expect(checkEmail("someone@gmail.con").suggestion).toBe("someone@gmail.com");
  });

  it("corrects Australian bigpond addresses", () => {
    expect(checkEmail("someone@bigpond.com").suggestion).toBe("someone@bigpond.com.au");
  });

  it("every suggestion it offers is itself a valid address", () => {
    for (const email of ["a@gmial.com", "b@outlok.com", "c@yaho.com", "d@iclould.com"]) {
      const suggestion = checkEmail(email).suggestion;
      expect(suggestion).toBeTruthy();
      expect(checkEmail(suggestion!).ok).toBe(true);
    }
  });
});

describe("checkEmail — throwaway and placeholder domains", () => {
  it("rejects disposable inboxes", () => {
    expect(checkEmail("someone@mailinator.com").ok).toBe(false);
    expect(checkEmail("someone@yopmail.com").ok).toBe(false);
  });

  it("rejects placeholder domains", () => {
    expect(checkEmail("someone@example.com").ok).toBe(false);
    expect(checkEmail("someone@test.com").ok).toBe(false);
  });

  it("does not offer a suggestion it would reject anyway", () => {
    const result = checkEmail("someone@example.com");
    expect(result.suggestion).toBeUndefined();
  });
});
