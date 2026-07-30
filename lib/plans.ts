/** Plan definitions. `properties: null` means unlimited. */
export interface Plan {
  key: string;
  label: string;
  price: string;
  properties: number | null;
}

export const PLANS: Record<string, Plan> = {
  free: { key: "free", label: "Free", price: "$0", properties: 1 },
  pro: { key: "pro", label: "Pro", price: "$19/mo", properties: 5 },
  portfolio: { key: "portfolio", label: "Portfolio", price: "$49/mo", properties: null },
  agency: { key: "agency", label: "Agency", price: "$129/mo", properties: null },
};

export const planFor = (key: string | null | undefined): Plan => PLANS[key ?? "free"] ?? PLANS.free;

/** Existing accounts that already exceed a limit keep what they have — the cap
 *  only blocks adding more, so nobody's data is stranded by a pricing change. */
export function propertyLimitMessage(plan: Plan, current: number): string | null {
  if (plan.properties == null || current < plan.properties) return null;
  return `Your ${plan.label} plan includes ${plan.properties} propert${
    plan.properties === 1 ? "y" : "ies"
  } and you have ${current}. Upgrade in Settings to add more.`;
}
