/** Client-safe role constants. Kept separate from lib/workspace.ts, which
 *  imports next/headers and must never reach the browser bundle. */

export type Role = "owner" | "manager" | "accountant" | "viewer";

export const WORKSPACE_COOKIE = "roost-workspace";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  viewer: "Viewer",
};

export const ROLE_BLURB: Record<Role, string> = {
  owner: "Full access, including team and billing.",
  manager: "Can add and edit properties, rent and expenses.",
  accountant: "Read-only access to everything, ideal for tax time.",
  viewer: "Read-only access.",
};
