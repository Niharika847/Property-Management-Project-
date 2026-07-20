export interface Property {
  id: string;
  workspace_id: string;
  address: string;
  suburb: string;
  state: string | null;
  postcode: string | null;
  status: "rental" | "owner_occupied" | "vacant" | "under_construction" | "sold";
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  current_value: number | null;
  valued_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Lease {
  id: string;
  property_id: string;
  tenant_id: string | null;
  rent_amount: number;
  frequency: "weekly" | "fortnightly" | "monthly";
  start_date: string;
  end_date: string | null;
  bond_amount: number | null;
  status: "active" | "ended";
  tenants?: { full_name: string } | null;
}

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income";
  tax_deductible_default: boolean;
  is_capital: boolean;
}

export interface Expense {
  id: string;
  property_id: string | null;
  date: string;
  amount: number;
  gst_amount: number;
  category_id: string;
  vendor: string | null;
  description: string;
  payment_status: "paid" | "unpaid" | "scheduled";
  is_tax_deductible: boolean;
  notes: string | null;
  categories?: { name: string } | null;
  properties?: { address: string } | null;
}

export interface RentCharge {
  id: string;
  lease_id: string;
  due_date: string;
  amount: number;
  status: "expected" | "paid" | "waived";
  paid_amount: number | null;
  leases?: {
    property_id: string;
    frequency: string;
    properties?: { address: string } | null;
    tenants?: { full_name: string } | null;
  } | null;
}

export interface DocumentRow {
  id: string;
  file_name: string;
  type: string;
  ocr_status: "pending" | "processing" | "done" | "failed";
  extracted: {
    vendor?: string | null;
    amount?: number | null;
    date?: string | null;
    confidence?: number | null;
  } | null;
  expense_id: string | null;
  created_at: string;
  properties?: { address: string } | null;
}

export interface Income {
  id: string;
  property_id: string;
  type: "rent" | "other";
  date: string;
  amount: number;
  description: string | null;
  properties?: { address: string } | null;
}
