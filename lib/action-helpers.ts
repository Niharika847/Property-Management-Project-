import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const fail = (error: string): ActionResult => ({ ok: false, error });
export const ok = (): ActionResult => ({ ok: true });

/** Supabase client + workspace for the signed-in user, or null if signed out. */
export async function actionContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const workspace = await ensureWorkspace(supabase, user);
  if (!workspace) return null;
  return { supabase, workspace, user };
}

export const str = (form: FormData, key: string): string =>
  String(form.get(key) ?? "").trim();

export const num = (form: FormData, key: string): number | null => {
  const raw = String(form.get(key) ?? "").replace(/[,$\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
